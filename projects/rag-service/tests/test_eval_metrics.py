"""pytest：检索指标定义（Hit@k / Recall@k / MRR / nDCG@k 与 doc 级去重）。"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from rag_service.eval_metrics import (collapse_to_docs, evaluate_ranking, hit_at_k,  # noqa: E402
                                      macro_average, ndcg_at_k, recall_at_k, reciprocal_rank)


class TestCollapseToDocs:
    def test_dedupe_keeps_first_rank(self):
        chunk_docs = ["A", "A", "B", "A", "C", "B"]
        assert collapse_to_docs(chunk_docs) == ["A", "B", "C"]

    def test_empty(self):
        assert collapse_to_docs([]) == []


class TestMetricDefinitions:
    """规格中的两个标准用例（gold 有 2 个相关文档）。"""

    GOLD = ["A", "B"]

    def test_case1_ranking_A_C_B(self):
        ranking = ["A", "C", "B"]
        assert hit_at_k(ranking, self.GOLD, 3) == 1.0
        assert recall_at_k(ranking, self.GOLD, 3) == 1.0
        assert reciprocal_rank(ranking, self.GOLD) == 1.0
        expected = (1 / math.log2(2) + 1 / math.log2(4)) / (1 / math.log2(2) + 1 / math.log2(3))
        assert ndcg_at_k(ranking, self.GOLD, 3) == pytest.approx(expected, abs=1e-9)
        assert ndcg_at_k(ranking, self.GOLD, 3) < 1.0  # B 排在第 3，被折扣

    def test_case2_ranking_A_C_D(self):
        ranking = ["A", "C", "D"]
        assert hit_at_k(ranking, self.GOLD, 3) == 1.0
        assert recall_at_k(ranking, self.GOLD, 3) == pytest.approx(0.5)
        assert reciprocal_rank(ranking, self.GOLD) == 1.0
        assert ndcg_at_k(ranking, self.GOLD, 3) < 1.0

    def test_hit_vs_recall_distinction(self):
        # 只命中两个相关文档中的一个：Hit=1 但 Recall=0.5（旧实现会把两者混为一谈）
        ranking = ["A", "X", "Y"]
        assert hit_at_k(ranking, self.GOLD, 3) == 1.0
        assert recall_at_k(ranking, self.GOLD, 3) == 0.5

    def test_perfect_ranking(self):
        ranking = ["B", "A", "C"]
        assert ndcg_at_k(ranking, self.GOLD, 3) == pytest.approx(1.0)

    def test_no_hit(self):
        ranking = ["X", "Y", "Z"]
        metrics = evaluate_ranking(ranking, self.GOLD, 3)
        assert metrics == {"hit@k": 0.0, "recall@k": 0.0, "mrr": 0.0, "ndcg@k": 0.0}

    def test_k_truncation(self):
        ranking = ["X", "Y", "A", "B"]
        assert recall_at_k(ranking, self.GOLD, 2) == 0.0
        assert recall_at_k(ranking, self.GOLD, 4) == 1.0
        assert hit_at_k(ranking, self.GOLD, 2) == 0.0

    def test_empty_gold_and_empty_ranking(self):
        assert recall_at_k(["A"], [], 3) == 0.0
        assert ndcg_at_k([], ["A"], 3) == 0.0
        assert reciprocal_rank([], ["A"]) == 0.0

    def test_mrr_second_relevant(self):
        assert reciprocal_rank(["X", "B", "A"], self.GOLD) == pytest.approx(0.5)


class TestMacroAverage:
    def test_average_over_queries(self):
        rows = [
            {"hit@k": 1.0, "recall@k": 1.0, "mrr": 1.0, "ndcg@k": 1.0},
            {"hit@k": 1.0, "recall@k": 0.5, "mrr": 0.5, "ndcg@k": 0.5},
        ]
        avg = macro_average(rows)
        assert avg["recall@k"] == pytest.approx(0.75)
        assert avg["mrr"] == pytest.approx(0.75)

    def test_empty(self):
        avg = macro_average([])
        assert avg["recall@k"] == 0.0
