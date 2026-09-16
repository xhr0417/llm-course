"""答案解析：从模型自由文本里可靠地提取 A/B/C/D。

真实模型输出五花八门：
    "C"、"C."、"答案：C"、"The correct answer is C."、"我认为选 B"、"**D**"、
    "A) 因为……"、"答案是 C 选项"
解析失败（parse_failure）会直接拉低 accuracy——所以 parser 是评测系统最关键
也最容易被忽视的组件之一。
"""
from __future__ import annotations

import re
from typing import Optional

_CHOICE_CHARS = "ABCDEFGH"

_PATTERNS = [
    r"(?:正确答案|答案|正确选项|应选|选择|选)\s*(?:是|为|:|：)?\s*[（(\[]?\s*([A-H])\s*[)）\]]?",
    r"(?:correct\s+answer|answer)\s*(?:is|:)?\s*[（(\[]?\s*([A-H])\b",
    r"\b([A-H])\s*[)）.、]\s*",                       # "C) 因为……"
    r"[（(\[]\s*([A-H])\s*[)）\]]",                    # "（C）"
    r"^\s*[（(\[]?\s*([A-H])\s*[)）\]]?\s*[.。!！?？,，]*\s*$",  # 单独一个字母
]
_COMPILED = [re.compile(p, re.IGNORECASE if i == 1 else 0) for i, p in enumerate(_PATTERNS)]


def parse_choice(text: str, valid: str = _CHOICE_CHARS) -> Optional[str]:
    """返回 A-H 中的字母；无法可靠解析时返回 None。"""
    if not text:
        return None
    cleaned = re.sub(r"[*`_]", "", text.strip()).upper()
    for pattern in _COMPILED:
        m = pattern.search(cleaned)
        if m:
            letter = m.group(1).upper()
            if letter in valid:
                return letter
    return None


def strip_special(text: str) -> str:
    """去掉常见特殊 token（如 <|im_end|>）。"""
    return re.sub(r"<\|[^|]*\|>", "", text).strip()
