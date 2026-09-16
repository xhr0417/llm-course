> **本章对应课件**：《3.2 Transformer》。这是全课程最重要的章节，也是面试八股最密集的一章。下面的知识点全部**独立展开**，每个都包含：直觉、公式、逐项拆解、矩阵 shape、最小数字例子、交互演示、代码、常见误区、面试问题。
>
> 本章末尾还有 **7.24 面试题库**，把 39 个高频问题（含本章全部考点）逐条列出并给出折叠答案。

:::note 本章的「统一算例」
为了让你每一节都能自己验算，全章使用同一组最小数字：

- 3 个 token，$d_{model} = 2$，$d_k = d_v = 2$，$h = 1$
- $X = \begin{pmatrix}1&0\\0&1\\1&1\end{pmatrix}$（第 1 行是第 1 个 token 的向量）
- $W_Q = \begin{pmatrix}1&0\\1&1\end{pmatrix}$，$W_K = \begin{pmatrix}0&1\\1&0\end{pmatrix}$，$W_V = \begin{pmatrix}1&0\\0&1\end{pmatrix}$

每一节都会用到这套数字，7.12 节会把它们从头到尾算一遍。请随时回看本框。
:::

## 7.1 为什么需要 Attention ★

:::unfold 先懂直觉
在 Attention 出现之前，处理序列只能用 RNN 或 CNN。RNN 必须一个词一个词串行计算，信息要走很多步才能从句子开头传到结尾；CNN 只能看固定大小的窗口。Attention 的思路完全不同：让每个词**直接和所有词**建立联系，一步到位，而且权重由数据自己学出来。
:::

### 三种方案对比

| 方案 | 信息路径长度 | 并行性 | 长距离依赖 |
| --- | --- | --- | --- |
| RNN | O(S)（要一步步传） | ❌ 串行 | 差（梯度消失） |
| CNN | O(S/k)（要叠很多层） | ✅ 并行 | 一般（感受野有限） |
| **Attention** | **O(1)**（任意两个位置直接相连） | ✅ 完全并行 | 好 |

### 逐项拆解：Attention 解决的两个核心问题

| 问题 | RNN 的做法 | Attention 的做法 |
| --- | --- | --- |
| 长距离依赖 | 信息沿时间步传递，梯度连乘易消失 | 任意两位置直接点积交互 |
| 并行计算 | $h_t$ 依赖 $h_{t-1}$，必须串行 | 全部位置一次矩阵乘法 |

:::note Attention 的本质
Attention 不是「检索」，也不是「相似度排序」，而是**用数据学出来的权重，对信息做加权平均**。权重多大由 Query 和 Key 的匹配程度决定，而且这个匹配方式（三个投影矩阵）是训练出来的。
:::

:::demo attention 交互：看 "it" 关注谁
点击句子里的任意 token，查看它的注意力分布。处理 "it" 时 "animal" 权重最高——这就是「指代消解」在数学上的表现。
:::

:::interview 面试常问
**Q1：为什么需要 Attention？RNN 和 CNN 不够吗？**

:::answer
RNN 的两个致命问题：① 串行计算，无法利用 GPU 并行；② 长距离依赖需要 O(S) 步传递，梯度连乘易消失。CNN 感受野有限，要堆很多层才能覆盖长距离。Attention 让任意两个位置一步直接交互（路径长度 O(1)），且完全可并行——这就是 Transformer 取代 RNN 的根本原因。
:::
:::

## 7.2 Transformer 总体架构（含 Encoder 模块）★

:::unfold 先懂直觉
Transformer 2017 年诞生于机器翻译，思路是彻底抛弃 RNN 的串行结构，改用「所有位置互相关注」的 Attention。它由 Encoder（理解输入）和 Decoder（生成输出）两部分组成。
:::

### 逐项拆解：Encoder 一层做什么

| 子层 | 作用 | 注意力类型 |
| --- | --- | --- |
| ① Multi-Head Self-Attention | 所有位置互相交换信息 | 双向（无 mask） |
| ② Feed-Forward Network | 每个位置独立加工 | 无注意力 |
| 每个子层外面 | 残差 + LayerNorm | — |

**Encoder 的输出**：与输入同形状 `[B, S, d_model]` 的张量，但每个位置都融合了全句信息。原始论文堆叠 N = 6 层，每层结构完全相同但参数不同。

### 矩阵 shape

:::shapeflow
输入 tokens [B, S] → Embedding ×√d_model + 位置编码 → [B, S, d_model]
→ N 层（每层：Self-Attn → Add&Norm → FFN → Add&Norm）→ [B, S, d_model]
:::

### Decoder 一层（原始 Transformer）

| 子层 | 注意力类型 | 说明 |
| --- | --- | --- |
| ① Masked Self-Attention | 因果（只看到自己及之前） | 防偷看答案 |
| ② Cross-Attention | Q 来自 Decoder，K/V 来自 Encoder | 看输入句子 |
| ③ FFN | 逐位置加工 | — |

:::demo transformer-block 交互：点击查看每个模块
点击结构图里的任意模块，右侧显示它的作用。整个 Block 输入输出形状不变，都是 (B, S, d_model)。
:::

**BERT vs GPT vs 原始 Transformer**：

| 模型 | 使用的部分 | 注意力 | 训练目标 |
| --- | --- | --- | --- |
| BERT | Encoder-only | 双向 | MLM |
| GPT | Decoder-only | 因果 | next token prediction |
| 原始 Transformer / T5 | Encoder-Decoder | 双向 + 因果 + Cross | 序列到序列 |

:::interview 面试常问
**Q：大概讲一下 Transformer 的 Encoder 模块？**

:::answer
Encoder 由 N 个相同结构的层堆叠（原论文 N=6），每层包含两个子层：① 多头自注意力（双向，无 mask），让所有位置交换信息；② 前馈网络 FFN，逐位置独立加工。每个子层都包着「残差连接 + LayerNorm」。输入输出形状不变，都是 [B, S, d_model]。Encoder 的输出会作为 Decoder 交叉注意力的 K/V。
:::
:::

## 7.3 位置编码（含 embedding 缩放）★

:::unfold 先懂直觉
Self-Attention 本质是「加权求和」，它对输入的顺序完全无感：把句子打乱，注意力矩阵只是跟着换行换列。所以必须人为把位置信息注入进去。
:::

### 为什么没有顺序

看这个例子：

```
dog bites man
man bites dog
```

两句话用词完全相同，意思相反。纯 Attention 是**置换等变的**（permutation equivariant）：

$$
\text{Attn}(PX) = P\,\text{Attn}(X)
$$

输入置换 $P$，输出只是跟着置换——模型根本没有「位置」概念。

### 如何弥补

$$
\text{Input} = \text{TokenEmbedding} \times \sqrt{d_{model}} + \text{PositionalEncoding}
$$

**Sinusoidal 位置编码**（原始 Transformer）：

$$
PE_{(pos,2i)} = \sin\left(\frac{pos}{10000^{2i/d}}\right), \qquad PE_{(pos,2i+1)} = \cos\left(\frac{pos}{10000^{2i/d}}\right)
$$

不同维度有不同频率：低频表达粗粒度位置，高频表达细粒度位置。

:::math 为什么用 sin/cos
和角公式：

$$
\sin(a+b) = \sin a \cos b + \cos a \sin b
$$

说明位置 $pos+k$ 的编码可以由位置 $pos$ 的编码**线性组合**得到——模型因此更容易学到「相对位置」而不是死记「绝对位置」。
:::

### 为什么 embedding 要乘 √d_model

:::math 推导
设 embedding 的每一维独立、方差为 $1/d_{model}$（常见初始化下的近似），则向量各维标准差是 $1/\sqrt{d_{model}}$，与位置编码（值域 [−1,1]，方差约 1/3）相比尺度偏小。

乘以 $\sqrt{d_{model}}$ 后：

$$
\text{Var}\left(x_i \cdot \sqrt{d_{model}}\right) = \frac{1}{d_{model}} \cdot d_{model} = 1
$$

方差归一到 1，与位置编码量级相当，相加时不会一方主导另一方。
:::

**注意**：这是原始论文的实现细节；现代 LLM（如 LLaMA）通常在 embedding 后直接接 RMSNorm，用归一化解决尺度问题。

### 位置编码技术全景

| 方案 | 公式/思想 | 优点 | 缺点 |
| --- | --- | --- | --- |
| Sinusoidal（原始） | sin/cos 固定频率 | 无参数、理论可外推 | 绝对位置、表达力有限 |
| 可学习绝对（BERT/GPT-2） | 每个位置一个可训练向量 | 简单、效果好 | 固定最大长度、不能外推 |
| 相对位置（Shaw / T5 bias） | 按 $i-j$ 的偏移给分数加偏置 | 直接建模相对距离 | 实现复杂、需要截断范围 |
| **RoPE**（LLaMA/Qwen） | 旋转 Q/K，点积含相对位置 | 相对位置 + 外推好 + 无参数 | 需要频率调参（NTK/YaRN） |
| ALiBi | 距离越远惩罚越大（线性 bias） | 外推极好、实现简单 | 表达力略弱于 RoPE |

:::warning 常见误区
**Self-Attention 本身不知道顺序**，这是面试高频考点。位置信息不是 Attention 自带的，必须通过位置编码注入。
:::

:::interview 面试常问
**Q1：位置编码有什么意义和优缺点？**

:::answer
意义：给无序的 Attention 注入位置信息，否则打乱词序模型无法区分。Sinusoidal 的优点是无需参数、理论上可外推到更长序列；缺点是不可学习、表达绝对位置，实际长序列外推效果有限。因此现代 LLM 多用 RoPE（旋转 Q/K，点积只依赖相对位置，外推更好）。
:::

**Q2：还了解哪些位置编码技术？**

:::answer
① 可学习绝对位置（BERT）：简单有效但不能外推；② 相对位置编码（Shaw、T5 bias）：直接建模 i−j 偏移，泛化好但实现复杂；③ RoPE：旋转 Q/K，具备相对位置性质 + 外推好，现代 LLM 主流；④ ALiBi：给注意力分数加线性距离惩罚，外推能力极强但表达力略弱。
:::

**Q3：为什么输入词向量要乘以 √d_model？**

:::answer
让 embedding 与位置编码的尺度相当。embedding 各维方差若为 1/d_model，其数值尺度远小于位置编码（值域 [-1,1]），相加时位置信息会被淹没或主导。乘以 √d_model 后方差归一到 1，两者量级匹配。现代实现也常用 embedding 后接 RMSNorm 来达到同样目的。
:::
:::

## 7.4 Self-Attention 是什么 ★

:::unfold 先懂直觉
一句话：**Attention 就是按相关性做加权平均**。

每个 token 提出一个问题（Query），所有 token 展示自己的标签（Key），匹配度高的就多取一点它的内容（Value）。处理 "it" 时它问「我指谁？」，发现 "animal" 的标签最匹配，于是主要把 "animal" 的内容取过来。
:::

### 公式

$$
\text{Attention}(Q,K,V) = \text{Softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V
$$

### 逐项拆解（五个部件，后面逐节展开）

| 部件 | 数学 | 作用 | 小节 |
| --- | --- | --- | --- |
| $Q, K, V$ | $Q = XW_Q$ 等 | 三个投影 | 7.5 |
| $QK^\top$ | 矩阵乘法 | 两两匹配分数 | 7.7 |
| $\sqrt{d_k}$ | 缩放 | 防 softmax 饱和 | 7.9 |
| $\text{Softmax}$ | 逐行归一化 | 分数 → 权重 | 7.10 |
| $\times V$ | 加权求和 | 混合内容 | 7.11 |

### 矩阵 shape

:::shapeflow
X [B, S, d_model] → 三次投影 → Q, K, V [B, S, d_k] / [B, S, d_v]
Q [B, S, d_k] × Kᵀ [B, d_k, S] → scores [B, S, S]
scores → softmax(逐行) → A [B, S, S]
A [B, S, S] × V [B, S, d_v] → 输出 [B, S, d_v]
:::

### 复杂度与「翻倍变 4 倍」

:::math 复杂度推导
1. 分数矩阵 $QK^\top$：$S \times S$ 个元素，每个是一次 $d_k$ 维点积 → $O(S^2 d_k)$
2. Softmax：对 $S^2$ 个元素做指数运算 → $O(S^2)$
3. 乘 V：$S \times S$ 的权重矩阵乘 $S \times d_v$ → $O(S^2 d_v)$

合计：

$$
O(S^2 d) \text{ 时间}, \qquad O(S^2) \text{ 空间（存分数矩阵）}
$$

序列长度翻倍：$(2S)^2 = 4S^2$ → 元素数变 **4 倍**。
:::

:::interview 面试常问
**Q：Attention 的复杂度为什么是 O(S²)？seq_len 翻倍为什么变 4 倍？**

:::answer
要计算 seq_len × seq_len 的分数矩阵：每个元素是一次 d 维点积，共 S² 个元素。序列长度翻倍后 (2S)² = 4S²，元素数变 4 倍（时间和显存都如此）。这是长上下文的核心瓶颈，催生了 FlashAttention（优化 IO，不改变 O(S²) 复杂度）、稀疏/线性 Attention（改变复杂度）等方案。
:::
:::

## 7.5 Q、K、V：三个投影 ★

:::unfold 先懂直觉
同一个输入 $X$，用三套不同的权重矩阵投影出三种角色：

- **Query（我在问什么）**：当前 token 想找什么信息；
- **Key（我的标签是什么）**：每个 token 能提供什么信息的索引；
- **Value（我的内容是什么）**：匹配成功后真正被取走的内容。
:::

### 公式

$$
Q = XW_Q, \qquad K = XW_K, \qquad V = XW_V
$$

### 逐项拆解

| 符号 | 形状 | 含义 | 直觉 |
| --- | --- | --- | --- |
| $X$ | $[B, S, d_{model}]$ | 输入（embedding + 位置编码） | 每个 token 一行 |
| $W_Q$ | $[d_{model}, d_k]$ | Query 投影矩阵 | 学出来的「提问方式」 |
| $W_K$ | $[d_{model}, d_k]$ | Key 投影矩阵 | 学出来的「标签方式」 |
| $W_V$ | $[d_{model}, d_v]$ | Value 投影矩阵 | 学出来的「内容方式」 |
| $Q, K$ | $[B, S, d_k]$ | 提问 / 标签 | 用于算匹配分数 |
| $V$ | $[B, S, d_v]$ | 内容 | 用于加权求和 |

### 矩阵 shape（QKV shape flow）

:::shapeflow
X [B, S, d_model] × W_Q [d_model, d_k] → Q [B, S, d_k]
X [B, S, d_model] × W_K [d_model, d_k] → K [B, S, d_k]
X [B, S, d_model] × W_V [d_model, d_v] → V [B, S, d_v]
:::

维度怎么「消掉」的：$d_{model}$ 在矩阵乘法中被求和消去，剩下 $d_k$（或 $d_v$）。

### 最小数字例子

$$
Q = XW_Q = \begin{pmatrix}1&0\\0&1\\1&1\end{pmatrix}\begin{pmatrix}1&0\\1&1\end{pmatrix} = \begin{pmatrix}1&0\\1&1\\2&1\end{pmatrix}
$$

逐行验算：

- 第 1 行：$[1,0]$ → 列 1 = $1\times1 + 0\times1 = 1$；列 2 = $1\times0 + 0\times1 = 0$ → $[1, 0]$
- 第 2 行：$[0,1]$ → 列 1 = $0\times1 + 1\times1 = 1$；列 2 = $0\times0 + 1\times1 = 1$ → $[1, 1]$
- 第 3 行：$[1,1]$ → 列 1 = $1+1 = 2$；列 2 = $0+1 = 1$ → $[2, 1]$

同理：

$$
K = XW_K = \begin{pmatrix}0&1\\1&0\\1&1\end{pmatrix}, \qquad V = XW_V = \begin{pmatrix}1&0\\0&1\\1&1\end{pmatrix}
$$

:::demo qkv-matrix 交互：从 X 到 Q/K/V 的完整流程
点「下一步」逐步查看 X → Q/K/V → QKᵀ → 缩放 → softmax → 输出，每一步都标注 shape。
:::

:::fold 工程里怎么用（PyTorch）
```python
Wq = nn.Linear(d_model, d_k, bias=False)
Wk = nn.Linear(d_model, d_k, bias=False)
Wv = nn.Linear(d_model, d_v, bias=False)

Q = Wq(x)   # [B, S, d_k]
K = Wk(x)   # [B, S, d_k]
V = Wv(x)   # [B, S, d_v]
```
:::

:::warning 常见误区
- **Q、K、V 都来自同一个 $X$**（Self-Attention），但用**三套不同的权重**；Cross-Attention 里 Q 来自 Decoder、K/V 来自 Encoder（见 7.18）。
- **$d_k$ 和 $d_v$ 可以不同**：分数矩阵只依赖 $d_k$，输出维度等于 $d_v$。通常取相等。
- **投影矩阵是学出来的**，不是人为设计的规则。
:::

:::interview 面试常问
**Q1：Q、K、V 分别是什么？**

:::answer
Q 是「查询」（当前 token 想找什么），K 是「键」（每个 token 的匹配标签），V 是「值」（匹配后传递的内容）。三者都由输入 X 用不同权重投影得到。三套投影让模型学习「相关性如何度量、什么内容值得传递」。
:::

**Q2：Q 和 K 必须同维度吗？V 呢？**

:::answer
Q 和 K 必须同维度（点积要求），即 d_q = d_k；V 的维度 d_v 可以独立，它只决定输出维度。实践中通常 d_k = d_v = d_model / h。
:::
:::

## 7.6 为什么 Q 和 K 要用不同的投影矩阵（不能 X·Xᵀ）★

:::unfold 先懂直觉
如果直接用 X·Xᵀ，注意力矩阵就变成**对称**的：A 关注 B 多强，B 就关注 A 多强。但语言关系几乎都是不对称的——代词需要关注它指代的名词，名词却不必反向关注代词。分开投影让模型能学「我在找什么」和「我提供什么」两种不同角色。
:::

### 三个理由

**理由 1：打破对称性**

如果 $S = XX^\top$：

$$
S_{ij} = x_i \cdot x_j = x_j \cdot x_i = S_{ji}
$$

注意力矩阵恒为对称矩阵，模型无法表达方向性关系。

**理由 2：角色分离（Query ≠ Key）**

- Query：我在找什么信息（当前 token 的需求）
- Key：我能提供什么信息（每个 token 的标签）

这两个角色语义不同，需要**不同的子空间**来表达。分开投影后：

$$
S_{ij} = (x_i W_Q)(x_j W_K)^\top = x_i\, W_Q W_K^\top\, x_j^\top
$$

模型可以通过 $W_Q W_K^\top$ 学出一个**非对称**的双线性形式，表达「i 对 j 的关注」。

**理由 3：表达力**

论文实验表明，学习出来的投影比固定的恒等映射（直接点积）效果好；投影让模型自适应地选择「哪些维度用于匹配」。

### 数字算例

沿用统一算例。如果直接用 $XX^\top$：

$$
XX^\top = \begin{pmatrix}1&0&1\\0&1&1\\1&1&2\end{pmatrix}
$$

注意它是**对称矩阵**：$S_{13} = S_{31} = 1$，$S_{23} = S_{32} = 1$。

而用分开投影后得到的 $S = QK^\top$：

$$
S = \begin{pmatrix}0&1&1\\1&1&2\\1&2&3\end{pmatrix}
$$

关键在于：**对称与否由模型自己决定，而不是被数学结构强制**。换一组不同的 $W_Q, W_K$，$S$ 就不再对称。

:::warning 常见误区
- **「Q、K、V 都来自 X 所以点积就是 X·Xᵀ」是错的**：中间隔了两个学出来的投影矩阵。
- **不能用同一个矩阵投影 Q 和 K**：那会退化回对称形式（$S = XWW^\top X^\top$ 仍对称）。
- **V 的角色不同**：它不参与匹配，只提供内容，所以 $W_V$ 独立。
:::

:::interview 面试常问
**Q：为什么 Q 和 K 使用不同的权重矩阵？为什么不能直接 X·Xᵀ 自身点乘？**

:::answer
直接 X·Xᵀ 会让注意力矩阵对称（S_ij = S_ji），无法表达「it 关注 animal 但 animal 不必同等关注 it」这类方向性关系；且「我在找什么」（Query）和「我提供什么」（Key）是两个不同角色，需要不同的子空间。分开投影后模型学出非对称双线性形式 x_i(W_Q W_Kᵀ)x_jᵀ，表达力更强。实验也表明可学习投影优于固定点积。
:::
:::

## 7.7 QKᵀ：匹配打分 ★

:::unfold 先懂直觉
点积衡量两个向量方向的一致程度：越一致，点积越大。所以让每个 Query 和所有 Key 做点积，就得到「这个 token 觉得每个 token 有多相关」的分数表。
:::

### 公式

$$
S = QK^\top, \qquad S_{ij} = q_i \cdot k_j = \sum_{t=1}^{d_k} q_{i,t}\, k_{j,t}
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $q_i$ | 第 $i$ 个 token 的 Query（$Q$ 的第 $i$ 行） |
| $k_j$ | 第 $j$ 个 token 的 Key（$K$ 的第 $j$ 行） |
| $S_{ij}$ | 第 $i$ 个 token 对第 $j$ 个 token 的**原始匹配分数**（logit） |
| $S$ 的第 $i$ 行 | token $i$ 对所有 token 的打分 |
| 为什么转置 | $Q$ 是 $[S, d_k]$，$K$ 是 $[S, d_k]$；要相乘必须把 $K$ 转成 $[d_k, S]$ |

### 矩阵 shape（为什么是 seq_len × seq_len）

:::shapeflow
Q [B, S, d_k] × Kᵀ [B, d_k, S] → scores [B, S, S]
:::

维度怎么「消掉」的：$d_k$ 在点积中被求和消去，剩下 $S \times S$——**每个 token 对每个 token 一个分数**，所以注意力矩阵的行数和列数都是序列长度。

### 最小数字例子

$$
S = QK^\top = \begin{pmatrix}1&0\\1&1\\2&1\end{pmatrix}\begin{pmatrix}0&1&1\\1&0&1\end{pmatrix} = \begin{pmatrix}0&1&1\\1&1&2\\1&2&3\end{pmatrix}
$$

逐项验算（注意 $K^\top$ 的列就是 $K$ 的行）：

| 项 | 计算 | 结果 | 含义 |
| --- | --- | --- | --- |
| $S_{11}$ | $q_1\cdot k_1 = 1\times0 + 0\times1$ | 0 | token1 与 token1 |
| $S_{12}$ | $q_1\cdot k_2 = 1\times1 + 0\times0$ | 1 | token1 与 token2 |
| $S_{13}$ | $q_1\cdot k_3 = 1\times1 + 0\times1$ | 1 | token1 与 token3 |
| $S_{21}$ | $q_2\cdot k_1 = 1\times0 + 1\times1$ | 1 | token2 与 token1 |
| $S_{23}$ | $q_2\cdot k_3 = 1\times1 + 1\times1$ | 2 | token2 与 token3 |
| $S_{33}$ | $q_3\cdot k_3 = 2\times1 + 1\times1$ | 3 | token3 与 token3（最匹配） |

:::demo dot-product 交互：点积的几何直觉
拖动 q 和 k 的角度，看点积如何随夹角变化：对齐 → 分数大，垂直 → 接近 0，相反 → 负分数。
:::

:::fold 工程里怎么用（PyTorch）
```python
scores = Q @ K.transpose(-2, -1)   # [B, S, S]
# transpose(-2, -1)：交换最后两维，即 [B, S, d_k] → [B, d_k, S]
```
:::

:::warning 常见误区
- **分数不是概率**：$S$ 可以是负数、可以大于 1，必须经过 softmax 才是权重。
- **$S$ 一般不对称**：$S_{ij} = q_i\cdot k_j$ 与 $S_{ji} = q_j\cdot k_i$ 是不同的数（本例中 $S_{12}=S_{21}=1$ 只是巧合）。
- **忘记转置是最常见的实现 bug**：形状对不上或语义错位。
- **$S$ 的大小是 $S \times S$**，这就是 $O(S^2)$ 复杂度的来源。
:::

:::interview 面试常问
**Q1：QKᵀ 为什么能表示相关性？**

:::answer
点积 q·k = |q||k|cosθ 衡量两个向量的方向一致性：越对齐越大。Q 和 K 都是可学习投影，所以模型学出的「相关性度量」而不是固定的余弦相似度。
:::

**Q2：QKᵀ 的每个元素是什么？矩阵形状和计算量？**

:::answer
每个元素 S_ij = q_i·k_j，是第 i 个 token 对第 j 个 token 的匹配分数（logit）。形状 [B, S, S]，每个元素是一次 d_k 维点积，总计算量 O(B·S²·d_k)。S 是瓶颈，所以长上下文需要 FlashAttention、GQA 等技术。
:::
:::

## 7.8 点乘 vs 加法注意力 ★

:::unfold 先懂直觉
算匹配分数有两种方式：点乘（dot-product）和加性（additive，又叫 Bahdanau attention）。点乘就是直接内积；加性先用一个小 MLP 把两个向量合起来再打分。现代 Transformer 全用点乘，因为快得多，效果还相当。
:::

### 公式对比

**点乘（Luong，Transformer 采用）**：

$$
\text{score}(q, k) = q^\top k
$$

**加性（Bahdanau）**：

$$
\text{score}(q, k) = v^\top \tanh(W_q q + W_k k)
$$

### 逐项拆解

| | 点乘 | 加性 |
| --- | --- | --- |
| 参数量 | 0（无额外参数） | 有 $W_q, W_k, v$ |
| 计算 | 一次点积 | 两次线性变换 + tanh + 一次点积 |
| 实现 | 可用高度优化的 GEMM | 逐元素操作多，GPU 利用率低 |
| 效果 | 配合 $\sqrt{d_k}$ 缩放后与加性相当 | 高维时略优（未缩放点乘会饱和） |
| 现代使用 | 全部 Transformer 系 | 早期 seq2seq |

### 复杂度对比

单次打分：点乘 $O(d)$，加性 $O(d^2)$（两个 $d \times d$ 投影）或 $O(d)$（投影到低维后）。但两者都要算 $S^2$ 对，总复杂度分别是 $O(S^2 d)$ 和 $O(S^2 d^2)$——点乘在实际硬件上快得多（大矩阵乘法 + 显存友好）。

:::warning 常见误区
**加性注意力不是「效果更好」**：论文指出高维时未缩放的加性略优于点乘，但点乘配合 $\sqrt{d_k}$ 缩放后两者相当，而点乘在工程上快一个量级，所以成为标准。
:::

:::interview 面试常问
**Q：为什么用点乘而不是加法注意力？**

:::answer
点乘可直接用高度优化的矩阵乘法（GEMM）实现，GPU 上快得多、显存友好；加性注意力需要额外的线性变换和 tanh，逐元素操作多、利用率低。效果上：点乘在 d_k 大时未缩放会饱和，但除以 √d_k 后与加性相当。因此现代 Transformer 统一采用缩放点乘。
:::
:::

## 7.9 为什么除 √d_k ★

:::unfold 先懂直觉
$d_k$ 越大，点积的数值就越大（更多项相加）。分数一大，softmax 就会变得极其尖锐（接近 one-hot），梯度消失、模型学不动。除以 $\sqrt{d_k}$ 把分数拉回正常范围。
:::

### 公式

$$
\text{scaled} = \frac{QK^\top}{\sqrt{d_k}}
$$

### 逐项拆解（方差推导）

假设 $q$、$k$ 的每个分量独立、均值 0、方差 1：

$$
q \cdot k = \sum_{i=1}^{d_k} q_i k_i
$$

每项 $q_i k_i$ 的方差为 1，$d_k$ 项独立相加：

$$
\text{Var}(q \cdot k) = d_k, \qquad \text{std}(q \cdot k) = \sqrt{d_k}
$$

所以除以 $\sqrt{d_k}$ 后，方差回到 1。

| 量 | 数值 | 含义 |
| --- | --- | --- |
| 点积方差 | $d_k$ | 随维度线性增长 |
| 点积标准差 | $\sqrt{d_k}$ | 要除以的就是它 |
| 缩放后方差 | 1 | 与 $d_k$ 无关，稳定 |

### 矩阵 shape

缩放**不改变形状**，只改变数值：

$$
[B, S, S] \xrightarrow{\div \sqrt{d_k}} [B, S, S]
$$

### 最小数字例子

统一算例中 $d_k = 2$，$\sqrt{d_k} \approx 1.414$：

| 原始分数 | 缩放后 |
| --- | --- |
| 0 | 0 |
| 1 | 0.707 |
| 2 | 1.414 |
| 3 | 2.121 |

$d_k$ 更大时差异更明显。假设某行分数是 $[3, 2, 1]$：

| $d_k$ | 缩放后 | softmax 后最大概率 |
| --- | --- | --- |
| 1 | [3, 2, 1] | 66.5% |
| 16 | [0.75, 0.5, 0.25] | 44.5% |
| 64 | [0.375, 0.25, 0.125] | 38.3% |
| 不缩放（d_k=64） | [24, 16, 8] | ≈ 100%（饱和！） |

:::demo scaling 交互：不缩放 vs 缩放
拖动 d_k 滑块，左侧看未缩放时 softmax 如何变得极其尖锐，右侧看缩放后分布依然平滑。
:::

:::fold 工程里怎么用（PyTorch）
```python
d_k = Q.size(-1)
scores = Q @ K.transpose(-2, -1) / math.sqrt(d_k)   # 或 scores * (d_k ** -0.5)
```
:::

:::warning 常见误区
- **不是除以 $d_k$**：方差随 $d_k$ 线性增长，要除的是标准差 $\sqrt{d_k}$。除以 $d_k$ 会让分布过平、区分度不足。
- **缩放不改变大小顺序**：它只改变分布尖锐程度。
- **这不是「为了更快」**：是为了数值稳定和梯度健康。
:::

:::interview 面试常问
**Q：为什么 Attention 要除以 √d_k？请推导。**

:::answer
设 q、k 各维独立、均值 0、方差 1，则 q·k = Σqᵢkᵢ 是 d_k 个独立同分布项之和，方差为 d_k、标准差为 √d_k。分数过大会让 softmax 饱和（输出接近 one-hot，雅可比趋近 0，梯度消失）。除以 √d_k 把方差归一到 1，与加性注意力效果相当。除以 d_k 会过度缩小（方差变 1/d_k），区分度不足。
:::
:::

## 7.10 Softmax：对哪个维度做 ★

:::unfold 先懂直觉
上一步得到的是原始分数，可正可负、可大可小。Softmax 把**每一行**变成概率分布：每个分数变成 0~1 的权重，一行加起来等于 1。这样「关注谁多一点」就量化成了权重。
:::

### 公式（逐行计算）

$$
A_{ij} = \frac{e^{S_{ij}}}{\sum_{j'} e^{S_{ij'}}}
$$

**关键：对最后一维（dim=-1，即 key 的位置）做，不是对列。**

### 逐项拆解

| 步骤 | 操作 | 例子（第 1 行 $[0, 0.707, 0.707]$） |
| --- | --- | --- |
| ① 取指数 | $e^{S_{ij}}$ | $e^0=1$，$e^{0.707}=2.028$，$e^{0.707}=2.028$ |
| ② 求和 | $\sum_j e^{S_{ij}}$ | $1 + 2.028 + 2.028 = 5.056$ |
| ③ 归一化 | 除以总和 | $[0.198, 0.401, 0.401]$ |

**为什么用 exp？** 保证非负、放大差异、可导。**数值稳定技巧**：先减去每行最大值再取 exp。

### 矩阵 shape

$$
[B, S, S] \xrightarrow{\text{逐行 softmax}} [B, S, S], \qquad \sum_j A_{ij} = 1
$$

### 最小数字例子

$$
A = \begin{pmatrix}0.198&0.401&0.401\\0.248&0.248&0.504\\0.140&0.284&0.576\end{pmatrix}
$$

验算第 2 行：$e^{0.707}=2.028$，$e^{0.707}=2.028$，$e^{1.414}=4.113$；总和 $= 8.169$；$2.028/8.169 = 0.248$，$4.113/8.169 = 0.504$ ✅ 每行和 = 1。

**怎么读**：第 3 行 `[0.14, 0.28, 0.58]` 表示「token3 把 14% 的注意力给 token1、28% 给 token2、58% 留给自己」。

:::demo softmax 交互：逐行归一化
拖动三个 logits 滑块，观察 exp → 求和 → 归一化的全过程。注意：无论输入多大，输出永远是和为 1 的正数。
:::

:::fold 工程里怎么用（PyTorch）
```python
A = F.softmax(scores, dim=-1)      # 对最后一维（每个 query 的所有 key）归一化

# 手写数值稳定版：
scores = scores - scores.max(dim=-1, keepdim=True).values
e = torch.exp(scores)
A = e / e.sum(dim=-1, keepdim=True)
```
:::

:::warning 常见误区
- **是逐行（dim=-1）不是逐列**：每一行是一个 token 的注意力分布。
- **不是 Sigmoid**：Sigmoid 逐元素独立，不保证和为 1；Softmax 是竞争性的（此消彼长）。
- **Softmax 不会输出严格 0**：即使分数是 −100，权重也是 $e^{-100}$ 这样的小正数。
- **忘了减最大值**：FP16 下 $e^{89}$ 就溢出了。
:::

:::interview 面试常问
**Q1：Attention 的 softmax 对哪个维度做？**

:::answer
对最后一维 dim=-1（key 的位置）。分数矩阵 [B, S, S]，最后一维是「每个 query 对所有 key」，归一化后每行和为 1，表示该 token 的注意力分布。写错维度语义完全错误（变成每个 key 被所有 query 分配）。
:::

**Q2：Softmax 的数值稳定性怎么处理？**

:::answer
先减去每行最大值：softmax(z) = softmax(z − max(z))，数学等价（分子分母同乘 e^(−max)），但最大指数变成 e⁰=1，不会溢出。PyTorch 的 F.softmax 内部已处理。
:::
:::

## 7.11 为什么最后乘 V 而不是 K ★

:::unfold 先懂直觉
QKᵀ 得到的只是「谁该关注谁」的权重，权重本身没有内容。真正要被取走的信息存在 V 里。所以最后用权重去「称量」V：权重大的 V 多拿一点。用 K 就错了——K 只是标签（用于匹配），不是内容。
:::

### 为什么不是 K

| 张量 | 角色 | 用来做什么 |
| --- | --- | --- |
| Q | 提问 | 和 K 匹配 |
| K | 标签/索引 | 只参与打分，不参与内容传递 |
| V | 内容 | 被加权求和，产生输出 |

如果用 $A \cdot K$，输出的语义就变成「按权重混合所有 token 的**标签**」，而不是「混合所有 token 的**内容**」——标签是为匹配服务的投影，不是信息本身。

### 为什么是加权和

$$
\text{output}_i = \sum_{j=1}^{S} A_{ij} V_j
$$

- $A_{ij} \ge 0$ 且 $\sum_j A_{ij} = 1$（softmax 保证）
- 所以 output_i 是**凸组合**（convex combination）——所有 V 的加权平均
- 权重大的 V 贡献大，但**所有 V 都被混合**（软选择，不是 argmax）

### 矩阵 shape

:::shapeflow
A [B, S, S] × V [B, S, d_v] → 输出 [B, S, d_v]
:::

$S$ 在加权中被求和消去，输出每个位置仍然是 $d_v$ 维——**形状与 V 相同，序列长度不变**。

### 最小数字例子

计算第 1 个 token 的输出：

$$
\text{output}_1 = 0.198 \cdot \begin{pmatrix}1\\0\end{pmatrix} + 0.401 \cdot \begin{pmatrix}0\\1\end{pmatrix} + 0.401 \cdot \begin{pmatrix}1\\1\end{pmatrix}
$$

逐维计算：

- 第 1 维：$0.198\times1 + 0.401\times0 + 0.401\times1 = 0.599$
- 第 2 维：$0.198\times0 + 0.401\times1 + 0.401\times1 = 0.802$

:::demo weighted-sum 交互：加权平均的几何含义
拖动三个权重滑块，看输出向量（绿色粗箭头）如何在三个 V 向量之间「按权重混合」。权重全给 V₁ 时输出就是 V₁，平均分配时输出就是三者的中心。
:::

:::warning 常见误区
- **输出不是「最相关的那个 V」**：是全部 V 的加权平均（软选择）。
- **输出维度是 $d_v$，不是 $d_k$**：$d_k$ 只影响分数，$d_v$ 决定输出。
- **每个 token 的输出都不同**：因为每行的注意力分布不同。
:::

:::interview 面试常问
**Q1：为什么 Attention 最后乘 V 而不是 K？**

:::answer
K 是为「匹配」学出来的标签投影，只参与打分；V 是为「传递」学出来的内容投影。Attention 的目标是按相关性提取信息，所以用权重混合 V（内容）。输出 = 所有 V 的加权平均（凸组合），权重由 QKᵀ+softmax 得到。用 K 会把「标签」当内容，语义错误。
:::

**Q2：一个 token 的最终输出为什么是所有 Value 的加权和？**

:::answer
softmax 保证每行权重非负且和为 1，所以 A·V 的每一行是 V 的凸组合（加权平均）。这是「软选择」：所有位置的信息都按相关性比例混合进来，而不是硬选一个。好处是可导、允许同时参考多个位置。
:::
:::

## 7.12 完整手算：3 token × 2 维的 Attention ★

:::unfold 先懂直觉
前面每一节都在拆一个部件，这里把它们串起来，用同一组数字从头算到尾。请拿一张纸跟着算——算完这一遍，Attention 就不再是黑箱。
:::

### 第 0 步：输入

$$
X = \begin{pmatrix}1&0\\0&1\\1&1\end{pmatrix}
$$

3 个 token（行），每个 2 维（列）。$d_{model} = d_k = d_v = 2$。

### 第 1 步：三个投影

$$
W_Q = \begin{pmatrix}1&0\\1&1\end{pmatrix}, \quad W_K = \begin{pmatrix}0&1\\1&0\end{pmatrix}, \quad W_V = \begin{pmatrix}1&0\\0&1\end{pmatrix}
$$

$$
Q = XW_Q = \begin{pmatrix}1&0\\1&1\\2&1\end{pmatrix}, \quad
K = XW_K = \begin{pmatrix}0&1\\1&0\\1&1\end{pmatrix}, \quad
V = XW_V = \begin{pmatrix}1&0\\0&1\\1&1\end{pmatrix}
$$

**逐行验算**（以 Q 为例）：第 3 行 $[1,1]$ 乘 $W_Q$ 的第 1 列 $[1,1]$ 得 $1+1=2$，乘第 2 列 $[0,1]$ 得 $0+1=1$ → $[2,1]$。

### 第 2 步：QKᵀ 打分

$$
S = QK^\top = \begin{pmatrix}0&1&1\\1&1&2\\1&2&3\end{pmatrix}
$$

**全部 9 个元素**：

| | k₁=[0,1] | k₂=[1,0] | k₃=[1,1] |
| --- | --- | --- | --- |
| q₁=[1,0] | 0 | 1 | 1 |
| q₂=[1,1] | 1 | 1 | 2 |
| q₃=[2,1] | 1 | 2 | 3 |

### 第 3 步：除以 √d_k

$\sqrt{d_k} = \sqrt{2} \approx 1.414$：

$$
\frac{S}{\sqrt{2}} = \begin{pmatrix}0&0.707&0.707\\0.707&0.707&1.414\\0.707&1.414&2.121\end{pmatrix}
$$

### 第 4 步：逐行 softmax

**第 1 行**：$e^{[0,\ 0.707,\ 0.707]} = [1,\ 2.028,\ 2.028]$，和 $= 5.056$ → $[0.198,\ 0.401,\ 0.401]$

**第 2 行**：$e^{[0.707,\ 0.707,\ 1.414]} = [2.028,\ 2.028,\ 4.113]$，和 $= 8.169$ → $[0.248,\ 0.248,\ 0.504]$

**第 3 行**：$e^{[0.707,\ 1.414,\ 2.121]} = [2.028,\ 4.113,\ 8.343]$，和 $= 14.484$ → $[0.140,\ 0.284,\ 0.576]$

$$
A = \begin{pmatrix}0.198&0.401&0.401\\0.248&0.248&0.504\\0.140&0.284&0.576\end{pmatrix}
$$

### 第 5 步：乘 V 得到输出

**output₁**：

$$
0.198\begin{pmatrix}1\\0\end{pmatrix} + 0.401\begin{pmatrix}0\\1\end{pmatrix} + 0.401\begin{pmatrix}1\\1\end{pmatrix} = \begin{pmatrix}0.198+0.401\\0.401+0.401\end{pmatrix} = \begin{pmatrix}0.599\\0.802\end{pmatrix}
$$

**output₂**：

$$
0.248\begin{pmatrix}1\\0\end{pmatrix} + 0.248\begin{pmatrix}0\\1\end{pmatrix} + 0.504\begin{pmatrix}1\\1\end{pmatrix} = \begin{pmatrix}0.752\\0.752\end{pmatrix}
$$

**output₃**：

$$
0.140\begin{pmatrix}1\\0\end{pmatrix} + 0.284\begin{pmatrix}0\\1\end{pmatrix} + 0.576\begin{pmatrix}1\\1\end{pmatrix} = \begin{pmatrix}0.716\\0.860\end{pmatrix}
$$

$$
O = \begin{pmatrix}0.599&0.802\\0.752&0.752\\0.716&0.860\end{pmatrix}
$$

输出形状与输入 $X$ 相同（都是 3×2）——Attention 不改变序列长度，也不改变（当 $d_v = d_{model}$ 时）特征维度。

:::demo attn-handcalc 交互：逐步验证上面的每一步
点「下一步」按第 0～5 步走完整个手算过程，每一步都显示矩阵、数字和计算说明。建议对照上面的手算过程核对。
:::

:::key 手算流程总结
$$
X \xrightarrow{\times W_Q, W_K, W_V} Q,K,V \xrightarrow{QK^\top} S \xrightarrow{\div\sqrt{d_k}} \text{scaled} \xrightarrow{\text{softmax}} A \xrightarrow{\times V} O
$$
每一步的形状：`(3,2) → (3,2) → (3,3) → (3,3) → (3,3) → (3,2)`
:::

## 7.13 公式 ↔ 代码逐行对应 ★

:::unfold 先懂直觉
数学公式和代码其实是同一件事的两种写法。这一节把 Attention 的公式逐行翻译成 PyTorch 代码，让你以后看到代码能想起公式、看到公式能写出代码。
:::

### 逐行对应表

| 公式 | 代码 | 说明 |
| --- | --- | --- |
| $X \in \mathbb R^{B\times S\times d}$ | `x` | 输入张量 |
| $Q = XW_Q$ | `Q = self.Wq(x)` | 线性投影（无 bias 时等价于 x @ Wq） |
| $K = XW_K$ | `K = self.Wk(x)` | 同上 |
| $V = XW_V$ | `V = self.Wv(x)` | 同上 |
| $QK^\top$ | `scores = Q @ K.transpose(-2, -1)` | 转置最后两维 |
| $\div \sqrt{d_k}$ | `scores = scores / math.sqrt(d_k)` | 缩放 |
| （可选）$+M$ | `scores = scores.masked_fill(mask, float("-inf"))` | causal/padding mask |
| $\text{softmax}(\cdot)$ | `A = F.softmax(scores, dim=-1)` | 逐行归一化 |
| $\times V$ | `out = A @ V` | 加权求和 |
| 拼接多头 + $W_O$ | `out = self.Wo(out)` | 多头输出投影 |

### 完整实现（逐行注释）

```python
import torch, torch.nn as nn
import torch.nn.functional as F
import math

class SelfAttention(nn.Module):
    def __init__(self, d_model, d_k):
        super().__init__()
        # 三套独立投影：W_Q, W_K, W_V
        self.Wq = nn.Linear(d_model, d_k, bias=False)   # 对应 Q = XW_Q
        self.Wk = nn.Linear(d_model, d_k, bias=False)   # 对应 K = XW_K
        self.Wv = nn.Linear(d_model, d_k, bias=False)   # 对应 V = XW_V

    def forward(self, x, causal=False):                  # x: [B, S, d_model]
        Q = self.Wq(x)                                   # [B, S, d_k]
        K = self.Wk(x)                                   # [B, S, d_k]
        V = self.Wv(x)                                   # [B, S, d_v]

        d_k = Q.size(-1)                                 # 缩放因子
        scores = Q @ K.transpose(-2, -1)                 # QKᵀ  → [B, S, S]
        scores = scores / math.sqrt(d_k)                 # 除以 √d_k

        if causal:                                       # 可选：因果掩码
            mask = torch.triu(torch.ones(scores.shape[-2:], device=x.device), 1).bool()
            scores = scores.masked_fill(mask, float("-inf"))   # 未来位置 = -∞

        A = F.softmax(scores, dim=-1)                    # 逐行 softmax → [B, S, S]
        return A @ V                                     # 加权求和 → [B, S, d_v]
```

### 对照手算例子验证代码

用 7.12 的数字跑一遍上面的代码（$B=1, S=3, d_k=2$），你会得到：

```
Q = [[1,0],[1,1],[2,1]]
K = [[0,1],[1,0],[1,1]]
V = [[1,0],[0,1],[1,1]]
scores（缩放后）= [[0,0.707,0.707],[0.707,0.707,1.414],[0.707,1.414,2.121]]
A = [[0.198,0.401,0.401],[0.248,0.248,0.504],[0.140,0.284,0.576]]
out = [[0.599,0.802],[0.752,0.752],[0.716,0.860]]
```

与手算结果完全一致 ✅——数学和代码是同一件事。

:::warning 常见误区
- **`transpose(-2, -1)` 不是 `transpose(0, 1)`**：前者只交换最后两维，对 batch 友好；后者会把 batch 也转掉。
- **`F.softmax(dim=-1)` 的维度必须写对**：写 `dim=1`（对 S 维）语义就错了。
- **mask 要在 softmax 之前加**，加在之后是无效的。
:::

## 7.14 Multi-Head Attention ★

:::unfold 先懂直觉
一组 Q/K/V 只能学到一种「关注模式」。多头就是并行做多组 Attention，每组把向量投影到更小的子空间，学习不同的关系（语法、指代、位置……），最后拼接融合。像多个专家从不同角度看同一句话。
:::

### 公式

$$
\text{head}_i = \text{Attention}\left(QW_i^Q,\; KW_i^K,\; VW_i^V\right)
$$

$$
\text{MHA}(X) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)\,W_O
$$

### 逐项拆解

| 符号 | 含义 | 形状 |
| --- | --- | --- |
| $h$ | head 数量 | 超参数（如 8、12、32） |
| $W_i^Q, W_i^K$ | 第 $i$ 个头的投影 | $[d_{model}, d_k]$，$d_k = d_{model}/h$ |
| $W_i^V$ | 第 $i$ 个头的 V 投影 | $[d_{model}, d_v]$，$d_v = d_{model}/h$ |
| $\text{head}_i$ | 第 $i$ 个头的输出 | $[B, S, d_v]$ |
| $\text{Concat}$ | 沿最后一维拼接 | $[B, S, h \cdot d_v] = [B, S, d_{model}]$ |
| $W_O$ | 输出投影 | $[d_{model}, d_{model}]$，融合各头信息 |

### 矩阵 shape（每个 head 的维度如何变化）

:::shapeflow
X [B, S, d_model] → 每个 head 独立投影 → headᵢ [B, S, d_v]（d_v = d_model/h）
head₁ … head_h 拼接 → [B, S, h·d_v] = [B, S, d_model]
× W_O [d_model, d_model] → 输出 [B, S, d_model]
:::

### 为什么不是「简单把 Attention 做很多遍」

| 对比 | 简单重复（同一组 Q/K/V 算 h 遍） | 真正的 Multi-Head |
| --- | --- | --- |
| 投影矩阵 | 同一组，每个头完全一样 | **每个头独立的 $W_i^Q, W_i^K, W_i^V$** |
| 结果 | h 个完全相同的结果，毫无意义 | 每个头学到不同的关注模式 |
| 子空间 | 同一个 | 不同的低维子空间 |
| 融合 | 无法融合 | Concat + $W_O$ 融合 |

**关键**：每个头有**独立的可学习参数**，所以会自发分化——有的头关注局部语法，有的关注指代，有的关注句首。

### 为什么每个 head 要降维

:::math 参数预算推导
设 $d_k = d_v = d_{model}/h$。

**单头（$d_k = d_{model}$）**的 Q/K/V 参数量：

$$
3 \times d_{model}^2
$$

**h 个头的 Q/K/V 参数量**（每个头 $3 \times d_{model} \times \frac{d_{model}}{h}$）：

$$
h \times 3 \times d_{model} \times \frac{d_{model}}{h} = 3 \times d_{model}^2
$$

**完全相同**。如果每个头不降维（$d_k = d_{model}$），参数量会变成 $h \times 3d_{model}^2$——涨 h 倍。

所以降维的目的：**在总参数量和总计算量不变的前提下，获得 h 个独立的表示子空间**。
:::

### 最小数字例子

设 $d_{model} = 4$，$h = 2$，则每个头的 $d_k = d_v = 2$。假设某个 token 两个头的输出分别是：

$$
\text{head}_1 = [0.6,\ 0.8], \qquad \text{head}_2 = [0.2,\ 0.5]
$$

拼接：

$$
\text{Concat} = [0.6,\ 0.8,\ 0.2,\ 0.5]
$$

再乘 $W_O$（$[4,4]$，这里取单位阵示意）得到该 token 的最终输出 $[0.6, 0.8, 0.2, 0.5]$。

:::demo mha 交互：4 个头的不同注意力模式
点击任意 head，观察它关注的模式（局部邻域、前一个词、自己、句首聚合）。真实模型的 head 会自发分化出更复杂的模式。
:::

:::fold 工程里怎么用（PyTorch 内置）
```python
mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
x = torch.randn(2, 10, 512)          # [B=2, S=10, d=512]
out, attn = mha(x, x, x)             # self-attention
print(out.shape)                     # [2, 10, 512]
print(attn.shape)                    # [2, 10, 10]（各头平均后的权重）
```
:::

:::warning 常见误区
- **多头不是把同一个 Attention 算 h 遍**：每个头有独立的投影参数。
- **参数量不是单头的 h 倍**：每个头维度缩小为 $1/h$，总量相近。
- **必须拼接后再过 $W_O$**：$W_O$ 负责融合各头信息，不能省。
- **所有头共享同一个输入 $X$**，只是投影不同。
:::

:::interview 面试常问
**Q1：Transformer 为何使用多头注意力？（为什么不使用一个头）**

:::answer
单个头只能学出一种注意力分布，把不同关系（语法、指代、位置）平均掉；多头在不同子空间并行学习多种关注模式，最后拼接融合，表达力更强。实验上删掉部分头会明显掉点。多头也提供了表示多样性。
:::

**Q2：为什么多头要对每个 head 降维？**

:::answer
保持总参数量和计算量与单头相当：h 个头各用 d_model/h 维时，Q/K/V 总参数 = 3·d_model²，与单头全维相同；不降维则参数和计算量涨 h 倍。降维让「多个子空间」几乎免费，只是把同样的预算拆开并行使用。
:::

**Q3：MHA、MQA、GQA 的区别？**

:::answer
MHA 每个 Q head 有独立 K/V；MQA 所有 Q 共享 1 组 K/V（KV Cache 最省，质量损失大）；GQA 分组共享（如 8 组），是质量与显存的折中，现代 LLM 主流（详见第 10 章）。
:::
:::

## 7.15 复杂度与工程延伸 ★

:::unfold 先懂直觉
Attention 的 $O(S^2)$ 是它的「原罪」：序列越长，平方级增长。围绕这个瓶颈，工业界发展出一整套优化技术。理解它们和 Attention 的关系，是走向 AI Infra 的必经之路。
:::

### 三个瓶颈与对应技术

| 瓶颈 | 问题 | 技术 | 是否改变 O(S²) |
| --- | --- | --- | --- |
| 推理重复计算 | 每生成一个 token 重算全部历史 K/V | **KV Cache** | 否（把每步从 O(S) 降到 O(1)，总计 O(S²)→O(S)） |
| KV Cache 显存 | 长序列 + 大 batch 时显存爆炸 | **GQA / MQA** | 否（KV 显存降到 1/4~1/32） |
| 注意力矩阵 IO | S×S 矩阵读写显存太慢 | **FlashAttention** | 否（不物化 S×S，靠分块 + 在线 softmax 优化 IO） |
| 长上下文计算量 | S² 本身太大 | 稀疏 / 线性 Attention | 是（降到 O(S·√S) 或 O(S)） |

### 逐项拆解

**KV Cache（推理）**：自回归生成时缓存历史 K/V，新 token 只算自己的——把生成 $n$ 个 token 的总计算量从 $O(n^2)$ 降到 $O(n)$。代价是显存随序列线性增长。

**GQA（显存）**：多个 Query head 共享一组 K/V head（如 32 Q 配 8 KV），KV Cache 直接降到 1/4。

**FlashAttention（IO）**：GPU 的瓶颈往往不是算力而是显存读写（HBM↔SRAM）。FlashAttention 把 Q/K/V 分块载入片上 SRAM，用「在线 softmax」逐步累积结果，**从不把完整的 S×S 矩阵写回显存**。结果：同样 $O(S^2)$ 复杂度，但显存占用从 $O(S^2)$ 降到 $O(S)$，速度大幅提升，且是**精确计算**不是近似。

:::warning 常见误区
- **FlashAttention 不改变 O(S²) 复杂度**：它优化的是 IO（显存读写），不是数学复杂度。
- **KV Cache 和 GQA 解决的是不同问题**：前者省计算，后者省显存（两者配合使用）。
- **稀疏/线性 Attention 才真正改变复杂度**，但通常有表达力损失，未被主流 LLM 全面采用。
:::

:::interview 面试常问
**Q：Attention 的 O(S²) 和 KV Cache / GQA / FlashAttention 是什么关系？**

:::answer
O(S²) 来自 S×S 分数矩阵。KV Cache 解决「推理重复计算」：缓存历史 K/V，生成 n 个 token 的总计算从 O(n²) 降到 O(n)；GQA 解决「KV Cache 显存」：多 Q head 共享 KV head，显存降到 1/4~1/32；FlashAttention 解决「注意力矩阵的显存 IO」：分块计算 + 在线 softmax，不物化 S×S 矩阵，显存从 O(S²) 降到 O(S)，但数学复杂度仍是 O(S²)。真正降低复杂度的是稀疏/线性 Attention。
:::
:::

## 7.16 Padding Mask：在 Attention 里怎么遮 PAD ★

:::unfold 先懂直觉
一个 batch 里句子长短不一，短的要用 PAD 补齐。这些 PAD 没有意义，如果参与注意力计算会污染真实 token 的表示，所以要在算分数时把它们遮掉。
:::

### 公式

$$
M_i = \begin{cases} 0, & \text{真实 token} \\ -\infty, & \text{PAD} \end{cases}, \qquad \text{scores} = \frac{QK^\top}{\sqrt{d_k}} + M
$$

### 逐项拆解

| 步骤 | 操作 | shape |
| --- | --- | --- |
| ① 构造 mask | 1 = 保留，0 = PAD | [B, S] |
| ② 广播 | 扩成 [B, 1, S]（多头的 [B, 1, 1, S]） | 广播到 [B, S, S] |
| ③ 加 mask | PAD 位置的分数变 −∞ | [B, S, S] |
| ④ softmax | PAD 位置权重变 0 | [B, S, S] |

### 数字算例

序列 `[CLS] my dog [SEP] PAD PAD`（S=6）：

```
mask = [1, 1, 1, 1, 0, 0]
```

某行原始分数 `[2, 1, 3, 2, 4, 5]`：

- **不加 mask**：softmax 后 PAD 位置（第 5、6 个）分别拿到约 21%、57% 的注意力——错误！模型会「关注空白」。
- **加 mask 后**：`[2, 1, 3, 2, −∞, −∞]` → softmax 只在真实 token 上分配权重，行和仍为 1。

### 与 Causal Mask 的区别

| | Padding Mask | Causal Mask |
| --- | --- | --- |
| 遮什么 | PAD 补齐位置 | 未来位置 |
| 形状 | [B, S]（广播） | [S, S] |
| 用在哪 | BERT / GPT 都需要 | 仅自回归模型（GPT） |
| 目的 | 排除无意义 token | 防止偷看答案 |

两者可以**同时使用**（GPT 的 batch 推理既有 padding 又需要 causal）。

:::fold 工程里怎么用（PyTorch / HuggingFace）
```python
# 方式一：masked_fill（True 的位置被填 -inf）
scores = scores.masked_fill(pad_mask[:, None, :] == 0, float("-inf"))

# 方式二：HuggingFace 的 attention_mask 约定（1 = 保留，0 = 遮住）
# model(input_ids, attention_mask=mask) 内部自动处理

# 注意：PyTorch nn.MultiheadAttention 的 attn_mask 约定是 True = 遮住（-inf）
```
:::

:::warning 常见误区
- **不同框架的 mask 约定相反**：HuggingFace 用 1=保留，PyTorch 的 `attn_mask` 用 True=遮住，写错会导致「只注意 PAD」。
- **padding mask 遮的是 key 维度**（哪些位置不能被关注）；query 位置的 PAD 输出是垃圾但会被忽略。
- **mask 必须在 softmax 之前加**。
:::

:::interview 面试常问
**Q：在计算 attention score 时如何对 padding 做 mask 操作？**

:::answer
构造 [B, S] 的 0/1 mask（1=真实 token，0=PAD），广播成 [B, 1, S]（多头再加 head 维），把 PAD 对应列的分数加上 −∞（或 masked_fill），再 softmax——PAD 权重为 0。注意不同框架约定不同：HuggingFace attention_mask 是 1=保留；PyTorch attn_mask 是 True=遮住。可与 causal mask 同时使用。
:::
:::

## 7.17 Causal Mask ★

:::unfold 先懂直觉
训练语言模型时，整句话都在手里。如果预测第 3 个词时模型能看到第 4 个词，它就「抄答案」了。所以把每个位置右边（未来）的注意力分数设为 −∞，softmax 后这些位置权重为 0。
:::

### 公式

$$
M_{ij} = \begin{cases} 0, & j \le i \\ -\infty, & j > i \end{cases}, \qquad \text{Attention} = \text{Softmax}\left(\frac{QK^\top}{\sqrt{d_k}} + M\right)V
$$

### 为什么填 −∞（而不是 0 或其他）

:::math 三个候选值都不行，只有 −∞ 可以
- **填 0**：softmax(0) = 正数权重，等于没遮；
- **填一个很大的负数**（如 −1e9）：数学上近似 −∞，工程上常用（避免 inf 运算问题），效果等价；
- **填 −∞**：$e^{-\infty} = 0$，权重严格为 0，这是数学上的精确做法。

**关键**：mask 必须加在 softmax **之前**，因为 softmax 是归一化操作——加在之后权重和就不为 1 了。
:::

### 矩阵 shape

$$
M \in \mathbb R^{S \times S}, \qquad \text{与分数矩阵同形状，直接相加}
$$

### 最小数字例子（三步变化）

**① 缩放后的分数**：

$$
\text{scaled} = \begin{pmatrix}0&0.707&0.707\\0.707&0.707&1.414\\0.707&1.414&2.121\end{pmatrix}
$$

**② 加 mask 后**（上三角变 $-\infty$）：

$$
S' = \begin{pmatrix}0&-\infty&-\infty\\0.707&0.707&-\infty\\0.707&1.414&2.121\end{pmatrix}
$$

**③ softmax 后**：

$$
A = \begin{pmatrix}1&0&0\\0.5&0.5&0\\0.140&0.284&0.576\end{pmatrix}
$$

验算第 2 行：$e^{0.707} = 2.028$，$e^{0.707} = 2.028$，未来是 0；归一化得 $[0.5, 0.5, 0]$ ✅

**含义**：token 1 只能看自己（权重 1.0），token 2 只能看 token1/2，token 3 可以看全部三个。

:::demo causal-mask 交互：三步看 mask 的作用
在「原始分数 → 加 mask → softmax 后」之间切换，观察上三角（未来）如何从数字变成 −∞ 再变成 0。
:::

### Decoder 自注意力 vs Encoder 自注意力

| | Encoder 自注意力 | Decoder 自注意力 |
| --- | --- | --- |
| Mask | 无（双向可见） | **Causal mask（只看左侧）** |
| 用途 | 理解输入 | 自回归生成 |
| 典型模型 | BERT | GPT |

:::fold 工程里怎么用（PyTorch）
```python
S = 4
mask = torch.triu(torch.ones(S, S), diagonal=1).bool()   # 上三角（不含对角线）
scores = scores.masked_fill(mask, float("-inf"))
attn = torch.softmax(scores, dim=-1)

# 内置写法：
# F.scaled_dot_product_attention(q, k, v, is_causal=True)
# nn.MultiheadAttention(..., is_causal=True)
```
:::

:::warning 常见误区
- **Causal Mask ≠ Padding Mask**：前者遮未来（S×S，与内容无关）；后者遮 PAD（B×S，与样本长度有关）。
- **Mask 必须加在 softmax 之前**。
- **推理时通常不需要 mask**：逐 token 生成时本来就没有未来 token。
- **不是把未来位置「删掉」**：是让权重为 0，矩阵形状不变（便于并行计算）。
:::

:::interview 面试常问
**Q1：为什么 Decoder 要 causal mask？**

:::answer
训练时并行计算所有位置的预测，每个位置都能看到整句输入。若不遮未来，位置 t 的预测会「看到」答案 x_{t+1}，等于作弊，学到的模型推理时无法工作。causal mask 保证位置 t 只能看到 ≤ t 的内容，使 teacher forcing 合法且可并行。
:::

**Q2：Mask 为什么填 −∞？**

:::answer
softmax 里 e^(−∞) = 0，权重严格为 0。填 0 不行（softmax(0) 仍是正权重）；工程上也常用很大的负数（如 −1e9）近似，效果等价。关键是 mask 必须加在 softmax 之前，否则归一化会破坏。
:::

**Q3：Decoder 自注意力和 Encoder 自注意力有什么区别？**

:::answer
结构相同（都是多头自注意力），唯一区别是 Decoder 加了 causal mask（只看到自己及之前），Encoder 无 mask（双向可见）。原因：Decoder 要自回归生成、不能偷看未来；Encoder 要理解全句。此外原始 Transformer 的 Decoder 还多一个 Cross-Attention 子层。
:::
:::

## 7.18 Cross-Attention ★

:::unfold 先懂直觉
Self-Attention 是「自己人内部交流」；Cross-Attention 是「Decoder 向 Encoder 提问」——Query 来自 Decoder（我在生成什么，想找什么信息），Key/Value 来自 Encoder（输入句子的每个位置能提供什么）。
:::

### 公式

$$
\text{CrossAttn} = \text{Attention}\left(Q_{dec},\ K_{enc},\ V_{enc}\right)
$$

### 逐项拆解

| 符号 | 来源 | 形状 |
| --- | --- | --- |
| $Q_{dec}$ | Decoder 当前状态投影 | $[B, S_{dec}, d_k]$ |
| $K_{enc}$ | Encoder 输出投影 | $[B, S_{enc}, d_k]$ |
| $V_{enc}$ | Encoder 输出投影 | $[B, S_{enc}, d_v]$ |
| 分数矩阵 | $Q_{dec} K_{enc}^\top$ | $[B, S_{dec}, S_{enc}]$ |
| 输出 | 加权后的 Encoder 信息 | $[B, S_{dec}, d_v]$ |

**注意**：分数矩阵不再是方阵——行数是 Decoder 长度，列数是 Encoder 长度。

### 矩阵 shape

:::shapeflow
Q_dec [B, S_dec, d_k] × K_encᵀ [B, d_k, S_enc] → scores [B, S_dec, S_enc]
scores → softmax → A [B, S_dec, S_enc]
A [B, S_dec, S_enc] × V_enc [B, S_enc, d_v] → 输出 [B, S_dec, d_v]
:::

### 数字算例（seq2seq 翻译）

Encoder 输入 `I love you`，Decoder 正在生成 `我 爱 你`：

| Decoder \ Encoder | I | love | you |
| --- | --- | --- | --- |
| 我 | **0.85** | 0.10 | 0.05 |
| 爱 | 0.05 | **0.90** | 0.05 |
| 你 | 0.05 | 0.10 | **0.85** |

生成「爱」时，权重集中在 `love`（0.90）——这就是模型学到的词对齐。输出 = $0.05 V_I + 0.90 V_{love} + 0.05 V_{you}$。

### seq2seq 里的 Attention 是怎么来的

在 Transformer 之前，seq2seq 用 RNN 做编码器和解码器，问题是「编码器把整句压成一个固定向量」，长句信息丢失。Bahdanau 等人提出：让解码器每生成一个词时，**回头查看编码器的所有位置**并加权取信息——这就是最早的 Attention。Transformer 把它推广成多头、可并行的 Cross-Attention。

:::demo cross-attention 交互：Decoder 看 Encoder 哪里
点击 Decoder 的每个 token，查看它给 Encoder 各位置的注意力权重。观察近似对齐现象。
:::

:::fold 工程里怎么用（PyTorch）
```python
cross_attn = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)

dec = torch.randn(2, 5, 512)    # Decoder 状态 [B, S_dec, d]
enc = torch.randn(2, 9, 512)    # Encoder 输出 [B, S_enc, d]

out, attn = cross_attn(query=dec, key=enc, value=enc)
print(out.shape)                # [2, 5, 512] —— 长度跟随 Decoder
print(attn.shape)               # [2, 5, 9]   —— 非方阵
```
:::

:::warning 常见误区
- **Q 来自 Decoder，K/V 来自 Encoder**——记反是最常见的错误。
- **输出长度 = Decoder 长度**，不是 Encoder 长度。
- **GPT 等 decoder-only 模型没有 Cross-Attention**：只有 Masked Self-Attention + FFN。
- **Cross-Attention 不需要 causal mask**：Encoder 是双向可见的，遮的是「输入」而不是「未来」。
:::

:::interview 面试常问
**Q1：Self-Attention 和 Cross-Attention 数据来源有什么区别？**

:::answer
Self-Attention 的 Q/K/V 都来自同一个序列（自己关注自己）；Cross-Attention 的 Q 来自 Decoder，K/V 来自 Encoder（关注输入序列）。前者分数矩阵是方阵 [B, S, S]，后者是 [B, S_dec, S_enc]。
:::

**Q2：Encoder 端和 Decoder 端是如何进行交互的？**

:::answer
通过 Cross-Attention：Decoder 每一层都有一个交叉注意力子层，用 Decoder 当前的隐藏状态生成 Query，用 Encoder 的输出生成 Key/Value，从而让解码器在生成每个 token 时「回头查看」输入序列的哪些位置最相关。这是 seq2seq（翻译、摘要）的核心机制；GPT 这类 decoder-only 模型把输入和输出拼成一个序列，用因果自注意力代替了 Cross-Attention。
:::
:::

## 7.19 残差连接（含 mask 泄露问题）★

:::unfold 先懂直觉
让网络学「在输入基础上加多少修正」，而不是「从头生成输出」。如果不需要修正，让 F(x)=0，信息原样通过——至少不会更差。而且反向传播时梯度有一条直通通道。
:::

### 公式

$$
y = x + F(x), \qquad \frac{\partial y}{\partial x} = 1 + \frac{\partial F}{\partial x}
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $x$ | 子层输入（也是残差旁路的输入） |
| $F(x)$ | 子层变换（Attention / FFN） |
| $1$ | 恒等通道的梯度——**与网络深度无关** |

### 数字算例

假设每层的「子层梯度因子」是 0.7：

| 层数 | 无残差：$0.7^n$ | 有残差：$1 + 0.7^n$ |
| --- | --- | --- |
| 1 | 0.700 | 1.700 |
| 4 | 0.240 | 1.240 |
| 12 | 0.014 | 1.014 |
| 24 | 0.0002 | 1.0002 |

无残差时 24 层后梯度几乎为 0；有残差时始终有 **1** 打底——这就是「梯度高速公路」。

:::demo residual 交互：有/无残差的梯度传播
拖动层数和每层因子，对比红色（无残差）和绿色（有残差）两条梯度曲线。
:::

### 解码端残差会不会泄露被 mask 的未来信息？（面试高频）

:::math 不会泄露，原因如下
Decoder 的残差是 $y = x + \text{Attn}(x)$。分两部分看：

1. **Attention 输出**：mask 加在 softmax 之前，未来位置的权重严格为 0，所以 $\text{Attn}(x)$ 只包含 ≤ t 的信息；
2. **残差旁路 $x$**：$x$ 本身是**上一层已经因果计算过的输出**，也只包含 ≤ t 的信息。

所以 $y$ 整体不含未来信息。**关键前提**：mask 必须在**每一层**都加。如果某一层忘了 mask，泄露会同时通过注意力输出和残差路径传播下去——所以实现上通常每层都传入同一个 causal mask。
:::

:::warning 常见误区
- **残差不是「把两层输出拼接」**：是逐元素相加，要求形状一致。
- **残差 ≠ Norm**：Add 和 Norm 是两个独立操作。
- **「残差会把原始输入带进未来」是错的**：原始输入本身就只包含当前及之前的位置。
:::

:::interview 面试常问
**Q1：残差结构的意义？**

:::answer
∂(x+F(x))/∂x = 1 + ∂F/∂x，恒等项 1 保证梯度至少能无衰减地传回前一层，缓解梯度消失；同时网络只需学习「残差修正」，学恒等映射变得容易（把 F 的权重推向 0 即可），使深层网络可训练。
:::

**Q2：解码端的残差结构会不会把被 mask 的未来信息带进来，造成泄露？**

:::answer
不会。残差 y = x + Attn(x) 中：Attn(x) 的 mask 加在 softmax 前，未来权重严格为 0；残差旁路 x 是上一层已因果计算的输出，也只含 ≤ t 的信息。前提是每一层都应用了 mask——若某层漏加，泄露会同时通过两条路径传播。这也是为什么实现上每层都传入同一 causal mask。
:::
:::

## 7.20 LayerNorm（为什么不用 BatchNorm）★

:::unfold 先懂直觉
深层网络的中间激活值尺度会漂移。LayerNorm 把**每个 token 自己的向量**「拉回」均值 0、方差 1，再用可学习的 γ、β 恢复表达能力。
:::

### 公式

$$
\text{LN}(x) = \gamma \cdot \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta
$$

### 逐项拆解

| 符号 | 含义 | 关键点 |
| --- | --- | --- |
| $\mu$ | 该 token 向量内的均值 | **不跨 token、不跨 batch** |
| $\sigma^2$ | 该 token 向量内的方差 | 同上 |
| $\gamma, \beta$ | 可学习的缩放、平移 | 让模型自己决定分布 |

### 数字算例（x = [1, 2, 3, 4]）

$$
\mu = 2.5, \quad \sigma^2 = 1.25, \quad \sigma \approx 1.118
$$

$$
\hat x \approx [-1.34,\ -0.45,\ 0.45,\ 1.34]
$$

:::demo layernorm 交互：逐步计算 LayerNorm
拖动向量分量和 γ、β，点「下一步」依次查看均值 → 标准差 → 标准化 → 缩放平移。
:::

### 为什么 Transformer 用 LN 不用 BN

| | BatchNorm | LayerNorm |
| --- | --- | --- |
| 统计维度 | 跨 batch（对每个特征） | 跨特征（对每个样本） |
| 依赖 batch size | 是（小 batch 不稳定） | 否 |
| 变长序列 | 不友好（PAD 干扰统计） | 友好 |
| 训练/推理 | 不一致（推理用 running stats） | 一致 |
| 适合场景 | CNN | NLP / Transformer |

### BatchNorm 及优缺点（面试常问）

**做法**：对一个 batch 内同一特征做标准化：$\hat x = \frac{x - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}$，再乘 γ 加 β。

| 优点 | 缺点 |
| --- | --- |
| 加速收敛，允许更大学习率 | 依赖 batch size，小 batch 效果差 |
| 缓解梯度消失/爆炸 | 变长序列中 PAD 会污染统计量 |
| 有正则化效果（batch 噪声） | 训练/推理不一致（需要 running stats） |
| 对初始化不敏感 | 不适合自回归/在线推理 |

### LayerNorm 在 Transformer 的位置

```
Post-Norm（原始）：x → Attention → Add → Norm
Pre-Norm（现代）：x → Norm → Attention → Add
```

Pre-Norm 的残差路径无归一化，梯度更容易传回浅层（见第 10 章）。

:::fold 工程里怎么用（PyTorch）
```python
ln = nn.LayerNorm(normalized_shape=512)   # 对最后一维做归一化
x = torch.randn(2, 10, 512)               # [B, S, d]
y = ln(x)                                 # 形状不变
```
:::

:::interview 面试常问
**Q1：为什么 Transformer 用 LayerNorm 而不是 BatchNorm？**

:::answer
BN 跨 batch 统计，依赖 batch size、对变长序列不友好（PAD 污染统计量）、训练/推理行为不一致；LN 对单个样本的 hidden 维统计，不依赖 batch、变长序列友好、训练推理一致。所以 NLP/Transformer 用 LN。
:::

**Q2：简单讲一下 BatchNorm 及优缺点？**

:::answer
对一个 batch 内同一特征做标准化（减均值除标准差）再乘 γ 加 β。优点：加速收敛、允许更大学习率、缓解梯度问题、有正则化效果、对初始化不敏感。缺点：依赖 batch size（小 batch 不稳定）、变长序列不友好、训练/推理不一致（需 running stats）、不适合自回归推理。
:::

**Q3：LayerNorm 在 Transformer 的位置？**

:::answer
原始 Transformer 用 Post-Norm：x = Norm(x + Sublayer(x))，归一化在残差之后；现代 LLM 用 Pre-Norm：x = x + Sublayer(Norm(x))，归一化在子层之前，残差路径干净、深层训练更稳，末尾再加一次 final norm。
:::
:::

## 7.21 FFN ★

:::unfold 先懂直觉
Attention 负责让 token 之间「交流信息」，但交流完还需要每个 token 自己「消化加工」。FFN 就是对每个位置**独立**做一次「升维 → 非线性 → 降维」。
:::

### 公式

$$
\text{FFN}(x) = W_2\,\sigma(W_1 x + b_1) + b_2
$$

### 逐项拆解与 shape

:::shapeflow
x [B, S, d_model] × W₁ [d_model, d_ff] → [B, S, d_ff]
激活 σ → [B, S, d_ff] × W₂ [d_ff, d_model] → [B, S, d_model]
:::

### 最小数字例子

取 $d_{model} = 2$，$d_{ff} = 4$，$x = [1, 0]$：

$$
xW_1 = [1\times1+0\times0,\ 1\times0+0\times1,\ 1\times1+0\times0,\ 1\times0+0\times1] = [1, 0, 1, 0]
$$

ReLU 后不变。乘 $W_2$ 后得到 $[2, 0]$——升维到 4、非线性加工、再降回 2。

:::demo ffn 交互：形状与参数量
调整 d_model 和扩展比，看 shape 流和参数量变化；切换 ReLU FFN 与 SwiGLU 对比。
:::

### 激活函数选择（面试常问）

| 激活函数 | 公式 | 优点 | 缺点 |
| --- | --- | --- | --- |
| ReLU（原始） | $\max(0,x)$ | 简单、快、不饱和 | 神经元死亡 |
| GELU（BERT/GPT-2） | $x\Phi(x)$ | 平滑、效果好 | 计算稍贵（含 erf） |
| SwiGLU（现代 LLM） | $\text{SiLU}(xW_1)\odot(xW_3)$ | 门控、质量最好 | 3 个矩阵，需把 d_ff 调成 8/3 d |

:::warning 常见误区
- **FFN 不混合 token**：逐 token 独立，token 间交换只由 Attention 完成。
- **FFN 参数量通常最大**：$2 \times d \times 4d = 8d^2$，Attention 约 $4d^2$。
- **中间层必须比输入宽**（升维）才有足够表达力。
:::

:::interview 面试常问
**Q：Transformer 中的 FFN 是什么？用了什么激活函数？优缺点？**

:::answer
FFN 是两个线性层夹一个激活：W₂σ(W₁x+b₁)+b₂，d_model → d_ff（通常 4d）→ d_model，对每个位置独立作用（不混合 token）。原始论文用 ReLU（简单快但可能死亡）；BERT/GPT-2 用 GELU（平滑、效果好但稍贵）；现代 LLM 用 SwiGLU（门控、质量最好，代价是 3 个矩阵，中间维取 8/3 d 保持参数量）。
:::
:::

## 7.22 训练 vs 推理（并行化）★

:::unfold 先懂直觉
训练时正确答案全都在手上，可以用 causal mask 一次并行算出所有位置的 loss；推理时没有答案，只能一个 token 一个 token 地生成。
:::

### 公式

**训练**（teacher forcing）：

$$
\mathcal L = -\frac{1}{S}\sum_{t=1}^{S} \log P_\theta(x_t \mid x_{<t})
$$

**推理**（自回归）：

$$
x_{t+1} \sim P_\theta(\cdot \mid x_1, \ldots, x_t)
$$

### 逐项拆解（并行化体现在哪）

| 环节 | 训练 | 推理 |
| --- | --- | --- |
| Encoder | 全部位置并行 | （无 Encoder 的模型跳过） |
| Decoder 自注意力 | **全部位置并行**（causal mask 保证合法） | 逐 token 串行 |
| Cross-Attention | 全部位置并行 | 逐 token |
| FFN | 全部位置并行 | 逐 token |

**结论**：训练时 token 维度完全并行（batch + 序列两个维度都能并行）；推理时序列维度天生串行，只能用 KV Cache 减少重复计算、用批处理提高 GPU 利用率。

### 数字算例

序列 `<BOS> I love AI`（4 个 token）：

| | 前向次数 | 说明 |
| --- | --- | --- |
| 训练 | **1 次** | 一次前向同时得到 3 个位置的预测，loss 一起回传 |
| 推理 | **3 次** | 第 1 次生成 I，第 2 次 love，第 3 次 AI |

:::demo train-vs-inference 交互：并行训练 vs 逐步推理
点击「运行训练」看一次前向并行点亮所有位置；点击「运行推理」看 token 一个接一个生成。
:::

:::fold 工程里怎么用（两段代码）
```python
# 训练：一次前向，所有位置并行算 loss（错位对齐）
logits = model(input_ids)                    # [B, S, V]
loss = F.cross_entropy(logits[:, :-1].reshape(-1, V), input_ids[:, 1:].reshape(-1))

# 推理：逐步生成
for _ in range(max_new_tokens):
    logits = model(idx)[:, -1, :]            # 只取最后一个位置
    next_id = sample(logits)
    idx = torch.cat([idx, next_id], dim=1)
```
:::

:::warning 常见误区
- **「自回归模型训练也慢」是错的**：训练时 teacher forcing + causal mask，所有位置并行。
- **推理时不用 causal mask，但结果等价**：因为没有未来 token 可看。
- **KV Cache 不改变串行性**：它只避免重算历史，每步仍要前向一次。
:::

:::interview 面试常问
**Q：Transformer 的并行化体现在哪里？Decoder 端可以做并行化吗？**

:::answer
并行化体现在：① Encoder 全部位置并行；② Decoder 在**训练时**借助 teacher forcing + causal mask，所有位置的预测一次前向并行计算（序列维度可并行）；③ 注意力/FFN 都是大矩阵乘法，天然适合 GPU。但 Decoder 在**推理时**必须逐 token 自回归生成，序列维度无法并行；只能靠 KV Cache 减少重复计算、batch 并行提高吞吐、投机解码等技巧缓解。
:::
:::

## 7.23 训练细节：学习率与 Dropout ★

:::unfold 先懂直觉
Transformer 训练有两个「祖传配方」：学习率用 warmup + 衰减（先热身再降温），Dropout 加在几处固定位置防止过拟合。面试问到「怎么训」时这两点必答。
:::

### 学习率设定（原始论文的 Noam 调度）

$$
\text{lr} = d_{model}^{-0.5} \cdot \min\left(\text{step}^{-0.5},\ \text{step} \cdot \text{warmup\_steps}^{-1.5}\right)
$$

| 阶段 | 行为 | 直觉 |
| --- | --- | --- |
| 前 warmup 步 | 线性增长 | 初期梯度不可靠，小步走 |
| 之后 | 按 step^-0.5 衰减 | 后期精细收敛 |

**现代 LLM** 常用 warmup + cosine decay 到峰值的 10%（见第 11 章），峰值 lr 约 1e-4 ~ 3e-4。

### Dropout 的位置（原始论文）

| 位置 | 作用 |
| --- | --- |
| ① Embedding + 位置编码之后 | 输入正则化 |
| ② 每个子层输出（残差相加之前） | 防止子层过拟合 |
| ③ 注意力权重矩阵上 | 随机丢弃部分注意力连接 |

现代 LLM 的 dropout 通常设得很小（0~0.1），大模型数据量极大时甚至不用 dropout。

### 测试时的注意事项

:::warning 常见误区
- **测试时必须关闭 Dropout**（`model.eval()`）：否则输出随机、不可复现。PyTorch 的 `nn.Dropout` 在 eval 模式下自动变成恒等映射。
- **推理时的输出是训练时期望的缩放版**：inverted dropout 在训练时就除以了保留概率，所以推理不需要额外缩放。
- **别忘了同时切 eval 的还有 BatchNorm**（用 running stats）——Transformer 一般没有 BN，但混合架构要注意。
:::

:::fold 工程里怎么用（PyTorch）
```python
model.train()   # 训练：开启 dropout
for batch in loader: ...

model.eval()    # 推理/验证：关闭 dropout
with torch.no_grad():
    logits = model(x)
```
:::

:::interview 面试常问
**Q：Transformer 训练的学习率和 Dropout 怎么设定？测试时注意什么？**

:::answer
学习率：原始论文用 Noam 调度（warmup 线性升 + step^-0.5 衰减）；现代 LLM 用 warmup + cosine decay 到峰值 10%，峰值 1e-4~3e-4。Dropout：原论文 0.1，加在 embedding 后、每个子层输出（残差相加前）、注意力权重上；现代大模型常设 0~0.1。测试时必须 model.eval() 关闭 dropout，否则输出随机、不可复现。
:::
:::

## 7.24 面试题库：39 问速查 ★

> 下面把本章涉及的全部高频问题集中列出（编号沿用课件题库，跳过原资料缺失的第 18 题之外的编号说明）。每题答案默认折叠，先自己想，再点开对照。

:::interview A 组：Attention 基础（Q1–Q10）

**Q1：为什么需要 Attention？RNN 和 CNN 不够吗？**

:::answer
RNN 串行计算、长距离依赖要 O(S) 步传递且梯度易消失；CNN 感受野有限。Attention 让任意两位置一步直接交互（路径 O(1)）且完全可并行，这是它取代 RNN 的根本原因。
:::

**Q2：Q、K、V 到底是什么？**

:::answer
Q=查询（我想找什么），K=键（我的标签是什么），V=值（我能提供什么内容）。三者都由输入 X 经三套不同权重投影得到：Q=XW_Q，K=XW_K，V=XW_V。
:::

**Q3：为什么需要三套不同的投影矩阵？**

:::answer
三套投影让模型分别学习「如何提问」「如何打标签」「如何提供内容」，表达力远强于固定点积；也让注意力矩阵不被强制对称（见 Q22）。
:::

**Q4：QKᵀ 为什么能表示相关性？**

:::answer
点积 q·k=|q||k|cosθ 衡量方向一致性，越对齐分数越高。由于 Q/K 是学出来的投影，模型学到的是任务相关的匹配度量。
:::

**Q5：QKᵀ 的每个元素是什么？**

:::answer
S_ij = q_i·k_j，即第 i 个 token 的 Query 与第 j 个 token 的 Key 的点积，表示「token i 觉得 token j 有多相关」的原始分数（logit）。
:::

**Q6：attention matrix 为什么是 seq_len × seq_len？**

:::answer
因为要对每一对 (query, key) 打分：行 = query 位置，列 = key 位置，共 S×S 个元素。这也是 O(S²) 复杂度的来源。
:::

**Q7：为什么除 √d_k？**

:::answer
q·k 是 d_k 个独立项之和，方差为 d_k、标准差 √d_k。不缩放则分数随 d_k 增大，softmax 饱和成 one-hot、梯度消失。除以 √d_k 把方差归一到 1。（不是除以 d_k——那会过度缩小。）
:::

**Q8：Softmax 是对哪一个维度做？**

:::answer
最后一维 dim=-1（key 的位置）。每行是一个 query 对所有 key 的注意力分布，行和为 1。写错维度语义完全错误。
:::

**Q9：为什么最终乘 V 而不是 K？**

:::answer
K 是用于匹配的标签投影，V 是用于传递的内容投影。Attention 要按相关性提取内容，所以用权重混合 V。用 K 会把标签当内容，语义错误。
:::

**Q10：一个 token 的最终输出为什么是所有 Value 的加权和？**

:::answer
softmax 保证每行权重非负且和为 1，所以 A·V 的每一行是 V 的凸组合（加权平均）——软选择，允许同时参考多个位置，且可导。
:::
:::

:::interview B 组：位置编码与顺序（Q11–Q12, Q28–Q30）

**Q11：Self-Attention 为什么本身没有顺序？**

:::answer
Attention 是对所有位置做加权求和，输出对输入的置换等变（Attn(PX)=P·Attn(X)）——打乱输入只是打乱输出，模型学不到顺序概念。
:::

**Q12：Positional Encoding 如何弥补？**

:::answer
把位置信息加到输入上：Input = TokenEmbedding×√d_model + PositionalEncoding。这样同一个词在不同位置得到不同的输入向量，Attention 就能区分顺序。现代 LLM 用 RoPE 旋转 Q/K。
:::

**Q28：为何在获取输入词向量之后需要对矩阵乘以 embedding size 的开方（√d_model）？意义是什么？**

:::answer
让 embedding 与位置编码尺度相当。embedding 各维方差若为 1/d_model，数值尺度小于位置编码（[-1,1]）；乘 √d_model 后方差归一到 1，两者量级匹配，相加时不会一方主导。现代实现也常用 embedding 后接 RMSNorm 达到同样目的。
:::

**Q29：位置编码有什么意义和优缺点？**

:::answer
意义：给无序的 Attention 注入位置信息。Sinusoidal 优点：无参数、理论可外推；缺点：不可学习、绝对位置、实际外推有限。现代 LLM 多用 RoPE。
:::

**Q30：还了解哪些位置编码技术？**

:::answer
① 可学习绝对（BERT）：简单但不能外推；② 相对位置（Shaw/T5 bias）：建模 i−j 偏移，泛化好但复杂；③ RoPE：旋转 Q/K，相对位置 + 外推好，现代主流；④ ALiBi：线性距离惩罚，外推极强但表达力略弱。
:::
:::

:::interview C 组：多头与复杂度（Q13–Q14, Q18–Q21, Q23–Q26）

**Q13：Multi-Head 为什么不是简单把 Attention 做很多遍？**

:::answer
每个头有独立的投影矩阵（W_i^Q/W_i^K/W_i^V），在不同子空间学习不同关注模式；简单重复同一组 Q/K/V 会得到完全相同的结果，毫无意义。最后 Concat + W_O 融合。
:::

**Q14：每个 head 的维度如何变化？**

:::answer
每个头 d_k = d_v = d_model/h。h 个头拼接后回到 d_model，再经 W_O（d_model×d_model）输出，形状与输入一致。
:::

**Q18：Attention 的计算复杂度为什么是 O(S²)？**

:::answer
分数矩阵有 S² 个元素，每个是一次 d 维点积，乘 V 和 softmax 也是 O(S²d)。总时间 O(S²d)，空间 O(S²)（存分数矩阵）。
:::

**Q19：seq_len 翻倍时 attention matrix 为什么变 4 倍？**

:::answer
矩阵元素数 = S²，S 翻倍后 (2S)²=4S²，元素数变 4 倍，时间和显存都如此。
:::

**Q20：这和 KV Cache / GQA / FlashAttention 有什么关系？**

:::answer
KV Cache：推理时缓存历史 K/V，把生成 n 个 token 的总计算从 O(n²) 降到 O(n)（省计算，花显存）。GQA：多 Q head 共享 KV head，把 KV Cache 显存降到 1/4~1/32。FlashAttention：分块 + 在线 softmax，不物化 S×S 矩阵，显存从 O(S²) 降到 O(S)，但复杂度仍是 O(S²)。真正降复杂度的是稀疏/线性 Attention。
:::

**Q21：Transformer 为何使用多头注意力？（为什么不使用一个头）**

:::answer
单头只能学出一种注意力分布，会平均掉不同关系；多头在不同子空间并行学习多种模式（语法、指代、位置），拼接后表达力更强。实验证明删头会掉点。
:::

**Q23：为什么点乘而不是加法注意力？**

:::answer
点乘可用高度优化的 GEMM，GPU 上快一个量级、显存友好；加性需要额外 MLP + tanh，逐元素操作多、利用率低。效果上点乘配 √d_k 缩放后与加性相当。
:::

**Q24：为什么 attention 要 scaled？请推导。**

:::answer
设 q、k 各维独立、均值 0、方差 1，则 q·k=Σqᵢkᵢ 的方差为 d_k、标准差 √d_k。分数过大会让 softmax 饱和（输出接近 one-hot，雅可比≈0，梯度消失）。除以 √d_k 把方差归一到 1。
:::

**Q25：计算 attention score 时如何对 padding 做 mask？**

:::answer
构造 [B,S] 的 0/1 mask，广播成 [B,1,S]（多头 [B,1,1,S]），把 PAD 列的分数设 −∞ 后 softmax → PAD 权重为 0。注意框架约定：HuggingFace 是 1=保留，PyTorch attn_mask 是 True=遮住。可与 causal mask 叠加。
:::

**Q26：为什么多头要对每个 head 降维？**

:::answer
保持总参数量和计算量与单头相当：h 个头各 d_model/h 维时，Q/K/V 总参数 = 3·d_model²，与单头全维相同；不降维则参数和计算涨 h 倍。降维让「多子空间」几乎免费。
:::
:::

:::interview D 组：Mask、Cross-Attention 与架构（Q15–Q17, Q27, Q31–Q37）

**Q15：为什么 Decoder 要 causal mask？**

:::answer
训练时并行算所有位置，若不遮未来，位置 t 的预测会看到答案 x_{t+1}（作弊），推理时模型无法工作。mask 保证位置 t 只能看 ≤t 的内容，使 teacher forcing 合法且可并行。
:::

**Q16：Mask 为什么填 −∞？**

:::answer
e^(−∞)=0，权重严格为 0；填 0 无效（softmax(0) 仍是正权重）。工程上也常用 −1e9 近似。关键是加在 softmax 之前。
:::

**Q17：Self-Attention 和 Cross-Attention 数据来源有什么区别？**

:::answer
Self：Q/K/V 都来自同一序列，分数矩阵方阵 [B,S,S]；Cross：Q 来自 Decoder，K/V 来自 Encoder，分数矩阵 [B,S_dec,S_enc]。
:::

**Q27：讲一下 Encoder 模块？**

:::answer
N 个相同层堆叠，每层：① 双向多头自注意力；② FFN；每个子层外包「残差 + LayerNorm」。输入输出形状不变 [B,S,d_model]，输出作为 Decoder 交叉注意力的 K/V。
:::

**Q31：残差结构及意义？**

:::answer
y=x+F(x)，∂y/∂x=1+∂F/∂x 中的常数 1 提供无损梯度通道，缓解梯度消失；同时网络只需学「修正量」，学恒等映射容易，使深层网络可训练。
:::

**Q32：为什么用 LayerNorm 而不是 BatchNorm？LayerNorm 在哪？**

:::answer
BN 跨 batch 统计、依赖 batch size、变长序列不友好、训练/推理不一致；LN 对单样本 hidden 维统计，不依赖 batch、训练推理一致。位置：原始用 Post-Norm（残差后），现代用 Pre-Norm（子层前）+ final norm。
:::

**Q33：简单讲一下 BatchNorm 及优缺点？**

:::answer
对 batch 内同一特征标准化再乘 γ 加 β。优点：加速收敛、允许大 lr、缓解梯度问题、有正则效果、对初始化不敏感。缺点：依赖 batch size、变长序列不友好、训练/推理不一致、不适合自回归推理。
:::

**Q34：FFN 是什么？用什么激活函数？优缺点？**

:::answer
W₂σ(W₁x+b₁)+b₂，d→4d→d，逐位置独立（不混合 token）。ReLU（简单快，可能死亡）；GELU（平滑效果好，稍贵）；SwiGLU（门控质量最好，3 矩阵，中间维 8/3 d）。
:::

**Q35：Encoder 和 Decoder 如何交互？（seq2seq attention）**

:::answer
通过 Cross-Attention：Decoder 用当前状态生成 Q，用 Encoder 输出生成 K/V，每生成一个 token 时「回头查看」输入序列的相关位置。这是 Bahdanau 注意力的推广，是翻译/摘要等 seq2seq 任务的核心。GPT 类模型把输入输出拼成一个序列，用因果自注意力替代 Cross-Attention。
:::

**Q36：Decoder 自注意力和 Encoder 自注意力有什么区别？**

:::answer
结构相同，唯一区别是 Decoder 加 causal mask（只看左侧），Encoder 双向可见。原因：Decoder 自回归生成不能偷看未来；Encoder 要理解全句。Decoder 还多一个 Cross-Attention 子层。
:::

**Q37：Transformer 的并行化体现在哪里？Decoder 端能并行吗？**

:::answer
并行化：Encoder 全部位置并行；Decoder 训练时靠 teacher forcing + causal mask 全位置并行；所有子层都是大矩阵乘法。但 Decoder 推理时必须逐 token 串行，只能用 KV Cache、批处理、投机解码等缓解。
:::
:::

:::interview E 组：训练细节与泄露问题（Q39–Q40）

**Q39：学习率如何设定？Dropout 如何设定、位置在哪？测试注意什么？**

:::answer
学习率：原论文 Noam 调度（warmup + step^-0.5 衰减）；现代用 warmup + cosine 到峰值 10%，峰值 1e-4~3e-4。Dropout：0.1，加在 embedding 后、每个子层输出（残差相加前）、注意力权重上；现代大模型 0~0.1。测试时 model.eval() 关闭 dropout，否则输出随机。
:::

**Q40：解码端残差会不会把 mask 掉的未来信息带进来造成泄露？**

:::answer
不会。y = x + Attn(x)：Attn(x) 的 mask 加在 softmax 前，未来权重严格为 0；残差旁路 x 是上一层已因果计算的输出，也只含 ≤t 的信息。前提是每层都应用了 mask——漏掉任何一层，泄露会同时通过注意力输出和残差路径传播。
:::
:::

## 7.25 全章总结

:::key 本节必须记住
| 组件 | 一句话 | 关键 shape |
| --- | --- | --- |
| 为什么 Attention | 任意两位置一步交互 + 完全并行 | — |
| Self-Attention | 按相关性加权平均，$O(S^2d)$ | 输出 (B, S, d_v) |
| Q/K/V | 问什么 / 标签是什么 / 内容是什么 | Q,K (B,S,d_k)，V (B,S,d_v) |
| 为什么 Q≠K 投影 | 打破对称性、角色分离 | — |
| QKᵀ | 每个元素 S_ij = q_i·k_j | (B, S, S) |
| 点乘 vs 加法 | 点乘快、配合缩放效果相当 | — |
| √d_k | 方差归一到 1，防 softmax 饱和 | 形状不变 |
| Softmax | 逐行（dim=-1）归一化 | (B, S, S)，行和 1 |
| V 加权 | 输出 = Σ 权重 × V（凸组合） | (B, S, d_v) |
| Multi-Head | 多子空间并行，各头降维到 d/h | 回到 (B, S, d_model) |
| O(S²) | S×S 分数矩阵；翻倍变 4 倍 | — |
| KV Cache / GQA / FlashAttention | 省计算 / 省显存 / 省 IO，都不改 O(S²) | — |
| Padding Mask | 遮 PAD，[B,S] 广播 | — |
| Causal Mask | 遮未来，softmax 前加 −∞ | (S, S) |
| Cross-Attention | Q 来自 Decoder，K/V 来自 Encoder | (B, S_dec, S_enc) |
| 残差 | y = x + F(x)，梯度含常数 1；不泄露未来 | 形状一致 |
| LayerNorm | 每 token hidden 维归一化；不用 BN | 形状不变 |
| FFN | 逐 token d → 4d → d | 不混合 token |
| 训练 vs 推理 | 训练并行，推理串行（KV Cache 缓解） | [B,S,V] vs [B,V] |
| 学习率/Dropout | warmup+decay；dropout 0.1 三处；测试 eval | — |
:::

:::quiz
Self-Attention 中 QKᵀ 得到的矩阵形状是？

A. [B, S, d_k]
B. [B, S, S]
C. [B, d_k, d_k]
D. [S, d_k]

答案: B
解析: Q 是 [B,S,d_k]，Kᵀ 是 [B,d_k,S]，相乘得 [B,S,S]。第 i 行第 j 列是 token i 对 token j 的匹配分数。
:::

:::quiz
Attention 的 softmax 应该对哪个维度做？

A. dim=0（batch）
B. dim=-1（每个 query 的所有 key）
C. dim=-2（key 的位置）
D. 对整张矩阵一起做

答案: B
解析: 分数矩阵 [B,S,S]，最后一维是 key 的位置。对 dim=-1 归一化 = 每个 query 对所有 key 的权重和为 1。
:::

:::quiz
如果 d_k 很大但不做缩放，最可能发生什么？

A. 训练变快
B. softmax 输出接近 one-hot，梯度消失
C. 模型参数量爆炸
D. 位置信息丢失

答案: B
解析: 点积方差随 d_k 线性增长，分数过大使 softmax 饱和成近似 one-hot，其雅可比趋近 0，梯度消失。除以 √d_k 把方差归一到 1。
:::

:::quiz
为什么 Q 和 K 不能直接用 X·Xᵀ（用同一套表示）？

A. 计算太慢
B. 注意力矩阵会被强制对称，无法表达方向性关系
C. 会导致梯度爆炸
D. 参数量太大

答案: B
解析: X·Xᵀ 恒为对称矩阵（S_ij = S_ji），「it 关注 animal」和「animal 关注 it」权重被迫相同。分开投影让模型学出非对称的双线性形式，表达方向性关系。
:::

:::quiz
Multi-Head Attention 中每个 head 的维度通常是？

A. d_model
B. d_model / h
C. d_model × h
D. 固定 64，与 d_model 无关

答案: B
解析: 每个 head 的 d_k = d_v = d_model/h，这样 h 个头拼接后恰好回到 d_model，总参数量与单头相当。
:::

:::quiz
关于 FlashAttention，说法正确的是？

A. 把复杂度降到了 O(S)
B. 通过分块和在线 softmax 避免物化 S×S 矩阵，优化显存 IO
C. 是一种近似注意力
D. 只在训练时可用

答案: B
解析: FlashAttention 是精确计算，不改变 O(S²) 复杂度，但把 S×S 矩阵的显存读写从 HBM 移到片上 SRAM，显存占用从 O(S²) 降到 O(S)，速度大幅提升。
:::

:::quiz
解码端的残差连接会不会把被 mask 的未来信息带进当前表示？

A. 会，因为残差直接加了原始输入
B. 不会，因为注意力输出已 mask 且残差旁路也是因果计算的
C. 会，但影响很小
D. 只有训练时会

答案: B
解析: y = x + Attn(x)：Attn(x) 的未来权重严格为 0；x 是上一层已因果计算的输出，只含 ≤t 的信息。前提是每层都应用 mask。
:::

:::quiz
GPT 训练时可以一次前向算出所有位置的 loss，靠的是什么？

A. KV Cache
B. causal mask 保证每个位置只能看到自己及之前
C. 模型参数少
D. Top-P 采样

答案: B
解析: teacher forcing 下标签全部已知；causal mask 遮住未来位置，使位置 t 的预测在数学上合法（只依赖 x_{≤t}），因此可以并行计算所有位置的 loss。
:::

:::related
依赖 | Embedding, Softmax, 残差连接, LayerNorm
用于 | BERT, GPT, 现代 LLM 架构, KV Cache, FlashAttention
:::

