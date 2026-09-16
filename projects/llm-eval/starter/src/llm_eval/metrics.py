"""指标：accuracy / exact_match / f1_score。

这是 starter 的【待实现文件】：
- Step 2：实现 accuracy() / exact_match() / f1_score()

normalize_text() 与 _tokenize() 已给出（和参考实现一致），直接用它们。
"""
from __future__ import annotations

import re
import string
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
    """Step 2：正确率。

    边界：n_total == 0 时返回 float("nan")（不是 0.0，也不是除零崩溃）。
    """
    raise NotImplementedError("Step 2：实现 accuracy（0/0 → float('nan')）")


def exact_match(prediction: Optional[str], golds: Sequence[str]) -> float:
    """Step 2：归一化后与任一 gold 相等返回 1.0，否则 0.0。

    - prediction 为空（None / ""）直接返回 0.0；
    - 比较用 normalize_text，并且额外去掉空格再比一次：
      "不 知道" 与 "不知道" 应判为相等；
    - golds 可以是多个标准答案，命中任意一个都算对。
    """
    raise NotImplementedError("Step 2：实现 exact_match（归一化 + 去空格比较）")


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
    """Step 2：基于 _tokenize 的 token 重叠 F1。

    标准定义：
        precision = 公共 token 数 / prediction token 数
        recall    = 公共 token 数 / gold token 数
        F1        = 2 * precision * recall / (precision + recall)
    - 任一为空返回 0.0；公共 token 为 0 返回 0.0；
    - 完全相同（token 多重集合一致）返回 1.0。
    """
    raise NotImplementedError("Step 2：实现 f1_score（precision / recall → F1）")
