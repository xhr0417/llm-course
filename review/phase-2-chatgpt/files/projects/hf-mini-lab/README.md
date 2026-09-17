# hf-mini-lab

> **已退出主线（非当前作业）。** 当前动手任务在网站「我的学习」。本目录是历史参考实现，待后续审计后再处理。不要把 `starter/` 或下面的 Quick Start 当作现在要交的作业。

HuggingFace for LLM Engineering 配套实验：用一个小型 Qwen 模型走完
**加载 → Chat Template → logits → 批量生成 → LoRA SFT → 保存 → 重载 → 评测对比** 全流程。

## Quick Start

```bash
cd projects/hf-mini-lab
pip install -r requirements.txt

# 完整实验（默认 Qwen/Qwen2.5-0.5B-Instruct，CPU 约 1 分钟）
python scripts/run_lab.py

# 覆盖参数
python scripts/run_lab.py --model trl-internal-testing/tiny-Qwen2ForCausalLM-2.5 --steps 20

pytest -q
```

## 运行结果（本机真实记录，CPU）

- 模型：Qwen/Qwen2.5-0.5B-Instruct（494.0M 参数）
- LoRA 可训练参数：540,672 / 494,573,440（**0.1093%**）
- 训练 loss：2.6364 → 1.3052（60 步，batch 2，lr 2e-4，16 条训练样本）
- held-out response-only loss：**3.8168 → 3.6102（Δ −0.2065）**
- 用时：约 60s（CPU fp32）

> 以上是**流程验证**级别实验：16 条样本 / 60 步的目标是证明管线正确，不是能力结论。
> 正式实验需要更大数据、更长训练与完整评测（见 Capstone 1）。

## 项目结构

```
hf-mini-lab/
├── README.md
├── requirements.txt
├── configs/lora_sft.json     # 实验配置（dataclass + JSON）
├── data/sft_mini.jsonl       # 20 条教学数据（16 train / 4 eval）
├── src/hf_lab/
│   ├── config.py             # LabConfig dataclass
│   ├── loading.py            # tokenizer / model 加载（dtype、device）
│   ├── chat.py               # Chat Template、left padding 批量生成
│   ├── data.py               # JSONL、切分、response-only labels（loss mask）
│   ├── train.py              # 最小可读 LoRA 训练循环 + adapter 保存
│   └── evaluate.py           # held-out loss、base/tuned 生成对比
├── scripts/run_lab.py        # 端到端 8 步实验 + 自动生成 report.md
├── tests/test_lab.py         # 11 个测试函数（11 个用例）
└── outputs/lab_run/          # 产物：adapter + config + losses.json + report.md（运行后生成）
```

## 三个容易踩的坑（实验里真实遇到）

1. **PEFT 是就地注入**：`get_peft_model(model)` 会改造传入的模型对象。
   如果你之后直接用同一个 `model` 变量当「基线」评测，测到的其实是**带 adapter 的模型**。
   本项目在评测前用【另一次干净加载】的模型当 base（见 `run_lab.py` [7/8]）。
2. **response-only loss 的 mask 边界**：prompt 部分的 labels 要置 `-100`，
   assistant 回复部分才参与 loss；transformers 内部会对 labels 左移一位，掩码要按未移位的位置设置。
3. **模型输出维度 ≠ tokenizer 词表**：`logits.shape[-1]` 是 `config.vocab_size`，
   可能因并行/对齐被 pad 到略大于 `tokenizer.vocab_size`。

## 与课程对应

| 课程知识 | 本实验中的位置 |
| --- | --- |
| 第 6 章 Tokenizer / BPE | `AutoTokenizer`、encode/decode、子词 |
| 第 21 章 Chat Template / Loss Mask | `chat.py`、`data.build_labels` |
| 第 9 章 GPT / 采样 | `generate`、logits 形状、贪心解码 |
| 第 17 章 LoRA | `train.make_lora_model`（r/alpha/target_modules） |
| 第 23 章 评测 | held-out loss 与定性对比、已知限制 |
