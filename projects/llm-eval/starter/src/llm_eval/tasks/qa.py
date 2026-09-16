"""QATask：开放问答，EM + F1（自定义数据集）。

本文件已给出（given as reference）：作为「多指标打分（em + f1）」的完整参考实现，
不需要你修改——对照它理解 EvalTask 四件套即可。

数据行格式：
    {"id": "...", "question": "...", "answers": ["标准答案1", "标准答案2"]}
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from llm_eval.metrics import exact_match, f1_score
from llm_eval.tasks.base import EvalItem, EvalTask

PROMPT_TEMPLATE = """回答问题，尽量简洁。

问题：{question}

要求：直接给出答案，不要解释。"""


class QATask(EvalTask):
    name = "qa"
    primary_metric = "f1"

    def default_data_path(self) -> Path:
        return Path(__file__).resolve().parents[3] / "data" / "mini_qa.jsonl"

    def build_prompt(self, row: dict) -> str:
        return PROMPT_TEMPLATE.format(question=row["question"])

    def parse_answer(self, raw: str) -> Optional[str]:
        text = (raw or "").strip()
        if not text:
            return None
        return text.split("\n")[0].strip()  # 只取第一行，避免模型附送解释

    def score(self, prediction: Optional[str], item: EvalItem) -> dict[str, float]:
        golds = item.meta["answers"]
        best_em = max(exact_match(prediction, [g]) for g in golds)
        best_f1 = max(f1_score(prediction, g) for g in golds)
        return {"em": best_em, "f1": best_f1}

    def error_type(self, raw: str, prediction: Optional[str], item: EvalItem) -> str:
        if not (raw or "").strip():
            return "empty_output"
        base = super().error_type(raw, prediction, item)
        if base == "wrong_answer" and exact_match(prediction, item.meta["answers"]) == 0 and \
           max(f1_score(prediction, g) for g in item.meta["answers"]) < 0.5:
            return "low_f1"
        return base

    def _to_items(self, rows: list[dict]) -> list[EvalItem]:
        items = []
        for row in rows:
            items.append(EvalItem(
                id=str(row["id"]),
                prompt=self.build_prompt(row),
                gold=row["answers"][0],
                meta={"question": row["question"], "answers": row["answers"]},
            ))
        return items
