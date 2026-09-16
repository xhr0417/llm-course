"""Step 3 · 现实日志没有这么干净：WARNING / ERROR / NaN / 未知字段 / 坏 KV。

目标：让这 6 个测试变绿——它们会逼你放弃 `except: pass` 式的偷懒，
认真想清楚「哪些行要跳过、哪些字段解析失败应该是 None 而不是崩溃」。
"""
from __future__ import annotations

from pathlib import Path

from log_analyzer.parser import parse_line, parse_log_file

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_NAN = ROOT / "samples" / "train_nan.log"


class TestMessyLines:
    def test_warning_line(self):
        event = parse_line("2025-01-10 09:00:06 WARNING step=25 grad_norm=12.53 (> clip 1.0)")
        assert event is not None
        assert event.level == "WARNING"
        assert event.step == 25
        assert event.loss is None

    def test_error_nan_line(self):
        event = parse_line(
            "2025-01-11 10:00:10 ERROR step=34 loss is NaN — abort candidate, check lr / dtype"
        )
        assert event is not None
        assert event.level == "ERROR"
        assert event.loss is None
        assert "nan" in event.message.lower()

    def test_unknown_fields_are_kept(self):
        # 未来日志格式会加新字段——解析器不应该把它丢掉或崩溃
        event = parse_line("2025-01-10 09:00:02 INFO  step=10 loss=7.812 new_metric=0.42")
        assert event.fields["new_metric"] == "0.42"

    def test_bad_value_does_not_crash(self):
        # loss=abc 是坏值：属性应该返回 None，而不是让整个程序崩掉
        event = parse_line("2025-01-10 09:00:02 INFO  step=10 loss=abc tokens/s=1180")
        assert event is not None
        assert event.loss is None
        assert event.tokens_per_sec == 1180.0

    def test_continuation_line_is_skipped(self):
        # 没有时间戳的续行（例如 traceback）不是独立事件
        assert parse_line("  File \"train.py\", line 42, in main") is None

    def test_nan_log_parses_all_lines(self):
        events = parse_log_file(SAMPLE_NAN)
        assert len(events) == len(Path(SAMPLE_NAN).read_text(encoding="utf-8").splitlines())
        levels = [e.level for e in events]
        assert levels.count("WARNING") == 2
        assert levels.count("ERROR") == 2
