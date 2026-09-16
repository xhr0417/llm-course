"""Serving benchmark：对任何 OpenAI-compatible 端点测 TTFT / TPOT / 吞吐。

用法（需要先跑起服务端，vLLM 命令见 docs/vllm_runbook.md）：
    python scripts/run_serving_bench.py --base-url http://localhost:8000 \
        --model Qwen/Qwen2.5-0.5B-Instruct --concurrency 1 8 32 --num-prompts 24

    # 无真实服务端时的自检（本地 mock，验证客户端与指标计算）：
    python scripts/run_serving_bench.py --mock
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from ibench.serving_bench import bench_serving, to_dict  # noqa: E402

logger = logging.getLogger("serving_bench")

PROMPTS = [
    "用一句话解释什么是 KV Cache。",
    "用一句话解释什么是 TTFT。",
    "用一句话解释什么是 continuous batching。",
    "用一句话解释什么是 PagedAttention。",
]


async def run_mock() -> list[dict]:
    """本地 mock 服务端：真实 HTTP + SSE 流，验证客户端计时逻辑。"""
    import json as _json
    import threading
    import time
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            _ = self.rfile.read(length)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for i in range(12):
                chunk = {"choices": [{"delta": {"content": f"tok{i} "}}]}
                self.wfile.write(("data: " + _json.dumps(chunk) + "\n\n").encode())
                self.wfile.flush()
                time.sleep(0.02)   # 模拟 20ms/token 的 decode
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    rows = []
    for concurrency in (1, 4):
        result = await bench_serving(base_url, "mock", PROMPTS * 4, concurrency=concurrency,
                                     max_tokens=12, label=f"mock-c{concurrency}")
        rows.append(to_dict(result))
    server.shutdown()
    return rows


def main() -> int:
    p = argparse.ArgumentParser(description="OpenAI-compatible serving benchmark")
    p.add_argument("--base-url", default="http://localhost:8000")
    p.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct")
    p.add_argument("--concurrency", nargs="+", type=int, default=[1])
    p.add_argument("--num-prompts", type=int, default=16)
    p.add_argument("--max-tokens", type=int, default=64)
    p.add_argument("--api-key", default="")
    p.add_argument("--out", type=Path, default=PROJECT_ROOT / "results" / "serving_bench.csv")
    p.add_argument("--mock", action="store_true", help="本地 mock 服务端自检（非真实模型）")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    prompts = (PROMPTS * ((args.num_prompts // len(PROMPTS)) + 1))[: args.num_prompts]

    if args.mock:
        rows = asyncio.run(run_mock())
    else:
        rows = []
        for c in args.concurrency:
            result = asyncio.run(bench_serving(args.base_url, args.model, prompts, concurrency=c,
                                               max_tokens=args.max_tokens, api_key=args.api_key,
                                               label=f"c{c}"))
            rows.append(to_dict(result))
            logger.info("concurrency=%d → TTFT p50 %.0fms / tok/s %.1f / req/s %.2f",
                        c, result.ttft_ms_p50, result.tokens_per_s, result.requests_per_s)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f"\n✅ 写入 {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
