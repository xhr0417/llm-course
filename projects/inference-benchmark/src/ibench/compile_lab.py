"""torch.compile 最小实验：compile 不是「一开就一定更快」。

- 首次调用包含编译开销（本实验单独报告 compile 时间）；
- 编译后在固定 shape 下通常更快（kernel 融合、减少 Python 开销）；
- 动态 shape / 小算子场景可能没有收益甚至更慢。
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from typing import Callable

import torch

from ibench.timer import timeit


@dataclass
class CompileResult:
    eager_ms: float
    compiled_ms: float
    compile_time_s: float
    speedup: float
    outputs_match: bool
    note: str


def bench_compile(fn: Callable, example_input: torch.Tensor, warmup: int = 2, iters: int = 5) -> CompileResult:
    eager_out = fn(example_input)
    eager_ms = timeit(lambda: fn(example_input), warmup=warmup, iters=iters)

    t0 = time.perf_counter()
    compiled_fn = torch.compile(fn)  # 默认 inductor 后端
    compiled_out = compiled_fn(example_input)   # 触发编译
    compile_time_s = time.perf_counter() - t0

    compiled_ms = timeit(lambda: compiled_fn(example_input), warmup=warmup, iters=iters)
    speedup = eager_ms / compiled_ms if compiled_ms > 0 else float("nan")
    match = bool(torch.allclose(eager_out, compiled_out, atol=1e-3))
    note = ("compiled 更快" if speedup > 1.05 else
            "compiled 更慢（常见于小模型/CPU/形状多变的场景）" if speedup < 0.95 else "两者接近")
    return CompileResult(eager_ms=round(eager_ms, 3), compiled_ms=round(compiled_ms, 3),
                         compile_time_s=round(compile_time_s, 1), speedup=round(speedup, 3),
                         outputs_match=match, note=note)


def to_dict(result: CompileResult) -> dict:
    return asdict(result)
