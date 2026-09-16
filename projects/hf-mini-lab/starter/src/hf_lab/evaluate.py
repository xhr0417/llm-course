"""评测：response-only eval loss 与 base/tuned 生成对比（starter：待实现）。

Step 12：eval_loss / compare_generation / build_report
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def eval_loss(model, tokenizer, samples: list[list[dict]], max_length: int = 256) -> float:
    """Step 12：held-out 样本逐条计算 response-only loss 的均值。

    逐条算（不 padding 拼批，避免 padding 干扰）；labels 全为 -100 的样本跳过；
    没有任何可用样本时返回 float("nan")。
    """
    raise NotImplementedError("Step 12：实现 eval_loss（提示：逐条 forward，labels 全 -100 则跳过）")


def compare_generation(
    tokenizer,
    base_model,
    tuned_model,
    prompts: list[str],
    max_new_tokens: int = 64,
) -> list[dict]:
    """Step 12：同一组 prompt 下 base 与 tuned 的贪心生成对比。

    返回 list[dict]，键为 prompt / base / tuned。
    """
    raise NotImplementedError("Step 12：实现 compare_generation（提示：两个模型各 generate 一次，do_sample=False）")


def build_report(cfg, result, base_eval, tuned_eval, comparisons, elapsed, n_train: int, n_eval: int) -> str:
    """Step 12：生成 markdown 实验报告（模型名、loss、可训练参数、生成对比、已知限制）。"""
    raise NotImplementedError("Step 12：实现 build_report（提示：f-string 拼 markdown，沿用 run_lab.py 的结构）")
