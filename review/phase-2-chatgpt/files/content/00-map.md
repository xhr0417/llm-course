> **本章对应课件**：全站总纲。建议先花 15 分钟读完，建立全局地图。本课程是**中文交互式 LLM 教材**。动手主线在首页「我的学习」：**小模型学习实验室 → 技术声明核验助手 / 单 Agent → 算法或 Infra 专项**。第 0–23 章是理论主干；第 24–31 章是工程与岗位查阅，不再要求完成六个旧项目。

## 0.1 完整学习路线（六段式）

:::unfold 先懂直觉
这套课程讲一条完整的产业链：**理解模型原理 → 亲手构建模型 → 扩展规模（数据/算力/GPU/内核/分布式）→ 服务推理 → 对齐偏好 → 评估验证**。每一段都有明确的「学完能做什么」。
:::

```
① Understand 理解         ② Build 构建              ③ Scale 扩展
数学/ML/DL 基础            PyTorch 工具箱             Scaling Laws 算力规划
Tokenizer / BPE            RMSNorm / RoPE / Attention  GPU 基础与 Roofline
Transformer / GPT          完整 TinyLM 训练            分布式训练（DDP/ZeRO/TP/PP）
现代架构（RoPE/GQA）       评估 / 生成 / SFT / DPO     训练显存与高效微调
                                                      Pretraining Data Engineering
                                                      FlashAttention + Triton

④ Serve 服务              ⑤ Train & Align 对齐       ⑥ Evaluate 评估
Prefill / Decode          Pretrain → SFT             PPL / EM / F1 / pass@k
Continuous Batching       Preference / RM / DPO      MMLU / C-Eval / GSM8K
PagedAttention            PPO / GRPO / RLVR          LLM-as-a-Judge / 置信区间
Prefix Cache / 投机解码                               Contamination / 失败分析
vLLM / SGLang
```

:::demo pipeline 交互：训练完整流水线
点击每个阶段查看它在做什么——从 Raw Data 到 Aligned Model，这条流水线就是整个大模型工业的缩影。
:::

推理主线（贯穿全部章节）：

$$
\text{输入} \rightarrow \text{Tokenizer} \rightarrow \text{Embedding} \rightarrow \text{Transformer} \rightarrow \text{Logits} \rightarrow \text{Softmax} \rightarrow P(\text{next token})
$$

## 0.1b 当前主线与查阅分组

上图的六段式是教材知识地图（第 0–23 章为主）。它解决「懂」。当前**动手主线**不在六张旧项目卡上，而在首页「我的学习」。

```
当前主线
小模型学习实验室（Attention）
  → 技术声明核验助手 / 单 Agent
  → 算法或 Infra 专项实验
```

第 24–31 章仍可阅读：Python 工程、HuggingFace、评测分层、检索、SFT、推理分析，以及当时留下的真实数字。仓库里的六个旧目录是可选历史参考，**不是必修作业**。

三条岗位路线不在本章重复维护。下面的路线卡片和第 24 章使用同一份 `content/tracks.json`，只作查阅分组，不是当前主线。

路线标识：**Track A · AI 应用**、**Track B · 模型训练与算法**、**Track C · AI Infra**。

:::routes compact
:::

## 0.2 课程分层：哪些必须先学，哪些可以边学边补

:::warning 重要：不要把 CS336 全部内容当成「前置」
本课程按三层组织。**只有 Core Prerequisite 是真正的「开始前必备」**；其余可以在学习/使用过程中逐步补齐。
:::

| 层 | 内容 | 定位 |
| --- | --- | --- |
| 🟢 **Core Prerequisite** | 1-10 章（数学/深度学习/Transformer/GPT/Tokenizer）+ 11-13 章（PyTorch + 从零搭 Small LM） | **真正的前置**：学完即可进入 CS336 级别的课程 |
| 🔵 **CS336 Bridge** | 14 Scaling Laws · 15 GPU · 16 Distributed · 17 显存 · 18 Data Pipeline · 19 FlashAttention/Triton · 23 Evaluation | 让 CS336 学起来更顺：这些话题会在课程中反复用到 |
| 🟣 **Systems Extension** | 20 Inference Systems · 31 推理分析（vLLM runbook 待 GPU 验证） | 走向工程/系统方向：**不是开始 CS336 的必要条件** |

**阅读建议**：
- 目标是「看懂训练与原理」→ 优先 1-17 章 + 18 章；
- 目标是「做推理服务」→ 再加 20 章；
- 目标是「做模型评测」→ 重点 3、21、23 章。

## 0.3 章节地图

| 阶段 | 章节 | 核心产出 |
| --- | --- | --- |
| 准备 | 0 知识地图 | 全局路线 + 分层 |
| ① 理解 | 1-4 基础 · 5-6 序列/NLP · 7-10 架构 | 能推导 Attention、说清新旧架构演化 |
| ② 构建 | 11 PyTorch · 12-13 Build Small LLM | **亲手训练出一个小 LLM** |
| ③ 扩展 | 14 Scaling · 15 GPU · 16 分布式 · 17 显存 · 18 数据管线 · 19 FlashAttention | 能配置训练、判断瓶颈、写出数据管线、理解 IO 优化 |
| ④ 服务 | 20 推理系统 | 解释 prefill/decode、PagedAttention、continuous batching |
| ⑤ 对齐 | 21 Pretrain/SFT · 22 PPO/GRPO | 走完 Pretrain → SFT → DPO/GRPO |
| ⑥ 评估 | 23 LLM Evaluation | 读懂 benchmark 分数、做失败分析、跑评测 Lab |
| ⑦ 工程查阅 | 24 岗位能力地图 · 25 Python 工程 · 26 HuggingFace | 查阅分组、工程化 Python、工业生态工作流（非旧作业） |
| ⑦ 工程查阅 | 27 评测系统 · 28 RAG 工程 · 29 RAG 服务原理 | 评测分层、混合检索与精排、服务化要点 |
| ⑦ 工程查阅 | 30 SFT/LoRA 记录 · 31 推理分析 | 训练闭环纪律、profiling 与 serving 指标（含 NOT EXECUTED） |

## 0.4 学完能回答的问题（验收清单）

:::key 能力里程碑
| 学完 | 你应该能够回答 |
| --- | --- |
| ① 理解 | 「白板推导 Attention(Q,K,V)」「RoPE/GQA/RMSNorm/SwiGLU 各解决什么问题」 |
| ② 构建 | 「从零写出 RMSNorm/RoPE/Attention/Block/LM 并跑通训练」 |
| ③ 扩展 | 「用 6ND 估算算力」「判断算子瓶颈」「为显存瓶颈选并行方案」「一篇网页怎么变成 training batch」「FlashAttention 为什么没改变数学结果却更快」 |
| ④ 服务 | 「为什么 prefill/decode 是两个阶段」「为什么 vLLM 要 PagedAttention 和 Continuous Batching」 |
| ⑤ 对齐 | 「画出 Pretrain → SFT → RM → PPO/GRPO 全景」「实现 DPO loss」 |
| ⑥ 评估 | 「为什么 benchmark 不能只看 accuracy」「contamination / prompt / parser 如何影响分数」 |
:::

## 0.5 每个知识点的组织方式（图文并茂）

重要知识点按统一模板展开，并尽量配图：

```
问题 → 直觉 → 例子 → 定义 → 公式（逐项拆解）→ Shape / 时间线 / 存储
→ 数值算例 → 结构图/曲线 → 代码 → 工程意义
→ Trade-off → 误区 → 面试题 → Quiz
```

| 组件 | 形态 | 示例 |
| --- | --- | --- |
| 交互演示 | 可拖拽/点击的实时计算与动画 | 90+（数据管线 / MinHash / 打包 / online softmax / serving 模拟器 / chunking / retrieval metrics…） |
| 结构图 | HTML/CSS 静态图 | GPU 存储层次、并行布局、分页 KV |
| 曲线图 | Canvas 绘制 | isoFLOP、Roofline、置信区间、GPU 时间线 |
| 面试题 | 折叠答案 | 第 7 章 39 题速查 |
| 测验 | 点击判定 + 解析 | 每章 4~9 题 |

## 0.6 Systems 正确性守则（全站纪律）

:::warning 五类性能结论必须分开表达
1. **Compute Complexity**（如 $O(S^2 d)$）
2. **Memory Capacity**（如 KV Cache GB）
3. **Memory / HBM I/O**（搬了多少数据）
4. **Communication**（GPU 间传了多少）
5. **Wall-clock Performance**（实测 ms / tokens/s）

**禁止**：把「FLOPs 更少」直接等同「跑得更快」；把「显存更少」等同「IO 更少」；
把 attention 的复杂度当成整个 Transformer 的复杂度；把教学模拟值写成真实 benchmark。
:::

| 数字类型 | 标记方式 |
| --- | --- |
| A. 数学结果 | 可推导验证（如 6ND、Ring AllReduce 通信量） |
| B. 公开硬件/论文事实 | 注明型号与条件（如 A100 BF16 312 TFLOPS dense） |
| C. 教学模拟假设 | 页面显式标注「教学模拟」 |

## 0.7 主线优先级

| 优先级 | 内容 | 状态 |
| --- | --- | --- |
| P0 · 教材主干 | Transformer、手写实现、Scaling Laws、GPU、分布式、数据管线、FlashAttention、推理系统、评测 | ✅ 已上线（0-23） |
| P0 · 工程查阅 | Python 工程、HuggingFace、评测分层、RAG、SFT/LoRA、推理分析（理论与历史记录；六个旧作业已退出必修） | ✅ 教材可读（24-31） |
| 后续深化 | MoE、长上下文、Reasoning、系统化量化、CUDA/Triton（需 GPU） | 不在当前范围 |
| 明确不覆盖 | Agent / MCP / Multi-Agent / 多模态 / GraphRAG / Robotics / 安全大章 | 不属于本课程范围 |

:::quiz
本课程的分层中，下面哪一项**不是**开始 CS336 前的必要前置？

A. 从零搭 Small LM（第 12-13 章）
B. Transformer 原理（第 7 章）
C. 推理服务系统（第 20 章）
D. PyTorch 基础（第 11 章）

答案: C
解析: 课程分三层：Core Prerequisite（1-13 章）是真正前置；CS336 Bridge（14-19、23 章）可边学边补；Systems Extension（20 章推理系统）是走向系统方向的后续内容，不是开始 CS336 的必要条件。
:::

:::related
依赖 | 无（这是起点）
用于 | 全部章节
:::
