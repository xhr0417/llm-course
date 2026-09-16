"""任务注册表。"""
from __future__ import annotations

from llm_eval.tasks.base import EvalItem, EvalTask
from llm_eval.tasks.c3 import C3Task
from llm_eval.tasks.qa import QATask
from llm_eval.tasks.xcopa import XCOPATask

TASK_REGISTRY = {"c3": C3Task, "xcopa": XCOPATask, "qa": QATask}

__all__ = ["EvalItem", "EvalTask", "C3Task", "XCOPATask", "QATask", "get_task"]


def get_task(name: str, data_path=None) -> EvalTask:
    if name not in TASK_REGISTRY:
        raise ValueError(f"未知任务：{name}（可用：{list(TASK_REGISTRY)}）")
    return TASK_REGISTRY[name](data_path=data_path)
