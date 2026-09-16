# 内容审计报告（CONTENT_AUDIT）

> 生成时间：V2 升级（第一批）完成后。
> V2 升级目标：CS336 前置 + 中文交互式 LLM Systems 教材。五段式主线：Understand → Build → Scale → Serve → Align。
> 本批新增 6 章：PyTorch for LLM、Build Your Own Small LLM（上/下）、Scaling Laws、GPU Fundamentals、Distributed Training；新增 5 个系统级交互演示。

## 总览统计（V2）

| 指标 | 数值 |
| --- | --- |
| 章节数 | 20（V1 为 14） |
| 内容总量 | 约 10,300 行 / 380 KB |
| 交互演示 | 65 个挂载点（56 个组件） |
| 测验题 | 85 道（340 个选项） |
| 面试题模块 | 90+ 个（折叠答案 180+） |
| 数学公式 | 约 3,060 处 KaTeX 渲染 |
| 静态阅读页 | 20 章（chapters/*.html） |
| 全站验证 | 20 章无控制台错误、全部演示可交互 |

## V2 第一批新增章节

| 章节 | id | 内容 | 新演示 |
| --- | --- | --- | --- |
| 11 PyTorch for LLM | pytorch | shape 四件套、广播、einsum、nn.Module、autograd、训练循环、checkpoint、调试清单 | 复用 backprop |
| 12 Build Small LLM（上） | build-llm-1 | Lab 1-7：Tokenizer→RMSNorm→RoPE→Attention→SwiGLU→Block→LM，全部可运行可验证 | 复用既有演示 |
| 13 Build Small LLM（下） | build-llm-2 | Lab 8-14：数据→预训练→评估→生成→KV Cache→SFT→DPO/GRPO | 复用 next-token |
| 14 Scaling Laws | scaling-laws | 参数量公式、6ND、Kaplan、Chinchilla、isoFLOP、MFU、过度训练 | `scaling-calculator`、`chinchilla-curve` |
| 15 GPU Fundamentals | gpu | SM/Tensor Core/warp、存储层次、算术强度、Roofline、GEMM、融合、Profiling | `roofline` |
| 16 Distributed Training | distributed | DDP、Ring AllReduce、通信重叠、ZeRO 1-3、FSDP、TP、PP、3D 并行 | `allreduce-ring`、`zero-stages` |

## 章节结构（V2 五段式）

| 阶段 | 章节 |
| --- | --- |
| 准备 | 0 知识地图 |
| ① 理解 | 1-4 基础 · 5-6 序列/NLP · 7-10 架构 |
| ② 构建 | 11 PyTorch · 12-13 Build Small LLM |
| ③ 扩展 | 14 Scaling Laws · 15 GPU · 16 分布式 · 17 显存与高效微调 |
| ④ 服务 | （推理系统，第二批） |
| ⑤ 对齐 | 18 Pretrain/SFT · 19 Post-training |

## 原始章节覆盖审计（V1 内容，保持不变）

### 总览统计

| 指标 | 数值 |
| --- | --- |
| 章节数 | 20（含 V2 新增） |
| 交互演示 | 65 个挂载点 |
| 测验题 | 85 道 |
| 静态阅读页 | 20 章 |

## 第 7 章最终审查记录（40 问覆盖）

> 审查标准：初学者只看网页必须能回答全部 40 个问题。缺失内容已全部补齐。

| 问题 | 覆盖位置 | 状态 |
| --- | --- | --- |
| Q1 为什么需要 Attention | 7.1 三种方案对比 + 面试 A 组 | ✅ |
| Q2 Q/K/V 是什么 | 7.5 + 7.24 Q2 | ✅ |
| Q3 为什么三套投影矩阵 | 7.6 三个理由 + Q3 | ✅ |
| Q4 QKᵀ 为什么表示相关性 | 7.7 + 面试 | ✅ |
| Q5 QKᵀ 每个元素是什么 | 7.7 逐项拆解（S_ij = q_i·k_j） | ✅ |
| Q6 attention matrix 为什么 seq×seq | 7.7 shape 推导 + Q6 | ✅ |
| Q7 为什么除 √d_k | 7.9 方差推导 + Q7 | ✅ |
| Q8 Softmax 对哪个维度 | 7.10 强调 dim=-1 + Q8 | ✅ |
| Q9 为什么乘 V 不乘 K | 7.11 新增专节 + Q9 | ✅ |
| Q10 为什么输出是加权和 | 7.11 凸组合论证 + Q10 | ✅ |
| Q11 Self-Attention 为什么没有顺序 | 7.3 置换等变 + Q11 | ✅ |
| Q12 位置编码如何弥补 | 7.3 + Q12 | ✅ |
| Q13 多头为什么不是简单做多遍 | 7.14 对比表 + Q13 | ✅ |
| Q14 每个 head 维度如何变化 | 7.14 shape flow + Q14 | ✅ |
| Q15 为什么 Decoder 要 causal mask | 7.17 + Q15 | ✅ |
| Q16 Mask 为什么填 −∞ | 7.17 三候选值论证 + Q16 | ✅ |
| Q17 Self vs Cross 数据来源 | 7.18 对比 + Q17 | ✅ |
| Q18 复杂度为什么 O(S²) | 7.4 推导 + Q18 | ✅ |
| Q19 seq_len 翻倍为什么 4 倍 | 7.4 + Q19 | ✅ |
| Q20 与 KV Cache/GQA/FlashAttention 关系 | 7.15 新增专节 + Q20 | ✅ |
| Q21 为什么多头（不用单头） | 7.14 + Q21 | ✅ |
| Q22 为什么 Q/K 不同权重（不能 X·Xᵀ） | 7.6 新增专节 + Q22 | ✅ |
| Q23 点乘 vs 加法 | 7.8 新增专节 + Q23 | ✅ |
| Q24 为什么 scaled + 推导 | 7.9 + Q24 | ✅ |
| Q25 padding mask 怎么做 | 7.16 新增专节 + Q25 | ✅ |
| Q26 为什么多头要降维 | 7.14 参数预算推导 + Q26 | ✅ |
| Q27 Encoder 模块 | 7.2 子层拆解 + Q27 | ✅ |
| Q28 为什么乘 √d_model | 7.3 方差推导 + Q28 | ✅ |
| Q29 位置编码意义与优缺点 | 7.3 + Q29 | ✅ |
| Q30 其他位置编码技术 | 7.3 全景表（5 种）+ Q30 | ✅ |
| Q31 残差结构及意义 | 7.19 + Q31 | ✅ |
| Q32 为什么用 LN 不用 BN + 位置 | 7.20 对比表 + Q32 | ✅ |
| Q33 BatchNorm 及优缺点 | 7.20 新增小节 + Q33 | ✅ |
| Q34 FFN 与激活函数 | 7.21 激活函数对比表 + Q34 | ✅ |
| Q35 Encoder/Decoder 如何交互（seq2seq） | 7.18 seq2seq 起源 + Q35 | ✅ |
| Q36 Decoder vs Encoder 自注意力 | 7.17 对比表 + Q36 | ✅ |
| Q37 并行化 / Decoder 能并行吗 | 7.22 逐环节表 + Q37 | ✅ |
| Q38（原资料缺失） | — | — |
| Q39 学习率 / Dropout / 测试注意 | 7.23 新增专节 + Q39 | ✅ |
| Q40 解码端残差会不会泄露 mask 信息 | 7.19 新增小节 + Q40 | ✅ |

**必须加入的 6 个元素**：

| 要求 | 位置 | 状态 |
| --- | --- | --- |
| QKV shape flow | 7.5 三投影 shapeflow + 7.14 多头 shapeflow | ✅ |
| 3 token × 2 dim 完整手算 | 7.12 全流程 + `attn-handcalc` 交互演示（6 步可逐步验证） | ✅ |
| attention heatmap | `attention` 演示（11 token 热力图）+ `attn-handcalc` 的 A 矩阵热力图 + `causal-mask` 三步热力图 | ✅ |
| causal mask 动画 | `causal-mask` 演示（原始分数 → 加 mask → softmax 三步切换） | ✅ |
| multi-head 动画 | `mha` 演示（4 个 head 模式切换 + Concat/W_O 结构） | ✅ |
| 代码与公式逐行对应 | 7.13 逐行对应表 + 完整实现逐行注释 + 手算结果对照验证 | ✅ |

**修复的 bug**：嵌套容器（`:::interview` 内的 `:::answer`）此前因递归渲染管线的占位符作用域问题被静默丢弃——全站 141 个面试答案全部不显示。已修复为「同上下文占位符优先展开」的递归渲染，全站答案现已正常渲染并可折叠展开。

---

## 第 0 章 知识地图

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 大模型知识地图（推理/训练主线） | ★4 深入 | 🎮 pipeline | ✅ | ✅ | — | — | — | ✅ |
| 6 层逻辑压缩 | ★4 深入 | ✅ 表格 | — | — | — | — | — | ✅ |
| 优先级清单（必须会推） | ★4 | — | ✅ | — | — | — | — | — |
| 三级理解层级与使用说明 | ★2 | ✅ | — | — | — | — | — | — |

## 第 1 章 深度学习基础

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI / ML / DL 关系 | ★2 简明 | ✅ 表 | — | — | — | ✅ | — | — |
| 线性回归与线性模型 | ★4 深入 | — | ✅ | ✅ | ✅ | ✅ | — | — |
| MSE 损失（含梯度推导） | ★4 深入 | — | ✅ | — | ✅ | ✅ | — | — |
| 梯度下降 ★5 | ★5 极深 | 🎮 gradient-descent | ✅ | ✅ | ✅ | ✅ 学习率收敛条件推导 | ✅×3 | ✅ |
| Epoch / Batch / Step | ★4 深入 | ✅ 表 | ✅ | — | ✅ | ✅ | — | — |
| 前向传播与反向传播 ★5 | ★5 极深 | 🎮 backprop + 计算图 | ✅ | ✅ | ✅ autograd | ✅ 逐步数字算例 | ✅×2 | ✅ |
| 分类与 Softmax ★5 | ★5 极深 | 🎮 softmax | ✅ | — | ✅ | ✅ | — | ✅ |
| 交叉熵 ★5 | ★5 极深 | 🎮 cross-entropy | ✅ | — | ✅ | ✅ GPT 例子 | ✅×2 | ✅ |
| Softmax+CE 导数 ∂L/∂z=p−y ★5 | ★5 极深 | — | ✅ 完整推导 | — | — | ✅ 数字算例 | — | — |
| MLP 与隐藏层 | ★4 深入 | — | ✅ | ✅ | ✅ | ✅ XOR | — | ✅ |
| 激活函数（Sigmoid/Tanh/ReLU/现代变体） | ★4 深入 | 🎮 activations + 对比表 | ✅ | — | ✅ | ✅ 0.25²⁰ 算例 | ✅×2 | ✅ |

## 第 2 章 优化器

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 为什么需要优化器 | ★4 | — | ✅ | — | — | — | — | — |
| SGD（含三种变体） | ★4 | 🎮 optimizer-race | ✅ | — | ✅ | — | — | ✅ |
| Momentum | ★4 | 🎮 optimizer-race | ✅ | — | ✅ | ✅ 等效学习率 | — | ✅ |
| Adam ★5 | ★5 极深 | 🎮 optimizer-race | ✅ | — | ✅ | ✅ 两步数字算例 | ✅×3 | ✅ |
| AdamW（解耦正则推导） | ★4 | — | ✅ | — | ✅ | — | ✅ | ✅ |

## 第 3 章 模型评估与泛化

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 训练误差 vs 泛化误差 | ★4 | ✅ 类比 | — | — | — | ✅ 学生类比 | — | — |
| 数据划分与数据泄漏 | ★4 | ✅ 表 | — | — | — | — | — | — |
| 混淆矩阵 TP/FP/FN/TN | ★4 | 🎮 confusion-matrix | — | — | — | ✅ | — | ✅ |
| Accuracy/Precision/Recall/F1 | ★5 | 🎮 confusion-matrix | ✅ | — | — | ✅ 不平衡数据双模型对比 | ✅×2 | ✅ |
| 欠拟合与过拟合 | ★4 | ✅ 曲线 | — | — | — | ✅ | — | — |
| L2 正则 / Weight Decay | ★4 | — | ✅ 推导 | — | — | — | — | ✅ |
| Dropout | ★4 | — | ✅ 期望一致 | — | ✅ eval() | — | — | ✅ |

## 第 4 章 数值稳定

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 梯度爆炸/消失 ★5 | ★5 极深 | 🎮 vanishing-exploding | ✅ | — | ✅ 梯度裁剪 | ✅ 1.5¹⁰⁰ / 0.8¹⁰⁰ | ✅×3 | ✅ |
| Sigmoid 饱和分析 | ★4 | ✅ 导数表 | ✅ | — | — | ✅ 0.25²⁰ | — | ✅ |
| 权重初始化（Xavier/Kaiming） | ★4 | — | ✅ 方差推导 | — | — | — | — | ✅ |
| BatchNorm | ★4 深入 | — | ✅ | — | — | ✅ [1,2,3,4] 算例 | — | ✅ |
| 残差连接 ResNet ★5 | ★5 | 🎮 transformer-block | ✅ 梯度推导 | — | — | ✅ | ✅ | ✅ |

## 第 5 章 RNN / LSTM / GRU

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 为什么需要 RNN ★5 | ★5 | 🎮 rnn-unroll | ✅ | ✅ | ✅ nn.RNN | ✅ | — | ✅ |
| 参数共享 | ★5 | 🎮 rnn-unroll | ✅ | — | — | — | — | ✅ |
| RNN 任务类型 | ★4 | ✅ 表 | — | — | — | ✅ | — | — |
| 长程依赖与 BPTT ★5 | ★5 极深 | 🎮 vanishing-exploding | ✅ 雅可比推导 | — | — | ✅ | ✅×2 | ✅ |
| LSTM 三门一状态 ★5 | ★5 极深 | 🎮 lstm | ✅ 全部公式 + 四门拆解表 | ✅ | ✅ 手写 cell | ✅ Cₜ 与 hₜ 逐步验算 | ✅×3 | ✅ |
| GRU | ★4 深入 | 🎮 gru | ✅ | ✅ | ✅ nn.GRU | ✅ 二维向量混合验算 + 参数量对比 | ✅ | ✅ |
| Deep RNN / 双向 RNN | ★4 | ✅ 结构图 | — | — | — | — | — | ✅ |
| 为什么 Transformer 取代 RNN | ★4 | ✅ 对比表 | — | — | — | — | — | ✅ |

## 第 6 章 NLP / Tokenizer / Embedding

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tokenization 与 Token≠Word | ★5 | 🎮 tokenizer | ✅ | — | — | ✅ 三粒度 token 数对比 | ✅ | ✅ |
| 三种切分粒度（word/char/subword） | ★4 | ✅ 对比表 | — | — | — | ✅ | — | ✅ |
| BPE 原理 ★5 | ★5 极深 | 🎮 bpe | ✅ 算法伪码 | — | ✅ 20 行 Python | ✅ low/lower/newest/widest | ✅×2 | ✅ |
| BPE Training vs Encoding | ★5 | 🎮 bpe | ✅ | — | ✅ | ✅ slowest 编码全过程 | ✅ | ✅ |
| BBPE | ★4 | — | ✅ | — | — | ✅ 中文 token 成本 | ✅ | ✅ |
| Tokenizer 评估（压缩率/OOV/多语言） | ★4 | ✅ | ✅ | — | — | ✅ 8192 窗口算例 | — | ✅ |
| Embedding 查表 ★5 | ★5 极深 | 🎮 embedding | ✅ 参数量 | ✅ | ✅ nn.Embedding | ✅ king−man+woman | — | ✅ |
| Word2Vec（CBOW/Skip-Gram） | ★4 | 🎮 cbow-skipgram + 🎮 embedding | ✅ 几何结构 | — | — | ✅ 窗口样本对演示 | — | — |

## 第 7 章 Transformer（全站核心，25 个小节 / 15 个交互演示 / 39 题面试库）

> 本章每个知识点都按统一模板展开：直觉 → 公式 → 逐项拆解 → 矩阵 shape → 最小数字例子 → 交互图 → 代码 → 常见误区 → 面试问题。全章使用同一组手算算例（3 token，d_model=d_k=2），7.12 节从头到尾完整验算，7.13 节公式与代码逐行对应。

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 为什么需要 Attention | ★5 | ✅ 三方案对比 | — | — | — | ✅ RNN/CNN 对比 | ✅ | — |
| 总体架构 + Encoder 模块 | ★5 | 🎮 transformer-block | ✅ | ✅ | — | — | ✅ | — |
| 位置编码（必要性 + √d_model + 5 种技术全景） | ★5 极深 | ✅ 置换等变 | ✅ sin/cos + 方差推导 | — | — | ✅ dog bites man | ✅×3 | — |
| Self-Attention 整体 | ★5 极深 | 🎮 attention | ✅ 全公式 + 五部件拆解 | ✅ | ✅ 20 行实现 | ✅ 输出 O 全矩阵 | ✅ | — |
| Q、K、V 三个投影 | ★5 极深 | 🎮 qkv-matrix | ✅ | ✅ QKV shape flow | ✅ nn.Linear | ✅ Q/K/V 逐行验算 | ✅×2 | — |
| 为什么 Q/K 要分开投影（不能 X·Xᵀ） | ★5 极深 | — | ✅ 对称性论证 | — | — | ✅ XXᵀ vs QKᵀ 对比 | ✅ | — |
| QKᵀ 匹配打分 | ★5 极深 | 🎮 dot-product | ✅ 点积定义 | ✅ | ✅ transpose | ✅ S 矩阵逐项验算 | ✅×2 | ✅ |
| 点乘 vs 加法注意力 | ★5 | — | ✅ 两种打分公式 | — | — | ✅ 复杂度对比表 | ✅ | — |
| 为什么除 √d_k | ★5 极深 | 🎮 scaling | ✅ 方差推导 | ✅ | ✅ | ✅ d_k 四档对比表 | ✅×2 | ✅ |
| Softmax 注意力权重 | ★5 极深 | 🎮 softmax | ✅ 逐行公式 | ✅ | ✅ 数值稳定版 | ✅ 三行完整验算 | ✅×2 | ✅ |
| 为什么乘 V 而不是 K | ★5 极深 | 🎮 weighted-sum | ✅ 凸组合论证 | ✅ | ✅ A @ V | ✅ output₁ 逐维验算 | ✅×2 | — |
| **完整手算 3×2 全流程** | ★5 极深 | 🎮 attn-handcalc（6 步） | ✅ 全链路 | ✅ | ✅ | ✅ 每步可纸笔验证 | — | — |
| **公式 ↔ 代码逐行对应** | ★5 极深 | — | ✅ 10 行对应表 | ✅ | ✅ 完整实现逐行注释 | ✅ 代码输出 = 手算结果 | — | — |
| Multi-Head Attention | ★5 极深 | 🎮 mha | ✅ | ✅ | ✅ nn.MultiheadAttention | ✅ 双头拼接 + 参数预算推导 | ✅×3 | ✅ |
| 复杂度与工程延伸（KV Cache/GQA/FlashAttention） | ★5 极深 | — | ✅ | — | — | ✅ 四技术对比表 | ✅ | ✅ |
| Padding Mask | ★5 极深 | ✅ 对比表 | ✅ 广播公式 | ✅ | ✅ masked_fill | ✅ PAD 污染算例 | ✅ | — |
| Causal Mask | ★5 极深 | 🎮 causal-mask | ✅ −∞ 论证 | ✅ | ✅ masked_fill | ✅ 三步矩阵变化 | ✅×3 | — |
| Cross-Attention（含 seq2seq 起源） | ★5 极深 | 🎮 cross-attention | ✅ | ✅ | ✅ 非方阵示例 | ✅ 3×3 对齐矩阵 | ✅×2 | — |
| 残差连接（含 mask 泄露分析） | ★5 极深 | 🎮 residual | ✅ 梯度推导 | ✅ | ✅ | ✅ 0.7ⁿ vs 1+0.7ⁿ 表 | ✅×2 | ✅ |
| LayerNorm（含 BN 对比与优缺点） | ★5 极深 | 🎮 layernorm | ✅ | ✅ | ✅ nn.LayerNorm | ✅ [1,2,3,4] 四步验算 | ✅×3 | — |
| FFN（含激活函数对比） | ★5 极深 | 🎮 ffn | ✅ | ✅ | ✅ ReLU/SwiGLU | ✅ [1,0] 升维降维验算 | ✅ | — |
| 训练 vs 推理（并行化） | ★5 极深 | 🎮 train-vs-inference | ✅ | ✅ | ✅ 训练/生成两段 | ✅ 1 次前向 vs 3 次 | ✅ | — |
| 训练细节：学习率与 Dropout | ★5 | — | ✅ Noam 调度公式 | — | ✅ train/eval | ✅ 三处 dropout 位置 | ✅ | — |
| 面试题库（39 问全解） | ★5 | — | — | — | — | — | ✅×39 | — |

## 第 8 章 BERT（全部知识点按统一模板展开）

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Encoder-only 定位 | ★4 | 🎮 bert-vs-gpt | ✅ | ✅ | — | ✅ 对比表 | ✅×2 | — |
| Base/Large 规格 | ★4 | ✅ 表 | ✅ 参数量估算 | — | — | ✅ 110M 逐项拆解 | — | — |
| 三种 Embedding ★5 | ★5 | 🎮 bert-embeddings | ✅ | ✅ | ✅ BertModel | ✅ 4 维相加算例 | ✅×2 | ✅ |
| [CLS] / [SEP] | ★4 | ✅ | ✅ 分类头公式 | ✅ | ✅ 分类微调 | ✅ 情感分类 | ✅ | — |
| Attention Mask（vs Causal Mask） | ★4 | ✅ 对比表 | ✅ 广播公式 | ✅ | — | ✅ PAD 注意力污染算例 | ✅ | ✅ |
| MLM ★5 | ★5 极深 | 🎮 mlm | ✅ 只算 15% 位置 | ✅ | ✅ ignore_index | ✅ −ln(0.62)=0.478 | ✅×2 | ✅ |
| 80/10/10 策略 | ★4 | ✅ 表 | ✅ 为什么 15% | — | — | ✅ 三种处理对比 | ✅ | ✅ |
| NSP | ★4 | — | ✅ | — | — | ✅ | — | ✅ |
| 微调三类任务头 | ★4 | ✅ 表 | — | ✅ | ✅ 代码骨架 | — | ✅ | — |

## 第 9 章 GPT（全部知识点按统一模板展开）

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Decoder-only ★5 | ★5 | ✅ 对比表 | ✅ 自回归分解 | ✅ | — | — | ✅ | — |
| Next Token Prediction ★5 | ★5 极深 | 🎮 next-token | ✅ LM Head 公式 | ✅ | ✅ shift 对齐 | ✅ Paris 91% 概率表 | ✅ | — |
| 训练并行（Teacher Forcing） | ★5 | 🎮 train-vs-inference | ✅ loss 公式 | ✅ | ✅ | ✅ 一次前向 3 个信号 | ✅ | — |
| 推理循环 | ★4 | 🎮 next-token | ✅ 采样公式 | ✅ | ✅ generate 循环 | ✅ | — | — |
| Temperature ★5 | ★5 极深 | 🎮 temperature | ✅ | — | ✅ HF 参数 | ✅ 三档完整概率表 | ✅ | ✅ |
| Greedy / Top-K / Top-P ★5 | ★5 极深 | 🎮 top-k-p | ✅ 三种策略公式 | — | ✅ | ✅ 8 token 截断计算 | ✅×2 | ✅ |
| LM Head 权重共享 | ★4 | — | ✅ | ✅ | ✅ | ✅ 参数量节省 | ✅ | ✅ |

## 第 10 章 现代 LLM 架构（全部知识点按统一模板展开）

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KV Cache ★5 | ★5 极深 | 🎮 kv-cache + 显存计算器 | ✅ 显存公式 | ✅ | ✅ 缓存实现 | ✅ 1+2+3+4=10 vs 4 + LLaMA 2.1GB | ✅×2 | ✅ |
| MHA → MQA → GQA ★5 | ★5 极深 | 🎮 mha-gqa | ✅ H_kv 公式 | ✅ | ✅ HF 配置 | ✅ 32/8 分组 + 三档显存 | ✅ | ✅ |
| RoPE ★5 | ★5 极深 | 🎮 rope | ✅ 旋转矩阵 + 相对位置推导 | ✅ | ✅ 实现 | ✅ 三行点积表（0.707/0.707/0） | ✅×2 | ✅ |
| RMSNorm ★5 | ★5 极深 | 🎮 norm-compare | ✅ | — | ✅ 手写实现 | ✅ [1,2,3,4] 逐步计算 | ✅ | ✅ |
| Pre-Norm vs Post-Norm ★5 | ★5 极深 | 🎮 pre-post-norm | ✅ 两种公式 + 梯度 | — | ✅ 两种写法 | ✅ 0.7ⁿ vs 1+0.7ⁿ 表 | ✅ | ✅ |
| SwiGLU ★5 | ★5 极深 | 🎮 swiglu | ✅ 8/3 d 推导 | ✅ | — | ✅ 标量四步演算 | ✅ | ✅ |
| 现代 LLM 骨架 | ★4 | ✅ 结构图 + 对比表 | — | — | — | — | — | — |

## 第 11 章 Pretrain 与 SFT（全部知识点按统一模板展开）

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 训练生命周期 | ★4 | 🎮 pipeline | — | — | — | ✅ 三阶段对比表 | ✅ | — |
| 数据来源与清洗 | ★4 | ✅ 表 | — | — | — | ✅ | — | — |
| MinHash 去重 ★5 | ★5 | — | ✅ Jaccard + 概率性质 | — | ✅ datasketch | ✅ J=3/5=0.6 算例 | ✅ | ✅ |
| 数据配比 | ★4 | ✅ 表 | — | — | — | ✅ | — | — |
| Tokenizer 训练决策 | ★4 | ✅ 表 | — | — | — | — | — | — |
| Warmup + LR Decay ★5 | ★5 极深 | 🎮 warmup-schedule | ✅ 两段公式 | — | ✅ LambdaLR | ✅ 峰值/最终值计算 | ✅ | ✅ |
| Loss Spike 监控 | ★4 | ✅ 日志示例 | — | — | — | ✅ | — | — |
| Perplexity ★5 | ★5 | — | ✅ PPL=e^Loss | — | — | ✅ 四档 loss→PPL 表 | ✅ | ✅ |
| Pretrain vs SFT ★5 | ★5 极深 | 🎮 pipeline | ✅ 目标对比 | — | — | ✅ 法国首都例子 + 超参对比 | ✅ | ✅ |
| Chat Template | ★4 | ✅ | — | — | ✅ apply_chat_template | — | — | — |
| Loss Mask ★5 | ★5 极深 | 🎮 loss-mask | ✅ 加权 loss 公式 | ✅ | ✅ labels=-100 | ✅ 4 token loss=0.45 算例 | ✅ | ✅ |
| 数据质量与多样性 | ★4 | ✅ | — | — | — | ✅ | — | — |
| 合成数据（Self-Instruct/蒸馏） | ★4 | — | — | — | — | ✅ model collapse 风险 | — | — |
| SFT 评估 | ★4 | ✅ 三方法对比 | — | — | — | — | — | — |

## 第 12 章 PPO 与 GRPO（全部知识点按统一模板展开）

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 为什么 SFT 后还要 RL | ★4 | 🎮 pipeline | — | — | — | — | — | — |
| PPO 四模型结构 ★5 | ★5 | 🎮 ppo-grpo | ✅ | — | — | ✅ 结构对比表 | ✅ | — |
| GRPO 去 Value Model ★5 | ★5 极深 | 🎮 ppo-grpo | ✅ | — | — | ✅ 三模型对比 | ✅ | ✅ |
| Group Relative Advantage ★5 | ★5 极深 | 🎮 grpo-group | ✅ μ/σ/A 公式 | — | — | ✅ [1,3,2,6]→A=[−1.07,0,−0.53,1.60] | ✅ | ✅ |
| Policy Ratio ★5 | ★5 极深 | 🎮 policy-ratio | ✅ 重要性采样公式 | — | — | ✅ ratio 数值表 | — | — |
| Clip ★5 | ★5 极深 | 🎮 policy-ratio | ✅ min+clip 形式 | — | — | ✅ 1.5→1.2 截断算例 | ✅ | ✅ |
| KL 散度 ★5 | ★5 极深 | 🎮 kl-divergence | ✅ 定义+三性质 | — | ✅ k3 估计 | ✅ 0.144≠0.131 不对称算例 | ✅ | ✅ |
| GRPO 目标函数 ★5 | ★5 极深 | — | ✅ 完整展开+逐项表 | — | — | — | — | — |
| On/Off-policy | ★4 | — | ✅ 重要性采样 | — | — | ✅ | — | — |
| Reward 来源 | ★4 | ✅ 表 | — | — | — | ✅ | — | — |

## 第 13 章 混合精度与 LoRA（全部知识点按统一模板展开）

| 知识点 | 详细程度 | 图 | 公式 | Shape | 代码 | 算例 | 面试 | Quiz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FP32/FP16/BF16/INT8/INT4 ★5 | ★5 极深 | 🎮 mixed-precision | ✅ 位分布 + 显存公式 | ✅ | — | ✅ 7B 四档显存表 | ✅ | ✅ |
| 指数位 vs 尾数位 | ★4 | 🎮 mixed-precision | ✅ | — | — | ✅ 尺子类比 | — | ✅ |
| 为什么 BF16 重要 | ★4 | 🎮 mixed-precision | ✅ | — | — | ✅ FP16 溢出场景 | ✅ | ✅ |
| Mixed Precision ★5 | ★5 极深 | 🎮 mixed-precision | ✅ master weights 算例 | — | ✅ AMP | ✅ 1e-5 更新量 vs 5e-4 精度 | ✅ | ✅ |
| 训练显存估算 ★5 | ★5 极深 | 🎮 mixed-precision 计算器 | ✅ 18 bytes/参数 | — | — | ✅ 7B=126GB / 70B=1.26TB | ✅ | ✅ |
| LoRA 低秩分解 ★5 | ★5 极深 | 🎮 lora-math | ✅ ΔW=BA | ✅ | ✅ PEFT | ✅ 4×4 矩阵 BA 逐步计算 | ✅×3 | ✅ |
| 秩的直觉 | ★4 | 🎮 lora-math | ✅ | — | — | ✅ ΔW 行线性相关可视化 | — | — |
| 为什么 LoRA 省参数 ★5 | ★5 | 🎮 lora | ✅ r×(d+k) 公式 | ✅ | ✅ | ✅ 0.39% 算例 + 优化器状态 | ✅ | ✅ |
| LoRA 实践细节 | ★4 | — | ✅ α/r 缩放 | — | ✅ target_modules | ✅ B 初始化为 0 | ✅ | ✅ |

---

## 交互演示清单（50 个组件 / 57 个挂载点）

> 粗体为升级过程中新增的 16 个演示（Phase 2 的 11 个 + Phase 3~4 的 5 个）。

| # | 演示 | 所在章节 | 交互内容 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | gradient-descent | 第 1 章 | 学习率滑块 + 四种预设 + 动画下山 | ✅ 已验证 |
| 2 | **backprop** | 第 1 章 | 前向/反向/更新三步走 + 可调 x、w、y | ✅ 已验证 |
| 3 | softmax | 第 1 章 | 3 个 logits 滑块 + 逐步计算 + 柱状图 | ✅ |
| 4 | cross-entropy | 第 1 章 | 概率滑块 + −ln(p) 曲线实时标注 | ✅ |
| 5 | **activations** | 第 1 章 | 四条激活函数曲线 + 导数切换 + x 滑块 | ✅ 已验证 |
| 6 | optimizer-race | 第 2 章 | SGD/Momentum/Adam 同屏赛跑动画 | ✅ |
| 7 | confusion-matrix | 第 3 章 | 4 个数字输入 + 5 个指标实时计算 | ✅ |
| 8 | vanishing-exploding | 第 4/5 章 | 底数滑块 + 对数刻度柱状图 | ✅ |
| 9 | rnn-unroll | 第 5 章 | 时间步进 + 参数共享高亮 | ✅ 已验证 |
| 10 | lstm | 第 5 章 | 三个门点击高亮 + f/i 滑块混合 Cₜ | ✅ 已验证 |
| 11 | gru | 第 5 章 | LSTM/GRU 并排 + 参数量计算 | ✅ 已验证 |
| 12 | **tokenizer** | 第 6 章 | 输入文本 + Word/Char/Subword 粒度对比 | ✅ 已验证 |
| 13 | bpe | 第 6 章 | 真实 BPE 训练逐步合并 + 编码输入框 | ✅ 已验证 |
| 14 | **cbow-skipgram** | 第 6 章 | 滑动窗口 + CBOW/Skip-Gram 样本对切换 | ✅ 已验证 |
| 15 | embedding | 第 6 章 | 查表点击 + 2D 语义空间 + 向量算术 | ✅ |
| 16 | attention | 第 7 章 | 11 token 点击查看注意力 + 热力图 | ✅ 已验证 |
| 17 | qkv-matrix | 第 7 章 | 6 步矩阵计算动画 + shape 标注 | ✅ 已验证 |
| 18 | **dot-product** | 第 7 章 | 角度滑块 + 点积几何直觉 + 对齐/垂直预设 | ✅ 已验证 |
| 19 | scaling | 第 7 章 | d_k 滑块 + 缩放前后分布对比 | ✅ |
| 20 | **weighted-sum** | 第 7 章 | 三个权重滑块 + 输出向量的几何混合 | ✅ 已验证 |
| 21 | mha | 第 7 章 | 4 个 head 注意力模式切换 | ✅ |
| 22 | **residual** | 第 7 章 | 层数/因子滑块 + 有/无残差梯度对比 | ✅ 已验证 |
| 23 | **layernorm** | 第 7 章 | 四步计算（均值→方差→标准化→缩放）+ γ/β 滑块 | ✅ 已验证 |
| 24 | **ffn** | 第 7 章 | d_model/扩展比滑块 + ReLU/SwiGLU 参数量对比 | ✅ 已验证 |
| 25 | causal-mask | 第 7 章 | 三步切换（原始/掩码/softmax） | ✅ 已验证 |
| 26 | **cross-attention** | 第 7 章 | 点击 Decoder token 看对 Encoder 的注意力 | ✅ 已验证 |
| 27 | **train-vs-inference** | 第 7 章 | 并行训练 vs 逐 token 推理动画对比 | ✅ 已验证 |
| 28 | **attn-handcalc** | 第 7 章 | 3 token × 2 维 Attention 完整手算（6 步 + 热力图） | ✅ 已验证 |
| 28 | transformer-block | 第 4/7 章 | 可点击结构图 + 说明面板 | ✅ 已验证 |
| 29 | bert-vs-gpt | 第 8 章 | 位置选择 + 双向/因果可见性对比 | ✅ 已验证 |
| 30 | **mlm** | 第 8 章 | 选 15% → 80/10/10 切换 → 预测概率 | ✅ 已验证 |
| 31 | **bert-embeddings** | 第 8 章 | 点击 token 看三种 Embedding 相加 | ✅ 已验证 |
| 32 | next-token | 第 9 章 | 三步生成流程（logits→softmax→采样） | ✅ 已验证 |
| 33 | temperature | 第 9 章 | 温度滑块 + 分布实时变化 | ✅ |
| 34 | top-k-p | 第 9 章 | 四种策略切换 + K/P 滑块 + 保留高亮 | ✅ |
| 35 | kv-cache | 第 10 章 | 有/无缓存步进动画 + 显存估算器 | ✅ 已验证 |
| 36 | mha-gqa | 第 10 章 | 三种结构切换 + KV 共享连线图 | ✅ 已验证 |
| 37 | rope | 第 10 章 | 旋转动画 + 相对位置不变性按钮 | ✅ 已验证 |
| 38 | norm-compare | 第 10 章 | 向量滑块 + LayerNorm/RMSNorm 逐步计算 | ✅ |
| 39 | pre-post-norm | 第 10 章 | 两种结构并排 + 残差路径高亮 | ✅ |
| 40 | swiglu | 第 10 章 | 曲线对比 + 标量演算 + 结构对比 | ✅ |
| 41 | pipeline | 第 0/11 章 | 9 阶段可点击流水线 | ✅ |
| 42 | loss-mask | 第 11 章 | 对话 token 着色 + mask 切换 | ✅ |
| 43 | **warmup-schedule** | 第 11 章 | 四个滑块实时绘制 LR 调度曲线 | ✅ 已验证 |
| 44 | ppo-grpo | 第 12 章 | 两种算法结构并排对比 | ✅ |
| 45 | grpo-group | 第 12 章 | 4 个 reward 滑块 + advantage 实时计算 | ✅ 已验证 |
| 46 | kl-divergence | 第 12 章 | 偏离度滑块 + KL 实时计算 | ✅ |
| 47 | **policy-ratio** | 第 12 章 | ratio/clip/advantage 滑块 + 目标函数曲线 | ✅ 已验证 |
| 48 | lora | 第 13 章 | 秩 r 滑块 + 参数量对比 | ✅ |
| 49 | **lora-math** | 第 13 章 | B×A 矩阵运算 + 低秩性质可视化 | ✅ 已验证 |
| 50 | mixed-precision | 第 13 章 | 位分布图 + 模型显存计算器 | ✅ |

## 验证结果（自动化测试）

| 检查项 | 方法 | 结果 |
| --- | --- | --- |
| 14 章全部可打开 | 无头 Chrome 逐章渲染 | ✅ 全部通过 |
| 演示初始化 | `[data-demo][data-init]` 计数 | ✅ 58/58 初始化成功 |
| 演示按钮 | CDP 逐一点击所有 `.demo-btn`（共 90+ 次点击） | ✅ 0 异常（累计修复 3 处 bug） |
| 面试答案折叠 | `details.answer` 渲染与展开 | ✅ 全站 141 个答案正常渲染、可展开（修复嵌套容器递归 bug） |
| 第 7 章 40 问覆盖 | 逐条 grep 渲染后 DOM | ✅ 39/39（跳过原资料缺失的 Q38） |
| 测验交互 | CDP 点击正确选项 | ✅ 显示「回答正确」并写入 localStorage |
| 演示滑块 | CDP 拖动 range 输入 | ✅ 数值实时更新 |
| 步进按钮 | CDP 点击「下一步」 | ✅ 内容正确切换 |
| 搜索 | 输入 GRPO | ✅ 14 条结果，面板可见 |
| 控制台错误 | CDP Runtime 监听 | ✅ 0 个错误 |
| KaTeX 渲染 | 管线端到端测试 | ✅ 2,929 处渲染，0 个残留占位符 |
| 容器配平 | `:::` 开闭配对检查 | ✅ 14 章全部配平 |
| 手算算例核验 | Node 脚本复算统一算例 | ✅ 第 7 章 Q/K/V/S/A/O、第 9 章 Temperature 概率表、第 12 章 GRPO 优势表全部一致 |
| 深度交互验证 | CDP 拖动滑块/点击 token/切换模式 | ✅ mlm、bert-embeddings、warmup-schedule、policy-ratio、lora-math 全部响应正确 |
| 离线可用 | 所有资源本地化 | ✅ 无任何 CDN 依赖 |

## 已知说明

1. **内容来源**：所有知识点均来自原始 9 份课件；补充的现代背景（如 FlashAttention、MoE、QLoRA）均以「扩展知识」形式标注或与课件结论一致。
2. **面试题答案**：全部默认折叠，点击展开。
3. **测验进度**：按「章节 id + 题号」存入 `localStorage`，刷新后恢复答题状态。
4. **演示数据**：所有交互演示使用教学用的简化数据（如 3×3 矩阵、4 个 reward），数值经过设计以便手算验证，非真实模型输出。
