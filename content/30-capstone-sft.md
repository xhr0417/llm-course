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

验证曲线（每 30 步，本次运行）：

| step | 30 | 60 | 90 | 120 | 150 |
| --- | --- | --- | --- | --- | --- |
| val loss | 2.8677 | **2.7301** | 2.9822 | 3.2427 | 3.2947 |

**本轮实现**：每次 val 改善自动保存 `adapter_best/`；训练结束保存 `adapter_final/`。

:::warning train loss 下降 ≠ 模型变好
train loss 一路降到 1.46，但 val loss 从 step 60 起**持续上升**——经典过拟合。
正规做法：保存 **best checkpoint**（本轮已实现）或 early stopping；本项目同时保留 final 作为反例，
让你直接对比两份 checkpoint 的差异。
:::

## 30.3 评测：把「变好了吗」交给数字回答

同一 held-out、同一 harness（Capstone 1 的 `llm-eval`），**Base / Best / Final 三路**：

| 指标 | Base | Best (step 60) | Final (step 150) |
| --- | --- | --- | --- |
| held-out response-only loss | 3.7565 | **2.7301** | 3.2947 |
| QA F1（20 题） | 20.2% | **24.4%** | 22.5% |
| QA EM | 0.0% | 0.0% | 0.0% |

**本次运行的观察**：best val loss 的 checkpoint 同时也是 QA F1 最高点。
但这只是单次运行的经验观察——**val 最优不必然等于 downstream 最优**（反之亦然），
所以实验报告固定输出三路对比来检查一致性。

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
- **内容仍然经常错误**：上例把「早停」解释成了别的东西（部分回答偏离）。

:::note 准确的定位（避免过度二分）
SFT 可以改变模型的行为、格式与任务能力，也可能注入一定的任务知识；但在本项目
**「0.5B + 48 条训练样本」的小数据 regime** 下，最明显的现象是**输出风格变化**，
而不是稳定的事实能力提升。RAG 与 SFT 不是互斥方案：

- RAG 适合：外部知识、频繁更新的知识、需要引用的知识；
- SFT 适合：行为格式、instruction following、领域风格、任务适配；
- 实际系统常常两者叠加（先微调行为，再挂检索补充知识）。
:::

## 30.4b Training Data Correctness：错误答案也会被认真学习

SFT 的一个残酷现实：

```text
错误 teacher answer
   ↓
training loss 一样会下降（模型在认真拟合你的数据）
   ↓
模型会认真地学错
```

本项目在 Correctness Pass 中逐条 auditing 了训练数据，修正了过度绝对的表述。典型例子（修正前后）：

| 主题 | 修正前（过度绝对） | 修正后（准确口径） |
| --- | --- | --- |
| LoRA alpha | 「通常取两倍 rank」 | alpha 是缩放超参数，常见取 rank / 2×rank 或其它值，需实验选择 |
| RoPE | 「支持外推」 | 不天然保证可靠外推；长上下文通常配合位置插值/缩放 |
| 量化 | 「代价是少量精度」 | 精度影响取决于 bit width / 算法 / 校准 / 模型与任务 |
| SwiGLU | 「比 ReLU 更好」 | 广泛采用，但配置不同，不能抽象成对所有任务必然更优 |
| 混合精度 | 「FP32 做关键状态」 | 保留哪些高精度状态取决于 AMP / optimizer / 分布式实现 |

**工程纪律**：合成数据 / teacher 模型产出的答案必须做事实审查——loss 不会替你发现数据是错的。
这条对后续做 DPO/GRPO 与合成数据管线同样适用。

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
| 反例 | final 已过拟合；本轮已实现 best checkpoint 自动保存 |
| 对比 | 同一 held-out / 同一模板 / 干净 base；Base–Best–Final 三路 |
| 发现 | 小数据 regime 下 SFT 主要改风格；能力提升需更大数据与更严评测 |
| 报告 | model/data/hyperparams/hardware/curve/eval/badcase/limits 七要素 |
:::

:::related
依赖 | 第 17 章 LoRA, 第 21 章 SFT/Loss Mask, 第 26 章 HuggingFace, 第 27 章 Eval Harness
用于 | 大模型算法实习面试, 后训练方向, 后续 DPO/GRPO 实验
:::
