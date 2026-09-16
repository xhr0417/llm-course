"""Step 3b · XCOPATask：因果推理 2 选 1（cause / effect 转成中文提问）。

目标：让这一组测试变绿。规则和 C3Task 一样，只是合法选项是 A/B。
"""
from __future__ import annotations

from llm_eval.tasks import get_task
from llm_eval.tasks.base import EvalItem


def _task():
    return get_task("xcopa")


class TestXCOPATask:
    def test_loads_12_items(self):
        items = _task().load()
        assert len(items) == 12

    def test_prompt_asks_cause_or_effect(self):
        prompt = _task().load()[0].prompt
        assert "原因" in prompt or "结果" in prompt
        assert "选项：" in prompt

    def test_gold_is_balanced(self):
        golds = [i.gold for i in _task().load()]
        assert all(g in ("A", "B") for g in golds)
        assert 0.3 < golds.count("A") / len(golds) < 0.7

    def test_parse_answer_and_score(self):
        task = _task()
        item = EvalItem(id="x", prompt="", gold="B", meta={})
        assert task.parse_answer("我认为选 B") == "B"
        assert task.parse_answer("C") is None
        assert task.score("B", item)["accuracy"] == 1.0
        assert task.score("A", item)["accuracy"] == 0.0
