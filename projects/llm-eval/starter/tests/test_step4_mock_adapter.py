"""Step 4 · MockAdapter：确定性假模型。

目标：让这 3 个测试变绿。
Mock 不是「随便糊一个」：它是整条评测管线的冒烟测试替身，
calls 计数器后面会用来验证缓存与重试有没有真的减少模型调用。
"""
from __future__ import annotations

import asyncio

from llm_eval.adapters.mock import MockAdapter


class TestMockAdapter:
    def test_policy_output(self):
        adapter = MockAdapter(policy=lambda p: "B")
        assert adapter.generate(["q1", "q2"]) == ["B", "B"]

    def test_calls_counter(self):
        adapter = MockAdapter(policy=lambda p: "C")
        adapter.generate(["q1", "q2", "q3"])
        assert adapter.calls == 3

    def test_default_policy_is_a(self):
        adapter = MockAdapter()
        assert adapter.generate(["q"]) == ["A"]
        assert adapter.calls == 1

    def test_agenerate_uses_default_threadpool_bridge(self):
        adapter = MockAdapter()
        assert asyncio.run(adapter.agenerate(["q1", "q2"])) == ["A", "A"]
