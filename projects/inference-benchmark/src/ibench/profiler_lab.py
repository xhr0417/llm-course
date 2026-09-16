"""torch.profiler 实验室：把「哪一步慢」变成可读的算子表。

CPU profile 也很有用：能看到 aten::mm / aten::softmax 等算子的时间占比与调用次数。
GPU 环境加上 activities=[CUDA] 即可得到 CUDA time（本机无 GPU → NOT EXECUTED）。
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Callable

import torch

from ibench.timer import cuda_available


@dataclass
class OpRow:
    op: str
    calls: int
    cpu_time_ms: float
    cuda_time_ms: float
    cpu_pct: float


def profile_ops(fn: Callable[[], torch.Tensor], warmup: int = 1, iters: int = 3,
                top: int = 15) -> list[OpRow]:
    for _ in range(warmup):
        fn()
    activities = [torch.profiler.ProfilerActivity.CPU]
    if cuda_available():
        activities.append(torch.profiler.ProfilerActivity.CUDA)
    with torch.profiler.profile(activities=activities, record_shapes=True) as prof:
        for _ in range(iters):
            fn()
    rows = []
    total_cpu = 0.0
    events = prof.key_averages()
    for ev in events:
        total_cpu += ev.self_cpu_time_total
    for ev in events:
        cpu_ms = ev.self_cpu_time_total / 1000
        cuda_ms = (ev.self_device_time_total / 1000) if hasattr(ev, "self_device_time_total") else 0.0
        rows.append(OpRow(op=ev.key[:70], calls=ev.count, cpu_time_ms=round(cpu_ms, 3),
                          cuda_time_ms=round(cuda_ms, 3),
                          cpu_pct=round(100 * ev.self_cpu_time_total / total_cpu, 1) if total_cpu else 0.0))
    rows.sort(key=lambda r: -r.cpu_time_ms)
    return rows[:top]


def rows_to_dicts(rows: list[OpRow]) -> list[dict]:
    return [asdict(r) for r in rows]
