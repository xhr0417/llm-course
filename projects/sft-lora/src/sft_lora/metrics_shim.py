"""与 llm-eval harness 同口径的指标（避免跨项目 import 的脆弱性，保持实现一致）。"""
from __future__ import annotations

import re
import string

_PUNCT = set(string.punctuation) | set("。，、；：？！“”‘’（）《》【】…—·￥")
_WS = re.compile(r"\s+")
_CJK = re.compile(r"[\u4e00-\u9fff]")


def normalize(text: str) -> str:
    text = (text or "").strip().lower()
    text = "".join(ch for ch in text if ch not in _PUNCT)
    return _WS.sub(" ", text).strip()


def _tok(text: str) -> list[str]:
    tokens, buf = [], ""
    for ch in normalize(text):
        if _CJK.match(ch):
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


def f1(prediction: str, gold: str) -> float:
    p, g = _tok(prediction), _tok(gold)
    if not p or not g:
        return 0.0
    common, gold_count = 0, {}
    for t in g:
        gold_count[t] = gold_count.get(t, 0) + 1
    for t in p:
        if gold_count.get(t, 0) > 0:
            common += 1
            gold_count[t] -= 1
    if common == 0:
        return 0.0
    precision, recall = common / len(p), common / len(g)
    return 2 * precision * recall / (precision + recall)
