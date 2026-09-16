"""Step 3a · C3Task：中文阅读理解 4 选 1。

目标：让这一组测试变绿。
关键纪律：夹具答案必须均衡（0.3 < A 占比 < 0.7），否则「全选 A」的假模型会得到假高分。
"""
from __future__ import annotations

from llm_eval.tasks import get_task
from llm_eval.tasks.base import EvalItem


def _task():
    return get_task("c3")


class TestC3Fixture:
    def test_loads_12_items(self):
        items = _task().load()
        assert len(items) == 12

    def test_prompt_contains_context_and_options(self):
        item = _task().load()[0]
        assert "材料：" in item.prompt
        assert "选项：" in item.prompt
        assert "A. " in item.prompt and "D. " in item.prompt

    def test_gold_is_balanced(self):
        golds = [i.gold for i in _task().load()]
        assert all(g in ("A", "B", "C", "D") for g in golds)
        assert 0.3 < golds.count("A") / len(golds) < 0.7

    def test_item_fields(self):
        item = _task().load()[0]
        assert item.id
        assert item.gold
        assert "question" in item.meta and "options" in item.meta


class TestC3Scoring:
    def test_parse_answer(self):
        task = _task()
        assert task.parse_answer("答案是 B") == "B"
        assert task.parse_answer("我不知道") is None

    def test_score_correct_and_wrong(self):
        task = _task()
        item = EvalItem(id="x", prompt="", gold="A", meta={})
        assert task.score("A", item)["accuracy"] == 1.0
        assert task.score("B", item)["accuracy"] == 0.0
        assert task.score(None, item)["accuracy"] == 0.0
