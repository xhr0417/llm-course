"""Attention benchmark：naive（物化中间矩阵） vs PyTorch SDPA。

测量口径（本文件严格遵守）：
- latency：由实际 device 决定的计时（CPU perf_counter / CUDA Event）；
- CPU memory：
    * `intermediate_mb` = 【理论中间张量 footprint 估计】，不是进程 peak memory；
      naive 会物化 scores 与 probs 两个 [B,H,S,S] 张量（本实现中两者会同时存活），
      估计值取 2×B×H×S²×bytes；SDPA 不物化 S×S，记 0。
    * 如需【进程 peak RSS】，必须用独立子进程测量（见 mem_worker.py 与
      measure_process_peak_mb），且结果含 Python/PyTorch 运行时开销，不是纯张量内存。
- CUDA memory：reset_peak_memory_stats → 运行 → max_memory_allocated，
  分别报告 peak allocated 与 peak reserved。
"""
from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path
from dataclasses import asdict, dataclass

import torch
import torch.nn.functional as F

from ibench.timer import timeit

_DTYPES = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}
_DTYPE_BYTES = {"float32": 4, "bfloat16": 2, "float16": 2}


@dataclass
class AttentionResult:
    impl: str
    device: str
    seq_len: int
    batch: int
    heads: int
    head_dim: int
    dtype: str
    latency_ms: float
    intermediate_mb: float          # 理论中间张量 footprint（CPU/GPU 通用）
    peak_allocated_mb: float = -1.0  # 仅 CUDA 实测；CPU 为 -1（未测）
    peak_reserved_mb: float = -1.0   # 仅 CUDA 实测


def naive_attention(q: torch.Tensor, k: torch.Tensor, v: torch.Tensor) -> torch.Tensor:
    """scores = QKᵀ → softmax → PV：三步全部物化（第 19 章的“naive 分解”）。"""
    scores = q @ k.transpose(-2, -1) / math.sqrt(q.shape[-1])
    probs = torch.softmax(scores, dim=-1)
    return probs @ v


def sdpa_attention(q: torch.Tensor, k: torch.Tensor, v: torch.Tensor) -> torch.Tensor:
    """PyTorch 的 fused 实现（底层按后端 dispatch，不物化完整 S×S 中间矩阵）。"""
    return F.scaled_dot_product_attention(q, k, v)


def theoretical_intermediate_mb(impl: str, batch: int, heads: int, seq_len: int, dtype: str) -> float:
    """理论中间张量 footprint 估计（MB）。naive：scores+probs 同时存活 ≈ 2×B×H×S²×bytes。"""
    if impl != "naive":
        return 0.0
    n_scores = batch * heads * seq_len * seq_len
    return 2 * n_scores * _DTYPE_BYTES[dtype] / (1024 * 1024)


def _device_dtype_ok(dtype: str, device: str) -> bool:
    """fp16/bf16 在 CPU 上不做（matmul 支持有限/易误导）；CUDA 支持三种。"""
    if dtype == "float32":
        return True
    return torch.device(device).type == "cuda"


def bench_attention(seq_lens: list[int], batch: int = 1, heads: int = 4, head_dim: int = 64,
                    dtypes: list[str] | None = None, device: str = "cpu",
                    warmup: int = 1, iters: int = 3) -> list[AttentionResult]:
    dev = torch.device(device)
    if dev.type == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("--device cuda 不可用：本机 torch.cuda.is_available() == False")
    dtypes = dtypes or ["float32"]
    results: list[AttentionResult] = []
    for dtype_name in dtypes:
        if dtype_name not in _DTYPES:
            raise ValueError(f"未知 dtype：{dtype_name}")
        if not _device_dtype_ok(dtype_name, device):
            continue
        dtype = _DTYPES[dtype_name]
        for seq_len in seq_lens:
            q = torch.randn(batch, heads, seq_len, head_dim, dtype=dtype, device=dev)
            k = torch.randn_like(q)
            v = torch.randn_like(q)
            for name, fn in (("naive", naive_attention), ("sdpa", sdpa_attention)):
                if dev.type == "cuda":
                    torch.cuda.empty_cache()
                    torch.cuda.reset_peak_memory_stats(dev)
                for _ in range(warmup):
                    fn(q, k, v)
                if dev.type == "cuda":
                    torch.cuda.synchronize(dev)
                    torch.cuda.reset_peak_memory_stats(dev)
                latency = timeit(lambda: fn(q, k, v), warmup=0, iters=iters, device=device)
                peak_alloc, peak_resv = -1.0, -1.0
                if dev.type == "cuda":
                    torch.cuda.synchronize(dev)
                    peak_alloc = torch.cuda.max_memory_allocated(dev) / (1024 * 1024)
                    peak_resv = torch.cuda.max_memory_reserved(dev) / (1024 * 1024)
                results.append(AttentionResult(
                    impl=name, device=device, seq_len=seq_len, batch=batch, heads=heads,
                    head_dim=head_dim, dtype=dtype_name, latency_ms=round(latency, 3),
                    intermediate_mb=round(theoretical_intermediate_mb(name, batch, heads, seq_len, dtype_name), 1),
                    peak_allocated_mb=round(peak_alloc, 1), peak_reserved_mb=round(peak_resv, 1),
                ))
    return results


def measure_process_peak_mb(impl: str, seq_len: int, batch: int = 1, heads: int = 4,
                            head_dim: int = 64, dtype: str = "float32") -> dict:
    """在独立子进程中跑单个 case，返回该进程的 peak RSS（含运行时开销，见 mem_worker）。"""
    cmd = [sys.executable, "-m", "ibench.mem_worker",
           "--impl", impl, "--seq", str(seq_len), "--batch", str(batch),
           "--heads", str(heads), "--head-dim", str(head_dim), "--dtype", dtype]
    import json
    import os
    env = dict(os.environ)
    env["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    src_dir = str(Path(__file__).resolve().parents[2] / "src")
    env["PYTHONPATH"] = src_dir + os.pathsep + env.get("PYTHONPATH", "")
    out = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=600)
    if out.returncode != 0:
        raise RuntimeError(f"mem_worker 失败：{out.stderr[-500:]}")
    return json.loads(out.stdout.strip().splitlines()[-1])


def results_to_rows(results: list[AttentionResult]) -> list[dict]:
    return [asdict(r) for r in results]
