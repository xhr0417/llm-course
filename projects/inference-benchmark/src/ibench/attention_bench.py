"""Attention benchmark：naive（物化中间矩阵） vs PyTorch SDPA（fused/optimized）。

对比什么（第 31 章 10.3）：
    - 不同 seq_len 下的延迟伸缩（O(n²) 的实测形状）；
    - dtype 影响（FP32 vs BF16，需硬件支持）；
    - peak memory（naive 会物化 [B,H,S,S] 的 scores；SDPA 不物化）。
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import torch
import torch.nn.functional as F

from ibench.timer import peak_memory_mb, timeit

_DTYPES = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}


@dataclass
class AttentionResult:
    impl: str
    seq_len: int
    batch: int
    heads: int
    head_dim: int
    dtype: str
    latency_ms: float
    peak_mem_mb: float


def naive_attention(q: torch.Tensor, k: torch.Tensor, v: torch.Tensor) -> torch.Tensor:
    """scores = QKᵀ → softmax → PV：三步全部物化（第 19 章的“naive 分解”）。"""
    scores = q @ k.transpose(-2, -1) / math.sqrt(q.shape[-1])
    probs = torch.softmax(scores, dim=-1)
    return probs @ v


def sdpa_attention(q: torch.Tensor, k: torch.Tensor, v: torch.Tensor) -> torch.Tensor:
    """PyTorch 的 fused 实现（底层按后端 dispatch，不保证物化中间矩阵）。"""
    return F.scaled_dot_product_attention(q, k, v)


def bench_attention(seq_lens: list[int], batch: int = 1, heads: int = 4, head_dim: int = 64,
                    dtypes: list[str] | None = None, warmup: int = 1, iters: int = 3) -> list[AttentionResult]:
    dtypes = dtypes or ["float32"]
    results: list[AttentionResult] = []
    for dtype_name in dtypes:
        dtype = _DTYPES[dtype_name]
        if dtype in (torch.float16, torch.bfloat16) and not torch.cuda.is_available():
            # CPU 上 bf16/fp16 的 matmul 支持有限，跳过并在报告中说明
            continue
        for seq_len in seq_lens:
            q = torch.randn(batch, heads, seq_len, head_dim, dtype=dtype)
            k = torch.randn_like(q)
            v = torch.randn_like(q)
            for name, fn in (("naive", naive_attention), ("sdpa", sdpa_attention)):
                mem_before = peak_memory_mb()
                latency = timeit(lambda: fn(q, k, v), warmup=warmup, iters=iters)
                mem_after = peak_memory_mb()
                results.append(AttentionResult(
                    impl=name, seq_len=seq_len, batch=batch, heads=heads, head_dim=head_dim,
                    dtype=dtype_name, latency_ms=round(latency, 3),
                    peak_mem_mb=round(max(mem_after - mem_before, 0.0), 1),
                ))
    return results


def results_to_rows(results: list[AttentionResult]) -> list[dict]:
    return [asdict(r) for r in results]
