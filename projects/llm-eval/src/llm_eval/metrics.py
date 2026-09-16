"""指标：accuracy / exact_match / f1 / pass@k。"""
from __future__ import annotations

import math
import re
import string
from math import comb
from typing import Optional, Sequence

_PUNCT = set(string.punctuation) | set("。，、；：？！“”‘’（）《》【】…—·￥")
_WHITESPACE_RE = re.compile(r"\s+")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def normalize_text(text: str) -> str:
    """评测标准归一化：小写、去标点、压缩空白。"""
    if text is None:
        return ""
    text = text.strip().lower()
    text = "".join(ch for ch in text if ch not in _PUNCT)
    return _WHITESPACE_RE.sub(" ", text).strip()


def accuracy(n_correct: int, n_total: int) -> float:
    return (n_correct / n_total) if n_total else float("nan")


def exact_match(prediction: Optional[str], golds: Sequence[str]) -> float:
    pred = normalize_text(prediction or "")
    if not pred:
        return 0.0
    pred_ns = pred.replace(" ", "")
    for g in golds:
        gold_ns = normalize_text(g)
        if pred == gold_ns or pred_ns == gold_ns.replace(" ", ""):
            return 1.0
    return 0.0


def _tokenize(text: str) -> list[str]:
    """朴素 tokenizer：中文按字切，英文按词切。够用且不引入依赖。"""
    tokens: list[str] = []
    buf = ""
    for ch in normalize_text(text):
        if _CJK_RE.match(ch):
            if buf:
                tokens.append(buf)
                buf = ""
            tokens.append(ch)
        elif ch == " ":
            if buf:
                tokens.append(buf)
                buf = ""
        else:
            buf += ch
    if buf:
        tokens.append(buf)
    return tokens


def f1_score(prediction: Optional[str], gold: str) -> float:
    pred_tokens = _tokenize(prediction or "")
    gold_tokens = _tokenize(gold)
    if not pred_tokens or not gold_tokens:
        return 0.0
    common = 0
    gold_count: dict[str, int] = {}
    for t in gold_tokens:
        gold_count[t] = gold_count.get(t, 0) + 1
    for t in pred_tokens:
        if gold_count.get(t, 0) > 0:
            common += 1
            gold_count[t] -= 1
    if common == 0:
        return 0.0
    precision = common / len(pred_tokens)
    recall = common / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)


def pass_at_k(n: int, c: int, k: int) -> float:
    """无偏 pass@k 估计（k ≤ n 硬约束，超出自动 clamp）。"""
    k = min(k, n)
    if n - c < k:
        return 1.0
    return 1.0 - comb(n - c, k) / comb(n, k)


def mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else float("nan")


def percentile(values: Sequence[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, math.ceil(p / 100 * len(ordered)) - 1))
    return ordered[idx]
