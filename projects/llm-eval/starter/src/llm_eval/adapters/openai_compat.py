"""OpenAICompatibleAdapter：任何提供 /v1/chat/completions 的服务（本地 vLLM/Ollama/任意网关）。

这是 starter 的【待实现文件】：
- Step 9：实现 _headers / _payload / _one / agenerate / aclose

异常语义（Step 11 的重试依赖它）：
- 超时、传输错误、429、5xx → AdapterError（可重试）；
- 400 / 401 → FatalAdapterError（不可重试）。

__init__ 与 generate / supports_concurrency 已给出。
"""
from __future__ import annotations

import logging

from llm_eval.adapters.base import AdapterError, FatalAdapterError, ModelAdapter

logger = logging.getLogger(__name__)


class OpenAICompatibleAdapter(ModelAdapter):
    supports_concurrency = True   # API 场景由 Runner 用 Semaphore 控制并发

    def __init__(self, model: str, base_url: str = "http://localhost:8000",
                 api_key: str = "", max_new_tokens: int = 16, temperature: float = 0.0,
                 timeout_s: float = 60.0):
        self.name = f"openai:{model}"
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        self.timeout_s = timeout_s
        self._client = None

    def _headers(self) -> dict:
        """Step 9：Content-Type: application/json；api_key 非空时加 Bearer 鉴权头。"""
        raise NotImplementedError("Step 9：实现 _headers（Bearer 鉴权）")

    def _payload(self, prompt: str) -> dict:
        """Step 9：OpenAI 消息格式：model / messages / temperature / max_tokens。"""
        raise NotImplementedError("Step 9：实现 _payload（messages + max_tokens）")

    async def _one(self, client, prompt: str) -> str:
        """Step 9：POST {base_url}/v1/chat/completions，返回 choices[0].message.content。

        状态码分类（顺序很重要）：
        - 400 / 401 → FatalAdapterError；
        - 429 / 500 / 502 / 503 / 504 → AdapterError（可重试）；
        - 其它 raise_for_status()；
        - httpx.TimeoutException → AdapterError；httpx.TransportError / 响应缺字段 → AdapterError。
        """
        raise NotImplementedError("Step 9：实现 _one（POST + 状态码分类）")

    async def agenerate(self, prompts: list[str]) -> list[str]:
        """Step 9：懒加载 httpx.AsyncClient(timeout=self.timeout_s)，逐条调用 _one。

        并发由 Runner 层（Semaphore）控制，这里保持简单的顺序实现即可。
        """
        raise NotImplementedError("Step 9：实现 agenerate（懒加载 AsyncClient）")

    def generate(self, prompts: list[str]) -> list[str]:
        import asyncio
        return asyncio.run(self.agenerate(prompts))

    async def aclose(self) -> None:
        """Step 9：await self._client.aclose() 并置 None（runner 会 await 本方法）。"""
        raise NotImplementedError("Step 9：实现 aclose（关闭 httpx.AsyncClient）")

    def close(self) -> None:
        """同步兜底：无事件循环可用时不残留未关闭连接（进程退出时由 GC 回收）。"""
        self._client = None
