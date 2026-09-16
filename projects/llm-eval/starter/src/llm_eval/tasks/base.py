"""EvalTask 基类：load / build_prompt / parse_answer / score 四件套。"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class EvalItem:
    id: str
    prompt: str
    gold: str
    meta: dict = field(default_factory=dict)


class EvalTask(ABC):
    """评测任务统一接口。

    - load():           读数据 → EvalItem 列表（prompt 已构造好）
    - parse_answer():   原始输出 → 规范化答案
    - score():          规范化答案 × 标准答案 → {指标名: 数值}
    - error_type():     失败原因分类（parse_failure / wrong_answer / empty_output）
    """

    name: str = "task"
    primary_metric: str = "accuracy"

    def __init__(self, data_path: Optional[Path | str] = None):
        self.data_path = Path(data_path) if data_path else self.default_data_path()

    @abstractmethod
    def default_data_path(self) -> Path:
        ...

    @abstractmethod
    def build_prompt(self, row: dict) -> str:
        ...

    @abstractmethod
    def parse_answer(self, raw: str) -> Optional[str]:
        ...

    @abstractmethod
    def score(self, prediction: Optional[str], item: EvalItem) -> dict[str, float]:
        ...

    def error_type(self, raw: str, prediction: Optional[str], item: EvalItem) -> str:
        if not (raw or "").strip():
            return "empty_output"
        if prediction is None:
            return "parse_failure"
        return "wrong_answer"

    def load(self) -> list[EvalItem]:
        rows = []
        with Path(self.data_path).open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
        return self._to_items(rows)

    @abstractmethod
    def _to_items(self, rows: list[dict]) -> list[EvalItem]:
        ...
