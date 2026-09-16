"""MockAdapter：确定性假模型，用于测试与管线冒烟（不是真实评测）。"""
from __future__ import annotations

from typing import Callable, Optional

from llm_eval.adapters.base import ModelAdapter


class MockAdapter(ModelAdapter):
    name = "mock"

    def __init__(self, policy: Optional[Callable[[str], str]] = None, fail_times: int = 0):
        """policy(prompt) -> response；默认返回 "A"。
        fail_times: 前 N 次调用抛 AdapterError（用于测试重试逻辑）。"""
        self.policy = policy or (lambda _p: "A")
        self.fail_times = fail_times
        self.calls = 0

    def generate(self, prompts: list[str]) -> list[str]:
        self.calls += len(prompts)
        if self.fail_times > 0:
            self.fail_times -= len(prompts)
            from llm_eval.adapters.base import AdapterError
            raise AdapterError("mock failure（测试重试用）")
        return [self.policy(p) for p in prompts]
