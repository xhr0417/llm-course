"""统计：从事件序列中提取训练运行的关键指标。

这是 starter 的【待实现文件】：
- Step 4：实现 analyze() 与 final_loss / best_loss / avg_tokens_per_sec / has_nan / to_dict
- Step 5：修复 step 与 loss 的对齐 bug（先让测试变红，再修）
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence

from log_analyzer.parser import LogEvent


@dataclass
class TrainRunStats:
    """一次训练日志的聚合结果。

    字段在 Step 4 中由你在 analyze() 里填充；
    Step 5 会要求你新增一个字段来修复对齐问题——先不要提前加。
    """

    total_lines: int = 0
    parsed_events: int = 0
    steps: list[int] = field(default_factory=list)
    losses: list[float] = field(default_factory=list)
    throughput_samples: list[float] = field(default_factory=list)
    warnings: list[LogEvent] = field(default_factory=list)
    errors: list[LogEvent] = field(default_factory=list)
    nan_events: list[LogEvent] = field(default_factory=list)
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    @property
    def final_loss(self) -> Optional[float]:
        """最后一个 loss；没有 loss 时返回 None（而不是报错）。"""
        raise NotImplementedError("Step 4：实现 final_loss")

    @property
    def best_loss(self) -> Optional[float]:
        """最小 loss；没有 loss 时返回 None。"""
        raise NotImplementedError("Step 4：实现 best_loss")

    @property
    def avg_tokens_per_sec(self) -> Optional[float]:
        """吞吐样本的平均值；没有样本时返回 None。"""
        raise NotImplementedError("Step 4：实现 avg_tokens_per_sec")

    @property
    def has_nan(self) -> bool:
        """日志里是否出现过 NaN。"""
        raise NotImplementedError("Step 4：实现 has_nan")

    def to_dict(self) -> dict:
        """序列化为 JSON 友好的 dict（CLI 的 --json 会用它）。"""
        raise NotImplementedError("Step 4：实现 to_dict")


def analyze(events: Sequence[LogEvent], total_lines: int = 0) -> TrainRunStats:
    """Step 4：把事件序列聚合成 TrainRunStats。

    注意：Step 5 的测试会检查 best_step 的正确性——
    第一版实现（把「所有 step」和「所有 loss」按下标对齐）会在这里踩坑。
    """
    raise NotImplementedError("Step 4：实现 analyze")
