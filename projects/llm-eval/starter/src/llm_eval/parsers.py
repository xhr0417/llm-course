"""答案解析：从模型自由文本里可靠地提取 A/B/C/D。

这是 starter 的【待实现文件】：
- Step 1：实现 parse_choice() 与 strip_special()

真实模型输出五花八门：
    "C"、"c"、"C."、"（C）"、"答案是 C"、"The correct answer is C."、
    "我认为选 B"、"**D**"、"C) 因为……"、"B. 因为……"
解析失败（parse_failure）会直接拉低 accuracy——所以 parser 是评测系统最关键
也最容易被忽视的组件之一。
"""
from __future__ import annotations

import re
from typing import Optional


def parse_choice(text: str, valid: str = "ABCD") -> Optional[str]:
    """Step 1：从自由文本中解析选项字母；无法可靠解析时返回 None。

    必须覆盖的格式（见 tests/test_step1a_parser_basic.py 与 test_step1b_parser_robust.py）：
        "C" / "c" / "C." / "（C）" / "[B]" / "答案是 C" / "答案：D" /
        "我认为选 B" / "**D**" / "C) 因为……" / "B. 因为……" / "The correct answer is C."

    提示：
    - 先 re.sub 去掉 markdown 字符（* ` _），strip 后统一大写（"c" → "C"）；
    - 再用多条正则从严格到宽松依次匹配（"答案是 X" / "X)" / "（X）" / 单独一个字母）；
    - 匹配到的字母必须在 valid 里，否则继续尝试下一条模式。

    边界："" 与 "我不知道" 返回 None；"E"（valid="ABCD"）返回 None。
    """
    raise NotImplementedError("Step 1：实现 parse_choice（提示：去 markdown + 多条正则 + 大写）")


def strip_special(text: str) -> str:
    """Step 1：去掉常见特殊 token（如 <|im_end|>）并 strip。

    例："C<|im_end|>" → "C"；"<|im_start|>你好<|im_end|>" → "你好"。
    """
    raise NotImplementedError("Step 1：实现 strip_special（提示：re.sub 去掉 <|...|>）")
