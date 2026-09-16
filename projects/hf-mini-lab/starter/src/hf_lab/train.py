"""LoRA 训练：最小可读的 SFT 循环（starter：待实现）。

Step 8：make_lora_model
Step 9：_collate / train_lora（TrainResult 数据类已给出）
Step 10：save_adapter
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import torch

logger = logging.getLogger(__name__)


@dataclass
class TrainResult:
    losses: list[float]
    trainable_params: int
    total_params: int


def make_lora_model(model, cfg):
    """Step 8：按 cfg 构造 LoraConfig 并注入模型，返回 PeftModel。

    注意：get_peft_model 是就地注入——传入的 model 对象会被改造。
    """
    raise NotImplementedError("Step 8：实现 make_lora_model（提示：LoraConfig + get_peft_model）")


def _collate(batch_ids: list[list[int]], batch_labels: list[list[int]], pad_id: int):
    """Step 9：把变长序列 pad 成 (input_ids, labels, attention_mask) 张量。

    - input_ids 用 pad_id 补齐；labels 用 -100 补齐（不参与 loss）；
    - attention_mask 真实 token 为 1、padding 为 0。
    """
    raise NotImplementedError("Step 9：实现 _collate（提示：pad_id / -100 / 0-1 掩码）")


def train_lora(
    tokenizer,
    model,
    samples: list[list[dict]],
    cfg,
    log_every: int = 10,
) -> TrainResult:
    """Step 9：最小可读的 LoRA SFT 循环（AdamW 只优化可训练参数）。

    samples 是 messages 列表的列表；从 cfg 取 max_steps / batch_size /
    max_length / learning_rate，循环采样 batch，做标准 forward/backward/step，
    结束后 model.eval()，返回 TrainResult。
    """
    raise NotImplementedError("Step 9：实现 train_lora（提示：循环 max_steps + zero_grad/backward/step）")


def save_adapter(model, output_dir: str, cfg) -> None:
    """Step 10：保存 adapter 权重（save_pretrained）与实验配置（cfg.save）。"""
    raise NotImplementedError("Step 10：实现 save_adapter（提示：mkdir + save_pretrained + cfg.save）")
