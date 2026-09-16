"""评测：held-out loss、生成对比、bad case 导出。"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import torch

from sft_lora.data import build_example

logger = logging.getLogger(__name__)


def eval_loss(model, tokenizer, samples: list[list[dict]], max_length: int = 256) -> float:
    """held-out response-only loss（逐条，避免 padding 干扰）。"""
    model.eval()
    total, count = 0.0, 0
    with torch.no_grad():
        for messages in samples:
            ids, labels = build_example(tokenizer, messages, max_length)
            if all(x == -100 for x in labels):
                continue
            out = model(input_ids=torch.tensor([ids]), labels=torch.tensor([labels]))
            total += float(out.loss)
            count += 1
    return total / count if count else float("nan")


def generate_answer(model, tokenizer, question: str, max_new_tokens: int = 96) -> str:
    text = tokenizer.apply_chat_template(
        [{"role": "user", "content": question}], tokenize=False, add_generation_prompt=True
    )
    enc = tokenizer(text, return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(**enc, max_new_tokens=max_new_tokens, do_sample=False,
                             pad_token_id=tokenizer.pad_token_id)
    return tokenizer.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True).strip()


def generate_answers(model, tokenizer, questions: list[str], max_new_tokens: int = 96) -> list[str]:
    return [generate_answer(model, tokenizer, q, max_new_tokens) for q in questions]


def export_badcases(pairs: list[dict], path: Path) -> int:
    """pairs: [{id, question, gold, base, tuned, error_type}]"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in pairs:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return len(pairs)


def classify_badcase(gold_answers: list[str], answer: str) -> str:
    """粗分类（教学用启发式）：refusal_ok / refusal_wrong / verbose / wrong / ok."""
    if not answer.strip():
        return "empty"
    if "无法" in answer and "回答" in answer:
        return "refusal"
    from sft_lora.metrics_shim import f1  # 延迟导入避免循环

    best = max(f1(answer, g) for g in gold_answers)
    if best >= 0.6:
        return "ok"
    if best == 0.0:
        return "wrong"
    return "verbose" if len(answer) > 80 else "partial"
