"""Step 1 · 读取日志文件：pathlib / encoding / 文件不存在的语义。

目标：让这 4 个测试变绿。先预测：文件不存在时，应该抛异常还是返回空列表？
"""
from __future__ import annotations

from pathlib import Path

import pytest

from log_analyzer.parser import load_lines

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "samples" / "train.log"


class TestLoadLines:
    def test_reads_utf8_file(self, tmp_path):
        f = tmp_path / "zh.log"
        f.write_text("你好，世界\n训练开始\n", encoding="utf-8")
        assert load_lines(f) == ["你好，世界", "训练开始"]

    def test_strips_trailing_newlines(self):
        lines = load_lines(SAMPLE)
        assert lines
        assert all(not line.endswith("\n") for line in lines)

    def test_counts_real_sample(self):
        # samples/train.log 是 22 行的真实训练日志
        assert len(load_lines(SAMPLE)) == 22

    def test_missing_file_raises(self, tmp_path):
        # 缺文件不是「空结果」，而是一个必须被处理的事件——不要吞掉它
        with pytest.raises(FileNotFoundError):
            load_lines(tmp_path / "nope.log")

    def test_empty_file_returns_empty_list(self, tmp_path):
        f = tmp_path / "empty.log"
        f.write_text("", encoding="utf-8")
        assert load_lines(f) == []
