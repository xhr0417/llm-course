"""Step 1b · parser 鲁棒性：真实模型不会乖乖只输出一个字母。

目标：让这一组测试变绿。
必测的 12 种格式来自真实模型输出——「答案是 C」「**D**」「C) 因为……」……
parser 的 bug 会伪装成「模型能力差」，所以这里一条都不能少。
"""
from __future__ import annotations

import pytest

from llm_eval.parsers import parse_choice, strip_special


class TestParserRobust:
    @pytest.mark.parametrize("raw,expected", [
        ("C", "C"),
        ("c", "C"),
        ("C.", "C"),
        ("（C）", "C"),
        ("[B]", "B"),
        ("答案是 C", "C"),
        ("答案：D", "D"),
        ("我认为选 B", "B"),
        ("**D**", "D"),
        ("C) 因为天气原因", "C"),
        ("B. 因为它很易碎", "B"),
        ("The correct answer is C.", "C"),
    ])
    def test_common_model_outputs(self, raw, expected):
        assert parse_choice(raw, valid="ABCD") == expected

    def test_failure_cases_return_none(self):
        assert parse_choice("我不知道", valid="ABCD") is None
        assert parse_choice("", valid="ABCD") is None
        assert parse_choice("E", valid="ABCD") is None
        assert parse_choice("ABCD 全选", valid="ABCD") is None


class TestStripSpecial:
    def test_strip_im_end(self):
        assert strip_special("C<|im_end|>") == "C"

    def test_strip_around_content(self):
        assert strip_special("<|im_start|>你好<|im_end|>") == "你好"
