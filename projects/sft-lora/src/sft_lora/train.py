"""训练：grad accum + 梯度裁剪 + warmup/余弦调度 + 验证 loss（最小可读实现）。"""
from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field

import torch

from sft_lora.config import SFTConfig
from sft_lora.data import make_collate

logger = logging.getLogger(__name__)


@dataclass
class TrainLog:
    steps: list[dict] = field(default_factory=list)   # {step, loss, grad_norm, lr, t}
    val_losses: list[dict] = field(default_factory=list)  # {step, val_loss}

    @property
    def first_loss(self) -> float:
        return self.steps[0]["loss"] if self.steps else float("nan")

    @property
    def last_loss(self) -> float:
        return self.steps[-1]["loss"] if self.steps else float("nan")


def lr_at(step: int, cfg: SFTConfig) -> float:
    """线性 warmup + 余弦衰减。"""
    if step < cfg.warmup_steps:
        return cfg.learning_rate * (step + 1) / max(1, cfg.warmup_steps)
    progress = (step - cfg.warmup_steps) / max(1, cfg.max_steps - cfg.warmup_steps)
    return cfg.learning_rate * 0.5 * (1 + math.cos(math.pi * min(1.0, progress)))


def train(tokenizer, model, train_samples: list[list[dict]], val_samples: list[list[dict]],
          cfg: SFTConfig) -> TrainLog:
    torch.manual_seed(cfg.seed)
    collate = make_collate(tokenizer, cfg.max_length)
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(params, lr=cfg.learning_rate)
    log = TrainLog()
    model.train()
    cursor = 0
    t0 = time.time()

    for step in range(1, cfg.max_steps + 1):
        lr = lr_at(step - 1, cfg)
        for group in optimizer.param_groups:
            group["lr"] = lr

        accum_loss, grad_norm = 0.0, 0.0
        optimizer.zero_grad()
        for micro in range(cfg.grad_accum):
            batch_samples = [train_samples[(cursor + i) % len(train_samples)] for i in range(cfg.batch_size)]
            cursor += cfg.batch_size
            batch = collate(batch_samples)
            out = model(**batch)
            loss = out.loss / cfg.grad_accum
            loss.backward()
            accum_loss += float(out.loss.detach())
        grad_norm = float(torch.nn.utils.clip_grad_norm_(params, cfg.grad_clip))
        optimizer.step()

        log.steps.append({"step": step, "loss": accum_loss / cfg.grad_accum,
                          "grad_norm": grad_norm, "lr": lr, "t": time.time() - t0})
        if step % 10 == 0 or step == 1:
            logger.info("step %d/%d | loss %.4f | grad_norm %.3f | lr %.2e",
                        step, cfg.max_steps, log.steps[-1]["loss"], grad_norm, lr)
        if val_samples and (step % cfg.val_every == 0 or step == cfg.max_steps):
            from sft_lora.evaluate import eval_loss
            vl = eval_loss(model, tokenizer, val_samples, cfg.max_length)
            log.val_losses.append({"step": step, "val_loss": vl})
            logger.info("step %d | val_loss %.4f", step, vl)

    model.eval()
    logger.info("训练完成：%d 步，用时 %.1fs，loss %.4f → %.4f",
                cfg.max_steps, time.time() - t0, log.first_loss, log.last_loss)
    return log
