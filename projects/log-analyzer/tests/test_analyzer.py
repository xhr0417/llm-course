"""pytest 测试：解析器 / 统计 / CLI 输出。"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from log_analyzer.cli import format_report, main  # noqa: E402
from log_analyzer.parser import LogEvent, parse_line, parse_log_file  # noqa: E402
from log_analyzer.stats import analyze  # noqa: E402

SAMPLE = PROJECT_ROOT / "samples" / "train.log"
SAMPLE_NAN = PROJECT_ROOT / "samples" / "train_nan.log"


class TestParser:
    def test_parse_standard_line(self):
        event = parse_line("2025-01-10 09:00:02 INFO  step=10 loss=7.812 lr=3.0e-4 tokens/s=1180")
        assert isinstance(event, LogEvent)
        assert event.level == "INFO"
        assert event.step == 10
        assert event.loss == pytest.approx(7.812)
        assert event.tokens_per_sec == pytest.approx(1180)

    def test_parse_skips_blank_and_garbage(self):
        assert parse_line("") is None
        assert parse_line("    ") is None
        assert parse_line("this is not a log line") is None

    def test_parse_handles_missing_fields(self):
        event = parse_line("2025-01-10 09:00:01 INFO  start training run=small-llm")
        assert event is not None
        assert event.step is None
        assert event.loss is None

    def test_parse_file_counts(self):
        events = parse_log_file(SAMPLE)
        assert len(events) >= 20

    def test_parse_file_missing_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            parse_log_file(tmp_path / "nope.log")


class TestStats:
    def test_final_and_best_loss(self):
        stats = analyze(parse_log_file(SAMPLE), total_lines=len(SAMPLE.read_text().splitlines()))
        assert stats.final_loss == pytest.approx(2.271)
        assert stats.best_loss == pytest.approx(2.271)
        assert stats.best_step == 1000

    def test_step_range_and_throughput(self):
        stats = analyze(parse_log_file(SAMPLE))
        assert stats.steps[0] == 10
        assert stats.steps[-1] == 1000
        assert 4500 < stats.avg_tokens_per_sec < 6000

    def test_warnings_collected(self):
        stats = analyze(parse_log_file(SAMPLE))
        assert len(stats.warnings) == 3
        assert not stats.has_nan

    def test_nan_detected(self):
        stats = analyze(parse_log_file(SAMPLE_NAN))
        assert stats.has_nan
        assert len(stats.errors) == 2

    def test_healthy_run_has_no_nan(self):
        stats = analyze(parse_log_file(SAMPLE))
        assert not stats.has_nan
        assert stats.warnings
        assert stats.to_dict()["final_loss"] == pytest.approx(2.271)


class TestCLI:
    def test_json_output(self, capsys):
        code = main([str(SAMPLE), "--json"])
        assert code == 0
        payload = json.loads(capsys.readouterr().out)
        assert payload["final_loss"] == pytest.approx(2.271)
        assert payload["has_nan"] is False
        assert payload["num_warnings"] == 3

    def test_missing_file_exit_code(self, tmp_path):
        assert main([str(tmp_path / "missing.log")]) == 2

    def test_text_report_contains_keys(self):
        stats = analyze(parse_log_file(SAMPLE))
        report = format_report(stats)
        for key in ["final loss", "best", "平均吞吐", "warning", "NaN"]:
            assert key in report

    def test_subprocess_entrypoint(self):
        result = subprocess.run(
            [sys.executable, "-m", "log_analyzer.cli", str(SAMPLE), "--json"],
            cwd=PROJECT_ROOT,
            env={"PYTHONPATH": str(PROJECT_ROOT / "src"), "PATH": "/usr/bin:/bin"},
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        payload = json.loads(result.stdout)
        assert payload["steps"]["last"] == 1000
