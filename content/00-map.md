> **本章对应课件**：全站总纲（2026 升级版）。建议先花 15 分钟读完本章，建立全局地图，再进入具体章节。本课程的战略目标是：**中文交互式 LLM 教材 + Stanford CS336 前置能力**。

## 0.1 五段式学习路线

:::unfold 先懂直觉
这套课程讲一条完整的产业链：**理解模型原理 → 亲手构建模型 → 扩展规模 → 服务推理 → 对齐人类偏好**。每一段都有明确的「学完能做什么」。
:::

```
① Understand 理解          ② Build 构建            ③ Scale 扩展
数学/ML/DL 基础              PyTorch 工具箱            Scaling Laws 算力规划
Tokenizer / BPE              RMSNorm / RoPE / Attention GPU 基础与 Roofline
Transformer / GPT            完整 TinyLM 训练           分布式训练（DDP/ZeRO/TP/PP）
现代架构（RoPE/GQA/SwiGLU）  评估 / 生成 / SFT          训练显存与高效微调
                                                      数据管线 / FlashAttention（即将）

④ Serve 服务               ⑤ Align 对齐
推理系统（prefill/decode）   Pretrain → SFT
KV Cache / 连续批处理        Preference Data / RM / DPO
vLLM / 分页注意力             PPO / GRPO / RLVR
                             LLM Evaluation（即将）
```

:::demo pipeline 交互：训练完整流水线
点击每个阶段查看它在做什么——从 Raw Data 到 Aligned Model，这条流水线就是整个大模型工业的缩影。
:::

推理主线（贯穿全部章节）：

$$
\text{输入} \rightarrow \text{Tokenizer} \rightarrow \text{Embedding} \rightarrow \text{Transformer} \rightarrow \text{Logits} \rightarrow \text{Softmax} \rightarrow P(\text{next token})
$$

## 0.2 章节地图与学习顺序

| 阶段 | 章节 | 核心产出 |
| --- | --- | --- |
| **准备** | 0 知识地图 | 全局路线 |
| **① 理解** | 1-4 基础 · 5-6 序列/NLP · 7-10 架构 | 能推导 Attention、说清新旧架构演化 |
| **② 构建** | 11 PyTorch · 12 组件篇 · 13 训练篇 | **亲手训练出一个小 LLM** |
| **③ 扩展** | 14 Scaling Laws · 15 GPU · 16 分布式 · 17 显存 | 能配置训练、判断瓶颈、选择并行方案 |
| **④ 服务** | （推理系统，下一批上线） | 理解 prefill/decode、KV Cache、批处理 |
| **⑤ 对齐** | 18 Pretrain/SFT · 19 Post-training | 走完 Pretrain → SFT → DPO/GRPO |

## 0.3 五段式的「学完能做什么」

:::key 能力里程碑
| 学完 | 你应该能够 |
| --- | --- |
| ① 理解（0-10 章） | 白板推导 Attention(Q,K,V)；解释 RoPE/GQA/RMSNorm/SwiGLU 解决什么问题 |
| ② 构建（11-13 章） | 从零写 RMSNorm/RoPE/Attention/Block/LM；跑通预训练 + SFT + DPO 小实验 |
| ③ 扩展（14-17 章） | 用 6ND 估算算力与时间；判断算子是 memory/compute bound；为显存瓶颈选并行方案 |
| ④ 服务 | 解释 TTFT/TPOT；说清 PagedAttention 为什么能提高吞吐 |
| ⑤ 对齐 | 画出 Pretrain → SFT → RM → PPO/GRPO 全景图；实现 DPO loss |
:::

## 0.4 每个知识点的组织方式（图文并茂）

重要知识点按统一模板展开，并尽量配图：

```
问题 → 直觉 → 例子 → 定义 → 公式（逐项拆解）→ Shape
→ 数值算例 → 结构图/曲线 → 代码 → 工程意义
→ Trade-off → 误区 → 面试题 → Quiz
```

| 组件 | 形态 | 示例 |
| --- | --- | --- |
| 直觉/数学/工程 | 可折叠三级块 | 每节开头 |
| Shape 流 | 图形化张量维度 | `[B,S,d] × [d,d'] → [B,S,d']` |
| 交互演示 | 可拖拽/点击的实时计算 | 51+ 个（见各章 🎮） |
| 结构图 | HTML/CSS 静态图 | GPU 存储层次、并行布局 |
| 曲线图 | Canvas 绘制 | isoFLOP 曲线、Roofline |
| 面试题 | 折叠答案 | 第 7 章 39 题速查 |
| 测验 | 点击判定 + 解析 | 每章 4~9 题 |

## 0.5 主线优先级（对照 CS336）

| 优先级 | 内容 | 状态 |
| --- | --- | --- |
| P0（最高） | Transformer fundamentals、手写实现、Scaling Laws、GPU、分布式、推理系统、评测 | 大部分已上线 |
| P1 | MoE、长上下文、推理模型、量化 | 规划中 |
| P2（选修专题，不抢主线） | RAG、Agent、MCP、多模态、安全、Prompt 工程 | 暂不展开 |

:::warning 学习路线的常见错误
- **跳着只看「热点名词」**（RAG/Agent）——它们建立在本课程主线之上；
- **只看不写**——② 构建阶段的 14 个 Lab 必须亲手跑；
- **背公式不理解瓶颈**——③ 扩展阶段的核心是「用系统视角看模型」，Roofline 和显存账是硬功夫。
:::

## 0.6 建议的学习节奏

| 周 | 内容 | 检查点 |
| --- | --- | --- |
| 第 1 周 | 0-4 章（基础） | 能白板推导反向传播与 Softmax 梯度 |
| 第 2 周 | 5-7 章（序列 + Transformer） | 完成第 7 章 39 题自测 |
| 第 3 周 | 8-10 章（BERT/GPT/现代架构） | 说清 5 组架构演化 |
| 第 4-5 周 | 11-13 章（构建） | **跑出自己训练的 TinyLM 生成文本** |
| 第 6 周 | 14-16 章（扩展） | 用计算器估算一次训练预算；画出并行方案 |
| 第 7 周 | 17-19 章（显存/对齐） | 完成 DPO 小实验 |

:::quiz
本课程的五段式主线是？

A. 理解 → 构建 → 扩展 → 服务 → 对齐
B. 入门 → 进阶 → 精通 → 实战 → 面试
C. 数学 → 代码 → 论文 → 复现 → 部署
D. 模型 → 数据 → 训练 → 评测 → 上线

答案: A
解析: 课程按 Understand → Build → Scale → Serve → Align 组织，每段都有明确的能力里程碑。
:::

:::related
依赖 | 无（这是起点）
用于 | 全部章节
:::
