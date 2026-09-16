"""Step 12 · 报告：results.json / summary.md / badcases.jsonl。

目标：让这一组测试变绿。
报告是评测系统的「交付物」：results.json 给脚本消费，summary.md 给人看，
badcases.jsonl 逐条记录失败样本（error_type 决定下一步修什么）。
"""
from __future__ import annotations

import json

from llm_eval.config import EvalConfig
from llm_eval.reports import write_reports
from llm_eval.runner import RunReport, TaskReport


def _fake_run() -> RunReport:
    """手工构造一个 RunReport，让本步不依赖 Runner 是否已经实现。"""
    run = RunReport(adapter="mock", model="mock-model",
                    started_at="2026-01-01T00:00:00", finished_at="2026-01-01T00:00:01")
    run.duration_s = 1.0
    run.tasks.append(TaskReport(
        task="c3", n=10, metrics={"accuracy": 0.6},
        cache_hits=0, api_errors=0, parse_failures=1,
        badcases=[{
            "task": "c3", "id": "mini-c3-1", "prompt": "材料：……",
            "gold": "C", "prediction": None, "raw_output": "我不知道",
            "error_type": "parse_failure", "scores": {"accuracy": 0.0},
        }],
    ))
    return run


def _write(tmp_path):
    cfg = EvalConfig(adapter="mock", model="mock-model", tasks=["c3"], limit=10,
                     output_dir=str(tmp_path / "out"), use_cache=False)
    return write_reports(_fake_run(), cfg, tmp_path / "out")


class TestReports:
    def test_three_files_created(self, tmp_path):
        paths = _write(tmp_path)
        assert set(paths) == {"results", "summary", "badcases"}
        assert (tmp_path / "out" / "results.json").exists()
        assert (tmp_path / "out" / "summary.md").exists()
        assert (tmp_path / "out" / "badcases.jsonl").exists()

    def test_results_json_content(self, tmp_path):
        paths = _write(tmp_path)
        payload = json.loads(paths["results"].read_text(encoding="utf-8"))
        assert payload["adapter"] == "mock"
        assert payload["model"] == "mock-model"
        assert payload["tasks"][0]["metrics"]["accuracy"] == 0.6
        assert payload["tasks"][0]["n"] == 10

    def test_summary_contains_table_and_repro_command(self, tmp_path):
        paths = _write(tmp_path)
        text = paths["summary"].read_text(encoding="utf-8")
        assert "accuracy" in text
        assert "60.0%" in text, "指标应以百分比呈现（60.0% 风格）"
        assert "python run_eval.py" in text

    def test_badcases_jsonl_parses(self, tmp_path):
        paths = _write(tmp_path)
        lines = [l for l in paths["badcases"].read_text(encoding="utf-8").splitlines() if l.strip()]
        assert len(lines) == 1
        case = json.loads(lines[0])
        assert case["error_type"] == "parse_failure"
        assert case["gold"] == "C"
