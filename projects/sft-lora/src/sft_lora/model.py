"""模型：加载 base、注入 LoRA、导出合并权重（merge）。"""
from __future__ import annotations

import logging
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from sft_lora.config import SFTConfig

logger = logging.getLogger(__name__)

_DTYPES = {"float32": torch.float32, "float16": torch.float16, "bfloat16": torch.bfloat16}


def load_base_model(cfg: SFTConfig):
    model = AutoModelForCausalLM.from_pretrained(cfg.base_model, dtype=_DTYPES.get(cfg.dtype, torch.float32))
    model.to(cfg.device)
    return model


def load_tokenizer(model_name: str):
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    return tokenizer


def apply_lora(model, cfg: SFTConfig):
    from peft import LoraConfig, get_peft_model

    lora_cfg = LoraConfig(
        r=cfg.lora_r,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=cfg.target_modules,
        task_type="CAUSAL_LM",
    )
    peft_model = get_peft_model(model, lora_cfg)
    trainable = sum(p.numel() for p in peft_model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in peft_model.parameters())
    logger.info("LoRA 可训练参数：%s / %s = %.4f%%", f"{trainable:,}", f"{total:,}", 100 * trainable / total)
    return peft_model


def merge_adapter(base_model: str, adapter_dir: str, output_dir: str, dtype: str = "float16") -> Path:
    """把 adapter 合并回 base 权重并保存（发布用）。"""
    from peft import PeftModel

    base = AutoModelForCausalLM.from_pretrained(base_model, dtype=_DTYPES.get(dtype, torch.float16))
    merged = PeftModel.from_pretrained(base, adapter_dir).merge_and_unload()
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(out)
    logger.info("合并权重已保存：%s", out)
    return out
