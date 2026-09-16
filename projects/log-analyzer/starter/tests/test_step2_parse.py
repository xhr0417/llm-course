"""Step 2 · 解析第一条训练日志：dataclass / typing / 正则 + KV 切分。

目标：让这 6 个测试变绿。这是本项目数据流的入口：
    文本行 → LogEvent(timestamp, level, message, fields)
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest

from log_analyzer.parser import LogEvent, parse_line, parse_lines, parse_log_file

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "samples" / "train.log"

CANONICAL = "2025-01-10 09:00:02 INFO  step=10 loss=7.812 lr=3.0e-4 tokens/s=1180"


class TestParseLine:
    def test_returns_log_event(self):
        event = parse_line(CANONICAL)
        assert isinstance(event, LogEvent)
        assert event.level == "INFO"
        assert event.timestamp == datetime(2025, 1, 10, 9, 0, 2)

    def test_extracts_kv_fields(self):
        event = parse_line(CANONICAL)
        assert event.fields["lr"] == "3.0e-4"
        assert "step=10" in event.message

    def test_step_and_loss_typed_values(self):
        event = parse_line(CANONICAL)
        assert event.step == 10
        assert event.loss == pytest.approx(7.812)

    def test_tokens_per_sec_key_has_slash(self):
        # 键名是 tokens/s——不是 tokens_per_sec。正则必须允许斜杠。
        assert parse_line(CANONICAL).tokens_per_sec == pytest.approx(1180)

    def test_line_without_fields(self):
        event = parse_line("2025-01-10 09:00:01 INFO  start training run=small-llm seed=42")
        assert event is not None
        assert event.step is None
        assert event.loss is None

    def test_blank_and_garbage_return_none(self):
        assert parse_line("") is None
        assert parse_line("   ") is None
        assert parse_line("this is not a log line") is None


class TestParseFile:
    def test_parse_lines_skips_unparsable(self):
        events = list(parse_lines(["", CANONICAL, "garbage", ""]))
        assert len(events) == 1

    def test_parse_log_file_reads_all_events(self):
        events = parse_log_file(SAMPLE)
        assert len(events) == 22
        assert events[0].level == "INFO"
