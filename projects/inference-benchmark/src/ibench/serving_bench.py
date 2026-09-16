"""Serving benchmark 客户端：测任何 OpenAI-compatible 服务（vLLM / Ollama / 网关）。

指标（第 31 章 10.6）：
    TTFT（首 token 延迟）、TPOT（每 token 时间）、tokens/s、requests/s。
必须用【流式】请求才能测到 TTFT/TPOT：SSE 逐块到达的时间戳就是观测点。
"""
from __future__ import annotations

import asyncio
import json
import statistics
import time
from dataclasses import asdict, dataclass, field

import httpx


@dataclass
class ServeResult:
    label: str
    concurrency: int
    requests: int
    errors: int = 0
    ttft_ms_p50: float = 0.0
    ttft_ms_p95: float = 0.0
    tpot_ms_p50: float = 0.0
    tokens_per_s: float = 0.0
    requests_per_s: float = 0.0
    total_s: float = 0.0
    notes: str = ""


async def _one_stream(client: httpx.AsyncClient, base_url: str, model: str, prompt: str,
                      max_tokens: int, api_key: str) -> dict:
    """单次流式请求：返回 ttft_ms、tokens、total_ms。"""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.0,
        "stream": True,
    }
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    t0 = time.perf_counter()
    ttft = None
    n_tokens = 0
    async with client.stream("POST", base_url.rstrip("/") + "/v1/chat/completions",
                             json=payload, headers=headers) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line.startswith("data:"):
                continue
            data = line[len("data:"):].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue
            delta = chunk.get("choices", [{}])[0].get("delta", {})
            text = delta.get("content")
            if text:
                n_tokens += 1  # 近似：按 chunk 计数（真实 token 数应以 usage 为准）
                if ttft is None:
                    ttft = (time.perf_counter() - t0) * 1000
    total_ms = (time.perf_counter() - t0) * 1000
    return {"ttft_ms": ttft, "tokens": n_tokens, "total_ms": total_ms}


async def bench_serving(base_url: str, model: str, prompts: list[str], concurrency: int = 1,
                        max_tokens: int = 32, timeout_s: float = 120.0, api_key: str = "",
                        label: str = "") -> ServeResult:
    result = ServeResult(label=label or f"c{concurrency}", concurrency=concurrency, requests=len(prompts))
    queue: asyncio.Queue = asyncio.Queue()
    for p in prompts:
        queue.put_nowait(p)
    records: list[dict] = []
    t0 = time.perf_counter()

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        async def worker():
            while True:
                try:
                    prompt = queue.get_nowait()
                except asyncio.QueueEmpty:
                    return
                try:
                    records.append(await _one_stream(client, base_url, model, prompt, max_tokens, api_key))
                except Exception:
                    result.errors += 1
                finally:
                    queue.task_done()

        await asyncio.gather(*(worker() for _ in range(concurrency)))

    result.total_s = round(time.perf_counter() - t0, 2)
    ttfts = [r["ttft_ms"] for r in records if r["ttft_ms"] is not None]
    tpots = [(r["total_ms"] - r["ttft_ms"]) / max(1, r["tokens"] - 1)
             for r in records if r["ttft_ms"] is not None and r["tokens"] > 1]
    total_tokens = sum(r["tokens"] for r in records)
    if ttfts:
        result.ttft_ms_p50 = round(statistics.median(ttfts), 1)
        result.ttft_ms_p95 = round(sorted(ttfts)[int(len(ttfts) * 0.95) - 1] if len(ttfts) > 1 else ttfts[0], 1)
    if tpots:
        result.tpot_ms_p50 = round(statistics.median(tpots), 2)
    result.tokens_per_s = round(total_tokens / result.total_s, 1) if result.total_s else 0.0
    result.requests_per_s = round(len(records) / result.total_s, 2) if result.total_s else 0.0
    return result


def to_dict(result: ServeResult) -> dict:
    return asdict(result)
