# hf-mini-lab · Starter（Guided Build）

这是 **第 26 章 · HuggingFace for LLM Engineering** 的 Guided Build 起点项目。

**它现在是一个不完整的项目**：`src/hf_lab/` 里的核心函数只有签名和 `NotImplementedError`。
你的任务不是「看懂」，而是**一步一步把函数写出来，让测试从红变绿**。

> 项目目标：用一个小型 Qwen 模型走完
> 加载 → Chat Template → logits → 批量生成 → JSONL 切分 → response-only labels
> → LoRA 训练 → 保存 / 重载 → 评测对比 → 自动报告 全流程。
> 测试使用 `trl-internal-testing/tiny-Qwen2ForCausalLM-2.5`（已缓存，体积很小）；
> 最终用 `scripts/run_lab.py` 跑一遍真实端到端实验。

## Quick Start

```bash
cd projects/hf-mini-lab/starter
pip install -r requirements.txt

pytest -q          # 现在就应该失败（这是设计的一部分）
```

**初始状态（真实记录）**：`38 failed`（首次记录 27.10s，本机约 30s）—— 因为 `src/` 还没有实现。
失败不是错误，而是给你看的任务清单。请对照课程第 26 章的 Step 0-12 逐组变绿。

> 模型依赖测试首次运行需要联网下载 tiny 模型（之后走本地缓存）。
> 想跳过模型测试：`RUN_MODEL_TESTS=0 pytest -q`（此时 7 failed / 31 skipped，仍然是红）。

## Step → 测试 对应表

| Step | 主题 | 运行（只看本步） | 变绿意味着 |
| --- | --- | --- | --- |
| 1 | 加载 tokenizer（encode/decode、pad_token 兜底） | `pytest -q tests/test_step1_tokenizer.py` | 3 passed |
| 2 | Chat Template（特殊 token 与 add_generation_prompt） | `pytest -q tests/test_step2_chat_template.py` | 5 passed |
| 3 | 加载模型（eval 模式、参数量、CPU/float32） | `pytest -q tests/test_step3_model.py` | 3 passed |
| 4 | logits 形状（batch / seq / vocab，注意 vocab ≥ 词表） | `pytest -q tests/test_step4_logits.py` | 2 passed |
| 5 | 批量生成（left padding、只解码新 token） | `pytest -q tests/test_step5_generate.py` | 3 passed |
| 6 | 数据读入与切分（JSONL、split 字段、随机兜底） | `pytest -q tests/test_step6_data.py` | 4 passed |
| 7 | response-only 掩码（-100、BatchEncoding 兼容） | `pytest -q tests/test_step7_labels.py` | 5 passed |
| 8 | LoRA 注入（r/alpha/target_modules、可训练参数占比） | `pytest -q tests/test_step8_lora.py` | 2 passed |
| 9 | 训练循环（手工 collate、AdamW、loss 记录） | `pytest -q tests/test_step9_train.py` | 3 passed |
| 10 | 保存与重载 adapter（adapter_config / safetensors） | `pytest -q tests/test_step10_save_load.py` | 3 passed |
| 11 | PEFT 就地注入陷阱（本项目真实历史 bug） | `pytest -q tests/test_step11_peft_trap.py` | 2 passed |
| 12 | 评测与报告（held-out loss、生成对比、report.md） | `pytest -q tests/test_step12_evaluate.py` | 3 passed |
| 全部 | 最终验收 | `pytest -q` | 38 passed |

> 跑全量 `pytest -q` 时，后面步骤的测试也会一起失败——这是正常的：
> 它们在等你先完成前面的步骤。另外 `next_token_logits` 依赖 `render_chat`、
> `train_lora` 依赖 `encode_batch` 与 `_collate`，依赖顺序在测试失败信息里能看出来。

## 目录结构

```text
starter/
├── README.md
├── requirements.txt        # torch / transformers / peft / datasets / pytest
├── pytest.ini              # testpaths = tests
├── conftest.py             # src/ 加进 import 路径 + RUN_MODEL_TESTS 开关
├── configs/lora_sft.json   # 实验配置（LabConfig + JSON）
├── data/sft_mini.jsonl     # 20 条教学数据（16 train / 4 eval）
├── src/hf_lab/
│   ├── __init__.py
│   ├── config.py           # 已给出：LabConfig dataclass + load_config
│   ├── loading.py          # Step 1 / 3 / 10：tokenizer、model、adapter
│   ├── chat.py             # Step 2 / 4 / 5：模板渲染、logits、批量生成
│   ├── data.py             # Step 6 / 7：JSONL、切分、response-only labels
│   ├── train.py            # Step 8 / 9 / 10：LoRA、collate、训练、保存
│   └── evaluate.py         # Step 12：eval loss、生成对比、报告
├── scripts/run_lab.py      # 已给出：8 步端到端实验（写完后用它验收）
└── tests/
    └── test_step1_tokenizer.py … test_step12_evaluate.py
```

## 三个真实陷阱（课程与父项目都验证过）

1. **PEFT 是就地注入**：`get_peft_model(model)` / `PeftModel.from_pretrained(base, ...)`
   会改造传入的模型对象。Step 11 的测试就是为这个历史 bug 写的——用同一个 `base`
   变量当基线，会把 adapter 当成 base 来评测（Δ≈0.0000）。
2. **response-only loss 的 mask 边界**：prompt 部分 labels 置 `-100`，
   掩码要按**未移位**的位置设置（transformers 内部会对 labels 左移一位）。
3. **模型输出维度 ≠ tokenizer 词表**：`logits.shape[-1]` 是 `config.vocab_size`，
   可能因对齐 pad 到略大于 `tokenizer.vocab_size`（Step 4 用 `>=` 而不是 `==`）。

## 三条纪律

1. **不要先看参考实现**：完整实现就在上一级目录（`../src/` 与 `../scripts/run_lab.py`）。
   卡住时先看课程里的 Hint 1 / Hint 2；只有两次 Hint 都用完、仍然卡住时才打开
   `[查看参考实现]`。抄一遍 ≠ 学会。
2. **先预测，再运行**：每一步的 `pytest` 之前，先写下你预期看到几个 failed / passed。
   预测和实际不一致的地方，才是你真正需要理解的地方。
3. **self-check 诚实**：课程页面上的进度条需要你**在本地真实跑通测试后**才点「我已在本地通过」。
   网站无法验证你的本地环境——自己骗自己没有意义。

## 完成之后

- `pytest -q` 全部通过（38 passed）；
- 用 tiny 模型跑通端到端实验（约几秒）：
  `python scripts/run_lab.py --model trl-internal-testing/tiny-Qwen2ForCausalLM-2.5 --steps 20 --output outputs/lab_run_smoke`；
- 对照上一级的完整工程（`../README.md` / `../src/` / `../scripts/run_lab.py`），
  看看你的实现和它差在哪里；
- 回到课程页面回答 Step 12 的复盘问题——能不看代码回答，才算完成 Checkpoint B。
