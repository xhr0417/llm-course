"""C3Task：中文阅读理解 4 选 1（连接第 23 章 C3 案例）。

这是 starter 的【待实现文件】：
- Step 3a：实现 parse_answer / score / _to_items

数据行格式（data/mini_c3.jsonl 或 scripts/fetch_data.py 产出的真实切片）：
    {"id": "...", "context": "男：... 女：...", "question": "女的到底生谁的气?",
     "options": ["老师", "学生", "丈夫", "孩子"], "answer": "C"}   # answer 为字母

PROMPT_TEMPLATE / default_data_path / build_prompt 已给出。
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from llm_eval.parsers import parse_choice
from llm_eval.tasks.base import EvalItem, EvalTask

PROMPT_TEMPLATE = """阅读下面的材料，回答问题。

材料：{context}

问题：{question}

选项：
A. {optA}
B. {optB}
C. {optC}
D. {optD}

要求：只回答一个选项字母（A/B/C/D），不要解释。"""


class C3Task(EvalTask):
    name = "c3"
    primary_metric = "accuracy"

    def default_data_path(self) -> Path:
        return Path(__file__).resolve().parents[3] / "data" / "mini_c3.jsonl"

    def build_prompt(self, row: dict) -> str:
        options = row["options"]
        return PROMPT_TEMPLATE.format(context=row["context"], question=row["question"],
                                      optA=options[0], optB=options[1], optC=options[2], optD=options[3])

    def parse_answer(self, raw: str) -> Optional[str]:
        """Step 3a：借用 parse_choice，只在 A/B/C/D 里取值。"""
        raise NotImplementedError("Step 3a：实现 C3Task.parse_answer（parse_choice(raw, valid='ABCD')）")

    def score(self, prediction: Optional[str], item: EvalItem) -> dict[str, float]:
        """Step 3a：返回 {"accuracy": 1.0 或 0.0}（prediction 为 None 时 0.0）。"""
        raise NotImplementedError("Step 3a：实现 C3Task.score")

    def _to_items(self, rows: list[dict]) -> list[EvalItem]:
        """Step 3a：每行 → EvalItem(id, prompt, gold, meta)。

        - id 用 str(row["id"])；
        - prompt 用 self.build_prompt(row)；
        - gold 用 row["answer"].strip().upper()；
        - meta 至少带 question / options / context。
        """
        raise NotImplementedError("Step 3a：实现 C3Task._to_items")
