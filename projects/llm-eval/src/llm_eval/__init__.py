"""llm_eval —— Mini LLM Evaluation Harness（Capstone 1）。

统一入口：ModelAdapter（怎么要答案）× EvalTask（怎么问/怎么判分）
          → Runner（并发 + 重试 + 缓存）→ Reports（results.json / summary.md / badcases.jsonl）
"""
from llm_eval.adapters import get_adapter
from llm_eval.config import EvalConfig
from llm_eval.runner import evaluate_tasks
from llm_eval.tasks import get_task

__all__ = ["EvalConfig", "get_adapter", "get_task", "evaluate_tasks"]
__version__ = "0.1.0"
