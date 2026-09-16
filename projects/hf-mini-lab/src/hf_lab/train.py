"""LoRA 训练：最小可读的 SFT 循环（无 Trainer，方便逐行理解）。"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import torch
from peft import LoraConfig, PeftModel, get_peft_model
from transformers import PreTrainedModel

from hf_lab.config import LabConfig
from hf_lab.data import encode_batch

logger = logging.getLogger(__name__)


@dataclass
class TrainResult:
    losses: list[float]
    trainable_params: int
    total_params: int


def make_lora_model(model: PreTrainedModel, cfg: LabConfig) -> PreTrainedModel:
    lora_cfg = LoraConfig(
        r=cfg.lora_r,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=cfg.target_modules,
        task_type="CAUSAL_LM",
    )
    peft_model = get_peft_model(model, lora_cfg)
    return peft_model


def _collate(batch_ids: list[list[int]], batch_labels: list[list[int]], pad_id: int):
    max_len = max(len(ids) for ids in batch_ids)
    input_ids, labels, attention = [], [], []
    for ids, labs in zip(batch_ids, batch_labels):
        pad_n = max_len - len(ids)
        input_ids.append(ids + [pad_id] * pad_n)
        labels.append(labs + [-100] * pad_n)
        attention.append([1] * len(ids) + [0] * pad_n)
    return (
        torch.tensor(input_ids),
        torch.tensor(labels),
        torch.tensor(attention),
    )


def train_lora(
    tokenizer,
    model: PreTrainedModel,
    samples: list[list[dict]],
    cfg: LabConfig,
    log_every: int = 10,
) -> TrainResult:
    torch.manual_seed(cfg.seed)
    trainable = [p for p in model.parameters() if p.requires_grad]
    n_trainable = sum(p.numel() for p in trainable)
    n_total = sum(p.numel() for p in model.parameters())
    logger.info(
        "LoRA 可训练参数：%s / %s = %.4f%%",
        f"{n_trainable:,}", f"{n_total:,}", 100 * n_trainable / n_total,
    )

    optimizer = torch.optim.AdamW(trainable, lr=cfg.learning_rate)
    model.train()
    losses: list[float] = []
    cursor = 0

    for step in range(1, cfg.max_steps + 1):
        batch = [samples[(cursor + i) % len(samples)] for i in range(cfg.batch_size)]
        cursor += cfg.batch_size
        ids, labels = encode_batch(tokenizer, batch, max_length=cfg.max_length)
        input_ids, label_ids, attention = _collate(ids, labels, tokenizer.pad_token_id)

        optimizer.zero_grad()
        out = model(input_ids=input_ids, attention_mask=attention, labels=label_ids)
        out.loss.backward()
        optimizer.step()

        losses.append(float(out.loss.detach()))
        if step % log_every == 0 or step == 1 or step == cfg.max_steps:
            logger.info("step %d/%d | loss %.4f", step, cfg.max_steps, losses[-1])

    model.eval()
    return TrainResult(losses=losses, trainable_params=n_trainable, total_params=n_total)


def save_adapter(model: PeftModel, output_dir: str, cfg: LabConfig) -> None:
    from pathlib import Path

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(out)
    cfg.save(out / "config.json")
    logger.info("adapter 已保存：%s", out)
