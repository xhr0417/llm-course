# sft-lora —— Capstone 3：Real SFT / LoRA Experiment

完整后训练实验：**Base Model → Instruction Dataset → Chat Template → LoRA → Training → Adapter → Evaluation → Bad Case → Experiment Report**。

用 [Capstone 1 的评测 harness（llm-eval）](../llm-eval/) 对微调前后做**同一套评测**的对比。

这是 Job-Ready Track 的算法方向核心项目（Track B）。

## Quick Start

```bash
cd projects/sft-lora
pip install -r requirements.txt

# 完整实验（CPU 约 8 分钟：150 步训练 + base/tuned 生成 + harness 评测）
python scripts/run_experiment.py --steps 150 --output outputs/sft_run --run-harness

# 只训练（跳过 harness 对比）
python scripts/run_experiment.py --steps 150

# 训练并导出合并权重（merge，文件约 1GB）
python scripts/run_experiment.py --steps 150 --merge

pytest -q   # 14 passed
```

## 真实实验结果（本机 CPU，Qwen2.5-0.5B-Instruct）

**训练**（48 train / 12 val，response-only loss，150 步，用时 469s）：

```
train loss：3.8878 → 1.4638
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%

val loss 曲线：
  step  30：2.8671
  step  60：2.7344   ← 最佳（best checkpoint 应存这里）
  step  90：2.9813
  step 120：3.2416
  step 150：3.2923   ← 最终（已过拟合）
```

**评测对比**（同一 held-out 集 + 同一 harness）：

| 指标 | Base | SFT (LoRA) | Δ |
| --- | --- | --- | --- |
| held-out response-only loss | 3.7565 | 3.2923 | **-0.4641** |
| QA F1（Capstone 1 harness，20 题） | 20.2% | **24.0%** | **+3.8pt** |
| QA EM | 0.0% | 0.0% | +0.0pt |

**生成风格对比**（真实输出）：

```
Q: 用一句话解释什么是早停。
- base ："早停"通常指的是在某些情况下，人们或组织提前停止某种活动、项目或计划，以避免风险……
- tuned：早停时模型不等待下游损失下降就停止优化，避免鞍点死循环。
```

tuned 输出明显更接近训练数据的「一句话、直接回答」风格——但**内容仍然经常错误**（上例中把早停解释错了）。

## 三个关键结论（真实数据支持的）

1. **train loss ↓ ≠ 模型变好**：val loss 从 step 60 起持续上升——过拟合。正确做法是保存 best checkpoint / early stopping；本实验保存了**最终** checkpoint，是一个刻意保留的反例（见 experiment.md 的 Limitations）；
2. **SFT 教格式，不教知识**：48 条样本让回答更简洁（风格迁移成功，F1 +3.8pt），但内容正确性没有保障——知识注入需要数据规模或 RAG/更大模型；
3. **公平对比的三个前提**（本项目全部满足）：同一 held-out、同一 prompt 模板、**干净加载的 base**（PEFT 就地注入陷阱：用训练时那个 model 变量当 base 会得到 Δ=0 的假结论）。

## 项目结构

```text
sft-lora/
├── configs/sft_lora.json       # SFTConfig（LoRA/训练/调度超参）
├── data/
│   ├── train.jsonl             # 48 条指令数据（LLM/ML 概念，简洁风格）
│   ├── val.jsonl               # 12 条 held-out
│   └── eval_qa.jsonl           # 20 条 QA（Capstone 1 harness 评测集）
├── src/sft_lora/
│   ├── config.py               # dataclass + JSON
│   ├── data.py                 # response-only labels + collate
│   ├── model.py                # 加载 / LoRA 注入 / merge_adapter
│   ├── train.py                # grad accum + clip + warmup/cosine + val loss
│   ├── evaluate.py             # held-out loss / 生成 / bad case 分类
│   ├── metrics_shim.py         # 与 llm-eval 同口径的 F1
│   └── report.py               # experiment.md + losses.csv 自动生成
├── scripts/run_experiment.py   # 端到端（含调用 llm-eval harness）
└── tests/test_sft.py           # 14 个测试
```

## 与课程对应

| 课程知识 | 项目位置 |
| --- | --- |
| 第 21 章 SFT / Loss Mask | `data.build_example`（-100 掩码） |
| 第 17 章 LoRA | `model.apply_lora`（r/alpha/target）+ merge |
| 第 26 章 Chat Template / PEFT 陷阱 | `scripts/run_experiment.py`（干净 base 对照） |
| 第 23 章 评测 | harness 前后对比 + bad case + Limitations |

## 产物

`outputs/sft_run/`：`adapter/`（LoRA 权重）、`losses.csv`、`badcases.jsonl`、`experiment.md`（自动报告）、`harness_results.json`（前后对比原始结果）。
