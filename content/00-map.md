> **本章对应课件**：全部 9 份 PDF 的总纲。建议先花 15 分钟读完本章，建立全局地图，再进入具体章节。

## 0.1 整个大模型知识地图

:::unfold 先懂直觉
这套课程本质上只讲一件事：**如何把「输入文字」变成「下一个 token 的概率」**，以及**如何训练这个函数**。所有的模型结构、训练技巧、工程优化，都是围绕这条主线展开的。
:::

推理主线：

$$
\text{输入数据} \rightarrow \text{Tokenizer} \rightarrow \text{Token ID} \rightarrow \text{Embedding} \rightarrow \text{Transformer} \rightarrow \text{Logits} \rightarrow \text{Softmax} \rightarrow P(\text{next token})
$$

训练主线：

$$
\text{模型预测} \quad \text{vs} \quad \text{正确答案} \quad \Rightarrow \quad \text{Loss} \quad \Rightarrow \quad \frac{\partial Loss}{\partial W} \quad \Rightarrow \quad \text{更新参数}
$$

:::demo pipeline 交互：完整训练流水线
点击每个阶段查看它在做什么——从 Raw Data 到 Aligned Model，这条流水线就是整个大模型工业的缩影。
:::

所以课件前面的回归、分类、Loss、梯度下降、反向传播、Softmax、交叉熵，其实全部都是后面 GPT 训练的基础。

现代 GPT 虽然有几百亿参数，看起来复杂，底层训练思想仍然是：

**输入 → 前向传播 → 算 loss → 反向传播 → 算梯度 → optimizer 更新参数。**

> **一句话主线**
> 深度学习基础 → 模型训练与稳定性 → RNN/LSTM/GRU → NLP/Tokenizer/Embedding → Transformer → BERT/GPT → 现代 LLM 架构 → Pretrain/SFT/RL → GRPO/LoRA/混合精度。

## 0.2 112 个知识点压缩成 6 层逻辑

不要觉得「一下子要学一百多个知识点」。实际上它们只有 6 层逻辑：

| 层级 | 你真正需要理解的东西 | 对应章节 |
| --- | --- | --- |
| 数学 / 深度学习 | $Wx+b$、Loss、Softmax、交叉熵、梯度下降、反向传播 | 第 1～2 章 |
| 神经网络训练 | MLP、激活函数、过拟合、正则化、梯度稳定、Norm、Residual | 第 3～4 章 |
| 序列模型 | RNN → LSTM → GRU | 第 5 章 |
| NLP | Tokenizer → BPE/BBPE → Embedding → Word2Vec | 第 6 章 |
| LLM 架构 | Attention → Transformer → BERT/GPT → RoPE/GQA/KV Cache/RMSNorm/SwiGLU | 第 7～10 章 |
| LLM 训练 | Pretrain → SFT → RL/GRPO → LoRA/混合精度 | 第 11～13 章 |

## 0.3 必须真正会推的内容（优先级最高）

如果你以后想往 **LLM / AI Infra / ML Systems** 走，以下内容必须能自己推导或默写：

- Softmax 与数值稳定技巧
- Cross Entropy 与 $\partial L/\partial z = p - y$
- Gradient Descent 与学习率的影响
- Backpropagation（链式法则手算）
- $\text{Attention}(Q,K,V) = \text{softmax}(QK^\top/\sqrt{d_k})V$
- $Q=XW_Q,\quad K=XW_K,\quad V=XW_V$
- Causal Mask
- Residual + Norm
- $P(x_t \mid x_{<t})$

同时要搞明白这些组件**分别解决什么问题**：

| 组件 | 解决的问题 |
| --- | --- |
| Tokenizer | 文本 → 数字，压缩率与多语言公平性 |
| Embedding | 离散 ID → 有语义的稠密向量 |
| KV Cache | 推理时避免重复计算历史 token |
| GQA | 减少 KV Cache 显存占用 |
| RoPE | 让 Attention 感知相对位置 |
| RMSNorm / Pre-Norm | 更轻、更稳的深层训练 |
| Pretrain / SFT | 先学能力，再学「怎么回答」 |
| GRPO | 用相对优势做偏好优化，省掉 Value Model |
| LoRA / 混合精度 | 让微调与训练变得显存可行 |

## 0.4 暂时不需要背到一字不差的内容

- LSTM / GRU 的每一个矩阵公式（理解「门」的作用即可）
- RoPE 的复数证明（记住「旋转 Q/K」的直觉）
- GRPO 完整 objective（记住「策略改进 − KL 惩罚」的结构）

## 0.5 怎么用这套课程

每章的知识点按统一模板组织，遇到折叠块请按顺序读：

:::note 三级理解层级
| 折叠块 | 什么时候读 |
| --- | --- |
| 💡 **先懂直觉**（默认展开） | 第一遍：先建立画面感，不纠结公式 |
| 🧮 **再看数学** | 第二遍：理解推导与 shape |
| 🔧 **工程里怎么用** | 动手写代码时回来看 |
:::

| 模块 | 图标 | 作用 |
| --- | --- | --- |
| 直觉 | 💡 绿色框 | 一句话讲清「为什么」 |
| 数学 | 🧮 紫色框 | 公式、推导、算例 |
| 工程 | 🔧 橙色框 | PyTorch 代码与工程实践 |
| 误区 | ⚠️ 红色框 | 容易混淆的概念 |
| 面试 | 🎯 黄色框 | 八股考点（答案默认折叠） |
| 交互演示 | 🎮 | 动手拖滑块，建立肌肉记忆 |
| 小测验 | 📝 | 每章末尾自测，进度自动保存 |

## 0.6 学习方法建议

这套课内容并不浅，已经从最基础的 MSE 一直讲到 LoRA、GQA、KV Cache 和 GRPO。最容易犯的错误反而是：**一口气全听完，感觉每个词都见过，但自己讲不出来**。

建议的学习方式：

1. 按顺序逐章阅读，每章先看「先懂直觉」，再看数学。
2. 每个公式都问自己：它解决什么问题？输入输出 shape 是什么？
3. **每个交互演示都要动手玩**——特别是梯度下降、BPE、Attention、KV Cache、GRPO 这几个。
4. 每章读完做小测验，答错先看解析再回读对应小节。
5. 读完一章点「标记本章已读」，用左侧进度条管理节奏。
6. 面试前用右上角搜索快速回顾关键词（如 GRPO、RoPE、交叉熵）。

:::key 掌握的标准
不是「每个词都见过」，而是**能不看课件，用自己的话把这张 6 层逻辑表讲给别人听**，并能在白板上写出 Q/K/V 的 shape 与 Attention 公式。
:::

:::quiz
根据课程主线，下面哪个顺序是正确的？

A. Tokenizer → Pretrain → Transformer → Embedding
B. 深度学习基础 → 序列模型 → NLP → Transformer → LLM 训练
C. Transformer → 梯度下降 → Tokenizer → SFT
D. Embedding → 梯度下降 → Attention → BPE

答案: B
解析: 课程的 6 层逻辑是：数学/深度学习 → 神经网络训练 → 序列模型 → NLP → LLM 架构 → LLM 训练。其余选项顺序都颠倒了。
:::

:::related
依赖 | 无（这是起点）
用于 | 全部 13 章
:::
