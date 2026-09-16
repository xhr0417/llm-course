"""Runner：并发 + 重试 + 缓存 + badcase 收集（评测系统的发动机）。

这是 starter 的【待实现文件】：
- Step 5：实现 evaluate_task / evaluate_tasks（先用 mock 跑通端到端）
- Step 6：badcase 收集与 error_type 分类
- Step 8：缓存查询与写回（注意：空响应不写缓存）
- Step 10：并发（adapter.supports_concurrency + asyncio.Semaphore(cfg.concurrency)）
- Step 11：重试（只重试 AdapterError；FatalAdapterError 立即放弃；指数退避）

TaskReport / RunReport 已给出。参考流程（见课程第 27 章）：
    对每个 task：
      items = task.load()[:cfg.limit]
      ① 查缓存（命中直接用）→ ② 生成缺失的 prompt → ③ strip_special + parse_answer
      → ④ task.score 累计指标 → ⑤ 非满分样本进 badcases → ⑥ 指标除以 n
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime

from llm_eval.adapters.base import AdapterError, ModelAdapter
from llm_eval.cache import ResponseCache
from llm_eval.config import EvalConfig
from llm_eval.parsers import strip_special
from llm_eval.tasks.base import EvalTask

logger = logging.getLogger(__name__)


@dataclass
class TaskReport:
    task: str
    n: int
    metrics: dict[str, float] = field(default_factory=dict)
    cache_hits: int = 0
    api_errors: int = 0
    parse_failures: int = 0
    badcases: list[dict] = field(default_factory=list)
    duration_s: float = 0.0


@dataclass
class RunReport:
    adapter: str
    model: str
    started_at: str = ""
    finished_at: str = ""
    duration_s: float = 0.0
    tasks: list[TaskReport] = field(default_factory=list)
    config: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


async def evaluate_task(adapter: ModelAdapter, task: EvalTask, cfg: EvalConfig,
                        cache: ResponseCache | None = None) -> TaskReport:
    """Step 5/6/8/10/11：评测单个任务，返回 TaskReport。

    关键语义（测试逐条检查）：
    - n = len(task.load()[:cfg.limit])，指标是全部样本的平均值；
    - 只生成缓存未命中的 prompt；空响应（""）不写缓存；
    - badcase 字段：task/id/prompt/gold/prediction/raw_output/error_type/scores；
    - error_type：生成失败（raw == ""）记 "api_error"，否则用 task.error_type(raw, prediction, item)；
    - cache_hits = 本任务内的命中增量（cache.hits 的前后差）；
    - parse_failures：parse_answer 返回 None 的样本数。
    """
    raise NotImplementedError("Step 5：实现 evaluate_task（先跑通 mock 端到端）")


async def evaluate_tasks(adapter: ModelAdapter, tasks: list[EvalTask], cfg: EvalConfig) -> RunReport:
    """Step 5：逐任务调用 evaluate_task，汇总 RunReport，最后释放资源。

    - RunReport(adapter=adapter.name, model=cfg.model, config=cfg.__dict__.copy())；
    - cache = ResponseCache(cfg.cache_path) if cfg.use_cache else None，结束时 close（finally）；
    - 关闭适配器：优先 `await adapter.aclose()`（若存在），否则 adapter.close()。
    """
    raise NotImplementedError("Step 5：实现 evaluate_tasks")
