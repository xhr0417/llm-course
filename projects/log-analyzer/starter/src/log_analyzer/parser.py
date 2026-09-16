"""日志解析：把每一行文本变成结构化的 LogEvent。

这是 starter 的【待实现文件】：
- Step 1：实现 load_lines()
- Step 2：实现 LogEvent.step / LogEvent.loss / LogEvent.tokens_per_sec 与 parse_line()
- Step 3：增强 parse_line()，让它可以面对现实世界的脏数据

真实日志行长这样（samples/train.log）：
    2025-01-10 09:00:02 INFO  step=10 loss=7.812 lr=3.0e-4 tokens/s=1180
    2025-01-10 09:00:06 WARNING step=25 grad_norm=12.53 (> clip 1.0)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Iterator, Optional

TS_FORMAT = "%Y-%m-%d %H:%M:%S"


@dataclass(frozen=True)
class LogEvent:
    """一条解析成功的日志。

    字段设计：timestamp / level / message 是三要素；
    其余 key=value（step、loss、tokens/s ...）统一装进 fields。
    """

    timestamp: datetime
    level: str
    message: str
    fields: dict[str, str] = field(default_factory=dict)

    @property
    def step(self) -> Optional[int]:
        """从 fields 中取出 step（没有 / 不是数字 → None）。"""
        raise NotImplementedError("Step 2：实现 LogEvent.step")

    @property
    def loss(self) -> Optional[float]:
        """从 fields 中取出 loss（没有 / 解析失败 → None，不要抛异常）。"""
        raise NotImplementedError("Step 2：实现 LogEvent.loss")

    @property
    def tokens_per_sec(self) -> Optional[float]:
        """从 fields 中取出吞吐（键名是 tokens/s，注意斜杠）。"""
        raise NotImplementedError("Step 2：实现 LogEvent.tokens_per_sec")


def load_lines(path: "Path | str") -> list[str]:
    """Step 1：按 UTF-8 读取文件的每一行（不含行尾换行符）。

    - 文件不存在时不要吞错：让 FileNotFoundError 抛给调用方；
    - 空文件返回 []。
    """
    raise NotImplementedError("Step 1：实现 load_lines（提示：pathlib + splitlines）")


def parse_line(line: str) -> Optional[LogEvent]:
    """Step 2/3：解析单行日志；空行、坏行、续行一律返回 None。

    只有「时间戳 + 级别 + 内容」齐全的行才算合法日志。
    """
    raise NotImplementedError("Step 2：实现 parse_line（提示：正则 + KV 切分）")


def parse_lines(lines: Iterable[str]) -> Iterator[LogEvent]:
    """Step 2：逐行解析，只产出解析成功的事件。"""
    raise NotImplementedError("Step 2：实现 parse_lines")


def parse_log_file(path: "Path | str") -> list[LogEvent]:
    """Step 2：读文件 + 逐行解析（组合 load_lines + parse_lines）。"""
    raise NotImplementedError("Step 2：实现 parse_log_file")
