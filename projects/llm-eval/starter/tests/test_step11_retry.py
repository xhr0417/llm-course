"""Step 11 · 重试：指数退避 + 「什么错误不该重试」。

目标：让这 3 个测试变绿。
关键设计：适配器把可重试（超时 / 429 / 5xx）和不可重试（400 / 401）分开了——
FatalAdapterError 重试多少次都没用，必须立即放弃。
"""
from __future__ import annotations

import asyncio

from llm_eval.adapters.base import AdapterError, FatalAdapterError
from llm_eval.adapters.mock import MockAdapter
from llm_eval.config import EvalConfig
from llm_eval.runner import evaluate_tasks
from llm_eval.tasks import get_task


def _cfg(tmp_path, **kw) -> EvalConfig:
    base = dict(adapter="mock", model="mock", tasks=["c3"], limit=6, use_cache=False,
                output_dir=str(tmp_path / "out"), concurrency=1, retries=2, retry_backoff_s=0.001)
    base.update(kw)
    return EvalConfig(**base)


class FlakyAdapter(MockAdapter):
    """前 failures 次 generate 调用抛 AdapterError，之后成功返回 "A"。"""

    def __init__(self, failures: int = 4):
        super().__init__()
        self.failures = failures
        self.calls = 0

    def generate(self, prompts):
        self.calls += 1
        if self.calls <= self.failures:
            raise AdapterError("临时故障（测试重试）")
        return ["A"] * len(prompts)


class AlwaysFailAdapter(MockAdapter):
    def __init__(self):
        super().__init__()
        self.calls = 0

    def generate(self, prompts):
        self.calls += 1
        raise AdapterError("一直失败")


class FatalAdapter(MockAdapter):
    def __init__(self):
        super().__init__()
        self.calls = 0

    def generate(self, prompts):
        self.calls += 1
        raise FatalAdapterError("鉴权失败（不可重试）")


class TestRetry:
    def test_transient_failures_recover(self, tmp_path):
        adapter = FlakyAdapter(failures=4)
        cfg = _cfg(tmp_path, retries=4)  # 第 5 次调用成功
        run = asyncio.run(evaluate_tasks(adapter, [get_task("c3")], cfg))
        assert adapter.calls == 5
        assert run.tasks[0].api_errors == 0
        assert 0.0 <= run.tasks[0].metrics["accuracy"] <= 1.0

    def test_retries_are_bounded(self, tmp_path):
        adapter = AlwaysFailAdapter()
        cfg = _cfg(tmp_path, retries=2)
        run = asyncio.run(evaluate_tasks(adapter, [get_task("c3")], cfg))
        assert adapter.calls == 3, "重试次数必须受 cfg.retries 约束"
        assert run.tasks[0].api_errors == 6

    def test_fatal_error_is_not_retried(self, tmp_path):
        adapter = FatalAdapter()
        cfg = _cfg(tmp_path, retries=3)
        run = asyncio.run(evaluate_tasks(adapter, [get_task("c3")], cfg))
        assert adapter.calls == 1, "FatalAdapterError 必须立即放弃，不能重试"
        assert run.tasks[0].api_errors == 6
