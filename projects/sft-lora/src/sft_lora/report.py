"""实验报告：losses.csv + experiment.md（model/data/hyperparams/hardware/curve/eval/badcases/limits）。"""
from __future__ import annotations

import csv
import json
import platform
import sys
from pathlib import Path

from sft_lora.config import SFTConfig
from sft_lora.train import TrainLog


def write_losses_csv(log: TrainLog, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["step", "loss", "grad_norm", "lr", "elapsed_s"])
        for row in log.steps:
            writer.writerow([row["step"], f"{row['loss']:.6f}", f"{row['grad_norm']:.4f}",
                             f"{row['lr']:.3e}", f"{row['t']:.1f}"])
        for row in log.val_losses:
            writer.writerow([row["step"], f"val:{row['val_loss']:.6f}", "", "", ""])


def hardware_info() -> str:
    import torch

    gpu = "无 CUDA（CPU 运行）"
    if torch.cuda.is_available():
        gpu = torch.cuda.get_device_name(0)
    return f"{platform.system()} {platform.machine()} | Python {sys.version.split()[0]} | torch {torch.__version__} | {gpu}"


def build_experiment_md(cfg: SFTConfig, log: TrainLog, base_val: float, best_val: float,
                        final_val: float, n_train: int, n_val: int, badcases: list[dict],
                        eval_table: list[dict] | None, elapsed_s: float,
                        adapter_dir: Path) -> str:
    lines = [
        "# SFT / LoRA 实验报告（自动生成）",
        "",
        "## 1. 实验设置",
        "",
        f"- 基座模型：`{cfg.base_model}`（dtype={cfg.dtype}, device={cfg.device}）",
        f"- 数据：train {n_train} 条 / val {n_val} 条（response-only loss）",
        f"- LoRA：r={cfg.lora_r}, alpha={cfg.lora_alpha}, dropout={cfg.lora_dropout}, target={cfg.target_modules}",
        f"- 训练：steps={cfg.max_steps}, batch={cfg.batch_size}×accum={cfg.grad_accum}"
        f"（等效 {cfg.effective_batch}）, lr={cfg.learning_rate}, warmup={cfg.warmup_steps}, clip={cfg.grad_clip}",
        f"- 硬件：{hardware_info()}",
        f"- 用时：{elapsed_s:.1f}s | adapter：`{adapter_dir}`",
        "",
        "## 2. 训练曲线",
        "",
        f"- train loss：{log.first_loss:.4f} → {log.last_loss:.4f}",
    ]
    for row in log.val_losses:
        lines.append(f"- val loss @step {row['step']}：{row['val_loss']:.4f}")
    lines += [
        "",
        "完整曲线见 `losses.csv`。",
        "",
        f"best checkpoint：val loss {log.best_val_loss:.4f} @step {log.best_step}（adapter_best/）；"
        f"final checkpoint：val loss {final_val:.4f} @step {cfg.max_steps}（adapter_final/）。",
        "",
        "## 3. 评测对比（同一套 held-out；Base / Best / Final 三路）",
        "",
        "| 指标 | Base | Best (step " + str(log.best_step) + ") | Final (step " + str(cfg.max_steps) + ") |",
        "| --- | --- | --- | --- |",
        f"| held-out response-only loss | {base_val:.4f} | {best_val:.4f} | {final_val:.4f} |",
    ]
    if eval_table:
        for row in eval_table:
            lines.append(f"| {row['metric']} | {row['base']} | {row['best']} | {row['final']} |")
    else:
        lines.append("| QA harness（EM/F1） | — | — | 未运行（--run-harness 开启） |")
    lines += [
        "",
        "> **注意**：best val loss 的 checkpoint **不保证**同时是 downstream 指标（QA F1/EM）的最佳点——"
        "本表就是用来检验这一点的；如果出现不一致，如实记录（这本身就是 experiment design 的常见现象）。",
    ]
    lines += [
        "",
        "## 4. Bad cases（生成侧）",
        "",
        f"共 {len(badcases)} 条（完整见 badcases.jsonl），按粗分类统计：",
        "",
    ]
    counts: dict[str, int] = {}
    for case in badcases:
        counts[case["error_type"]] = counts.get(case["error_type"], 0) + 1
    for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
        lines.append(f"- {k}: {v}")
    lines += ["", "示例：", ""]
    for case in badcases[:5]:
        lines.append(f"- `{case['id']}`（{case['error_type']}）")
        lines.append(f"  - Q: {case['question']}")
        lines.append(f"  - base: {case['base'][:80]}")
        lines.append(f"  - tuned: {case['tuned'][:80]}")
    lines += [
        "",
        "## 5. Limitations",
        "",
        "- 数据规模小（48 train / 12 val）、训练步数少：目标是验证流程与对比方法，不是能力结论；",
        "- 生成评测为粗分类启发式（F1 阈值），正式实验需要 LLM-as-Judge 或人工评分；",
        "- CPU 训练：没有 tokens/s 与显存数字（GPU 环境可用 `nvidia-smi` 与 profiler 补充）；",
        "- 单种子实验：没有做多次运行取均值与置信区间。",
    ]
    return "\n".join(lines) + "\n"
