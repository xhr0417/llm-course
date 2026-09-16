"""XCOPATask：因果推理 2 选 1（中文子集，连接第 23 章 XCOPA 案例）。

数据行格式：
    {"id": "...", "premise": "该物品用气泡包装纸包着。", "question": "cause",
     "choice1": "它很易碎。", "choice2": "它很小。", "answer": "A"}
question ∈ {cause, effect}：
    cause  → 问「原因」；effect → 问「结果」。
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from llm_eval.parsers import parse_choice
from llm_eval.tasks.base import EvalItem, EvalTask

QUESTION_ZH = {"cause": "以下哪个选项最可能是该情况的原因？", "effect": "以下哪个选项最可能是该情况的结果？"}

PROMPT_TEMPLATE = """{premise}

{question}

选项：
A. {choice1}
B. {choice2}

要求：只回答一个选项字母（A/B），不要解释。"""


class XCOPATask(EvalTask):
    name = "xcopa"
    primary_metric = "accuracy"

    def default_data_path(self) -> Path:
        return Path(__file__).resolve().parents[3] / "data" / "mini_xcopa.jsonl"

    def build_prompt(self, row: dict) -> str:
        return PROMPT_TEMPLATE.format(premise=row["premise"],
                                      question=QUESTION_ZH.get(row["question"], row["question"]),
                                      choice1=row["choice1"], choice2=row["choice2"])

    def parse_answer(self, raw: str) -> Optional[str]:
        return parse_choice(raw, valid="AB")

    def score(self, prediction: Optional[str], item: EvalItem) -> dict[str, float]:
        return {"accuracy": 1.0 if prediction == item.gold else 0.0}

    def _to_items(self, rows: list[dict]) -> list[EvalItem]:
        items = []
        for row in rows:
            items.append(EvalItem(
                id=str(row["id"]),
                prompt=self.build_prompt(row),
                gold=row["answer"].strip().upper(),
                meta={"premise": row["premise"], "question": row["question"],
                      "choices": [row["choice1"], row["choice2"]]},
            ))
        return items
