"""OpenAICompatibleAdapter：任何提供 /v1/chat/completions 的服务（本地 vLLM/Ollama/任意网关）。

只依赖通用接口，不绑定特定收费服务。
"""
from __future__ import annotations

import logging

import httpx

from llm_eval.adapters.base import AdapterError, ModelAdapter

logger = logging.getLogger(__name__)


class OpenAICompatibleAdapter(ModelAdapter):
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
        self._client: httpx.AsyncClient | None = None

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _payload(self, prompt: str) -> dict:
        return {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
            "max_tokens": self.max_new_tokens,
        }

    async def _one(self, client: httpx.AsyncClient, prompt: str) -> str:
        try:
            resp = await client.post(self.base_url + "/v1/chat/completions",
                                     json=self._payload(prompt), headers=self._headers())
            if resp.status_code in (429, 500, 502, 503, 504):
                raise AdapterError(f"HTTP {resp.status_code}（可重试）")
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException as e:
            raise AdapterError(f"请求超时：{e}") from e
        except (httpx.TransportError, KeyError) as e:
            raise AdapterError(f"传输/响应异常：{e}") from e

    async def agenerate(self, prompts: list[str]) -> list[str]:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout_s)
        return [await self._one(self._client, p) for p in prompts]

    def generate(self, prompts: list[str]) -> list[str]:
        import asyncio
        return asyncio.run(self.agenerate(prompts))

    def close(self) -> None:
        if self._client is not None:
            import asyncio
            try:
                asyncio.get_event_loop().run_until_complete(self._client.aclose())
            except RuntimeError:
                pass
            self._client = None
