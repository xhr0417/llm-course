"""MockAdapter：确定性假模型，用于测试与管线冒烟（不是真实评测）。

这是 starter 的【待实现文件】：
- Step 4：实现 generate()

__init__ 已给出：policy(prompt) -> response（默认返回 "A"），calls 统计处理过的 prompt 条数。
"""
from __future__ import annotations

from typing import Callable, Optional

from llm_eval.adapters.base import ModelAdapter


class MockAdapter(ModelAdapter):
    name = "mock"

    def __init__(self, policy: Optional[Callable[[str], str]] = None):
        self.policy = policy or (lambda _p: "A")
        self.calls = 0

    def generate(self, prompts: list[str]) -> list[str]:
        """Step 4：先 calls += len(prompts)，再逐条调用 policy 返回结果列表。

        契约：
        - 返回值长度必须与 prompts 一致；
        - 每处理一条 prompt，calls 计数器 +1（测试用它验证缓存/重试有没有真的减少调用）。
        """
        raise NotImplementedError("Step 4：实现 MockAdapter.generate（calls 计数 + 逐条调用 policy）")
