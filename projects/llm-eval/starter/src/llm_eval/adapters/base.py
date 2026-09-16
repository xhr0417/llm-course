"""ModelAdapter 基类与异常。

本文件已给出，不需要修改。异常语义是 Step 11 重试逻辑的基础：
- AdapterError：可重试（网络超时、429 限流、5xx）；
- FatalAdapterError：不可重试（400 参数错、401 鉴权失败）——重试多少次都没用。
"""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod


class AdapterError(RuntimeError):
    """可重试的适配器错误（网络超时、限流 429、5xx 等）。"""


class FatalAdapterError(AdapterError):
    """不可重试的适配器错误（400 参数错、401 鉴权失败）。"""


class ModelAdapter(ABC):
    """统一模型接口：输入一组 prompt，返回一组字符串。

    所有评测任务只依赖这个接口——换模型只换 Adapter。
    """

    name: str = "base"
    supports_concurrency: bool = False   # API 类适配器覆盖为 True（Runner 据此用 Semaphore 并发）

    @abstractmethod
    def generate(self, prompts: list[str]) -> list[str]:
        """同步生成（HF 本地模型 / 测试用的 Mock）。"""

    async def agenerate(self, prompts: list[str]) -> list[str]:
        """异步生成。默认在线程池里跑同步实现；API 适配器会覆盖为真异步。"""
        return await asyncio.to_thread(self.generate, prompts)

    def close(self) -> None:
        """释放资源（如 HTTP 连接池）。"""
