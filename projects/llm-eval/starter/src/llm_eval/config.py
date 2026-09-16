"""评测配置（dataclass + JSON 覆盖，参照第 25/26 章工程规范）。

本文件已给出，不需要修改。
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class EvalConfig:
    adapter: str = "hf"                       # hf | openai | mock
    model: str = "Qwen/Qwen2.5-0.5B-Instruct"
    tasks: list[str] = field(default_factory=lambda: ["c3", "xcopa"])
    limit: int = 50                           # 每个任务最多评测多少题
    max_new_tokens: int = 16
    temperature: float = 0.0
    concurrency: int = 1                      # HF(CPU) 用 1；API 可调大（配合 Semaphore）
    retries: int = 2
    retry_backoff_s: float = 1.5
    use_cache: bool = True
    cache_path: str = ".cache/llm_eval.sqlite"
    output_dir: str = "outputs/run"
    data_overrides: dict[str, str] = field(default_factory=dict)  # {task: jsonl路径}
    base_url: str = "http://localhost:8000"   # openai-compatible adapter
    api_key: str = ""
    peft_adapter: str = ""                    # HF adapter 可选：LoRA adapter 路径（Capstone 3 对比用）

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2), encoding="utf-8")


def load_config(path: Optional[Path] = None, **overrides) -> EvalConfig:
    data: dict = {}
    if path is not None:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    data.update({k: v for k, v in overrides.items() if v is not None})
    return EvalConfig(**data)
