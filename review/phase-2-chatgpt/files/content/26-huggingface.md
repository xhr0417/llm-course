:::intuition 一句话
你已经知道 Transformer 内部长什么样（第 7 章）——这一章把工业生态里的 **Tokenizer → Chat Template → logits → generate → response-only mask → LoRA → 保存/重载 → 对比评测** 串成一条可理解的工作流。当前主线作业仍是 Attention 空文件练习，不是再跑一遍旧的 HuggingFace starter。
:::

:::warning 页面中的数字来自真实运行
模型：`Qwen/Qwen2.5-0.5B-Instruct`（CPU，fp32）。形状、参数量、loss、生成结果来自当时对历史参考实现的实测。tests 用 tiny 模型保证速度；完整实验用真实 Qwen。这些数字是历史记录，不是当前必做实验。
:::

:::note 本章在当前主线中的位置
当前主线是「小模型学习实验室 → 技术声明核验助手 / 单 Agent → 算法或 Infra 专项」。本章当教材阅读：保留 HuggingFace 原理与实测数字。`projects/hf-mini-lab/` 是历史参考实现，**不是当前作业**。不要进入 `starter/`。完整 SFT 实验纪律见第 30 章（同样是教材与历史记录，不是当前 Capstone）。
:::

## 26.1 工作流地图（先建立心智模型）

一条真实 LLM 工程链路的每一层解决一个具体问题：

| 环节 | 要搞清楚的事 |
| --- | --- |
| Tokenizer | encode / decode、pad token、attention_mask |
| Chat Template | 模型看到的是渲染后的特殊 token 文本，不要手拼 |
| 加载模型 | 参数量与内存的数量级；权重在 HuggingFace 缓存，不在 git 仓库 |
| logits | 形状连接第 9 章：`[batch, seq, vocab]` |
| 批量生成 | 不同长度 prompt → padding 边（decoder-only 常用 left padding） |
| JSONL 数据 | load / split；指令格式 `messages` |
| Response-only loss | prompt 置 `-100`，只学 assistant |
| LoRA | `r` / `alpha` / `target_modules`；可训练参数占比 |
| 保存与重载 | adapter 是轻量交付物；评测基线必须**干净加载** |
| 对比评测 | 同一 held-out、同一模板；训练 loss 下降 ≠ held-out 变好 |

每一步仍值得用「先预测形状或数字，再对照实测」的方式理解。当前主线不要求你按旧 Step 去改历史 starter 目录。

运行 `from_pretrained(...)` 时，模型进入 **HuggingFace 缓存目录**，不是课程仓库：

```bash
echo ${HF_HOME:-~/.cache/huggingface}
```

要放大盘先 `export HF_HOME=...`。GitHub 只提交代码与小数据，不提交权重。

## 26.2 历史实测（可选对照）

当时在 CPU、fp32、Qwen2.5-0.5B-Instruct 上的记录：

```
模型：Qwen/Qwen2.5-0.5B-Instruct | 494.0M 参数 | float32 | cpu
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%
训练 loss：2.6364 → 1.3052（60 步，batch 2，lr 2e-4，16 条样本）
held-out response-only loss：base=3.8168 → tuned=3.6102（Δ=-0.2065）
用时：60.2s（CPU）
```

读这些数字时记住：16 条样本 / 60 步只够验证流程，不构成能力结论。PEFT 会就地改造传入的模型对象——拿同一个 `base` 变量当基线，会得到 Δ=0 的假对比。必须重新 `from_pretrained` 一份干净模型。

:::note 可选参考（非当前作业）
对照实现见 [projects/hf-mini-lab](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab)。不要 `cd` 进 `starter/`，也不要把 38 个测试全绿或 `run_lab.py` 当作当前任务。
:::

## 26.3 参考手册与算法延伸

Tokenizer、Chat Template、left padding、response-only mask、PEFT 陷阱和面试复盘在按需查阅页。完整 SFT / LoRA 实验记录在第 30 章。

:::reference huggingface
打开 HuggingFace 工程参考手册
:::
