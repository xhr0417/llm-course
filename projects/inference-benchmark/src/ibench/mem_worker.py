"""独立子进程 worker：在【完全独立的进程】里跑单个 attention case，输出该进程 peak RSS。

用法：
    python -m ibench.mem_worker --impl naive --seq 2048 --dtype float32

输出（stdout 最后一行 JSON）：
    {"impl": ..., "seq_len": ..., "process_peak_rss_mb": ..., "note": "..."}

重要口径说明：
- ru_maxrss 是【整个进程生命周期】的 high-water mark；
  因为本进程只跑这一个 case，「进程 peak RSS」可作为该 case 的资源占用上限参考；
- 但它**包含** Python 解释器、PyTorch、BLAS 线程缓冲等运行时开销，
  不是「attention 张量本身的峰值内存」。纯张量 footprint 见 theoretical_intermediate_mb。
"""
from __future__ import annotations

import argparse
import json
import resource
import sys

import torch

from ibench.attention_bench import naive_attention, sdpa_attention, theoretical_intermediate_mb

_DTYPES = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}


def _peak_rss_mb() -> float:
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return rss / (1024 * 1024) if sys.platform == "darwin" else rss / 1024


def main() -> int:
    p = argparse.ArgumentParser(description="单 case 进程 peak RSS 测量（独立进程）")
    p.add_argument("--impl", choices=["naive", "sdpa"], required=True)
    p.add_argument("--seq", type=int, required=True)
    p.add_argument("--batch", type=int, default=1)
    p.add_argument("--heads", type=int, default=4)
    p.add_argument("--head-dim", type=int, default=64)
    p.add_argument("--dtype", default="float32")
    args = p.parse_args()

    dtype = _DTYPES[args.dtype]
    fn = naive_attention if args.impl == "naive" else sdpa_attention
    q = torch.randn(args.batch, args.heads, args.seq, args.head_dim, dtype=dtype)
    k = torch.randn_like(q)
    v = torch.randn_like(q)
    fn(q, k, v)  # 运行一次（含内存分配）
    torch.set_num_threads(1)
    result = {
        "impl": args.impl,
        "seq_len": args.seq,
        "batch": args.batch,
        "heads": args.heads,
        "head_dim": args.head_dim,
        "dtype": args.dtype,
        "theoretical_intermediate_mb": round(
            theoretical_intermediate_mb(args.impl, args.batch, args.heads, args.seq, args.dtype), 1),
        "process_peak_rss_mb": round(_peak_rss_mb(), 1),
        "note": "进程 peak RSS（含 Python/PyTorch 运行时开销），非纯张量内存",
    }
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
