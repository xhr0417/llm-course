"""Step 9 · OpenAICompatibleAdapter：对接任何 /v1/chat/completions 服务。

目标：让这一组测试变绿。
用本地 HTTP fake server 测试，不需要真实 API（也不产生费用）。

异常分类是本步的重点：
- 500 → AdapterError（可重试）；
- 400 / 401 → FatalAdapterError（不可重试，Step 11 会用到）。
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from llm_eval.adapters.base import AdapterError, FatalAdapterError
from llm_eval.adapters.openai_compat import OpenAICompatibleAdapter


class _OpenAIHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        assert self.path == "/v1/chat/completions"
        model = body.get("model")
        if model == "fail-model":
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"{}")
            return
        if model == "bad-model":
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"{}")
            return
        if model == "slow-model":
            time.sleep(0.3)
        auth = self.headers.get("Authorization", "")
        payload = {"choices": [{"message": {"content": f"A（收到鉴权: {auth}）"}}]}
        data = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


@pytest.fixture()
def mock_server():
    server = HTTPServer(("127.0.0.1", 0), _OpenAIHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


def _agenerate(adapter: OpenAICompatibleAdapter, prompts: list[str]) -> list[str]:
    """在同一个事件循环里调用 agenerate，结束后关闭连接池。"""
    async def run():
        try:
            return await adapter.agenerate(prompts)
        finally:
            await adapter.aclose()
    return asyncio.run(run())


class TestOpenAIAdapter:
    def test_roundtrip_and_auth_header(self, mock_server):
        adapter = OpenAICompatibleAdapter("test-model", base_url=mock_server, api_key="sk-test")
        out = _agenerate(adapter, ["你好"])
        assert len(out) == 1
        assert "A" in out[0]
        assert "sk-test" in out[0], "api_key 应放进 Authorization: Bearer 头"

    def test_api_adapter_declares_concurrency_support(self, mock_server):
        adapter = OpenAICompatibleAdapter("test-model", base_url=mock_server)
        assert adapter.supports_concurrency is True

    def test_5xx_raises_retryable_adapter_error(self, mock_server):
        adapter = OpenAICompatibleAdapter("fail-model", base_url=mock_server)
        with pytest.raises(AdapterError):
            _agenerate(adapter, ["你好"])

    def test_400_raises_fatal_error(self, mock_server):
        adapter = OpenAICompatibleAdapter("bad-model", base_url=mock_server)
        with pytest.raises(FatalAdapterError):
            _agenerate(adapter, ["你好"])

    def test_timeout_respects_config(self, mock_server):
        adapter = OpenAICompatibleAdapter("slow-model", base_url=mock_server, timeout_s=0.05)
        with pytest.raises(AdapterError):
            _agenerate(adapter, ["你好"])
