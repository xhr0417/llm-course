"""CPU 可跑的 Labs：attention 伸缩 / profiler / torch.compile → results/ + analysis.md。

用法：
    python scripts/run_cpu_labs.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import torch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from ibench.attention_bench import bench_attention, results_to_rows  # noqa: E402
from ibench.compile_lab import bench_compile, to_dict as compile_to_dict  # noqa: E402
from ibench.profiler_lab import profile_ops, rows_to_dicts  # noqa: E402
from ibench.report import build_analysis_md, write_analysis  # noqa: E402
from ibench.timer import platform_info  # noqa: E402

RESULTS = PROJECT_ROOT / "results"


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    info = platform_info()
    print("环境：", json.dumps(info, ensure_ascii=False))

    print("\n[1/3] Attention benchmark（naive vs sdpa）…")
    seq_lens = [128, 256, 512, 1024, 2048]
    attention_rows = results_to_rows(bench_attention(seq_lens=seq_lens, batch=1, heads=4, head_dim=64))
    write_csv(RESULTS / "attention_bench.csv", attention_rows)
    for r in attention_rows:
        print(f"  {r['impl']:>5s} seq={r['seq_len']:<5d} {r['latency_ms']:>8.2f} ms  mem≈{r['peak_mem_mb']} MB")

    print("\n[2/3] Profiler（CPU 算子表）…")
    q = torch.randn(1, 4, 512, 64)
    from ibench.attention_bench import naive_attention
    profile_rows = rows_to_dicts(profile_ops(lambda: naive_attention(q, q, q), iters=3, top=12))
    write_csv(RESULTS / "profile_top_ops.csv", profile_rows)
    for r in profile_rows[:6]:
        print(f"  {r['cpu_pct']:>5.1f}%  {r['op'][:60]}  calls={r['calls']}")

    print("\n[3/3] torch.compile（eager vs compiled）…")
    def mlp(x: torch.Tensor) -> torch.Tensor:
        return torch.relu(x @ x.T).softmax(dim=-1) @ x

    x = torch.randn(256, 256)
    compile_row = compile_to_dict(bench_compile(mlp, x))
    print("  ", json.dumps(compile_row, ensure_ascii=False))
    (RESULTS / "compile.json").write_text(json.dumps(compile_row, ensure_ascii=False, indent=2), encoding="utf-8")

    analysis = build_analysis_md(info, attention_rows, profile_rows, compile_row, [])
    write_analysis(RESULTS / "analysis.md", analysis)
    print(f"\n✅ 结果写入 {RESULTS}/：attention_bench.csv / profile_top_ops.csv / compile.json / analysis.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
