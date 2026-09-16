"""Attention benchmark CLI：device 必须显式指定，cuda 不可用时报错退出（不静默回退）。

用法：
    python scripts/run_attention_bench.py --device cpu
    python scripts/run_attention_bench.py --device cpu --seq-lens 128 512 2048
    python scripts/run_attention_bench.py --device cuda --dtype bfloat16
    python scripts/run_attention_bench.py --device cpu --rss-check 512 2048   # 独立子进程 peak RSS
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from ibench.attention_bench import bench_attention, measure_process_peak_mb, results_to_rows  # noqa: E402


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    p = argparse.ArgumentParser(description="Attention benchmark（naive vs SDPA）")
    p.add_argument("--device", default="cpu", choices=["cpu", "cuda"])
    p.add_argument("--dtype", nargs="+", default=["float32"], choices=["float32", "bfloat16", "float16"])
    p.add_argument("--seq-lens", nargs="+", type=int, default=[128, 256, 512, 1024, 2048])
    p.add_argument("--batch", type=int, default=1)
    p.add_argument("--heads", type=int, default=4)
    p.add_argument("--head-dim", type=int, default=64)
    p.add_argument("--rss-check", nargs="*", type=int, default=[],
                   help="额外用独立子进程测指定 seq_len 的进程 peak RSS")
    p.add_argument("--out", type=Path, default=PROJECT_ROOT / "results" / "attention_bench.csv")
    args = p.parse_args()

    rows = results_to_rows(bench_attention(seq_lens=args.seq_lens, batch=args.batch, heads=args.heads,
                                           head_dim=args.head_dim, dtypes=args.dtype, device=args.device))
    if not rows:
        print("没有可运行的组合（例如 CPU 上请求了 bf16）", file=sys.stderr)
        return 1
    write_csv(args.out, rows)
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f"\n✅ latency + 理论中间张量 footprint → {args.out}")

    if args.rss_check:
        rss_rows = []
        for seq in args.rss_check:
            for impl in ("sdpa", "naive"):
                result = measure_process_peak_mb(impl, seq, args.batch, args.heads, args.head_dim, args.dtype[0])
                rss_rows.append(result)
                print(f"  [subprocess] {impl} seq={seq}: process peak RSS "
                      f"{result['process_peak_rss_mb']} MB（理论中间张量 {result['theoretical_intermediate_mb']} MB）")
        rss_path = args.out.with_name("attention_mem_subprocess.csv")
        write_csv(rss_path, rss_rows)
        print(f"✅ 独立子进程 peak RSS → {rss_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
