"""计时工具：CUDA Event（GPU）与同步计时（CPU）的正确姿势。

为什么必须 synchronize / 用 CUDA Event（第 31 章 10.2）：
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
    info = {
        "platform": f"{platform.system()} {platform.machine()}",
        "python": platform.python_version(),
        "torch": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "device_name": "CPU" if not torch.cuda.is_available() else torch.cuda.get_device_name(0),
    }
    return info


def timeit(fn: Callable, warmup: int = 2, iters: int = 5, sync: bool = True) -> float:
    """返回平均耗时（毫秒）。GPU 上使用 CUDA Event；CPU 上普通计时。"""
    for _ in range(warmup):
        fn()
    if torch.cuda.is_available():
        start = torch.cuda.Event(enable_timing=True)
        end = torch.cuda.Event(enable_timing=True)
        torch.cuda.synchronize()
        start.record()
        for _ in range(iters):
            fn()
        end.record()
        torch.cuda.synchronize()
        return start.elapsed_time(end) / iters
    if sync and torch.cuda.is_available():
        torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(iters):
        fn()
    if sync and torch.cuda.is_available():
        torch.cuda.synchronize()
    return (time.perf_counter() - t0) * 1000 / iters


def peak_memory_mb() -> float:
    """GPU 返回显存峰值（MB）；CPU 返回进程峰值 RSS（MB，darwin 为 bytes、linux 为 KB）。"""
    if torch.cuda.is_available():
        return torch.cuda.max_memory_allocated() / (1024 * 1024)
    import resource
    import sys
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return rss / (1024 * 1024) if sys.platform == "darwin" else rss / 1024
