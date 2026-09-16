"""Step 5 · Runner 端到端：mock 适配器 × 多个任务。

目标：让这 3 个测试变绿。
这是第一个「完整管线」测试：load → generate → parse → score → TaskReport。
"""
from __future__ import annotations

import asyncio

from llm_eval.adapters.mock import MockAdapter
from llm_eval.config import EvalConfig
from llm_eval.runner import evaluate_tasks
from llm_eval.tasks import get_task


def _cfg(tmp_path, **kw) -> EvalConfig:
    base = dict(adapter="mock", model="mock", tasks=["c3"], limit=6, use_cache=False,
                output_dir=str(tmp_path / "out"), concurrency=1, retries=0, retry_backoff_s=0.01)
    base.update(kw)
    return EvalConfig(**base)


class TestRunnerEndToEnd:
    def test_single_task_with_mock(self, tmp_path):
        run = asyncio.run(evaluate_tasks(MockAdapter(), [get_task("c3")], _cfg(tmp_path)))
        assert len(run.tasks) == 1
        report = run.tasks[0]
        assert report.task == "c3"
        assert report.n == 6
        assert "accuracy" in report.metrics
        assert 0.0 <= report.metrics["accuracy"] <= 1.0

    def test_two_tasks_are_both_evaluated(self, tmp_path):
        run = asyncio.run(evaluate_tasks(MockAdapter(), [get_task("c3"), get_task("xcopa")],
                                         _cfg(tmp_path)))
        assert [t.task for t in run.tasks] == ["c3", "xcopa"]
        assert all(t.n == 6 for t in run.tasks)
        assert all("accuracy" in t.metrics for t in run.tasks)

    def test_limit_is_respected(self, tmp_path):
        run = asyncio.run(evaluate_tasks(MockAdapter(), [get_task("c3")], _cfg(tmp_path, limit=3)))
        assert run.tasks[0].n == 3

    def test_run_report_metadata(self, tmp_path):
        run = asyncio.run(evaluate_tasks(MockAdapter(), [get_task("c3")], _cfg(tmp_path)))
        assert run.adapter == "mock"
        assert run.model == "mock"
        assert run.started_at and run.finished_at
        assert run.duration_s >= 0.0
