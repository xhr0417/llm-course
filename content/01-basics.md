> **本章对应课件**：《1.1 深度学习基础概念》。这是整套课程的地基：线性模型、损失函数、梯度下降、反向传播、Softmax、交叉熵、MLP、激活函数。后面所有内容（包括 GPT）都是这些概念的组合与放大。

## 1.1 AI、机器学习、深度学习是什么关系

:::unfold 先懂直觉
传统程序是「人写规则」，机器学习是「机器从数据里学规则」。

判断一张图是不是猫：

- **传统程序**：人写 if-else——耳朵尖？毛多？眼睛圆？→ 猫。规则写不完，也写不准。
- **机器学习**：给机器几万张标注好的图片，让模型自己调整参数，最后得到一个函数 $f(x;\theta)$，输入图片输出「是猫的概率」。

所谓「训练模型」，本质就是**找到一组好的参数 $\theta$**。
:::

三者是包含关系：

$$
\text{Deep Learning} \subset \text{Machine Learning} \subset \text{AI}
$$

| 层级 | 含义 | 例子 |
| --- | --- | --- |
| AI | 让机器表现出智能行为的总目标 | 下棋、对话、自动驾驶 |
| Machine Learning | 从数据中自动学习规律 | 线性回归、决策树、SVM |
| Deep Learning | 用多层神经网络学习表示 | CNN、RNN、Transformer、GPT |

:::warning 常见误区
「深度学习 = 机器学习 = AI」是错的。深度学习只是机器学习的一个子集；而机器学习又是 AI 的一个子集。GPT 属于深度学习，深度学习属于机器学习，机器学习属于 AI。
:::

## 1.2 回归问题与线性模型

:::unfold 先懂直觉
回归就是「预测一个连续数字」。例如根据房子的面积、房间数、房龄预测房价。最简单的假设是：这些因素对房价的影响是**线性叠加**的。
:::

假设房价由以下特征决定：

- 面积 $x_1$
- 房间数 $x_2$
- 房龄 $x_3$

模型写成：

$$
\hat y = w_1 x_1 + w_2 x_2 + w_3 x_3 + b
$$

向量形式：

$$
\hat y = \mathbf w^\top \mathbf x + b
$$

其中：

| 符号 | 含义 |
| --- | --- |
| $\mathbf x$ | 输入特征 |
| $\mathbf w$ | 权重（weight） |
| $b$ | 偏置（bias） |
| $\hat y$ | 模型预测值 |
| $y$ | 真实值 |

:::shapeflow
X [B, d_in] × W [d_in, 1] → ŷ [B, 1] 加偏置 b
:::

写成矩阵形式（一个 batch 一次算完）：

$$
\hat{\mathbf y} = XW + b, \qquad X \in \mathbb R^{B \times d_{in}},\ W \in \mathbb R^{d_{in} \times 1}
$$

> **这就是神经网络最基本的计算：$Wx+b$。** 后面 Transformer 里的 $Q=XW_Q$、$K=XW_K$、$V=XW_V$，本质仍然是这个东西——只是 $W$ 的列数变多了。

:::fold 工程里怎么用（PyTorch）
```python
import torch, torch.nn as nn

model = nn.Linear(3, 1)          # 3 个输入特征 → 1 个输出
x = torch.tensor([[120.0, 3.0, 5.0]])   # [batch=1, d_in=3]
y_hat = model(x)                  # [1, 1]
print(y_hat)
```
`nn.Linear(in, out)` 内部就是 $y = xW^\top + b$，参数 $W$ 形状 `(out, in)`，$b$ 形状 `(out,)`。
:::

## 1.3 损失函数：模型怎么知道自己预测得好不好

:::unfold 先懂直觉
模型猜完必须有人告诉它「错了多少」。这个评分函数就是 **Loss（损失）**。回归任务里最常用的是均方误差 MSE：把每个样本的误差平方后求平均。
:::

例如真实房价 $y = 100$（万），模型预测 $\hat y = 80$，显然差了 20。**均方误差（MSE）**：

$$
\text{MSE} = \frac{1}{n}\sum_{i=1}^{n}(y_i - \hat y_i)^2
$$

:::math 为什么平方？两个原因
1. **避免正负抵消**：如果直接求误差和，$+10 + (-10) = 0$，模型明明错了两个方向却被判「完美」。
2. **更严厉地惩罚大误差**：平方让误差 20 的惩罚（400）是误差 10 的惩罚（100）的 4 倍，模型会优先修掉大错。
:::

训练目标就是：

$$
\min_{W,b} \; L(W,b)
$$

所谓模型训练，可以理解成：**在巨大参数空间里寻找使 Loss 最小的位置。**

:::fold 再看数学（MSE 对参数的梯度）
对单个样本 $L = (\hat y - y)^2$，$\hat y = wx + b$：

$$
\frac{\partial L}{\partial w} = 2(\hat y - y)\,x, \qquad \frac{\partial L}{\partial b} = 2(\hat y - y)
$$

直觉：预测误差 $(\hat y - y)$ 越大，梯度越大，参数被修正得越多；输入 $x$ 越大，说明这个特征「责任越大」，对应权重被修正得越多。
:::

## 1.4 梯度下降：整个深度学习训练的核心 ★

:::unfold 先懂直觉
想象你在山上（Loss 是海拔），目标是走到谷底。你站在某个位置 $w$，梯度 $\frac{\partial L}{\partial w}$ 告诉你「往哪个方向走 Loss 会变大」。所以你**往反方向走一小步**：

$$
w_{t+1} = w_t - \eta \frac{\partial L}{\partial w}
$$

$\eta$ 是步长，也就是**学习率（learning rate）**。走一步、看一眼坡度、再走一步——这就是梯度下降。
:::

:::demo gradient-descent 交互：亲手调学习率走下山
拖动滑块改变学习率 η，点击开始，观察紫色小球如何一步步滚向谷底。试试四个预设：太小、合适、震荡、发散。
:::

### 为什么学习率是最重要的超参数

| 学习率 | 现象 | 原因 |
| --- | --- | --- |
| 过小（如 0.001） | 训练极慢，十万步还没到谷底 | 每步位移太小 |
| 合适（如 0.1～0.3） | 平稳收敛 | 每步刚好跨过一小段 |
| 略大（如 0.9） | 来回震荡但仍在收敛 | 每步跨过谷底，方向反复横跳 |
| 过大（如 1.1） | **发散**，Loss 变成 NaN | 每步越跨越大，冲出参数空间 |

:::math 收敛的数学条件（以二次函数为例）
设 $L(w) = (w-3)^2$，梯度 $\nabla L = 2(w-3)$。令 $d_t = w_t - 3$（离最优点的距离）：

$$
d_{t+1} = w_{t+1} - 3 = w_t - \eta \cdot 2(w_t - 3) - 3 = (1 - 2\eta)\,d_t
$$

所以：

- $|1-2\eta| < 1$（即 $0 < \eta < 1$）→ 距离每步缩小，**收敛**；
- $\eta > 0.5$ 时 $1-2\eta < 0$ → 符号翻转，**震荡**；
- $\eta > 1$ → $|1-2\eta| > 1$，距离越来越大，**发散**。

这就解释了交互演示里看到的全部现象。真实损失函数不是二次的，但局部近似是，所以结论依然成立。
:::

:::fold 工程里怎么用（PyTorch 训练循环）
```python
optimizer = torch.optim.SGD(model.parameters(), lr=0.1)

for x, y in dataloader:          # 一轮一轮拿 batch
    y_hat = model(x)             # ① 前向传播
    loss = loss_fn(y_hat, y)     # ② 算损失
    optimizer.zero_grad()        # ③ 清空上一轮的梯度
    loss.backward()              # ④ 反向传播：算每个参数的梯度
    optimizer.step()             # ⑤ 梯度下降：更新参数
```
这五行就是所有深度学习训练（包括 GPT 预训练）的骨架。
:::

:::warning 常见误区
- **梯度下降 ≠ 反向传播**。梯度下降是「用梯度更新参数」的规则；反向传播是「高效计算梯度」的算法。前者是走路方式，后者是测坡度的方法。
- **Loss 不下降 ≠ 代码有 bug**。可能是学习率、数据、初始化的问题，也可能是模型容量不够。
:::

:::interview 面试常问
**Q1：梯度下降和随机梯度下降（SGD）有什么区别？**

:::answer
全批量梯度下降（BGD）每步用全部训练数据算梯度，方向准但极慢；SGD 每步只用一个样本，快但噪声大；实际用的都是 **mini-batch SGD**（一次 32～4096 个样本），兼顾速度与方向稳定性。深度学习里的「SGD」通常指 mini-batch 版本。
:::

**Q2：为什么梯度反方向是 Loss 下降最快的方向？**

:::answer
一阶泰勒展开：$L(w + \Delta w) \approx L(w) + \nabla L^\top \Delta w$。在 $|\Delta w|$ 固定时，要使 $L$ 下降最多，就取 $\Delta w = -\eta \nabla L$（负梯度方向与梯度方向夹角 180°，内积最小）。
:::

**Q3：学习率太大和太小分别会怎样？**

:::answer
太大：震荡甚至发散（参数飞出有效范围，Loss 变 NaN）；太小：收敛极慢，还可能卡在局部平缓区。所以实际训练常用 warmup + 衰减策略（见第 11 章）。
:::
:::

## 1.5 Epoch、Batch、Step ★

:::unfold 先懂直觉
训练数据太多，一次全部拿来算梯度既慢又费显存。所以把数据切成小批（batch），一批一批地学。学完所有批次叫一个 epoch。
:::

假设训练集有 10000 条数据，batch size 取 100：

- **Batch**：一次拿多少样本算梯度 → 100 条；
- **Step**：完成一次参数更新 → 1 个 batch；
- **Epoch**：所有训练数据完整看一遍。

于是：

$$
1\ \text{epoch} = \frac{10000}{100} = 100\ \text{steps}
$$

如果训练 10 个 epoch，总步数就是 1000 步，参数被更新 1000 次。

:::example 具体算一遍
| 概念 | 数值 | 说明 |
| --- | --- | --- |
| 训练集大小 | 10000 | 样本总数 |
| batch size | 100 | 每次取 100 条 |
| steps per epoch | 100 | 10000 / 100 |
| epochs | 10 | 数据集看 10 遍 |
| 总参数更新次数 | 1000 | 10 × 100 |

注意：最后一个不满的 batch（如 10050 条数据）通常仍然保留，叫 drop_last=False。
:::

到了大模型时代，不一定特别强调 epoch，因为预训练数据太大，经常说：

```
trained for 2T tokens     # 训练了 2 万亿 token
```

而不是 `trained for 3 epochs`——因为「一遍」到底是多少数据本身就不固定。

:::warning 常见误区
- **Step ≠ Epoch**：1 个 epoch 通常包含多个 step。
- **Batch size 影响的不只是速度**：太小的 batch 梯度噪声大；太大的 batch 显存吃紧、收敛行为也会变化（常需要调学习率）。
:::

## 1.6 前向传播与反向传播 ★

:::unfold 先懂直觉
前向传播：把输入一层层算到输出，再算 Loss。
反向传播：从 Loss 出发往回问——「每个参数，你对这个错误负多少责任？」用链式法则把责任一层层分下去。
:::

假设一个最小模型：

$$
x \rightarrow z = wx \rightarrow L = (z - y)^2
$$

**前向传播**：$x \to z \to L$，得到 Loss。

**反向传播**利用链式法则：

$$
\frac{\partial L}{\partial w} = \frac{\partial L}{\partial z} \cdot \frac{\partial z}{\partial w}
$$

:::example 具体数字算一遍
设 $x = 2,\ y = 5,\ w = 1$。

**前向**：
- $z = wx = 1 \times 2 = 2$
- $L = (z-y)^2 = (2-5)^2 = 9$

**反向**（从后往前）：
- $\frac{\partial L}{\partial z} = 2(z-y) = 2 \times (-3) = -6$（z 每增大 1，Loss 减少 6）
- $\frac{\partial z}{\partial w} = x = 2$
- $\frac{\partial L}{\partial w} = (-6) \times 2 = -12$

**更新**（$\eta = 0.1$）：$w \leftarrow 1 - 0.1 \times (-12) = 2.2$

验证：新 $z = 2.2 \times 2 = 4.4$，新 $L = (4.4-5)^2 = 0.36$，比 9 小多了。✅
:::

:::shapeflow
x [标量] → z = wx [标量] → L = (z−y)² [标量] 前向
∂L/∂w [标量] ← 链式法则 ← ∂L/∂z [标量] 反向
:::

:::demo backprop 交互：逐步走一遍前向与反向
拖动 x、w、y，点击「前向传播 → 反向传播 → 更新参数」，每一步都显示具体数字和公式。可以自己验证每一步的算术。
:::

:::fold 工程里怎么用（PyTorch autograd）
```python
import torch

x = torch.tensor(2.0)
y = torch.tensor(5.0)
w = torch.tensor(1.0, requires_grad=True)   # 需要求导

z = w * x          # 前向
L = (z - y) ** 2

L.backward()       # 反向：自动算所有梯度
print(w.grad)      # tensor(-12.)  ← 与手算一致
```
`loss.backward()` 背后就是反向传播 + 自动微分。PyTorch 会记录前向的计算图，反向时按链式法则逐节点求导。
:::

:::warning 常见误区
- **梯度会累积**：PyTorch 的 `backward()` 是**累加**梯度，所以每个 step 前要 `optimizer.zero_grad()`，否则梯度越滚越大。
- **前向和反向的计算量**：反向传播的计算量约为前向的 2 倍（要算对输入和对权重的两类梯度）。
:::

:::interview 面试常问
**Q1：反向传播为什么比数值求导快？**

:::answer
数值求导（逐个参数扰动）需要 $O(N)$ 次前向（$N$ 是参数量，GPT 级别是千亿次）；反向传播一次前向 + 一次反向就得到所有参数的梯度，复杂度与参数量的常数倍同阶。这是深度学习能训练的根本原因之一。
:::

**Q2：为什么需要 `zero_grad()`？**

:::answer
PyTorch 梯度是累加的（便于 RNN 等场景跨步累积）。如果不清零，第 t 步的梯度会叠加第 t−1 步的，导致更新错误甚至发散。
:::
:::

## 1.7 分类问题与 Softmax ★

:::unfold 先懂直觉
回归输出一个数字；分类要输出「每个类别的概率」。模型先给出每个类别的原始分数（logits），Softmax 把这些分数变成和为 1 的概率分布。
:::

神经网络最后通常先产生：

$$
z = [2.0,\ 1.0,\ 0.1]
$$

这些叫 **logits**——它们不是概率，可以是负数、可以不和 1。**Softmax** 把它变成概率：

$$
p_i = \frac{e^{z_i}}{\sum_j e^{z_j}}
$$

得到：

$$
p = [0.66,\ 0.24,\ 0.10], \qquad \sum_i p_i = 1
$$

:::demo softmax 交互：拖动 logits 看概率变化
拖动三个滑块改变 logits，左侧是逐步计算过程，右侧是概率柱状图。注意：Softmax 永远不会输出严格 0。
:::

:::shapeflow
logits z [V] → exp(z) [V] → 除以 sum → 概率 P [V]，ΣP = 1
:::

:::math 为什么要取 exp？
1. **保证正数**：$e^x > 0$，概率不能为负；
2. **放大差异**：logit 差 1，概率比就是 $e \approx 2.7$ 倍；
3. **可导且光滑**：方便反向传播。
:::

:::fold 再看数学（数值稳定性技巧）
直接算 $e^{1000}$ 会溢出。实际实现会先减去最大值：

$$
p_i = \frac{e^{z_i - \max(z)}}{\sum_j e^{z_j - \max(z)}}
$$

数学上等价（分子分母同乘 $e^{-\max(z)}$），但数值上安全——最大指数变成 $e^0 = 1$。

```python
def softmax(z):
    z = z - z.max(dim=-1, keepdim=True).values   # 数值稳定
    e = torch.exp(z)
    return e / e.sum(dim=-1, keepdim=True)
```
:::

:::fold 工程里怎么用（GPT 就是一个巨大的分类器）
假设 vocabulary $|V| = 100000$，每生成一个 token：

$$
\text{logits} \in \mathbb R^{100000} \xrightarrow{\text{Softmax}} 100000 \text{ 个 token 的概率}
$$

然后从中选下一个 token。所以 GPT 的最后一层就是一个 $d_{model} \to |V|$ 的线性层（LM Head）+ Softmax。
:::

:::warning 常见误区
- **logits ≠ 概率**：logits 没归一化，不能直接当概率用。
- **Softmax 不会输出 0**：即使 logit 是 −100，概率也是 $e^{-100}$ 这样的小正数。
- **Softmax 输入顺序无关**：交换两个 logit，输出概率也跟着交换——这是后面 Attention 需要位置编码的原因之一。
:::

:::interview 面试常问
**Q1：Softmax 的数值稳定性怎么处理？**

:::answer
先减去最大值再取指数：softmax(z) = softmax(z − max(z))。数学上等价（分子分母同乘 e^(−max)），但最大指数变成 e⁰ = 1，避免 FP16 下 e^89 溢出。PyTorch 的 F.softmax 内部已做此处理。
:::

**Q2：Softmax 和 Sigmoid 有什么区别？**

:::answer
Sigmoid 逐元素独立计算，输出互不竞争、和不保证为 1，用于二分类/门控；Softmax 是竞争性的，所有元素共同归一化、和为 1，用于多分类和注意力权重。
:::
:::

## 1.8 交叉熵 ★

:::unfold 先懂直觉
模型给正确答案的概率越高，损失越小；给得越低，损失越大。交叉熵就是用 $-\log p_{\text{正确类别}}$ 来度量这件事。
:::

假设正确答案是「猫」，真实标签 one-hot：

$$
y = [1, 0, 0]
$$

模型预测 $p = [0.7, 0.2, 0.1]$，交叉熵：

$$
L = -\sum_i y_i \log p_i = -\log 0.7 \approx 0.357
$$

因为 one-hot 只有正确类别位置 $y_i = 1$，所以求和实际只剩一项：**$L = -\log p_{\text{正确类别}}$**。

:::demo cross-entropy 交互：拖动正确类别概率看 loss
拖动滑块改变「模型给正确答案的概率 p」，曲线是 $-\ln(p)$。观察 p 接近 0 时 loss 如何爆炸，p 接近 1 时如何趋近 0。
:::

### 为什么是 $-\log$？

:::math 从最大似然推导
模型输出概率分布 $p$，真实标签 $y$。我们希望模型对正确类别的预测概率越大越好，等价于**最小化负对数似然**：

$$
L = -\log p_{\text{correct}}
$$

性质：

| $p_{\text{correct}}$ | $-\log p$ | 含义 |
| --- | --- | --- |
| 1.0 | 0 | 完全正确，无损失 |
| 0.9 | 0.105 | 比较自信 |
| 0.5 | 0.693 | 犹豫不决 |
| 0.1 | 2.303 | 大概率错了 |
| 0.001 | 6.908 | 完全错，重罚 |

:::

:::example GPT 预训练里的交叉熵
```
I love artificial ______   → 正确 token: intelligence
```

- 如果模型给 $P(\text{intelligence}) = 0.8$ → loss $= -\ln 0.8 \approx 0.223$
- 如果只给 0.001 → loss $= -\ln 0.001 \approx 6.9$

GPT 预训练的 loss 就是整个语料上所有位置交叉熵的平均值。
:::

:::fold 工程里怎么用（PyTorch）
```python
import torch.nn.functional as F

logits = model(x)                 # [B, V] 未归一化分数
target = y                        # [B] 正确类别索引
loss = F.cross_entropy(logits, target)   # 内部自动做 log_softmax + NLL

# 注意：F.cross_entropy 接收的是 logits，不是 softmax 后的概率！
# 传入概率会得到错误结果（双重 softmax）。
```
:::

:::warning 常见误区
- **交叉熵 ≠ 准确率**：loss 是连续的「置信度惩罚」，准确率是离散的对错比例。loss 降低时准确率通常上升，但两者不同步。
- **不要手动 softmax 再传交叉熵**：数值不稳定且易错，直接用 `F.cross_entropy(logits, target)`。
- **分类别用 MSE**：MSE 配 sigmoid/softmax 会导致梯度消失（见下一节），收敛远慢于交叉熵。
:::

:::interview 面试常问
**Q1：为什么分类用交叉熵而不是 MSE？**

:::answer
MSE 配 Sigmoid/Softmax 时，梯度中含 $\sigma'(z)$ 因子，当预测严重错误（输出饱和）时 $\sigma' \approx 0$，梯度消失、学不动；交叉熵配 Softmax 的梯度是 $p - y$，误差越大梯度越大，学习更有效。
:::

**Q2：交叉熵与 KL 散度的关系？**

:::answer
$H(p,q) = H(p) + D_{KL}(p\|q)$。对 one-hot 标签，$H(p)=0$，所以交叉熵等价于 KL 散度。这也是 RLHF 里 KL 惩罚和交叉熵形式相近的原因。
:::
:::

## 1.9 Softmax + 交叉熵的导数 ★

:::unfold 先懂直觉
这个公式是分类学习「本质」的数学表达：**抬高正确类别，压低错误类别**。梯度直接等于「预测概率 − 真实标签」。
:::

课件专门给出了这个重要结果：

$$
\frac{\partial L}{\partial z_i} = p_i - y_i
$$

:::math 推导（两项，都不复杂）
记 $L = -\log p_{y}$（$y$ 是正确类别），$p_i = \dfrac{e^{z_i}}{\sum_j e^{z_j}}$。

**情况一：$i = y$（正确类别）**

$$
\frac{\partial L}{\partial z_y} = -\frac{1}{p_y} \cdot \frac{\partial p_y}{\partial z_y}
= -\frac{1}{p_y} \cdot p_y(1-p_y) = p_y - 1
$$

**情况二：$i \ne y$（错误类别）**

$$
\frac{\partial L}{\partial z_i} = -\frac{1}{p_y} \cdot \frac{\partial p_y}{\partial z_i}
= -\frac{1}{p_y} \cdot (-p_y p_i) = p_i
$$

合并两种情况：

$$
\frac{\partial L}{\partial z_i} = p_i - y_i
$$

:::

:::example 具体数字算一遍
正确类别 $y = [1,0,0]$，模型 $p = [0.3, 0.5, 0.2]$：

$$
p - y = [-0.7,\ 0.5,\ 0.2]
$$

梯度下降往负方向走：

- 正确类别 $z_0$ 的梯度是 $-0.7$ → 减去负梯度 → $z_0$ **增大**；
- 错误类别 $z_1$ 的梯度是 $+0.5$ → $z_1$ **减小**。

结果：正确类别 logit 上升，错误类别 logit 下降。✅
:::

:::key 本节必须记住
**分类学习的全部动力**就是这一行：$\partial L/\partial z = p - y$。

- 预测概率低于 1（还不够自信）→ 正梯度 → 提高正确类别；
- 错误类别概率 > 0 → 正梯度 → 压低错误类别；
- 当 $p = y$（完全预测对）时梯度为 0，不再更新。
:::

## 1.10 MLP 与隐藏层：为什么需要非线性 ★

:::unfold 先懂直觉
一层线性变换只能画直线/平面。要拟合曲线、识别复杂模式，必须引入非线性。做法是：线性变换 → 激活函数 → 线性变换……堆叠成多层感知机（MLP）。
:::

只有 $y = Wx + b$ 时，无论堆多少层，本质还是线性变换：

$$
W_2(W_1 x + b_1) + b_2 = \underbrace{(W_2W_1)}_{W'}x + \underbrace{(W_2b_1 + b_2)}_{b'}
$$

所以必须加入 **Activation Function（激活函数）**：

$$
h = \sigma(W_1 x + b_1), \qquad y = W_2 h + b_2
$$

:::shapeflow
x [B, d_in] × W₁ [d_in, d_hidden] → z₁ [B, d_hidden]
z₁ [B, d_hidden] 激活 σ → h [B, d_hidden] 非线性
h [B, d_hidden] × W₂ [d_hidden, d_out] → y [B, d_out]
:::

:::fold 工程里怎么用（PyTorch MLP）
```python
mlp = nn.Sequential(
    nn.Linear(4, 8),
    nn.ReLU(),            # 非线性！
    nn.Linear(8, 3),
)
x = torch.randn(16, 4)    # batch=16, d_in=4
y = mlp(x)                # [16, 3]
```
去掉 `nn.ReLU()`，这个网络就退化成单个线性层，学不了 XOR 这种简单问题。
:::

:::warning 常见误区
- **多层线性 ≠ 深度网络**：没有激活函数，100 层和 1 层等价。
- **激活函数加在哪**：通常加在线性层之后（Wx+b 的输出上），不是加在输入上。
:::

## 1.11 激活函数：Sigmoid、Tanh、ReLU

:::unfold 先懂直觉
激活函数就是「非线性开关」。早期用 Sigmoid/Tanh，现代深层网络几乎都用 ReLU 及其变体（GELU、SiLU），因为 Sigmoid 系在深层网络里会导致梯度消失。
:::

### Sigmoid

$$
\sigma(x) = \frac{1}{1 + e^{-x}}, \qquad \text{输出 } (0,1)
$$

导数：

$$
\sigma'(x) = \sigma(x)\bigl(1 - \sigma(x)\bigr)
$$

:::math 为什么 Sigmoid 容易梯度消失
$\sigma'(x)$ 的最大值出现在 $x=0$，等于 $\sigma(0)(1-\sigma(0)) = 0.5 \times 0.5 = 0.25$。

也就是说，每经过一层 Sigmoid，反向传播的梯度**至少乘以 0.25**。连续 20 层：

$$
0.25^{20} \approx 9 \times 10^{-13}
$$

几乎归零——浅层参数完全学不动。
:::

### Tanh

$$
\tanh(x) \in (-1, 1), \qquad \frac{d}{dx}\tanh(x) = 1 - \tanh^2(x)
$$

比 Sigmoid 好一点（输出零中心，收敛更快），但导数最大也只有 1，且两端同样饱和。RNN/LSTM 里你会频繁看到它。

### ReLU

$$
\text{ReLU}(x) = \max(0, x)
$$

- $x > 0$：导数恒为 1，梯度不衰减；
- $x \le 0$：导数为 0（可能「死亡」）。

计算极快（一次比较），是现代网络默认选择。课件用多个 ReLU 分段线性函数逼近曲线的例子说明：

> **很多简单的分段线性函数组合起来，可以表示高度复杂的非线性函数。**

### 现代变体

| 激活函数 | 公式 | 特点 |
| --- | --- | --- |
| ReLU | $\max(0,x)$ | 简单、快，可能死亡 |
| Leaky ReLU | $\max(0.01x, x)$ | 负区间给一点斜率，缓解死亡 |
| GELU | $x\Phi(x)$ | 平滑版 ReLU，BERT/GPT-2 常用 |
| SiLU / Swish | $x\sigma(x)$ | 平滑、非单调，SwiGLU 的组件 |

:::fold 工程里怎么用（看激活函数曲线）
```python
import torch, torch.nn.functional as F
x = torch.linspace(-5, 5, 1000)
for name, fn in [("sigmoid", torch.sigmoid), ("tanh", torch.tanh), ("relu", F.relu), ("silu", F.silu)]:
    y = fn(x)   # 画出来对比形状
```
:::

:::demo activations 交互：四条曲线与导数
拖动 x 滑块查看每个激活函数在当前位置的值；点「切换到导数」看它们的导数曲线——Sigmoid 的导数最高只有 0.25，ReLU 正区间恒为 1。
:::

:::warning 常见误区
- **ReLU 的导数是 0 或 1**，不是「0 到 1 之间」——这是它相比 Sigmoid 最大的优势。
- **Sigmoid 仍有用途**：二分类输出层、门控（LSTM 的门、GRU、SwiGLU 的 gate）——这些地方需要 (0,1) 区间。
:::

:::interview 面试常问
**Q1：为什么 ReLU 比 Sigmoid 收敛快？**

:::answer
Sigmoid 导数最大 0.25 且两端饱和，深层反向传播梯度指数衰减；ReLU 正区间导数恒为 1，梯度不衰减，且计算只涉及比较、没有指数运算。此外 ReLU 输出有稀疏性（约一半神经元输出 0）。
:::

**Q2：ReLU 的「神经元死亡」是什么？**

:::answer
如果某个神经元的输入长期为负，梯度恒为 0，参数永远不再更新，这个神经元就「死了」。缓解方法：Leaky ReLU、GELU、合适的初始化、更小的学习率。
:::
:::

:::quiz
一个 MLP 的隐藏层没有加激活函数，只有 Linear → Linear → Linear。它等价于什么？

A. 一个更深的非线性网络
B. 一个单层线性变换
C. 一个卷积网络
D. 无法确定

答案: B
解析: 多个线性变换的复合仍是线性变换：W₃(W₂(W₁x+b₁)+b₂)+b₃ = W'x + b'。所以没有非线性激活时，堆叠层数不增加表达能力。
:::

:::quiz
训练时 loss 一直不下降，学习率设为 0.000001。最可能的原因是？

A. 模型太大
B. 学习率太小，每步更新几乎为零
C. 数据太少
D. 激活函数选错

答案: B
解析: 学习率决定每步位移大小。η 太小时参数更新幅度极小，loss 下降极其缓慢，看起来「不下降」。应先尝试数量级更大的学习率（如 0.01～0.1）。
:::

:::quiz
关于交叉熵损失，下面说法正确的是？

A. 交叉熵可以直接当准确率使用
B. 正确类别概率为 1 时，交叉熵为 0
C. 交叉熵可以为负数
D. 交叉熵越大说明模型越好

答案: B
解析: L = −log(p)，p=1 时 L=0；p∈(0,1] 时 −log p ≥ 0，不会为负。交叉熵是连续的置信度惩罚，不能等同于准确率。
:::

:::quiz
前向传播中 z = wx = 2，y = 5，则 ∂L/∂w（L=(z−y)²）等于多少？

A. -6
B. -12
C. 6
D. 12

答案: B
解析: ∂L/∂z = 2(z−y) = 2×(2−5) = −6；∂z/∂w = x = 2；链式相乘 ∂L/∂w = −6×2 = −12。
:::

:::quiz
关于 Softmax，下列说法错误的是？

A. 输出所有元素和为 1
B. 输出元素都为正
C. 输入 logits 的绝对值会影响分布的尖锐程度
D. Softmax 会改变输入的顺序

答案: D
解析: Softmax 是保序的（单调变换）：logit 大的类别概率一定大。它不会改变大小顺序，只是把分数变成概率。C 正确：logit 差异越大分布越尖。
:::

:::related
依赖 | 线性回归, MSE, 梯度下降
用于 | 反向传播, 优化器, 交叉熵, Transformer
:::
