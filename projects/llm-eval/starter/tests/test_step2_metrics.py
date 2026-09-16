"""Step 2 · 指标：accuracy / exact_match / f1_score。

目标：让这一组测试变绿。
注意边界：accuracy(0, 0) 是 nan（评测里「一道题都没跑」和「全错」是两回事）。
"""
from __future__ import annotations

from llm_eval.metrics import accuracy, exact_match, f1_score


class TestAccuracy:
    def test_zero_total_is_nan(self):
        assert accuracy(0, 0) != accuracy(0, 0)  # nan != nan

    def test_zero_correct(self):
        assert accuracy(0, 10) == 0.0

    def test_all_correct(self):
        assert accuracy(10, 10) == 1.0


class TestExactMatch:
    def test_normalization_case_and_punctuation(self):
        assert exact_match("Hello, World!", ["hello world"]) == 1.0

    def test_normalization_whitespace(self):
        assert exact_match("不 知道", ["不知道"]) == 1.0

    def test_empty_prediction(self):
        assert exact_match("", ["x"]) == 0.0

    def test_wrong_answer(self):
        assert exact_match("苹果", ["香蕉"]) == 0.0

    def test_any_gold_matches(self):
        assert exact_match("模型记住了训练数据", ["模型记住了噪声", "模型记住了训练数据"]) == 1.0


class TestF1:
    def test_identical_is_one(self):
        assert f1_score("模型记住了训练噪声", "模型记住了训练噪声") == 1.0

    def test_partial_overlap(self):
        score = f1_score("模型记住了噪声", "模型记住了训练噪声")
        assert 0.5 < score < 1.0

    def test_disjoint_is_zero(self):
        assert f1_score("完全无关", "模型记住了训练噪声") == 0.0

    def test_empty_is_zero(self):
        assert f1_score("", "模型记住了训练噪声") == 0.0
