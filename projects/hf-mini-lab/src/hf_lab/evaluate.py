"""评测：response-only eval loss 与 base/tuned 生成对比。"""
from __future__ import annotations

import logging

import torch

from hf_lab.chat import render_chat
from hf_lab.data import build_labels

logger = logging.getLogger(__name__)


def eval_loss(model, tokenizer, samples: list[list[dict]], max_length: int = 256) -> float:
    """在 held-out 样本上计算 response-only loss 的平均值（逐条，避免 padding 干扰）。"""
    model.eval()
    total, count = 0.0, 0
    with torch.no_grad():
        for messages in samples:
            ids, labels = build_labels(tokenizer, messages)
            ids, labels = ids[:max_length], labels[:max_length]
            if all(label == -100 for label in labels):
                continue
            out = model(
                input_ids=torch.tensor([ids]),
                labels=torch.tensor([labels]),
            )
            total += float(out.loss)
            count += 1
    return total / count if count else float("nan")


def compare_generation(
    tokenizer,
    base_model,
    tuned_model,
    prompts: list[str],
    max_new_tokens: int = 64,
) -> list[dict]:
    """同一组 prompt，分别用 base 与 tuned 模型贪心生成，返回对比结果。"""
    results = []
    for prompt in prompts:
        text = render_chat(tokenizer, [{"role": "user", "content": prompt}])
        enc = tokenizer(text, return_tensors="pt")
        row = {"prompt": prompt}
        for name, model in (("base", base_model), ("tuned", tuned_model)):
            with torch.no_grad():
                out = model.generate(
                    **enc,
                    max_new_tokens=max_new_tokens,
                    do_sample=False,
                    pad_token_id=tokenizer.pad_token_id,
                )
            answer = tokenizer.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True)
            row[name] = answer.strip()
        results.append(row)
    return results
