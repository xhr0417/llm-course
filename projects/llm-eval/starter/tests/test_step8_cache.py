"""Step 8 · ResponseCache：同一请求只调一次模型。

目标：让这一组测试变绿。
核心纪律：key 必须包含全部影响输出的参数——只写 model + prompt 的实现，
改了 max_new_tokens / temperature 会命中旧答案，结果错得毫无察觉。
另外：空响应（失败样本）绝不能写进缓存，否则一次网络抖动会永久污染结果。
"""
from __future__ import annotations

import asyncio

from llm_eval.adapters.mock import MockAdapter
from llm_eval.cache import ResponseCache
from llm_eval.config import EvalConfig
from llm_eval.runner import evaluate_tasks
from llm_eval.tasks import get_task


def _cfg(tmp_path, **kw) -> EvalConfig:
    base = dict(adapter="mock", model="mock", tasks=["c3"], limit=6, use_cache=True,
                cache_path=str(tmp_path / "cache.sqlite"), output_dir=str(tmp_path / "out"),
                concurrency=1, retries=0, retry_backoff_s=0.01)
    base.update(kw)
    return EvalConfig(**base)


class TestCacheKey:
    def test_same_inputs_same_key(self):
        params = {"max_new_tokens": 16, "temperature": 0.0}
        assert ResponseCache.make_key("m", "p", params) == ResponseCache.make_key("m", "p", params)

    def test_max_new_tokens_changes_key(self):
        key = ResponseCache.make_key("m", "p", {"max_new_tokens": 16, "temperature": 0.0})
        assert ResponseCache.make_key("m", "p", {"max_new_tokens": 32, "temperature": 0.0}) != key

    def test_temperature_changes_key(self):
        key = ResponseCache.make_key("m", "p", {"max_new_tokens": 16, "temperature": 0.0})
        assert ResponseCache.make_key("m", "p", {"max_new_tokens": 16, "temperature": 0.7}) != key

    def test_prompt_and_model_change_key(self):
        params = {"max_new_tokens": 16, "temperature": 0.0}
        key = ResponseCache.make_key("m", "p", params)
        assert ResponseCache.make_key("m2", "p", params) != key
        assert ResponseCache.make_key("m", "p2", params) != key


class TestCacheStorage:
    def test_get_miss_put_hit(self, tmp_path):
        cache = ResponseCache(tmp_path / "c.sqlite")
        key = ResponseCache.make_key("m", "p", {})
        assert cache.get(key) is None
        assert cache.misses == 1
        cache.put(key, "A")
        assert cache.get(key) == "A"
        assert cache.hits == 1
        cache.close()


class TestCacheIntegration:
    def test_second_run_hits_cache(self, tmp_path):
        cfg = _cfg(tmp_path)
        first = MockAdapter(policy=lambda p: "A")
        asyncio.run(evaluate_tasks(first, [get_task("c3")], cfg))
        assert first.calls == 6
        second = MockAdapter(policy=lambda p: "A")
        run2 = asyncio.run(evaluate_tasks(second, [get_task("c3")], cfg))
        assert second.calls == 0, "第二次运行应全部命中缓存"
        assert run2.tasks[0].cache_hits == 6

    def test_empty_response_not_cached(self, tmp_path):
        cfg = _cfg(tmp_path)
        asyncio.run(evaluate_tasks(MockAdapter(policy=lambda p: ""), [get_task("c3")], cfg))
        second = MockAdapter(policy=lambda p: "A")
        run2 = asyncio.run(evaluate_tasks(second, [get_task("c3")], cfg))
        assert second.calls == 6, "空响应不应写入缓存"
        assert run2.tasks[0].cache_hits == 0
