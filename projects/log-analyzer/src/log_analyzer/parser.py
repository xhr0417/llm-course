"""日志解析：把每一行文本变成结构化的 LogEvent。"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Iterator, Optional

TS_FORMAT = "%Y-%m-%d %H:%M:%S"

LINE_RE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+"
    r"(?P<level>DEBUG|INFO|WARNING|ERROR)\s+"
    r"(?P<msg>.*)$"
)
KV_RE = re.compile(r"(?P<key>[A-Za-z_][A-Za-z0-9_/]*)=(?P<value>[^\s]+)")


@dataclass(frozen=True)
class LogEvent:
    timestamp: datetime
    level: str
    message: str
    fields: dict[str, str] = field(default_factory=dict)

    @property
    def step(self) -> Optional[int]:
        raw = self.fields.get("step")
        return int(raw) if raw is not None and raw.isdigit() else None

    @property
    def loss(self) -> Optional[float]:
        raw = self.fields.get("loss")
        if raw is None:
            return None
        try:
            return float(raw)
        except ValueError:
            return None

    @property
    def tokens_per_sec(self) -> Optional[float]:
        raw = self.fields.get("tokens/s") or self.fields.get("tokens_per_sec")
        if raw is None:
            return None
        try:
            return float(raw)
        except ValueError:
            return None


def parse_line(line: str) -> Optional[LogEvent]:
    """解析单行；无法解析（如空行、续行）返回 None。"""
    line = line.rstrip("\n")
    if not line.strip():
        return None
    m = LINE_RE.match(line)
    if not m:
        return None
    fields = {kv.group("key"): kv.group("value") for kv in KV_RE.finditer(m.group("msg"))}
    return LogEvent(
        timestamp=datetime.strptime(m.group("ts"), TS_FORMAT),
        level=m.group("level"),
        message=m.group("msg"),
        fields=fields,
    )


def parse_lines(lines: Iterable[str]) -> Iterator[LogEvent]:
    for line in lines:
        event = parse_line(line)
        if event is not None:
            yield event


def parse_log_file(path: Path | str) -> list[LogEvent]:
    """读取日志文件并返回全部可解析事件。"""
    return list(parse_lines(Path(path).read_text(encoding="utf-8").splitlines()))
