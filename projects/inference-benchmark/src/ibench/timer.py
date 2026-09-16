"""计时工具：由【实际被 benchmark 的 device】决定计时方式。

- CPU：time.perf_counter()
- CUDA：CUDA Event + torch.cuda.synchronize(device)

为什么必须 synchronize / 用 CUDA Event（第 31 章）：
    CUDA 调用是异步的——函数返回时 kernel 可能还没跑完。
    不 synchronize 直接测 time.time()，测到的是「下发命令的时间」而不是「计算时间」。
"""
from __future__ import annotations

import platform
import time
from typing import Callable

import torch


def cuda_available() -> bool:
    return torch.cuda.is_available()


def platform_info() -> dict:
    return {
        "platform": f"{platform.system()} {platform.machine()}",
        "python": platform.python_version(),
        "torch": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "device_name": "CPU" if not torch.cuda.is_available() else torch.cuda.get_device_name(0),
    }


def timeit(fn: Callable, warmup: int = 2, iters: int = 5, device: str = "cpu") -> float:
    """返回平均耗时（毫秒）。计时方式由 device 决定（不看本机是否有 CUDA）。"""
    dev = torch.device(device)
    for _ in range(warmup):
        fn()
    if dev.type == "cuda":
        start = torch.cuda.Event(enable_timing=True)
        end = torch.cuda.Event(enable_timing=True)
        torch.cuda.synchronize(dev)
        start.record()
        for _ in range(iters):
            fn()
        end.record()
        torch.cuda.synchronize(dev)
        return start.elapsed_time(end) / iters
    t0 = time.perf_counter()
    for _ in range(iters):
        fn()
    return (time.perf_counter() - t0) * 1000 / iters


def cuda_peak_memory_mb(device: str = "cuda") -> dict:
    """CUDA 峰值显存（allocated / reserved），必须在 reset_peak_memory_stats 之后读取。"""
    if not torch.cuda.is_available():
        raise RuntimeError("cuda_peak_memory_mb 需要 CUDA 环境")
    dev = torch.device(device)
    return {
        "peak_allocated_mb": torch.cuda.max_memory_allocated(dev) / (1024 * 1024),
        "peak_reserved_mb": torch.cuda.max_memory_reserved(dev) / (1024 * 1024),
    }
