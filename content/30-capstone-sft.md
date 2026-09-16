# 第 30 章 · Capstone 3：Real SFT / LoRA Experiment

:::intuition 一句话
不再「从零手写 SFT trainer」，而是用工业生态完成一次**真实的实验闭环**：训练 LoRA → 用同一套评测对比 base/tuned → 分析 bad case → 自动生成实验报告。这是大模型算法实习的核心工作流。
:::

**项目位置**：[`projects/sft-lora/`](https://github.com/xhr0417/llm-course/tree/main/projects/sft-lora)
**真实运行**：Qwen2.5-0.5B-Instruct，48 训练 / 12 验证 / 20 评测，CPU 469s。

## 30.1 目标与验收（Checkpoint 升级版）

| 环节 | 本项目交付 |
| --- | --- |
| Dataset | 真实指令格式 `{"messages": [...]}`（48+12 条） |
| Response-only loss | prompt 置 -100，只学 assistant 回答（接通第 21 章） |
| LoRA | r/alpha/dropout/target_modules 全部可配（接通第 17 章） |
| Train | grad accum + 梯度裁剪 + warmup/余弦 + 验证 loss 记录 |
| Checkpoint | adapter 保存 / 可选 merge 合并权重 |
| Eval | **同一套 held-out + 同一 harness**（Capstone 1）的 before/after |
| Bad case | 20 条结构化失败样本 + 粗分类 |
| Report | `experiment.md` 自动生成（设置/曲线/对比/badcase/局限） |

## 30.2 训练：真实曲线与一个刻意的反例

```
train loss：3.8878 → 1.4638（150 步，等效 batch 8，lr 2e-4，CPU 469s）
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%
```

验证曲线（每 30 步）：

| step | 30 | 60 | 90 | 120 | 150 |
| --- | --- | --- | --- | --- | --- |
| val loss | 2.8671 | **2.7344** | 2.9813 | 3.2416 | 3.2923 |

:::warning train loss 下降 ≠ 模型变好
train loss 一路降到 1.46，但 val loss 从 step 60 起**持续上升**——经典过拟合。

正规做法：保存 **best checkpoint**（step 60）或 early stopping。本项目刻意保存了**最终** checkpoint，作为反例写进报告——你可以直接对比 adapter 在 step 60 与 step 150 的差异复现这个结论。
:::

## 30.3 评测：把「变好了吗」交给数字回答

同一 held-out、同一 harness（Capstone 1 的 `llm-eval`）：

| 指标 | Base | SFT (LoRA) | Δ |
| --- | --- | --- | --- |
| held-out response-only loss | 3.7565 | 3.2923 | **-0.4641** |
| QA F1（20 题） | 20.2% | **24.0%** | **+3.8pt** |
| QA EM | 0.0% | 0.0% | +0.0pt |

:::note 公平对比的三个前提（一个都不能少）
1. **同一 held-out 集**（12 条验证 + 20 条 QA，训练时从未见过）；
2. **同一 prompt 模板**（同一 chat template 与生成参数）；
3. **干净加载的 base**——PEFT 就地注入陷阱：训练用的 `model` 变量已被注入 LoRA，拿它当 base 会得到 Δ=0.0000 的假结论（第 26 章踩过的坑，本项目用独立加载规避）。
:::

## 30.4 生成风格：SFT 到底学到了什么

```
Q: 用一句话解释什么是早停。
- base ："早停"通常指的是在某些情况下，人们或组织提前停止某种活动、项目或计划，以避免风险……
- tuned：早停时模型不等待下游损失下降就停止优化，避免鞍点死循环。
```

- **风格迁移成功**：tuned 回答变短、更直接（训练数据是「一句话解释」风格）；
- **内容仍然经常错误**：上例把「早停」解释成了别的东西——**SFT 教格式，不教知识**。

这个结论解释了 RAG（第 28 章）与 SFT 的分工：
- 知识 → 检索注入（RAG）；
- 格式/风格/行为 → 微调（SFT）；
- 两者都要评测，且要分开评测。

## 30.5 Bad case：20 条失败样本怎么用

每条 bad case 记录 `{id, question, gold, base, tuned, error_type}`，粗分类（教学启发式）：

| 分类 | 含义 | 该修什么 |
| --- | --- | --- |
| `ok` | F1 ≥ 0.6 | — |
| `partial` | 部分匹配 | 数据质量 / 更大模型 |
| `verbose` | 太长（>80 字） | 风格数据 / 长度惩罚 |
| `wrong` | 完全无关 | 数据覆盖 / 知识注入 |
| `refusal` | 拒绝回答 | 训练数据里的拒绝样本比例 |

本实验 20 条全部 `partial`（F1 ∈ (0, 0.6)）——如果只报告「F1 +3.8pt」而不看 bad case，你会错过「模型在瞎说但格式很像」这个事实。

## 30.6 实验报告：让别人能复现你的结论

`experiment.md` 自动生成，必须包含七要素：

```
model / dataset / hyperparameters / hardware / training curve / eval / failure cases / limitations
```

复现命令：

```bash
cd projects/sft-lora
python scripts/run_experiment.py --steps 150 --output outputs/sft_run --run-harness
```

:::warning 为什么硬件必须写
「CPU 469s」和「8×A100 20 分钟」是两个完全不同的成本事实。报告里不写硬件，读者无法判断实验规模，也无法复现。本项目如实标注 `无 CUDA（CPU 运行）`。
:::

## 30.7 面试复盘：SFT / 算法岗

1. 为什么用 LoRA 而不是全量微调？可训练参数占比怎么算？
2. response-only loss 的掩码怎么构造？为什么 prompt 置 -100？
3. 训练 loss 下降但验证 loss 上升，你怎么处理？
4. Base vs SFT 怎么公平比较？为什么 base 必须干净加载？
5. 为什么 F1 提高了但 EM 还是 0？这两个指标差在哪？
6. bad case 怎么分类？分类之后各自的修法？
7. 如果要把「知识」加进模型，SFT 和 RAG 你怎么选？
8. 你的实验报告里哪些数字是必须的？为什么硬件与数据规模缺一不可？

:::quiz
你的 SFT 实验：train loss 3.89→1.46，val loss 2.73（step 60）→3.29（step 150），QA F1 +3.8pt。最专业的结论是？

A. 训练非常成功，loss 下降了 60%
B. 模型在 step 60 附近达到最优泛化；最终 checkpoint 已过拟合；应保存 best checkpoint 并考虑 early stopping；F1 只有小幅提升，需要更多数据或更大模型
C. 直接上更多步数，loss 还能降
D. 放弃 SFT，改用 RAG

答案: B
解析: 必须同时读 train 与 val 两条曲线：val 的最低点在 step 60，之后上升说明过拟合。报告应给 best checkpoint 的成绩并诚实标注最终 checkpoint 的状态；「loss 下降 60%」是被 train loss 蒙蔽的典型误读；C 会让过拟合更严重；D 是把「格式问题」与「知识问题」混淆了——本项目 F1 +3.8pt 说明 SFT 有效，只是数据规模限制了上限。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 数据 | 指令 messages 格式 + response-only loss（-100 掩码） |
| 训练 | grad accum + clip + warmup/余弦；val 曲线是必看信号 |
| 反例 | 保存 final 而非 best 会过拟合；best checkpoint 才是交付物 |
| 对比 | 同一 held-out / 同一模板 / 干净加载的 base |
| 发现 | SFT 教格式不教知识（真实输出证据） |
| 报告 | model/data/hyperparams/hardware/curve/eval/badcase/limits 七要素 |
:::

:::related
依赖 | 第 17 章 LoRA, 第 21 章 SFT/Loss Mask, 第 26 章 HuggingFace, 第 27 章 Eval Harness
用于 | 大模型算法实习面试, 后训练方向, 后续 DPO/GRPO 实验
:::
