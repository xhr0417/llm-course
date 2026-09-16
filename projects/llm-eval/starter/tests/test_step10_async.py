"""Step 10 · asyncio 并发：Semaphore 限制同时在飞的请求数。

目标：让这 2 个测试变绿。

为什么要并发上限？10000 个请求一起打出去 → 429 限流 → 重试风暴 → 更慢。
本地 HF 模型（supports_concurrency=False）保持批量串行，瓶颈是 CPU 不是网络。
"""
from __future__ import annotations

import asyncio

from llm_eval.adapters.base import ModelAdapter
from llm_eval.adapters.mock import MockAdapter
from llm_eval.config import EvalConfig
from llm_eval.runner import evaluate_tasks
from llm_eval.tasks import get_task


def _cfg(tmp_path, **kw) -> EvalConfig:
    base = dict(adapter="mock", model="mock", tasks=["c3"], limit=9, use_cache=False,
                output_dir=str(tmp_path / "out"), concurrency=3, retries=0, retry_backoff_s=0.01)
    base.update(kw)
    return EvalConfig(**base)


class ConcurrencyProbe(ModelAdapter):
    """记录同时有多少个 agenerate 在飞。"""

    name = "probe"
    supports_concurrency = True

    def __init__(self):
        self.inflight = 0
        self.max_inflight = 0

    def generate(self, prompts):
        return ["A"] * len(prompts)

    async def agenerate(self, prompts):
        self.inflight += 1
        self.max_inflight = max(self.max_inflight, self.inflight)
        await asyncio.sleep(0.03)
        self.inflight -= 1
        return ["A"] * len(prompts)


class TestConcurrency:
    def test_concurrency_is_capped_and_actually_parallel(self, tmp_path):
        probe = ConcurrencyProbe()
        run = asyncio.run(evaluate_tasks(probe, [get_task("c3")], _cfg(tmp_path)))
        assert run.tasks[0].n == 9
        assert probe.max_inflight <= 3, "并发不能超过 cfg.concurrency"
        assert probe.max_inflight > 1, "实现必须真的并发（串行 for 循环会在这里失败）"

    def test_non_concurrent_adapter_still_works(self, tmp_path):
        class SyncProbe(ModelAdapter):
            name = "sync-probe"

            def __init__(self):
                self.calls = 0

            def generate(self, prompts):
                self.calls += len(prompts)
                return ["A"] * len(prompts)

        adapter = SyncProbe()
        run = asyncio.run(evaluate_tasks(adapter, [get_task("c3")], _cfg(tmp_path, limit=4)))
        assert adapter.calls == 4
        assert run.tasks[0].n == 4
        assert 0.0 <= run.tasks[0].metrics["accuracy"] <= 1.0

    def test_default_mock_is_batch_sequential(self):
        assert MockAdapter().supports_concurrency is False
