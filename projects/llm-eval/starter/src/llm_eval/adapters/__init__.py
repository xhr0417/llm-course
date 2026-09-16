"""适配器包：ModelAdapter 及其 hf / openai / mock 三种实现。

按需导入具体模块（如 `from llm_eval.adapters.mock import MockAdapter`），
避免在没安装 torch 的环境里 import 本包就失败。

本文件的 get_adapter 已给出；run_eval.py 里还有一个 build_adapter（Step 7/9 实现）。
"""
from __future__ import annotations

from typing import Any

__all__ = ["get_adapter"]


def get_adapter(cfg: Any):
    """按配置构造适配器（懒导入：只有真的用 hf 时才需要 transformers/torch）。"""
    if cfg.adapter == "mock":
        from llm_eval.adapters.mock import MockAdapter
        return MockAdapter()
    if cfg.adapter == "openai":
        from llm_eval.adapters.openai_compat import OpenAICompatibleAdapter
        return OpenAICompatibleAdapter(cfg.model, base_url=cfg.base_url, api_key=cfg.api_key,
                                       max_new_tokens=cfg.max_new_tokens, temperature=cfg.temperature)
    if cfg.adapter == "hf":
        from llm_eval.adapters.hf import HuggingFaceAdapter
        return HuggingFaceAdapter(cfg.model, max_new_tokens=cfg.max_new_tokens,
                                  temperature=cfg.temperature,
                                  peft_adapter=getattr(cfg, "peft_adapter", None) or None)
    raise ValueError(f"未知 adapter：{cfg.adapter}")
