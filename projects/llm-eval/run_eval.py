#!/usr/bin/env python3
"""Capstone 1 · Mini LLM Evaluation Harness —— 命令行入口。

示例：
    # 本地 HF 模型（CPU 可跑）
    python run_eval.py --adapter hf --model Qwen/Qwen2.5-0.5B-Instruct --tasks c3 xcopa --limit 20

    # OpenAI-compatible 服务（vLLM / Ollama / 任意网关）
    python run_eval.py --adapter openai --model qwen2.5 --base-url http://localhost:8000 \
        --tasks c3 xcopa --concurrency 8 --api-key sk-xxx

    # 只用 Mock 冒烟（验证管线，不是真实评测）
    python run_eval.py --adapter mock --tasks c3 --limit 10
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from llm_eval.adapters import get_adapter  # noqa: E402
from llm_eval.config import load_config  # noqa: E402
from llm_eval.reports import write_reports  # noqa: E402
from llm_eval.runner import evaluate_tasks  # noqa: E402
from llm_eval.tasks import get_task  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="run_eval", description="Mini LLM Evaluation Harness")
    p.add_argument("--config", type=Path, default=None, help="JSON 配置文件（可选）")
    p.add_argument("--adapter", choices=["hf", "openai", "mock"], default=None)
    p.add_argument("--model", default=None, help="模型名（HF 仓库名 / API model id）")
    p.add_argument("--tasks", nargs="+", default=None, help="要评测的任务：c3 / xcopa / qa")
    p.add_argument("--limit", type=int, default=None, help="每任务最多多少题")
    p.add_argument("--data", action="append", default=[], metavar="TASK=PATH",
                   help="覆盖某任务的数据文件，可重复：--data c3=my_c3.jsonl")
    p.add_argument("--output", default=None, help="输出目录")
    p.add_argument("--concurrency", type=int, default=None, help="API 并发上限（Semaphore）")
    p.add_argument("--retries", type=int, default=None)
    p.add_argument("--max-new-tokens", type=int, default=None)
    p.add_argument("--base-url", default=None)
    p.add_argument("--api-key", default=None)
    p.add_argument("--no-cache", action="store_true", help="关闭响应缓存")
    p.add_argument("--verbose", action="store_true")
    return p


def parse_data_overrides(pairs: list[str]) -> dict[str, str]:
    overrides = {}
    for pair in pairs:
        if "=" not in pair:
            raise SystemExit(f"--data 格式应为 TASK=PATH，收到：{pair}")
        task, path = pair.split("=", 1)
        overrides[task.strip()] = path.strip()
    return overrides


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(levelname)s %(message)s")

    cfg = load_config(
        args.config,
        adapter=args.adapter,
        model=args.model,
        tasks=args.tasks,
        limit=args.limit,
        output_dir=args.output,
        concurrency=args.concurrency,
        retries=args.retries,
        max_new_tokens=args.max_new_tokens,
        base_url=args.base_url,
        api_key=args.api_key,
        data_overrides=parse_data_overrides(args.data) or None,
    )
    if args.no_cache:
        cfg.use_cache = False

    tasks = []
    for name in cfg.tasks:
        data_path = cfg.data_overrides.get(name) if cfg.data_overrides else None
        task = get_task(name, data_path=data_path)
        if not Path(task.data_path).exists():
            raise SystemExit(f"任务 {name} 的数据文件不存在：{task.data_path}\n"
                             f"提示：先运行 python scripts/fetch_data.py --task {name} --n 100")
        tasks.append(task)

    adapter = get_adapter(cfg)
    run = asyncio.run(evaluate_tasks(adapter, tasks, cfg))
    out_dir = Path(cfg.output_dir)
    write_reports(run, cfg, out_dir)

    print()
    print("=" * 62)
    print(f"评测完成：{run.model}（{run.adapter}）  用时 {run.duration_s:.1f}s")
    for t in run.tasks:
        metric_str = " / ".join(f"{k}={v * 100:.1f}%" for k, v in t.metrics.items())
        print(f"  {t.task:6s} n={t.n:<4d} {metric_str}  （badcase {len(t.badcases)}）")
    print(f"报告：{out_dir}/results.json · summary.md · badcases.jsonl")
    print("=" * 62)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
