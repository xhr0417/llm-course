> **本章对应课件**：《1-2 模型评估和数值稳定》。核心内容：梯度爆炸/消失、Sigmoid 饱和、权重初始化、BatchNorm、残差连接 ResNet。

## 4.1 梯度爆炸与梯度消失

:::unfold 先懂直觉
反向传播是「连乘」：每层梯度乘在一起。如果每层乘的数略小于 1，100 层后趋近 0（消失）；略大于 1，100 层后爆炸。深层网络训练难，根子就在这个连乘。
:::

假设深层网络反向传播：

$$
\frac{\partial L}{\partial W_1} = \frac{\partial L}{\partial h_n} \prod_i \frac{\partial h_i}{\partial h_{i-1}}
$$

如果每层的局部梯度大约是 1.5：

$$
1.5^{100} \approx 4 \times 10^{17} \quad \Rightarrow \quad \text{梯度爆炸}
$$

如果每层大约乘 0.8：

$$
0.8^{100} \approx 2 \times 10^{-10} \quad \Rightarrow \quad \text{梯度消失}
$$

:::demo vanishing-exploding 交互：连乘的力量
拖动「每层梯度系数」滑块，用对数刻度柱状图观察 100 层后的数值。切换 0.8 和 1.5 两个预设，直观感受指数衰减与指数爆炸。
:::

**后果**：

| 问题 | 后果 |
| --- | --- |
| 梯度爆炸 | 参数突然变成极大值，甚至 NaN，训练崩溃 |
| 梯度消失 | 前面层基本学不动，网络只有最后几层在更新 |

课件用 $1.5^{100}$ 和 $0.8^{100}$ 来直观说明这个问题。

:::fold 工程里怎么用（梯度裁剪）
```python
loss.backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
optimizer.step()
```
梯度裁剪把梯度总范数限制在 max_norm 内，是训练 Transformer/RNN 的标准操作，主要防爆炸。梯度消失则靠结构（残差、门控、归一化）解决。
:::

## 4.2 为什么 Sigmoid 特别容易梯度消失

:::unfold 先懂直觉
Sigmoid 的导数最大只有 0.25，而且两端趋近 0。每过一层至少打 2.5 折，20 层后就是万分之几了。
:::

因为：

$$
\sigma'(x) = \sigma(x)\bigl(1 - \sigma(x)\bigr)
$$

最大值只有：

$$
0.25
$$

如果连续 20 层都乘 0.25：

$$
0.25^{20} \approx 9 \times 10^{-13}
$$

很快趋近 0。所以早期深层网络训练很困难。

:::math 更精确地说
Sigmoid 导数在 $|x|$ 稍大时就急剧饱和：

| x | σ'(x) |
| --- | --- |
| 0 | 0.25 |
| ±2 | 约 0.105 |
| ±4 | 约 0.0177 |
| ±6 | 约 0.0025 |

而且 Sigmoid 输出非零中心（恒正），还会导致梯度更新方向 zigzag。这就是现代网络改用 ReLU/GELU/SiLU 的原因。

:::

这也是为什么 **ReLU、残差连接、Normalization** 等技术如此重要。

## 4.3 权重初始化

:::unfold 先懂直觉
初始权重太大 → 信号和梯度爆炸；太小 → 逐层衰减到 0。好的初始化让每层输出的方差保持稳定，前向反向都「不放大也不缩小」。
:::

如果初始权重特别大，容易**梯度爆炸**；太小，容易**信号和梯度迅速衰减**。

课件提到 ReLU 常见 **Kaiming / He initialization**：

$$
W \sim \mathcal N\left(0, \frac{2}{n_{\text{in}}}\right)
$$

思想是让每层输出的**方差不要随着网络深度不断放大或缩小**。

:::math 为什么方差要控制
前向：$y = \sum_{i=1}^{n_{in}} w_i x_i$。若 $w_i$、$x_i$ 独立、方差分别为 $\sigma_w^2$、$\sigma_x^2$，则：

$$
\text{Var}(y) = n_{in} \cdot \sigma_w^2 \cdot \sigma_x^2
$$

要让它等于 $\sigma_x^2$（方差不变），需要：

$$
\sigma_w^2 = \frac{1}{n_{in}}
$$

这就是 Xavier 初始化。对 ReLU，约一半神经元被置零，方差减半，所以补偿为 $\sigma_w^2 = \frac{2}{n_{in}}$——即 Kaiming 初始化。
:::

## 4.4 Batch Normalization

:::unfold 先懂直觉
每一层的输入分布会随前面层的参数更新而漂移，训练因此变得不稳定。BN 把每个 batch 的激活强行拉回均值 0、方差 1，让每层都在「熟悉的分布」上工作。
:::

BN 的目标：**让每层输入保持比较稳定的统计分布**。

对一个 batch 的输入 $x_1, \ldots, x_m$：

**均值**：

$$
\mu_B = \frac{1}{m}\sum_i x_i
$$

**方差**：

$$
\sigma_B^2 = \frac{1}{m}\sum_i (x_i - \mu_B)^2
$$

**标准化**：

$$
\hat x_i = \frac{x_i - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}
$$

**再缩放平移**：

$$
y_i = \gamma \hat x_i + \beta
$$

:::math 具体算一遍
输入 batch（单特征）$x = [1, 2, 3, 4]$：

- $\mu_B = 2.5$
- $\sigma_B^2 = 1.25$，$\sigma_B \approx 1.118$
- 标准化：$[-1.34, -0.45, 0.45, 1.34]$
- 若 γ=2, β=1：$y = [-1.68, 0.1, 1.9, 3.68]$

γ、β 让模型自己决定「要多少方差、什么均值」。
:::

**为什么后面还要 $\gamma, \beta$？**

因为如果永远强迫均值 = 0、方差 = 1，反而限制模型表达能力。所以让模型自己学 $\gamma, \beta$ 来调整尺度和偏移。

**训练 vs 推理**：

- 训练时用当前 batch 的统计量；
- 推理时用训练期间累计的**移动平均**统计量（否则单条样本无法计算 batch 统计）。

:::warning 常见误区（Transformer 为什么不用 BN）
BN 依赖 batch 统计，对变长序列、小 batch、单样本推理都不友好。Transformer 用 **LayerNorm / RMSNorm**（对每个 token 的 hidden 维归一化，不依赖 batch）。所以 BN 是 CNN 时代的标配，Transformer 时代让位于 LN。
:::

## 4.5 残差连接 ResNet

:::unfold 先懂直觉
让网络学「在输入基础上加多少修正」，而不是「从头生成输出」。如果不需要修正，直接让 F(x)=0，信息原样通过——至少不会更差。而且反向传播时梯度有一条直通通道。
:::

普通深层网络：

$$
x \rightarrow F(x) \rightarrow \text{下一层}
$$

Residual：

$$
y = x + F(x)
$$

**非常重要。** 如果 $F(x)$ 学不到什么，$F(x) \approx 0$，那 $y \approx x$，至少信息可以直接通过。

反向传播：

$$
\frac{\partial y}{\partial x} = 1 + \frac{\partial F}{\partial x}
$$

其中的 **1** 就是一条非常宝贵的梯度通道——它保证梯度至少能以常数 1 传回去，不会因为连乘而消失。

:::math 直观理解「恒等映射」
深网络理论上不应该比浅网络差（多出来的层学恒等映射即可），但实验发现普通深层网络退化严重。残差让「学恒等」变得很容易：把 F 的权重推向 0 即可。所以深度不再是负担。

:::

Transformer 里的：

```
Attention → Add & Norm → FFN → Add & Norm
```

其中 **Add 就是残差**。课件第 14～15 页专门用 $H(x) = F(x) + x$ 解释了这一点。

:::demo transformer-block 交互：残差在 Block 里的位置
回到第 7 章的交互结构图，点击「残差相加 ⊕」节点，看它在 Attention 和 FFN 之后如何加回输入。
:::

:::interview 面试常问
**Q1：梯度消失和梯度爆炸的本质原因是什么？**

:::answer
反向传播是链式连乘：∂L/∂W₁ = ∂L/∂hₙ · Π(∂hᵢ/∂hᵢ₋₁)。每层的局部雅可比（含权重矩阵和激活导数）连乘，若谱半径 < 1 则指数衰减（消失），> 1 则指数增长（爆炸）。深度/序列长度越大越严重。
:::

**Q2：分别有哪些解决方案？**

:::answer
梯度消失：ReLU/GELU 等非饱和激活、残差连接（恒等通道）、归一化（BN/LN/RMSNorm）、LSTM 门控、合适的初始化（Kaiming/Xavier）。梯度爆炸：梯度裁剪（clip_grad_norm）、更小的学习率、warmup、BF16 替代 FP16。
:::

**Q3：为什么残差连接对 Transformer 是必需的？**

:::answer
Transformer 每一层包含 Attention 和 FFN 两次复杂变换，如果没有残差，梯度必须穿过所有层的雅可比连乘，12 层以上几乎无法训练。残差提供 ∂y/∂x = 1 + ∂F/∂x 中的常数 1 通道，保证梯度可直接回传。
:::
:::

:::key 本节必须记住
| 技术 | 解决的问题 | 核心机制 |
| --- | --- | --- |
| ReLU | Sigmoid 饱和导致梯度消失 | 正区间导数恒为 1 |
| Kaiming 初始化 | 信号方差随深度漂移 | $\sigma_w^2 = 2/n_{in}$（ReLU） |
| BatchNorm | 各层输入分布不稳定 | 标准化 + 可学习 γ、β（跨 batch） |
| LayerNorm | 同上，但适配 NLP | 跨 hidden 维归一化（第 7 章） |
| Residual | 深层网络梯度消失 | $y = x + F(x)$，梯度含常数 1 通道 |
:::

:::quiz
Sigmoid 容易导致梯度消失的根本原因是？

A. 它的输出不是概率
B. 导数最大只有 0.25 且两端饱和
C. 它不能求导
D. 它需要太多参数

答案: B
解析: σ'(x) = σ(x)(1−σ(x)) 最大值 0.25，且 |x| 增大时迅速趋近 0。深层反向传播连乘会指数衰减。ReLU 正区间导数为 1，避免了这个问题。
:::

:::quiz
残差连接 y = x + F(x) 为什么能帮助训练深层网络？

A. 减少了参数量
B. 反向传播时 ∂y/∂x = 1 + ∂F/∂x 含有恒等通道，梯度不会完全消失
C. 增加了非线性
D. 加速了前向计算

答案: B
解析: 那个常数 1 保证梯度至少能无损回传一层，是深层网络（ResNet、Transformer）可训练的关键。同时网络只需学「修正量」，学恒等映射变得容易。
:::

:::quiz
BatchNorm 在推理阶段使用什么统计量？

A. 当前 batch 的均值和方差
B. 训练期间累计的移动平均统计量
C. 固定为 0 和 1
D. 随机采样的统计量

答案: B
解析: 推理时可能只有单条样本，无法计算 batch 统计，所以使用训练期间累积的 running mean/var。这也是 model.eval() 要切换的原因。
:::

:::quiz
Kaiming 初始化相比 Xavier 多了一个因子 2，原因是？

A. 为了更快收敛
B. 补偿 ReLU 把约一半神经元置零造成的方差减半
C. 防止过拟合
D. 减少参数量

答案: B
解析: ReLU 把负半轴置 0，输出方差约为原来一半，所以初始化方差放大 2 倍（σ² = 2/n_in）才能让每层方差保持稳定。
:::

:::related
依赖 | 反向传播, 激活函数, 权重初始化
用于 | ResNet, Transformer, 深层网络训练
:::
