"""Step 5 · 错位 bug：warning 行有 step 但没有 loss。

目标：让这 3 个测试变绿。

先做一件事（课程要求的预测练习）：
    在动手改代码之前，先回答——samples/train.log 里 best loss 出现在第几步？
    然后运行本文件，看你实现的 best_step 和你的预测是否一致。

如果你的实现是「steps 列表和 losses 列表按下标对齐」，
这里会得到一个自信的错误答案 550——真实项目开发时这个 bug 就是这样被 pytest 抓出来的。
"""
from __future__ import annotations

from pathlib import Path

import pytest

from log_analyzer.parser import parse_log_file
from log_analyzer.stats import analyze

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "samples" / "train.log"


def _stats():
    return analyze(parse_log_file(SAMPLE))


class TestAlignment:
    def test_best_step_is_where_min_loss_really_happened(self):
        # 正确值 1000；按下标对齐的实现会得到 550（warning 行把数组错开了）
        stats = _stats()
        assert stats.best_step == 1000

    def test_loss_steps_tracks_only_steps_with_loss(self):
        stats = _stats()
        assert len(stats.loss_steps) == 17
        assert stats.loss_steps[-1] == 1000

    def test_steps_and_loss_steps_are_allowed_to_differ(self):
        # steps 包含 3 条 warning 的 step（20 个）；loss_steps 只有带 loss 的（17 个）
        stats = _stats()
        assert len(stats.steps) == 20
        assert len(stats.loss_steps) == 17
        assert len(stats.losses) == len(stats.loss_steps)
