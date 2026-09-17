# sft-lora —— Real SFT / LoRA Experiment（历史参考）

> **已退出主线（非当前作业）。** 当前动手任务在网站「我的学习」。本目录是历史参考实现，待后续审计后再处理。不要把下面的 Quick Start 当作现在要交的作业。

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

pytest -q   # 15 passed
```

## 真实实验结果（本机 CPU，Qwen2.5-0.5B-Instruct）

**训练**（48 train / 12 val，response-only loss，150 步，CPU）：

```
train loss：3.8878 → 1.4638（本 run）
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%

val loss 曲线（本次运行）：
  step  30：2.8677
  step  60：2.7301   ← best（已保存为 adapter_best/）
  step  90：2.9822
  step 120：3.2427
  step 150：3.2947   ← final（adapter_final/，过拟合反例）
```

**评测对比**（同一 held-out + 同一 harness，Base / Best / Final 三路）：

| 指标 | Base | Best (step 60) | Final (step 150) |
| --- | --- | --- | --- |
| held-out response-only loss | 3.7565 | **2.7301** | 3.2947 |
| QA F1（Capstone 1 harness，20 题） | 20.2% | **24.4%** | 22.5% |
| QA EM | 0.0% | 0.0% | 0.0% |

**本 run 的观察**：best val loss 的 checkpoint 同时也是 QA F1 最高点（24.4%）。
注意这只是**单次运行的经验观察**——val loss 与 downstream 指标不一致是常见现象，不能假设二者永远一致（报告脚本会同时打印三者，就是为了检查这一点）。

**生成风格对比**（真实输出）：

```
Q: 用一句话解释什么是早停。
- base ："早停"通常指的是在某些情况下，人们或组织提前停止某种活动、项目或计划，以避免风险……
- tuned：早停时模型不等待下游损失下降就停止优化，避免鞍点死循环。
```

tuned 输出明显更接近训练数据的「一句话、直接回答」风格——但**内容仍然经常错误**（上例中把早停解释错了）。

## 四个关键结论（真实数据支持的）

1. **train loss ↓ ≠ 模型变好**：val loss 从 step 60 起持续上升（2.73 → 3.29）——过拟合；
   本轮已实现 **best checkpoint 保存**（`adapter_best/`），final 作为反例保留（`adapter_final/`）；
2. **val 最优 ≠ 必然 downstream 最优**（但本次运行一致）：best@60 的 QA F1（24.4%）> final@150（22.5%）。
   这是单次运行的结果，不作为普遍规律——正确做法是每次都三路对比；
3. **+4.2pt 是描述性结果**：在这 20 条 QA 上 best 相对 base 观察到 +4.2pt 的 F1 提升，但 **n=20 太小，
   不足以单独证明稳定的能力提升**；能确定的是：train loss 下降、val 曲线过拟合、输出风格改变；
4. **公平对比三前提**：同一 held-out / 同一 prompt 模板 / **干净加载的 base**（PEFT 就地注入陷阱）。

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
└── tests/test_sft.py           # 15 个测试函数（15 个用例）
```

## 与课程对应

| 课程知识 | 项目位置 |
| --- | --- |
| 第 21 章 SFT / Loss Mask | `data.build_example`（-100 掩码） |
| 第 17 章 LoRA | `model.apply_lora`（r/alpha/target）+ merge |
| 第 26 章 Chat Template / PEFT 陷阱 | `scripts/run_experiment.py`（干净 base 对照） |
| 第 23 章 评测 | harness 前后对比 + bad case + Limitations |

## 产物

`outputs/sft_run/`：`adapter_best/`、`adapter_final/`（两份 LoRA 权重）、`losses.csv`、`badcases.jsonl`、`experiment.md`（自动报告）、`harness_results.json`（Base/Best/Final 三路原始结果 + eval_base/eval_best/eval_final 报告）。
