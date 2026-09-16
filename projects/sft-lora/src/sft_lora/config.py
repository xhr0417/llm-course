"""SFT 实验配置（dataclass + JSON 覆盖）。"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class SFTConfig:
    base_model: str = "Qwen/Qwen2.5-0.5B-Instruct"
    dtype: str = "float32"
    device: str = "cpu"
    max_length: int = 256
    lora_r: int = 8
    lora_alpha: int = 16
    lora_dropout: float = 0.0
    target_modules: list[str] = field(default_factory=lambda: ["q_proj", "v_proj"])
    learning_rate: float = 2e-4
    batch_size: int = 2
    grad_accum: int = 4
    max_steps: int = 150
    warmup_steps: int = 20
    grad_clip: float = 1.0
    val_every: int = 30
    seed: int = 0
    output_dir: str = "outputs/sft_run"
    merge: bool = False                      # 训练后是否导出合并权重（体积大）

    @property
    def effective_batch(self) -> int:
        return self.batch_size * self.grad_accum

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2), encoding="utf-8")


def load_config(path: Optional[Path] = None, **overrides) -> SFTConfig:
    data: dict = {}
    if path is not None and Path(path).exists():
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    data.update({k: v for k, v in overrides.items() if v is not None})
    return SFTConfig(**data)
