"""统计：从事件序列中提取训练运行的关键指标。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence

from log_analyzer.parser import LogEvent


@dataclass
class TrainRunStats:
    total_lines: int = 0
    parsed_events: int = 0
    steps: list[int] = field(default_factory=list)
    loss_steps: list[int] = field(default_factory=list)
    losses: list[float] = field(default_factory=list)
    throughput_samples: list[float] = field(default_factory=list)
    warnings: list[LogEvent] = field(default_factory=list)
    errors: list[LogEvent] = field(default_factory=list)
    nan_events: list[LogEvent] = field(default_factory=list)
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    @property
    def final_loss(self) -> Optional[float]:
        return self.losses[-1] if self.losses else None

    @property
    def best_loss(self) -> Optional[float]:
        return min(self.losses) if self.losses else None

    @property
    def best_step(self) -> Optional[int]:
        if not self.losses or not self.loss_steps:
            return None
        best_idx = self.losses.index(min(self.losses))
        return self.loss_steps[best_idx]

    @property
    def avg_tokens_per_sec(self) -> Optional[float]:
        if not self.throughput_samples:
            return None
        return sum(self.throughput_samples) / len(self.throughput_samples)

    @property
    def has_nan(self) -> bool:
        return len(self.nan_events) > 0

    def to_dict(self) -> dict:
        return {
            "parsed_events": self.parsed_events,
            "total_lines": self.total_lines,
            "steps": {"first": self.steps[0] if self.steps else None, "last": self.steps[-1] if self.steps else None},
            "final_loss": self.final_loss,
            "best_loss": self.best_loss,
            "best_step": self.best_step,
            "avg_tokens_per_sec": self.avg_tokens_per_sec,
            "num_warnings": len(self.warnings),
            "num_errors": len(self.errors),
            "has_nan": self.has_nan,
            "start_time": self.start_time,
            "end_time": self.end_time,
        }


def analyze(events: Sequence[LogEvent], total_lines: int = 0) -> TrainRunStats:
    stats = TrainRunStats(total_lines=total_lines, parsed_events=len(events))
    for event in events:
        if stats.start_time is None:
            stats.start_time = event.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        stats.end_time = event.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        if event.step is not None:
            stats.steps.append(event.step)
        if event.loss is not None:
            stats.losses.append(event.loss)
            if event.step is not None:
                stats.loss_steps.append(event.step)
        if event.tokens_per_sec is not None:
            stats.throughput_samples.append(event.tokens_per_sec)
        if event.level == "WARNING":
            stats.warnings.append(event)
        elif event.level == "ERROR":
            stats.errors.append(event)
        if "nan" in event.message.lower():
            stats.nan_events.append(event)
    return stats
