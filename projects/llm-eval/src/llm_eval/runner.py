"""Runner：并发 + 重试 + 缓存 + badcase 收集（评测系统的发动机）。"""
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


def _sync_with_retry(fn, cfg: EvalConfig):
    last: Exception | None = None
    for attempt in range(cfg.retries + 1):
        try:
            return fn()
        except AdapterError as e:
            last = e
            if attempt < cfg.retries:
                wait = cfg.retry_backoff_s * (2 ** attempt)
                logger.warning("调用失败（第 %d 次）：%s；%.1fs 后重试", attempt + 1, e, wait)
                time.sleep(wait)
    raise last  # type: ignore[misc]


async def _async_with_retry(fn, cfg: EvalConfig):
    last: Exception | None = None
    for attempt in range(cfg.retries + 1):
        try:
            return await fn()
        except AdapterError as e:
            last = e
            if attempt < cfg.retries:
                wait = cfg.retry_backoff_s * (2 ** attempt)
                logger.warning("调用失败（第 %d 次）：%s；%.1fs 后重试", attempt + 1, e, wait)
                await asyncio.sleep(wait)
    raise last  # type: ignore[misc]


async def _generate_missing(adapter: ModelAdapter, prompts: list[str], cfg: EvalConfig) -> list[str]:
    """生成缺失的响应。API 类适配器按 Semaphore 并发；本地模型批量串行。"""
    if not prompts:
        return []

    supports_concurrency = getattr(adapter, "supports_concurrency", False)
    if supports_concurrency:
        sem = asyncio.Semaphore(max(1, cfg.concurrency))

        async def one(prompt: str) -> str:
            async with sem:
                try:
                    return (await _async_with_retry(lambda: adapter.agenerate([prompt]), cfg))[0]
                except AdapterError as e:
                    logger.error("请求最终失败：%s", e)
                    return ""

        results = await asyncio.gather(*(one(p) for p in prompts))
        return list(results)

    def batch_call() -> list[str]:
        return _sync_with_retry(lambda: adapter.generate(prompts), cfg)

    try:
        return await asyncio.to_thread(batch_call)
    except AdapterError as e:
        logger.error("批量生成最终失败：%s（整批标记为 api_error）", e)
        return [""] * len(prompts)


async def evaluate_task(adapter: ModelAdapter, task: EvalTask, cfg: EvalConfig,
                        cache: ResponseCache | None) -> TaskReport:
    t0 = time.time()
    report = TaskReport(task=task.name, n=0)
    items = task.load()[: cfg.limit]
    report.n = len(items)
    logger.info("[%s] 共 %d 题，开始评测（adapter=%s）", task.name, len(items), adapter.name)

    raw_outputs: list[str] = []
    cache_keys: list[str | None] = []
    missing_prompts: list[str] = []
    missing_positions: list[int] = []

    params = {"max_new_tokens": cfg.max_new_tokens, "temperature": cfg.temperature}
    for idx, item in enumerate(items):
        key = ResponseCache.make_key(adapter.name, item.prompt, params) if cache else None
        cached = cache.get(key) if (cache and key) else None
        if cached is not None:
            raw_outputs.append(cached)
            cache_keys.append(key)
        else:
            raw_outputs.append("")
            cache_keys.append(key)
            missing_prompts.append(item.prompt)
            missing_positions.append(idx)

    generated = await _generate_missing(adapter, missing_prompts, cfg)
    failed_positions = set()
    for pos, raw in zip(missing_positions, generated):
        raw_outputs[pos] = raw
        if raw == "":
            failed_positions.add(pos)
        if cache and cache_keys[pos]:
            cache.put(cache_keys[pos], raw)

    for idx, item in enumerate(items):
        raw = strip_special(raw_outputs[idx])
        if idx in failed_positions:
            report.api_errors += 1
        prediction = task.parse_answer(raw)
        scores = task.score(prediction, item)
        if prediction is None:
            report.parse_failures += 1
        for k, v in scores.items():
            report.metrics.setdefault(k, 0.0)
            report.metrics[k] += v
        full_credit = all(v >= (1.0 - 1e-12) for v in scores.values())
        if not full_credit:
            badcase = {
                "task": task.name,
                "id": item.id,
                "prompt": item.prompt,
                "gold": item.gold,
                "prediction": prediction,
                "raw_output": raw,
                "error_type": "api_error" if idx in failed_positions else task.error_type(raw, prediction, item),
                "scores": scores,
            }
            report.badcases.append(badcase)

    for k in report.metrics:
        report.metrics[k] = report.metrics[k] / len(items) if items else float("nan")
    if cache:
        report.cache_hits = cache.hits
    report.duration_s = time.time() - t0
    primary = report.metrics.get(task.primary_metric, float("nan"))
    logger.info("[%s] 完成：%s", task.name,
                " ".join(f"{k}={v:.4f}" for k, v in report.metrics.items()))
    logger.info("[%s] 主指标 %s=%.2f%% | parse_failure=%d | api_error=%d | 用时 %.1fs",
                task.name, task.primary_metric, primary * 100,
                report.parse_failures, report.api_errors, report.duration_s)
    return report


async def evaluate_tasks(adapter: ModelAdapter, tasks: list[EvalTask], cfg: EvalConfig) -> RunReport:
    run = RunReport(adapter=adapter.name, model=cfg.model, config=cfg.__dict__.copy())
    run.started_at = datetime.now().isoformat(timespec="seconds")
    t0 = time.time()
    cache = ResponseCache(cfg.cache_path) if cfg.use_cache else None
    try:
        for task in tasks:
            run.tasks.append(await evaluate_task(adapter, task, cfg, cache))
    finally:
        if cache:
            cache.close()
        adapter.close()
    run.duration_s = time.time() - t0
    run.finished_at = datetime.now().isoformat(timespec="seconds")
    return run
