"""Step 4 · 统计训练结果：聚合指标（final / best / 吞吐 / warning / NaN）。

目标：让这 6 个测试变绿。运行之前先预测：
- final loss 和 best loss 哪个大？
- samples/train.log 的平均吞吐大约是多少 tokens/s？
"""
from __future__ import annotations

from pathlib import Path

import pytest

from log_analyzer.parser import parse_log_file
from log_analyzer.stats import analyze

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "samples" / "train.log"
SAMPLE_NAN = ROOT / "samples" / "train_nan.log"


def _stats(path=SAMPLE):
    text_lines = Path(path).read_text(encoding="utf-8").splitlines()
    return analyze(parse_log_file(path), total_lines=len(text_lines))


class TestStats:
    def test_final_and_best_loss(self):
        stats = _stats()
        assert stats.final_loss == pytest.approx(2.271)
        assert stats.best_loss == pytest.approx(2.271)

    def test_step_range(self):
        stats = _stats()
        assert stats.steps[0] == 10
        assert stats.steps[-1] == 1000

    def test_average_throughput(self):
        # 17 个吞吐样本，平均值约 4936 tokens/s（真实日志）
        stats = _stats()
        assert 4500 < stats.avg_tokens_per_sec < 6000

    def test_warnings_and_errors_collected(self):
        stats = _stats()
        assert len(stats.warnings) == 3
        assert len(stats.errors) == 0
        assert not stats.has_nan

    def test_nan_detected(self):
        stats = _stats(SAMPLE_NAN)
        assert stats.has_nan
        assert len(stats.errors) == 2

    def test_to_dict_is_json_friendly(self):
        payload = _stats().to_dict()
        assert payload["final_loss"] == pytest.approx(2.271)
        assert payload["num_warnings"] == 3
        assert payload["has_nan"] is False
        assert payload["steps"] == {"first": 10, "last": 1000}
        assert payload["parsed_events"] == 22
