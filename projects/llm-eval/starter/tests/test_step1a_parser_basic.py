"""Step 1a · parser 基本格式：只要求处理最干净的几种输出。

目标：让这 5 个用例变绿。
先预测：parse_choice("c") 应该返回 "c" 还是 "C"？
"""
from __future__ import annotations

import pytest

from llm_eval.parsers import parse_choice


class TestParserBasic:
    @pytest.mark.parametrize("raw,expected", [
        ("C", "C"),
        ("c", "C"),
        ("C.", "C"),
        ("A", "A"),
    ])
    def test_single_letter_formats(self, raw, expected):
        assert parse_choice(raw, valid="ABCD") == expected

    def test_returns_none_when_letter_outside_valid(self):
        assert parse_choice("B", valid="ACD") is None
