"""Step 6 · badcase：从「错了几个」到「错在哪」。

目标：让这 3 个测试变绿。

error_type 的分类语义：
- parse_failure：输出解析不出答案（修 parser / 改 prompt）；
- api_error：请求最终失败（修并发 / 超时 / 限流配置）；
- wrong_answer：解析成功但答错（修模型 / 数据）。
"""
from __future__ import annotations

import asyncio

from llm_eval.adapters.base import AdapterError
from llm_eval.adapters.mock import MockAdapter
from llm_eval.config import EvalConfig
from llm_eval.runner import evaluate_tasks
from llm_eval.tasks import get_task


def _cfg(tmp_path, **kw) -> EvalConfig:
    base = dict(adapter="mock", model="mock", tasks=["c3"], limit=6, use_cache=False,
                output_dir=str(tmp_path / "out"), concurrency=1, retries=0, retry_backoff_s=0.01)
    base.update(kw)
    return EvalConfig(**base)


class TestBadcaseCollection:
    def test_parse_failure(self, tmp_path):
        adapter = MockAdapter(policy=lambda p: "我无法确定")
        run = asyncio.run(evaluate_tasks(adapter, [get_task("c3")], _cfg(tmp_path)))
        report = run.tasks[0]
        assert report.parse_failures == 6
        assert {c["error_type"] for c in report.badcases} == {"parse_failure"}
        assert all(c["prediction"] is None for c in report.badcases)

    def test_api_error_when_generation_fails(self, tmp_path):
        class AlwaysFail(MockAdapter):
            def generate(self, prompts):
                raise AdapterError("永远失败")

        run = asyncio.run(evaluate_tasks(AlwaysFail(), [get_task("c3")], _cfg(tmp_path)))
        report = run.tasks[0]
        assert report.api_errors == 6
        assert {c["error_type"] for c in report.badcases} == {"api_error"}
        assert all(c["raw_output"] == "" for c in report.badcases)

    def test_wrong_answer_badcase_structure(self, tmp_path):
        adapter = MockAdapter(policy=lambda p: "D")
        run = asyncio.run(evaluate_tasks(adapter, [get_task("c3")], _cfg(tmp_path)))
        wrong = [c for c in run.tasks[0].badcases if c["error_type"] == "wrong_answer"]
        assert wrong, "夹具里存在非 D 的答案，应产生 wrong_answer badcase"
        case = wrong[0]
        for key in ("task", "id", "prompt", "gold", "prediction", "raw_output", "error_type", "scores"):
            assert key in case
        assert case["prediction"] in ("A", "B", "C", "D")
        assert case["task"] == "c3"
