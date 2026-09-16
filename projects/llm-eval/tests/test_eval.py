"""pytest：parser / 指标 / 任务 / Runner（缓存+重试+badcase）/ OpenAI 适配器。"""
from __future__ import annotations

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from llm_eval.adapters.base import AdapterError  # noqa: E402
from llm_eval.adapters.mock import MockAdapter  # noqa: E402
from llm_eval.adapters.openai_compat import OpenAICompatibleAdapter  # noqa: E402
from llm_eval.cache import ResponseCache  # noqa: E402
from llm_eval.config import EvalConfig  # noqa: E402
from llm_eval.metrics import exact_match, f1_score, pass_at_k  # noqa: E402
from llm_eval.parsers import parse_choice, strip_special  # noqa: E402
from llm_eval.reports import write_reports  # noqa: E402
from llm_eval.runner import evaluate_tasks  # noqa: E402
from llm_eval.tasks import get_task  # noqa: E402


class TestParser:
    @pytest.mark.parametrize("raw,expected", [
        ("C", "C"), ("c", "C"), ("C.", "C"), ("（C）", "C"), ("[B]", "B"),
        ("答案是 C", "C"), ("答案：D", "D"), ("The correct answer is C.", "C"),
        ("我认为选 B", "B"), ("**D**", "D"), ("C) 因为天气原因", "C"),
        ("B. 因为它很易碎", "B"),
    ])
    def test_parse_common_formats(self, raw, expected):
        assert parse_choice(raw, valid="ABCD") == expected

    def test_parse_failure_returns_none(self):
        assert parse_choice("我不知道", valid="ABCD") is None
        assert parse_choice("", valid="ABCD") is None
        assert parse_choice("E", valid="ABCD") is None

    def test_strip_special_tokens(self):
        assert strip_special("C<|im_end|>") == "C"


class TestMetrics:
    def test_accuracy_boundaries(self):
        from llm_eval.metrics import accuracy
        assert accuracy(0, 0) != accuracy(0, 0)  # nan
        assert accuracy(0, 10) == 0.0
        assert accuracy(10, 10) == 1.0

    def test_exact_match_normalization(self):
        assert exact_match("Hello, World!", ["hello world"]) == 1.0
        assert exact_match("不 知道", ["不知道"]) == 1.0
        assert exact_match("", ["x"]) == 0.0

    def test_f1_partial(self):
        score = f1_score("模型记住了噪声", "模型记住了训练噪声")
        assert 0.5 < score < 1.0
        assert f1_score("完全无关", "模型记住了训练噪声") == 0.0
        assert f1_score("模型记住了训练噪声", "模型记住了训练噪声") == 1.0

    def test_pass_at_k(self):
        assert pass_at_k(10, 3, 1) == pytest.approx(0.3, abs=1e-9)
        assert pass_at_k(10, 3, 5) == pytest.approx(0.9167, abs=1e-3)
        assert pass_at_k(10, 3, 10) == 1.0
        assert pass_at_k(1, 0, 1) == 0.0


class TestTasks:
    def test_c3_fixture(self):
        task = get_task("c3")
        items = task.load()
        assert len(items) == 12
        assert "选项：" in items[0].prompt
        assert task.parse_answer("答案是 B") in ("A", "B", "C", "D")
        from llm_eval.tasks.base import EvalItem
        assert task.score("A", EvalItem(id="x", prompt="", gold="A", meta={}))["accuracy"] == 1.0
        # 夹具答案必须均衡（防止全 A / 全 B 造成假高分）
        golds = [i.gold for i in items]
        assert 0.3 < golds.count("A") / len(golds) < 0.7

    def test_xcopa_fixture(self):
        task = get_task("xcopa")
        items = task.load()
        assert len(items) == 12
        assert "原因" in items[0].prompt or "结果" in items[0].prompt
        golds = [i.gold for i in items]
        assert 0.3 < golds.count("A") / len(golds) < 0.7

    def test_qa_fixture(self):
        task = get_task("qa")
        items = task.load()
        assert len(items) == 8
        from llm_eval.tasks.base import EvalItem
        item = EvalItem(id="x", prompt="", gold="模型记住了训练数据", meta={"answers": ["模型记住了训练数据"]})
        scores = task.score("模型记住了训练数据", item)
        assert scores["em"] == 1.0 and scores["f1"] == 1.0


def _cfg(tmp_path: Path, **kw) -> EvalConfig:
    base = dict(adapter="mock", model="mock", tasks=["c3"], limit=6, use_cache=True,
                cache_path=str(tmp_path / "cache.sqlite"), output_dir=str(tmp_path / "out"),
                retries=2, retry_backoff_s=0.01, concurrency=2)
    base.update(kw)
    return EvalConfig(**base)


class TestRunner:
    def test_mock_pipeline_and_reports(self, tmp_path):
        cfg = _cfg(tmp_path)
        adapter = MockAdapter(policy=lambda p: "A")
        tasks = [get_task("c3"), get_task("xcopa")]
        run = __import__("asyncio").run(evaluate_tasks(adapter, tasks, cfg))
        assert len(run.tasks) == 2
        assert run.tasks[0].n == 6
        assert 0.0 <= run.tasks[0].metrics["accuracy"] <= 1.0
        paths = write_reports(run, cfg, tmp_path / "out")
        assert paths["results"].exists() and paths["summary"].exists() and paths["badcases"].exists()
        payload = json.loads(paths["results"].read_text())
        assert payload["adapter"] == "mock"
        assert "accuracy" in payload["tasks"][0]["metrics"]

    def test_cache_hits_avoid_second_call(self, tmp_path):
        cfg = _cfg(tmp_path)
        adapter = MockAdapter(policy=lambda p: "A")
        tasks = [get_task("c3")]
        _ = __import__("asyncio").run(evaluate_tasks(adapter, tasks, cfg))
        first_calls = adapter.calls
        assert first_calls == 6
        adapter2 = MockAdapter(policy=lambda p: "A")
        run2 = __import__("asyncio").run(evaluate_tasks(adapter2, [get_task("c3")], cfg))
        assert adapter2.calls == 0, "第二次运行应全部命中缓存"
        assert run2.tasks[0].cache_hits == 6

    def test_retry_recovers(self, tmp_path):
        cfg = _cfg(tmp_path)
        adapter = MockAdapter(policy=lambda p: "A", fail_times=4)
        run = __import__("asyncio").run(evaluate_tasks(adapter, [get_task("c3")], cfg))
        assert run.tasks[0].api_errors == 0
        assert run.tasks[0].metrics["accuracy"] >= 0.0

    def test_permanent_failure_marks_api_error(self, tmp_path):
        class AlwaysFail(MockAdapter):
            def generate(self, prompts):
                raise AdapterError("永远失败")

        cfg = _cfg(tmp_path)
        run = __import__("asyncio").run(evaluate_tasks(AlwaysFail(), [get_task("c3")], cfg))
        assert run.tasks[0].api_errors == 6
        types = {c["error_type"] for c in run.tasks[0].badcases}
        assert types == {"api_error"}

    def test_parse_failure_badcase_type(self, tmp_path):
        cfg = _cfg(tmp_path)
        adapter = MockAdapter(policy=lambda p: "我无法确定答案")
        run = __import__("asyncio").run(evaluate_tasks(adapter, [get_task("c3")], cfg))
        types = {c["error_type"] for c in run.tasks[0].badcases}
        assert types == {"parse_failure"}
        assert run.tasks[0].parse_failures == 6


class _OpenAIHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        assert self.path == "/v1/chat/completions"
        auth = self.headers.get("Authorization", "")
        if body.get("model") == "fail-model":
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"{}")
            return
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


class TestOpenAIAdapter:
    def test_chat_completions_roundtrip(self, mock_server):
        import asyncio
        adapter = OpenAICompatibleAdapter("test-model", base_url=mock_server, api_key="sk-test")
        out = asyncio.run(adapter.agenerate(["你好"]))
        assert "A" in out[0]
        assert "sk-test" in out[0]

    def test_5xx_raises_adapter_error(self, mock_server):
        import asyncio
        adapter = OpenAICompatibleAdapter("fail-model", base_url=mock_server)
        with pytest.raises(AdapterError):
            asyncio.run(adapter.agenerate(["你好"]))

    def test_runner_with_openai_adapter_and_retries(self, mock_server, tmp_path):
        cfg = _cfg(tmp_path, adapter="openai", model="test-model", base_url=mock_server,
                   concurrency=3, tasks=["xcopa"], limit=4)
        adapter = OpenAICompatibleAdapter("test-model", base_url=mock_server)
        run = __import__("asyncio").run(evaluate_tasks(adapter, [get_task("xcopa")], cfg))
        assert run.tasks[0].api_errors == 0
        assert run.tasks[0].metrics["accuracy"] >= 0.0
