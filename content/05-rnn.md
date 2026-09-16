> **本章对应课件**：《1.5 循环神经网络》。核心内容：RNN 的隐藏状态与参数共享、长程依赖问题、LSTM 三门一状态、GRU、Deep RNN，以及为什么 Transformer 最终取代了 RNN。

## 5.1 为什么需要 RNN

:::unfold 先懂直觉
语言是有顺序的。「我打他」和「他打我」用词完全相同，意思相反。普通 MLP 把输入当固定向量，无法表达顺序和变长序列。RNN 的思路很朴素：**维护一个「记忆」向量，每读一个词就更新一次记忆。**
:::

普通 MLP 的输入是固定长度的向量；但文本、语音、时间序列都是**变长序列**：

```
我 / 今天 / 非常 / 开心
```

而且顺序至关重要：

```
狗 咬 人   ≠   人 咬 狗
```

所以 RNN 引入 **hidden state（隐藏状态）** $h_t$：

$$
h_t = \phi\left(W_{xh}x_t + W_{hh}h_{t-1} + b\right)
$$

当前状态由两部分决定：

- 当前输入 $x_t$；
- 过去的记忆 $h_{t-1}$。

$\phi$ 通常是 tanh。展开来看：

```
x₁ → h₁ → x₂ → h₂ → x₃ → h₃
```

:::shapeflow
xₜ [B, d_in] × W_xh [d_in, d_h] → [B, d_h]
hₜ₋₁ [B, d_h] × W_hh [d_h, d_h] → [B, d_h]
两者相加 + b → hₜ [B, d_h] 经 tanh
:::

## 5.2 参数共享：RNN 最重要的设计 ★

:::unfold 先懂直觉
RNN 在所有时间步使用**同一组参数**。这样参数量与序列长度无关，而且同一个模式（如「主谓一致」）无论出现在句子的哪个位置都能被识别。
:::

不同时间步**不是**用 $W_1, W_2, W_3, \ldots$，而是**同一个 $W$ 反复使用**：

$$
h_1 = f(x_1, h_0; W), \qquad h_2 = f(x_2, h_1; W), \qquad h_3 = f(x_3, h_2; W)
$$

否则序列长度 100 就要 100 套参数——不仅参数量爆炸，短序列上学的模式也无法迁移到长序列。

:::demo rnn-unroll 交互：RNN 按时间展开
点击「下一步」，看隐藏状态如何随时间的箭头一步步传递；点击「显示参数共享」，看每个时间步用的是不是同一组 W、U。
:::

:::fold 工程里怎么用（PyTorch nn.RNN）
```python
import torch, torch.nn as nn

rnn = nn.RNN(input_size=4, hidden_size=8, batch_first=True)
x = torch.randn(3, 5, 4)          # [batch=3, seq_len=5, d_in=4]
h0 = torch.zeros(1, 3, 8)         # 初始隐藏状态 [num_layers, batch, hidden]

out, hn = rnn(x, h0)
print(out.shape)   # [3, 5, 8]  每个时间步的隐藏状态
print(hn.shape)    # [1, 3, 8]  最后一个时间步的隐藏状态
```
`out[:, -1, :]` 常接分类头（many-to-one 任务）。
:::

:::warning 常见误区
- **参数共享 ≠ 状态共享**：共享的是 $W$，每个时间步的 $h_t$ 是不同的。
- **h₀ 通常初始化为 0 向量**（或让框架默认处理）。
:::

## 5.3 RNN 的任务类型

| 类型 | 结构 | 例子 | 输出取哪个位置 |
| --- | --- | --- | --- |
| One-to-one | 单输入单输出 | 普通分类（非序列） | — |
| One-to-many | 单输入多输出 | 一张图片 → 一句话 | 每个时间步都输出 |
| Many-to-one | 多输入单输出 | 一句话 → 情感分类 | 最后一个 $h_T$ |
| Many-to-many | 多输入多输出 | 机器翻译、序列标注 | 每个时间步都输出 |

机器翻译（many-to-many，长度可不同）：

```
I love you  →  我 爱 你
```

序列标注：

```
小明 / 去 / 北京
PER    O   LOC
```

## 5.4 长程依赖：RNN 的致命问题 ★

:::unfold 先懂直觉
RNN 的记忆靠「每一步都乘一次矩阵」传递。梯度反向传播时沿时间连乘，很容易指数衰减（梯度消失）或指数爆炸（梯度爆炸），所以很难记住几十步之前的信息。
:::

看这个例子：

> 我出生在**法国**……（中间隔了 100 个 token）……所以我会说流利的 ____。

模型需要记住 100 步前的「法国」。但普通 RNN 的梯度在时间维度连续相乘：

$$
\frac{\partial L}{\partial h_1} = \frac{\partial L}{\partial h_T} \prod_{t=2}^{T} \frac{\partial h_t}{\partial h_{t-1}}
$$

如果每个 $\frac{\partial h_t}{\partial h_{t-1}}$ 的谱半径小于 1，连乘 100 次后梯度趋近 0——**梯度消失**；大于 1 则爆炸。这与第 4 章深层网络的梯度问题同源，只是「深度」变成了时间步数。

:::demo vanishing-exploding 复习：连乘的威力
回到第 4 章的演示：0.8 连乘 100 次 ≈ 2×10⁻¹⁰，1.5 连乘 100 次 ≈ 4×10¹⁷。RNN 的 BPTT 就是这种连乘结构。
:::

:::math BPTT（时间反向传播）为什么危险
$$
\frac{\partial h_t}{\partial h_{t-1}} = \text{diag}\left(\phi'(\cdot)\right) W_{hh}
$$

每步都要乘一次 $W_{hh}$（矩阵）和一个导数对角阵。设 $W_{hh}$ 最大奇异值为 $\sigma$，则 $T$ 步后梯度幅度约为 $\sigma^T$：

- $\sigma < 1$ → 指数衰减（记不住远处）
- $\sigma > 1$ → 指数爆炸（训练不稳定，需要梯度裁剪）

这就是 LSTM 出现的重要原因：用「加法」而非「连乘」来更新记忆。
:::

:::interview 面试常问
**Q1：RNN 为什么会有梯度消失？和普通深层网络有什么区别？**

:::answer
本质相同，都是链式连乘。区别是 RNN 的连乘发生在**时间维度**（同一组 W 被反复使用），所以序列越长越严重；深层网络发生在**层维度**。此外 RNN 的梯度同时受 W_hh 的谱半径和激活函数导数影响。
:::

**Q2：梯度爆炸怎么缓解？**

:::answer
梯度裁剪（gradient clipping）：`torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)`，把梯度范数限制在阈值内。梯度消失则靠 LSTM/GRU 的门控机制、残差连接等结构解决。
:::
:::

## 5.5 LSTM：门控与 Cell State ★

:::unfold 先懂直觉
LSTM 给 RNN 加了一条「记忆高速公路」——Cell State $C_t$，再用三个「门」（sigmoid 输出 0~1 的开关）控制：忘掉多少旧记忆、写入多少新记忆、暴露多少给输出。关键在于记忆更新是**加法**，梯度可以沿高速公路无损流动。
:::

LSTM 有两个核心状态：

- $h_t$：hidden state（对外输出）；
- $C_t$：cell state（长期记忆）。

可以把 $C_t$ 理解为**长期记忆高速公路**。三个门都用 sigmoid（输出 0~1）控制信息流量。

:::demo lstm 交互：三个门如何控制记忆
点击「遗忘门 / 输入门 / 输出门」按钮高亮对应路径；拖动 fₜ、iₜ 滑块，观察 Cₜ = fₜ⊙Cₜ₋₁ + iₜ⊙C̃ₜ 中旧记忆与新记忆如何混合。
:::

### 逐项拆解：四个门与两个状态

| 部件 | 公式 | 权重 shape | 激活 | 作用 |
| --- | --- | --- | --- | --- |
| 遗忘门 $f_t$ | $\sigma(W_f x_t + U_f h_{t-1} + b_f)$ | $W_f [d_{in}, d_h]$，$U_f [d_h, d_h]$ | sigmoid → (0,1) | 旧记忆保留多少 |
| 输入门 $i_t$ | $\sigma(W_i x_t + U_i h_{t-1} + b_i)$ | 同上 | sigmoid → (0,1) | 新记忆写入多少 |
| 候选记忆 $\tilde C_t$ | $\tanh(W_c x_t + U_c h_{t-1} + b_c)$ | 同上 | tanh → (−1,1) | 新记忆的「内容」 |
| 输出门 $o_t$ | $\sigma(W_o x_t + U_o h_{t-1} + b_o)$ | 同上 | sigmoid → (0,1) | 暴露多少记忆给 $h_t$ |
| Cell state $C_t$ | $f_t \odot C_{t-1} + i_t \odot \tilde C_t$ | — | — | 长期记忆（加法更新） |
| Hidden state $h_t$ | $o_t \odot \tanh(C_t)$ | — | — | 对外输出 |

**注意**：门用 sigmoid（0~1 的开关），内容用 tanh（−1~1 的信号）——这个分工是 LSTM 的设计核心。

:::shapeflow
xₜ [B, d_in] 与 hₜ₋₁ [B, d_h] 拼接 → 四个门的线性变换 [B, 4·d_h]
σ / tanh → fₜ, iₜ, oₜ, C̃ₜ [B, d_h]
Cₜ = fₜ ⊙ Cₜ₋₁ + iₜ ⊙ C̃ₜ → [B, d_h]
hₜ = oₜ ⊙ tanh(Cₜ) → [B, d_h]
:::

### 最小数字例子（单维标量）

设 $C_{t-1} = 0.8$，$\tilde C_t = 1.0$，$f_t = 0.7$，$i_t = 0.4$，$o_t = 0.5$：

**记忆更新**：

$$
C_t = f_t \odot C_{t-1} + i_t \odot \tilde C_t = 0.7 \times 0.8 + 0.4 \times 1.0 = 0.56 + 0.40 = 0.96
$$

含义：旧记忆保留了 70%（0.56），新记忆写入了 0.40，最终记忆 0.96。

**输出**：

$$
h_t = o_t \odot \tanh(C_t) = 0.5 \times \tanh(0.96) \approx 0.5 \times 0.744 = 0.372
$$

如果 $f_t = 0.1$（几乎遗忘）：$C_t = 0.08 + 0.4 = 0.48$，记忆大幅刷新；如果 $i_t = 0$（拒绝新信息）：$C_t = 0.56$，完全靠旧记忆维持。

### 遗忘门（Forget Gate）

$$
f_t = \sigma\left(W_f x_t + U_f h_{t-1} + b_f\right)
$$

因为 sigmoid，$f_t \in (0,1)$：

- $f_t = 0$：旧记忆忘掉；
- $f_t = 1$：完整保留。

所以 $f_t \odot C_{t-1}$ 决定保留多少过去的信息（$\odot$ 是**逐元素相乘**，element-wise multiplication：两个同形状向量对应位置相乘）。

### 输入门（Input Gate）

$$
i_t = \sigma\left(W_i x_t + U_i h_{t-1}\right)
$$

候选记忆（用 tanh 产生 −1~1 的内容）：

$$
\tilde C_t = \tanh\left(W_c x_t + U_c h_{t-1}\right)
$$

$i_t \odot \tilde C_t$ 表示**新信息写入多少**。

### 核心公式（必须理解，不要死背）

$$
C_t = f_t \odot C_{t-1} + i_t \odot \tilde C_t
$$

- 第一部分 $f_t \odot C_{t-1}$：保留旧记忆；
- 第二部分 $i_t \odot \tilde C_t$：写入新记忆。

> **新记忆 = 旧记忆剩下的 + 新写进去的。**

:::math 为什么加法能救梯度
对 $C_t = f_t \odot C_{t-1} + i_t \odot \tilde C_t$ 求偏导：

$$
\frac{\partial C_t}{\partial C_{t-1}} = f_t \quad (\text{忽略其他路径})
$$

如果遗忘门 $f_t \approx 1$，梯度就能几乎无损地沿时间回传——不像 RNN 那样必须乘满 $W_{hh}$。这就是「梯度高速公路」的数学含义。
:::

### 输出门（Output Gate）

$$
o_t = \sigma\left(W_o x_t + U_o h_{t-1}\right)
$$

$$
h_t = o_t \odot \tanh(C_t)
$$

cell state 里有很多信息，但到底哪些暴露给当前输出，由 output gate 控制。

:::fold 工程里怎么用（PyTorch nn.LSTM + 手写 Cell）
```python
lstm = nn.LSTM(input_size=4, hidden_size=8, batch_first=True)
x = torch.randn(3, 5, 4)             # [B, S, d_in]
h0 = torch.zeros(1, 3, 8)
c0 = torch.zeros(1, 3, 8)
out, (hn, cn) = lstm(x, (h0, c0))    # 两个状态都要传

# 手写一个 LSTM cell（理解用）：
def lstm_cell(x, h, c, Wf, Wi, Wc, Wo, Uf, Ui, Uc, Uo):
    f = torch.sigmoid(x @ Wf + h @ Uf)      # 遗忘门
    i = torch.sigmoid(x @ Wi + h @ Ui)      # 输入门
    cc = torch.tanh(x @ Wc + h @ Uc)        # 候选记忆
    o = torch.sigmoid(x @ Wo + h @ Uo)      # 输出门
    c_new = f * c + i * cc                  # 记忆更新（加法！）
    h_new = o * torch.tanh(c_new)
    return h_new, c_new
```
:::

:::warning 常见误区
- **Cell State ≠ Hidden State**：$C_t$ 是内部长期记忆（不直接输出），$h_t$ 是暴露给外部的表示（也传给下一时间步）。
- **三个门不是二值开关**：它们是 0~1 的连续值，可以「忘掉 70%」。
- **tanh 与 sigmoid 的分工**：门用 sigmoid（0~1 当开关），内容用 tanh（−1~1 当信号）。
:::

:::interview 面试常问
**Q1：LSTM 为什么能缓解梯度消失？**

:::answer
关键在 cell state 的加法更新：∂Cₜ/∂Cₜ₋₁ = fₜ，遗忘门接近 1 时梯度几乎无损回传，形成类似残差连接的「梯度高速公路」。而普通 RNN 的 ∂hₜ/∂hₜ₋₁ = diag(φ')·W 是连乘结构，必然指数衰减或爆炸。
:::

**Q2：遗忘门一般初始化为多少？为什么？**

:::answer
常见做法是把遗忘门 bias 初始化为 1（即 fₜ ≈ 0.73 起步），让网络初始倾向于「记住」，避免一开始就遗忘。这在长序列任务上尤其有效（Jozefowicz et al. 2015）。
:::

**Q3：LSTM 参数量怎么算？**

:::answer
每个门有 W（d_in×d_h）和 U（d_h×d_h）两组矩阵，4 个门（f, i, c, o）：约 4 × d_h × (d_in + d_h + 1) 个参数（含 bias）。
:::
:::

## 5.6 GRU：更轻的 LSTM

:::unfold 先懂直觉
GRU 把 LSTM 的 3 个门精简成 2 个门（重置门、更新门），把 cell state 和 hidden state 合并成一个状态。参数少 25%，小数据集上效果往往和 LSTM 相当。
:::

:::demo gru 交互：LSTM vs GRU 结构对比
左侧 LSTM（3 门 + 2 状态），右侧 GRU（2 门 + 1 状态），点击按钮高亮各自的门。下面给出参数量的具体对比。
:::

GRU 的方程：

**重置门**（决定计算新内容时看不看历史）：

$$
r_t = \sigma\left(W_r x_t + U_r h_{t-1}\right)
$$

**更新门**（决定新旧状态混合比例）：

$$
z_t = \sigma\left(W_z x_t + U_z h_{t-1}\right)
$$

**候选状态**：

$$
\tilde h_t = \tanh\left(W_h x_t + U_h (r_t \odot h_{t-1})\right)
$$

**最终状态**（旧状态和新状态的加权混合）：

$$
h_t = z_t \odot h_{t-1} + (1 - z_t) \odot \tilde h_t
$$

**直觉**：

- $r_t$：计算新内容时，要不要看以前；
- $z_t$：旧状态和新状态到底混多少（$z_t = 1$ 完全保留旧的，$z_t = 0$ 完全用新的）。

:::shapeflow
xₜ [B, d_in] 与 hₜ₋₁ [B, d_h] → 重置门 rₜ、更新门 zₜ [B, d_h]
候选 h̃ₜ = tanh(W_h xₜ + U_h (rₜ ⊙ hₜ₋₁)) → [B, d_h]
hₜ = zₜ ⊙ hₜ₋₁ + (1−zₜ) ⊙ h̃ₜ → [B, d_h]
:::

### 最小数字例子（二维向量）

设 $z_t = 0.6$，$h_{t-1} = [1, 2]$，$\tilde h_t = [3, 4]$：

$$
h_t = z_t \odot h_{t-1} + (1 - z_t) \odot \tilde h_t
= 0.6 \times [1, 2] + 0.4 \times [3, 4]
= [0.6 + 1.2,\ 1.2 + 1.6] = [1.8,\ 2.8]
$$

$z_t = 0.6$ 表示「保留 60% 旧状态 + 40% 新候选」；如果 $z_t = 1$，状态完全不变（记忆锁死）；如果 $z_t = 0$，完全换成新候选（立即刷新）。

:::math 参数量对比（单层，d_in = d_h = 256）
| 模型 | 门数 | 参数公式 | 参数量 |
| --- | --- | --- | --- |
| LSTM | 4（f,i,c,o） | 4 × h × (d + h) | 4 × 256 × 512 = 524,288 |
| GRU | 3（r,z,h） | 3 × h × (d + h) | 3 × 256 × 512 = 393,216 |

GRU 少约 25% 参数，训练更快、更省显存。
:::

:::fold 工程里怎么用（PyTorch nn.GRU）
```python
gru = nn.GRU(input_size=4, hidden_size=8, batch_first=True)
x = torch.randn(3, 5, 4)
h0 = torch.zeros(1, 3, 8)
out, hn = gru(x, h0)   # 只有 h，没有 c
```
:::

:::interview 面试常问
**Q：LSTM 和 GRU 怎么选？**

:::answer
没有绝对优劣。GRU 参数更少、训练更快，在小数据集上常与 LSTM 持平甚至更好；LSTM 表达力略强（独立的 cell state），在长序列、大数据上有时更好。实践中先试 GRU 省资源，效果不够再换 LSTM。
:::
:::

## 5.7 Deep RNN 与双向 RNN

:::unfold 先懂直觉
Deep RNN 在时间维之外再加「层」维度：第 1 层输出序列喂给第 2 层，逐层抽象。双向 RNN 则同时从左右两个方向读序列，让每个位置的表示同时包含左右上下文。
:::

普通 RNN 只有时间维：

```
t₁ → t₂ → t₃ → t₄
```

Deep RNN 还有网络深度：

```
Layer 3
  ↑
Layer 2
  ↑
Layer 1
```

两个方向同时存在：

- **横向**：时间依赖；
- **纵向**：层间表示。

**双向 RNN（BiRNN）**：一个从左到右读，一个从右到左读，两个方向的 $h_t$ 拼接。适合「理解」类任务（如 BERT 的前身思想），**不适合**自回归生成（生成时看不到未来）。

:::warning 常见误区
- 双向 RNN 不能用于语言模型生成——预测下一个 token 时未来还没发生。
- Deep RNN 的层数通常远小于 CNN/Transformer（2~4 层常见），因为时间维已经带来了「深度」。
:::

## 5.8 为什么 Transformer 取代了 RNN

:::unfold 先懂直觉
RNN 必须一个词一个词串行计算：算 h₂ 必须先有 h₁。GPU 最擅长的并行计算完全用不上。Transformer 让所有位置**同时**互相看（Attention），一步到位，而且任意两个位置的距离都是「一跳」。
:::

RNN 的串行结构：

```
t₁ → t₂ → t₃ → ⋯ → tₙ
```

三个致命问题：

| 问题 | 说明 |
| --- | --- |
| **无法并行** | $h_t$ 依赖 $h_{t-1}$，序列必须逐个算，GPU 利用率低 |
| **长程依赖难** | 信息要走 O(n) 步才能从 t₁ 传到 tₙ，梯度连乘易衰减 |
| **训练慢** | 序列越长，训练时间线性增长且无法摊到更多 GPU |

Transformer 的对比：

- 所有 token **同时**参与计算（矩阵乘法天然并行）；
- 任意两个位置的信息交换只需 **1 层**（Attention 直接连接）；
- 训练可以用海量数据并行加速。

代价：Attention 的计算复杂度是 $O(S^2)$（序列长度平方），所以后来有各种高效 Attention 变体。这个 trade-off 是理解现代 LLM 的重要背景。

:::key 本节必须记住
| 概念 | 一句话 |
| --- | --- |
| RNN | $h_t = \tanh(Wx_t + Uh_{t-1})$，参数跨时间共享 |
| BPTT | 梯度沿时间连乘 → 消失/爆炸 |
| LSTM | 3 门 + Cell State，$C_t = f_t C_{t-1} + i_t \tilde C_t$（加法保梯度） |
| GRU | 2 门 + 1 状态，参数少 25% |
| 取代原因 | RNN 串行 → Transformer 全并行 + 任意距离 1 跳 |
:::

:::quiz
RNN 的「参数共享」指的是？

A. 所有时间步共享同一组权重矩阵
B. 所有隐藏状态相同
C. 每个时间步用不同的权重
D. 输入和输出共享参数

答案: A
解析: RNN 在所有时间步复用同一组 W_xh、W_hh、b。这让参数量与序列长度无关，也让模式可以跨位置迁移。状态 h_t 每步不同。
:::

:::quiz
LSTM 中「梯度高速公路」指的是哪条路径？

A. h_t 到 h_{t-1} 的路径
B. C_t 到 C_{t-1} 的路径（∂Cₜ/∂Cₜ₋₁ = fₜ）
C. 输入 x 到输出的路径
D. 输出门到 h_t 的路径

答案: B
解析: Cell state 的更新是加法形式 Cₜ = fₜ⊙Cₜ₋₁ + iₜ⊙C̃ₜ，其偏导 ∂Cₜ/∂Cₜ₋₁ = fₜ。遗忘门接近 1 时梯度几乎无损回传。
:::

:::quiz
GRU 相比 LSTM，缺少了下面哪个组件？

A. 重置门
B. 更新门
C. 独立的 Cell State
D. 隐藏状态

答案: C
解析: GRU 只有 hidden state，把 LSTM 的 cell state 与 hidden state 合并；门从 3 个减为 2 个（重置门 r、更新门 z）。因此参数约少 25%。
:::

:::quiz
关于双向 RNN，说法正确的是？

A. 适合自回归文本生成
B. 每个位置的表示同时包含左右上下文
C. 参数量是单向的一半
D. 不能用于序列标注

答案: B
解析: 双向 RNN 用两个方向的 RNN 分别读序列并拼接表示，适合理解类任务（分类、标注、问答）。生成任务看不到未来，不能用双向。
:::

:::quiz
Transformer 相对 RNN 的核心优势是？

A. 参数更少
B. 支持更长序列且复杂度更低
C. 所有位置可并行计算，任意距离信息 1 跳可达
D. 不需要训练

答案: C
解析: RNN 必须串行（hₜ 依赖 hₜ₋₁），Transformer 用 Attention 让所有位置同时交互，可高度并行；任意两位置直接相连，不受序列长度影响。代价是 O(S²) 计算复杂度。
:::

:::related
依赖 | 梯度消失, 激活函数, 序列建模
用于 | LSTM, GRU, Transformer, 语言模型
:::
