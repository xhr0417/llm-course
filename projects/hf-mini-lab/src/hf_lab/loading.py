"""模型与 Tokenizer 加载。"""
from __future__ import annotations

import logging

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

logger = logging.getLogger(__name__)

_DTYPES = {"float32": torch.float32, "float16": torch.float16, "bfloat16": torch.bfloat16}


def load_tokenizer(model_name: str):
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    logger.info("tokenizer 加载完成：vocab=%d pad=%s", tokenizer.vocab_size, tokenizer.pad_token)
    return tokenizer


def load_model(model_name: str, dtype: str = "float32", device: str = "cpu"):
    torch_dtype = _DTYPES.get(dtype, torch.float32)
    model = AutoModelForCausalLM.from_pretrained(model_name, dtype=torch_dtype)
    model.to(device)
    model.eval()
    n_params = sum(p.numel() for p in model.parameters())
    logger.info("模型加载完成：%s | %.1fM 参数 | %s | %s", model_name, n_params / 1e6, dtype, device)
    return model
