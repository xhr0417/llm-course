"""适配器注册表。"""
from __future__ import annotations

from typing import Any

from llm_eval.adapters.base import AdapterError, ModelAdapter
from llm_eval.adapters.hf import HuggingFaceAdapter
from llm_eval.adapters.mock import MockAdapter
from llm_eval.adapters.openai_compat import OpenAICompatibleAdapter

__all__ = ["AdapterError", "ModelAdapter", "HuggingFaceAdapter", "MockAdapter",
           "OpenAICompatibleAdapter", "get_adapter"]


def get_adapter(cfg) -> ModelAdapter:
    """按配置构造适配器。

    用法：
        cfg = EvalConfig(adapter="hf", model="Qwen/Qwen2.5-0.5B-Instruct")
    """
    if cfg.adapter == "hf":
        return HuggingFaceAdapter(cfg.model, max_new_tokens=cfg.max_new_tokens,
                                  temperature=cfg.temperature)
    if cfg.adapter == "openai":
        return OpenAICompatibleAdapter(cfg.model, base_url=cfg.base_url, api_key=cfg.api_key,
                                       max_new_tokens=cfg.max_new_tokens, temperature=cfg.temperature)
    if cfg.adapter == "mock":
        return MockAdapter()
    raise ValueError(f"未知 adapter：{cfg.adapter}")
