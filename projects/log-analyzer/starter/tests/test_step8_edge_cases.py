"""Step 8 · 你的 3 个边界测试（这一文件由你来写）。

课程提供的测试覆盖了「常见坏数据」。真实工程里最贵的 bug 来自
「我们没想到的输入」——所以这一步不是再讲一遍 pytest 定义，
而是让你为**自己刚写完的 parser / stats / CLI** 补 3 个边界用例。

规则：
1. 不允许删除这个文件里的测试来「通过」——把下面的占位测试改成你自己的用例；
2. 好用例的特征：它能失败。写完先故意改坏一行实现，确认你的测试会变红；
3. 提示（每题只给一个方向，具体输入由你想）：
   - 边界 1：空文件 / 只有空行的文件 → load_lines + analyze 的组合会怎样？
   - 边界 2：极端数值（loss=0.0、loss=1e-9、超长行）→ 解析和统计还成立吗？
   - 边界 3：CLI 的编码 / 路径边界（含中文文件名？相对路径？）→ exit code 与输出？

完成后运行：pytest -q tests/test_step8_edge_cases.py
"""
from __future__ import annotations

import pytest


def test_edge_case_1_your_own():
    """TODO 1：把它改成你的第一个边界用例。"""
    pytest.fail("Step 8：请写出你自己的边界测试 1（提示：空输入）")


def test_edge_case_2_your_own():
    """TODO 2：把它改成你的第二个边界用例。"""
    pytest.fail("Step 8：请写出你自己的边界测试 2（提示：极端数值）")


def test_edge_case_3_your_own():
    """TODO 3：把它改成你的第三个边界用例。"""
    pytest.fail("Step 8：请写出你自己的边界测试 3（提示：CLI 边界）")
