> **本章定位**：第二部分「构建 (Build)」的起点。前面 10 章解决了「懂原理」，从本章开始解决「写得出来」。目标：读完本章，你能读懂并自己写出 small LLM 的全部代码。本章不引入新模型概念，只补齐动手所需的 PyTorch 工具箱。

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测）
- 【Skeleton】工程骨架：逻辑完整，需要自备数据/环境/权重
- 【Pseudo-code】算法示意：用于解释思路，不保证可直接运行
:::

## 11.1 为什么单独练 PyTorch

:::unfold 先懂直觉
LLM 的论文公式最终都要落成 PyTorch 代码。但初学者常见的困境是：**公式看懂了，代码读不懂**——`transpose(-2,-1)` 是转什么？`keepdim=True` 为什么必要？`loss.backward()` 到底写了什么？本章把这些问题一次性讲清，后面 12、13 章的 Lab 才能顺畅跟做。
:::

**结论先行**——一个 LLM 工程师 90% 的时间只用这 12 个工具：

| 工具 | 一句话用途 | 本章小节 |
| --- | --- | --- |
| `Tensor` 的 shape/dtype/device | 一切数据的载体 | 11.2 |
| `reshape / view / transpose / permute` | 形状变换（attention 的核心操作） | 11.3 |
| 广播机制 | 不加循环做批量运算 | 11.4 |
| `matmul / @ / einsum` | 矩阵乘法与维度缩写 | 11.5 |
| `nn.Module / Parameter` | 组织模型与参数 | 11.6 |
| autograd（`backward`） | 自动求梯度 | 11.7 |
| `Dataset / DataLoader` | 喂数据 | 11.8 |
| 训练循环五件套 | 训练的标准骨架 | 11.9 |
| `no_grad / eval` | 推理模式 | 11.10 |
| `device / dtype / autocast` | GPU 与精度 | 11.11 |
| `state_dict / checkpoint` | 保存与续训 | 11.12 |
| shape 断言与最小复现 | 调试 | 11.13 |

:::note 「能读懂」的标准
看到任意一行 LLM 训练代码，你能说出：① 每个张量的 shape；② 这一行在公式上对应什么操作；③ 它跑在哪个 device、什么 dtype。做不到就先别急着读模型代码。
:::

## 11.2 Tensor：shape / dtype / device

:::unfold 先懂直觉
Tensor 就是「带类型的多维数组 + 住在某块设备上」。LLM 里所有东西——输入、参数、激活、梯度——都是 Tensor。读代码第一件事永远是问：**这个 tensor 的 shape、dtype、device 是什么？**
:::

```python
import torch

x = torch.tensor([[1.0, 2.0], [3.0, 4.0]])   # 从 Python 列表创建
print(x.shape)    # torch.Size([2, 2])
print(x.dtype)    # torch.float32
print(x.device)   # cpu

y = torch.randn(2, 3)                 # 标准正态
z = torch.zeros(2, 3)                 # 全 0
w = torch.arange(0, 10, 2)            # [0, 2, 4, 6, 8]
e = torch.empty(4, 4)                 # 未初始化（省时间，但值随机）

x_gpu = x.to("cuda")                  # 搬到 GPU
x_half = x.to(torch.bfloat16)         # 改精度
x_reshaped = x.view(1, 4)             # 改形状
```

### 三种最常打交道的 dtype

| dtype | 用途 | 显存/参数 |
| --- | --- | --- |
| `torch.float32` (fp32) | 优化器状态、master weights | 4 bytes |
| `torch.bfloat16` (bf16) | 前向/反向计算（训练首选） | 2 bytes |
| `torch.float16` (fp16) | 推理/部分训练（需 loss scaling） | 2 bytes |
| `torch.int64` (long) | token id、label、索引 | 8 bytes |

:::warning 最常见的报错来源
**device 不匹配**：`Expected all tensors to be on the same device` —— 模型在 GPU、输入在 CPU（或反过来）。规则：**输入和模型必须在同一 device**，通常做法是 `batch = {k: v.to(device) for k, v in batch.items()}`。
:::

## 11.3 形状变换四件套（LLM 代码的重灾区）

:::unfold 先懂直觉
LLM 代码里 80% 的烧脑行都在做 shape 变换：把 `[B, S, d]` 拆成多头、把 `[B, H, S, D]` 转成 `[B, S, H, D]` 再拼回来。四个函数搞定：`reshape`、`view`、`transpose`、`permute`。
:::

### 对比表（背下来）

| 操作 | 作用 | 是否拷贝 | 典型 LLM 用途 |
| --- | --- | --- | --- |
| `reshape` | 按新形状重排（不满足 view 条件时自动拷贝） | 视情况（必要时拷贝） | 一般性形状重组 |
| `view` | 要求张量的 **stride 与新形状兼容**（见下方说明）；不满足则报错 | 不拷贝 | 展平 logits：`[B,S,V] → [B*S,V]` |
| `transpose(d1,d2)` | 只交换**两个**维度 | 视图（不拷贝，但变不连续） | `K.transpose(-2,-1)` |
| `permute(...)` | 任意重排**所有**维度 | 视图（不拷贝，但变不连续） | `[B,H,S,D] → [B,S,H,D]` |

### 最小数值例子

```python
x = torch.arange(12).reshape(2, 3, 2)     # [2, 3, 2]
print(x.shape)                            # torch.Size([2, 3, 2])

a = x.transpose(1, 2)                     # 交换第 1、2 维 → [2, 2, 3]
b = x.permute(2, 0, 1)                    # 任意重排 → [2, 2, 3]
c = x.reshape(2, 6)                       # → [2, 6]
d = x.view(6, 2)                          # → [6, 2]（x 连续，可 view）

print(a.shape, b.shape)                   # 都是 [2, 2, 3]，但值不同！
```

:::math view 的准确条件：stride 兼容，而非「绝对连续」
`transpose`/`permute` 只改「步长」（stride），不搬数据。之后调用 `view` 何时会失败？**当新的形状无法用原 stride 表达时**——转置后的张量通常如此：

```python
x = torch.arange(12).reshape(2, 3, 2)
xt = x.transpose(1, 2)          # [2, 2, 3]，stride 已改变
xt.view(2, 6)                   # ❌ RuntimeError: view size is not compatible ...
xt.reshape(2, 6)                # ✅ reshape 自动拷贝一份再变形
xt.contiguous().view(2, 6)      # ✅ 显式拷贝，然后 view 合法
```

严格来说，`view` 要求的是「stride 与新形状兼容」（例如「是否连续」的特殊情况），而**不是**简单的一条「必须 contiguous」；但实操中记「转置/换维之后不要直接 view，改用 reshape 或先 contiguous」就够用了。LLM 代码里 `reshape` 更常用，因为它会自动处理不满足条件的情况。
:::

:::fold 工程里怎么用（多头注意力的形状往返，第 7 章实现的完整版）
```python
B, S, d_model, H = x.size(0), x.size(1), x.size(2), 8
D = d_model // H

# 1) 投影 → [B, S, d_model]，拆成多头 → [B, S, H, D]
q = Wq(x).view(B, S, H, D)
# 2) 把 head 维换到前面 → [B, H, S, D]，方便批量算注意力
q = q.transpose(1, 2)          # 或 permute(0, 2, 1, 3)
k = Wk(x).view(B, S, H, D).transpose(1, 2)
v = Wv(x).view(B, S, H, D).transpose(1, 2)

# 3) 注意力 → [B, H, S, S] @ [B, H, S, D] = [B, H, S, D]
attn = (q @ k.transpose(-2, -1)) / (D ** 0.5)
out = attn.softmax(-1) @ v

# 4) 拼回 → [B, S, d_model]
out = out.transpose(1, 2).contiguous().view(B, S, d_model)
out = Wo(out)
```
:::

:::shapeflow
x [B, S, d] → view → [B, S, H, D] → transpose(1,2) → [B, H, S, D]
Q@Kᵀ [B, H, S, S] → softmax → @V [B, H, S, D]
→ transpose(1,2) → [B, S, H, D] → view → [B, S, d]
:::

## 11.4 广播：不加循环做批量运算

:::unfold 先懂直觉
广播让不同形状的 tensor 直接做逐元素运算：小形状会自动「复制扩展」到大形状。理解它，就能看懂 `scores + mask`、`logits - logits.max(keepdim=True)` 这类常见写法。
:::

### 三条规则

1. 从**最后一维**开始向左对齐；
2. 两维相等，或其中一维是 1 → 兼容；
3. 不兼容 → 报错。

```python
a = torch.randn(3, 4)         # [3, 4]
b = torch.randn(4)            # [4]      → 广播成 [3, 4]
c = a + b                     # ✅

d = torch.randn(3, 1)         # [3, 1]   → 广播成 [3, 4]
e = a + d                     # ✅

f = torch.randn(3)            # [3]      → 与 [3, 4] 不兼容
# a + f  →  RuntimeError: The size of tensor a (4) ...
```

### LLM 三个经典用法

```python
# ① 因果掩码：scores [B, S, S] + mask [S, S]
scores = scores + causal_mask                # 广播自动处理 B 维

# ② padding mask：scores [B, S, S] + mask [B, 1, S]
scores = scores.masked_fill(pad_mask[:, None, :] == 0, float("-inf"))

# ③ softmax 数值稳定：每行减最大值
scores = scores - scores.max(dim=-1, keepdim=True).values
# keepdim=True 保留 [B, S, 1] 的形状，才能正确广播回 [B, S, S]
```

:::warning 高频错误
`keepdim=True` 忘写：`scores.max(dim=-1)` 得到 `[B, S]`，减去时会从**最后一维**对齐，变成减错维度（或直接报错）。凡是「按某维做归约、再减回原张量」的场景，几乎都要 `keepdim=True`。
:::

:::math 为什么广播不会浪费显存
PyTorch 的广播是**逻辑扩展**（stride 设为 0），不会真的复制数据。`[4] → [3,4]` 不会分配 3 倍内存。只有结果张量会占用新内存。
:::

## 11.5 矩阵乘法：matmul / @ / einsum

:::unfold 先懂直觉
LLM 就是一堆矩阵乘法。PyTorch 里表达矩阵乘法有三级工具：`@` 最直观、`matmul` 支持批量、`einsum` 能把复杂维度变换写成一行「下标方程」，特别适合检查 shape 是否写对。
:::

### 三种写法对照

```python
A = torch.randn(2, 3, 4)      # [B=2, m=3, k=4]
B_ = torch.randn(2, 4, 5)     # [B=2, k=4, n=5]

C1 = A @ B_                   # [2, 3, 5]（批量矩阵乘）
C2 = torch.matmul(A, B_)      # 同上
C3 = torch.einsum("bmk,bkn->bmn", A, B_)   # 同上，下标显式写出

# 只对最后两维做矩阵乘、前面维度广播：
A4 = torch.randn(2, 3, 4, 5)
B4 = torch.randn(4, 5, 6)
C4 = A4 @ B4                  # [2, 3, 4, 6]
```

### 用 einsum 重写 Attention（检查 shape 的神器）

```python
# 第 7 章的公式：Attention(Q,K,V) = softmax(QKᵀ/√d)V
# Q,K,V: [B, H, S, D]

scores = torch.einsum("bhsd,bhtd->bhst", Q, K) / (D ** 0.5)   # [B,H,S,S]
attn = scores.softmax(dim=-1)
out = torch.einsum("bhst,bhtd->bhsd", attn, V)                 # [B,H,S,D]
```

:::note einsum 的读法
`bhsd,bhtd->bhst`：两个输入的下标里，`d` 出现在两个输入中但不在输出里 → **沿 d 求和**（点积）；`s` 和 `t` 分别保留 → 输出 `[b,h,s,t]`。**出现即保留，消失即求和**，这就是 einsum 的全部规则。
:::

### 表格：LLM 里常见的矩阵乘

| 场景 | 形状变化 | 写法 |
| --- | --- | --- |
| 线性投影 | `[B,S,d] @ [d,d']` → `[B,S,d']` | `x @ W` 或 `nn.Linear` |
| Attention 分数 | `[B,H,S,D] @ [B,H,D,S]` → `[B,H,S,S]` | `q @ k.transpose(-2,-1)` |
| 加权求和 | `[B,H,S,S] @ [B,H,S,D]` → `[B,H,S,D]` | `attn @ v` |
| LM Head | `[B,S,d] @ [d,V]` → `[B,S,V]` | `x @ W_lm` |
| LoRA 低秩更新 | `[d,r] @ [r,k]` → `[d,k]` | `B @ A` |

:::warning 两个易错点
- **`*` 是逐元素乘，不是矩阵乘**：`A * B` 要求形状可广播；矩阵乘必须 `@` / `matmul` / `einsum`。
- **batch 维不参与矩阵乘**：`@` 只对最后两维做矩阵乘、前面的维度按广播对齐。所以 `[B,H,S,D] @ [B,H,D,S]` 是对的，而 `[B,H,S,D] @ [D,S]` 也能工作（B、H 维广播）。
:::

## 11.6 nn.Module 与 Parameter：组织模型

:::unfold 先懂直觉
`nn.Module` 就是一个「会记账的层」：任何赋值为属性的 `nn.Parameter` / 子模块都会被自动登记，于是 `model.parameters()` 能一次拿到全部参数交给优化器。LLM 就是把几十个这样的层拼起来。
:::

### 手写一个 Linear（理解内部）

```python
import torch, torch.nn as nn
import math

class MyLinear(nn.Module):
    def __init__(self, in_features, out_features):
        super().__init__()                                # 必须调用
        self.weight = nn.Parameter(torch.empty(out_features, in_features))
        self.bias = nn.Parameter(torch.zeros(out_features))
        nn.init.kaiming_uniform_(self.weight, a=math.sqrt(5))

    def forward(self, x):                                 # x: [..., in_features]
        return x @ self.weight.t() + self.bias            # [..., out_features]

lin = MyLinear(768, 256)
print(sum(p.numel() for p in lin.parameters()))           # 768*256 + 256 = 196,864
```

### nn.Module 的三条规则

| 规则 | 说明 |
| --- | --- |
| `__init__` 里定义参数和子模块 | 用 `self.x = ...` 赋值即可自动注册 |
| 计算写在 `forward` | 调用时用 `model(x)`（自动走 hooks），不要直接 `.forward(x)` |
| 参数用 `nn.Parameter` | 普通 tensor 不会被登记，也就不会被优化器更新 |

:::fold 工程里怎么用（一个最小 Transformer Block 的骨架）
```python
class Block(nn.Module):
    def __init__(self, d, h):
        super().__init__()
        self.norm1 = nn.LayerNorm(d)
        self.attn = nn.MultiheadAttention(d, h, batch_first=True)
        self.norm2 = nn.LayerNorm(d)
        self.ffn = nn.Sequential(
            nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d)
        )

    def forward(self, x):
        h = x + self.attn(self.norm1(x), self.norm1(x), self.norm1(x))[0]
        out = h + self.ffn(self.norm2(h))
        return out

model = nn.Sequential(*[Block(256, 8) for _ in range(4)])
print(sum(p.numel() for p in model.parameters()))
```
:::

## 11.7 autograd：把第 1 章的手算交给框架

:::unfold 先懂直觉
第 1 章你手算过 $\partial L/\partial w = -12$。PyTorch 的做法是：给参数设 `requires_grad=True`，前向时框架默默记录计算图，调用 `.backward()` 时按链式法则自动算所有梯度，结果存在 `.grad` 里。
:::

```python
import torch

x = torch.tensor(2.0)
y = torch.tensor(5.0)
w = torch.tensor(1.0, requires_grad=True)   # 需要求导

z = w * x            # 前向（自动记录计算图）
L = (z - y) ** 2
L.backward()         # 反向：自动微分

print(w.grad)        # tensor(-12.)   ← 与第 1 章手算完全一致
```

### 手动对照：计算图长这样

```
w ──×── z = wx ──(z−y)²── L
∂L/∂w ← ∂L/∂w = ∂L/∂z · ∂z/∂w
     = 2(z−y) · x = (−6)·2 = −12
```

:::demo backprop 交互：前向/反向/更新三步走（第 1 章实现）
拖动 x、w、y，点「前向传播 → 反向传播 → 更新参数」，每一步显示具体数字——和 autograd 的结果一一对应。
:::

### 三条必须记住的规则

| 规则 | 说明 |
| --- | --- |
| **梯度会累积** | `backward()` 是 `+=`，所以每步前要 `optimizer.zero_grad()` |
| **只有叶子节点默认有 `.grad`** | `w.grad` 有值；中间张量要看 `retain_grad()` |
| **想断开梯度** | `.detach()` 或 `with torch.no_grad():`（推理、生成标签、RL 采样都要用） |

:::warning 训练里最常见的 3 个 autograd 事故
1. **忘记 `zero_grad()`** → 梯度越滚越大，loss 爆炸；
2. **在 `backward()` 后又对同一图调用一次** → `RuntimeError: Trying to backward through the graph a second time`（需要 `retain_graph=True` 或重建图）；
3. **在 `no_grad` 区域里构建了需要梯度的计算** → 训练不更新（比如把模型输出存成了好几步之前的旧值）。
:::

## 11.8 Dataset / DataLoader：喂数据

:::unfold 先懂直觉
LLM 的「数据集」其实很简单：一大串 token id。训练时随机切一段长度为 S 的窗口，喂给模型。（更复杂的文档边界、packing 在数据管线章节讲。）
:::

```python
from torch.utils.data import Dataset, DataLoader

class TokenDataset(Dataset):
    """data.bin：把整个语料存成一串 uint16 token id"""
    def __init__(self, path, seq_len):
        import numpy as np
        self.data = np.memmap(path, dtype=np.uint16, mode="r")
        self.seq_len = seq_len

    def __len__(self):
        return len(self.data) - self.seq_len - 1

    def __getitem__(self, i):
        x = torch.from_numpy(self.data[i:i + self.seq_len].astype("int64"))
        y = torch.from_numpy(self.data[i + 1:i + 1 + self.seq_len].astype("int64"))
        return x, y                      # 输入与「右移一位」的标签

ds = TokenDataset("data.bin", seq_len=512)
loader = DataLoader(ds, batch_size=32, shuffle=True, num_workers=4, pin_memory=True)

x, y = next(iter(loader))
print(x.shape, y.shape)                  # [32, 512] [32, 512]
```

:::note 训练时标签是怎么来的
`y` 不是另存一份数据，而是 `x` **右移一位**：位置 t 的输入预测位置 t+1 的 token。这就是第 9 章讲的 shift 对齐。
:::

## 11.9 训练循环：标准骨架

:::unfold 先懂直觉
所有 LLM 训练（从 0.1B 玩具到 GPT-4）都是同一个五步循环，多出来的只是分布式和调度细节。
:::

```python
model.train()
for step, (x, y) in enumerate(loader):
    x, y = x.to(device), y.to(device)

    logits = model(x)                          # ① 前向：  [B,S,V]
    loss = F.cross_entropy(                       # ② 算损失
        logits.view(-1, logits.size(-1)),
        y.view(-1),
    )

    optimizer.zero_grad(set_to_none=True)      # ③ 清梯度
    loss.backward()                            # ④ 反向：算梯度
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)  # 梯度裁剪
    optimizer.step()                           # ⑤ 更新参数

    if step % 50 == 0:
        print(f"step {step}  loss {loss.item():.4f}")
```

### 五个零件各自的角色

| 零件 | 作用 | 相关章节 |
| --- | --- | --- |
| `model(x)` | 前向传播 | 第 9 章 |
| `F.cross_entropy` | next token 的损失 | 第 1 章 |
| `zero_grad` | 清空上一步梯度（autograd 是累加的） | 第 2 章 |
| `backward` | 自动微分 | 第 1 章 |
| `step` | 优化器更新（AdamW） | 第 2 章 |
| `clip_grad_norm_` | 防梯度爆炸 | 第 4 章 |

:::fold 工程里怎么用（加学习率调度与梯度累积）
```python
scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)  # warmup+cosine

accum_steps = 8
for step, (x, y) in enumerate(loader):
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, V), y.view(-1)) / accum_steps
    loss.backward()                              # 梯度在 .grad 里累积

    if (step + 1) % accum_steps == 0:            # 攒够 8 个 micro-batch 才更新
        clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
```
梯度累积 = 用小显存模拟大 batch（见第 17 章）。
:::

## 11.10 no_grad / eval / inference_mode

:::unfold 先懂直觉
训练要梯度（占显存），推理不要。两行代码的区别能让推理显存降一半、速度快一截。
:::

| 用法 | 作用 | 什么时候用 |
| --- | --- | --- |
| `model.train()` | 开启 dropout 等训练行为 | 训练前 |
| `model.eval()` | 关闭 dropout、BN 用 running stats | 验证/推理前 |
| `torch.no_grad()` | 不建计算图、不存中间激活 | 验证/推理/生成标签 |
| `torch.inference_mode()` | 更强版本（连版本计数都不记） | 纯推理 |

```python
model.eval()
with torch.no_grad():
    logits = model(x_val)
    val_loss = F.cross_entropy(logits.view(-1, V), y_val.view(-1))
```

:::warning eval() 不等于 no_grad()
`eval()` 只改层的**行为**（dropout/BN），不省显存；`no_grad()` 才是不建图。验证循环两个都要。
:::

## 11.11 device / dtype / autocast：进入 GPU 世界

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)

# 混合精度：前向/反向用 bf16，主权重仍是 fp32（第 17 章细讲）
with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, V), y.view(-1))
loss.backward()

# 查看显存
print(torch.cuda.memory_allocated() / 1e9, "GB")
print(torch.cuda.max_memory_allocated() / 1e9, "GB")
```

:::note 三个 dtype 何时出现
- **数据/参数**：训练默认 fp32（老代码）或 bf16（新代码）；
- **计算**：autocast 区域内自动用 bf16/fp16 做矩阵乘；
- **token id / label**：必须是整数（int64），永远不要转成浮点。
:::

## 11.12 state_dict / checkpoint：保存与续训

:::unfold 先懂直觉
`state_dict` 是一个字典：参数名 → 张量。保存它就是保存模型；加载它就是恢复模型。断点续训还要额外保存优化器状态和步数。
:::

```python
# 只保存模型权重（推理用）
torch.save(model.state_dict(), "model.pt")
model.load_state_dict(torch.load("model.pt", map_location="cpu"))

# 断点续训 checkpoint（训练用）
ckpt = {
    "model": model.state_dict(),
    "optimizer": optimizer.state_dict(),
    "scheduler": scheduler.state_dict(),
    "step": step,
}
torch.save(ckpt, f"ckpt_{step}.pt")

# 恢复
ckpt = torch.load("ckpt_1000.pt", map_location=device)
model.load_state_dict(ckpt["model"])
optimizer.load_state_dict(ckpt["optimizer"])
scheduler.load_state_dict(ckpt["scheduler"])
start_step = ckpt["step"]
```

:::warning 常见坑
- `map_location`：在 GPU 上存的权重，想在 CPU 上加载时必须写 `map_location="cpu"`；
- 保存 `state_dict()` 而不是整个 `model` 对象（后者依赖类定义，跨项目会加载失败）；
- 恢复后别忘 `model.train()` 和把 `start_step` 接上——否则调度器会从头开始。
:::

## 11.13 调试清单：shape 断言与最小复现

:::unfold 先懂直觉
LLM 代码的 bug 90% 是 shape 错、device 错、dtype 错。学会「三行断言 + 最小复现」，比会写代码更重要。
:::

```python
# ① shape 断言：把期望写出来，让错误尽早暴露
assert x.shape == (B, S), f"expected [B,S], got {x.shape}"
assert q.shape == (B, H, S, D)

# ② device / dtype 断言
assert x.device == model.device or x.device.type == "cuda"
assert y.dtype == torch.long

# ③ 最小复现：造 2 个样本、3 个 token、8 维的小输入
x = torch.randint(0, 100, (2, 3)).to(device)
```

### 常见报错对照表（收藏）

| 报错 | 原因 | 修法 |
| --- | --- | --- |
| `Expected all tensors on same device` | 输入没 `.to(device)` | 统一 device |
| `view size is not compatible with stride` | 转置后直接 view | 先 `.contiguous()` 或改 `reshape` |
| `Trying to backward through the graph a second time` | 重复 backward | 重建前向或 `retain_graph=True` |
| `CUDA out of memory` | batch 太大 | 降 batch / 梯度累积 / 看第 17 章 |
| `Expected Long but got Float` | label 是浮点 | `y.long()` |
| `RuntimeError: mat1 and mat2 shapes cannot be multiplied` | 矩阵乘维度不匹配 | 打印 shape 逐个核对 |

:::key 本章必须记住
| 工具 | 一句话 |
| --- | --- |
| shape/dtype/device | 读代码第一问 |
| view/reshape/transpose/permute | 多头注意力全靠它们 |
| 广播 + keepdim=True | 归约后减回原张量 |
| einsum 下标规则 | 出现即保留，消失即求和 |
| nn.Module | 参数自动登记、forward 写计算 |
| zero_grad/backward/step | 训练五件套中的三件 |
| no_grad + eval | 验证/推理的标配 |
| state_dict | 保存模型 = 保存参数字典 |
:::

:::quiz
一行代码 `out = out.transpose(1, 2).contiguous().view(B, S, d)` 中，`contiguous()` 的作用是？

A. 加快矩阵乘法
B. 把转置后的数据真正重排为连续内存，使 view 合法
C. 自动复制 batch 维
D. 转为半精度

答案: B
解析: transpose/permute 只改 stride 不搬数据，之后直接 view 会因内存不连续而报错；contiguous() 做一次真实拷贝使内存连续。
:::

:::quiz
`scores.max(dim=-1, keepdim=True)` 中 keepdim=True 的作用是？

A. 节省显存
B. 保留被归约的维度（[B,S,1]），使其能正确广播回 [B,S,S]
C. 只取每个 batch 的最大值
D. 加速计算

答案: B
解析: 归约后若不保留维度得到 [B,S]，与 [B,S,S] 相减时会从最后一维对齐导致算错或报错；keepdim 保留为 [B,S,1] 才能按行广播。
:::

:::quiz
关于 `optimizer.zero_grad()`，说法正确的是？

A. 可选操作，可省略
B. 必须每步调用，因为 PyTorch 的梯度是累加的
C. 只在第一个 step 需要
D. 它会重置模型参数

答案: B
解析: backward() 是梯度累加（+=），不清零会导致梯度滚雪球。梯度累积场景下是每 accum_steps 步清一次，但本质仍是要清零。
:::

:::quiz
为什么验证循环要同时用 `model.eval()` 和 `torch.no_grad()`？

A. 两者功能相同，用哪个都行
B. eval() 改变层行为（关 dropout），no_grad() 不建计算图省显存，两者作用不同
C. eval() 更快
D. no_grad() 会关闭 dropout

答案: B
解析: eval() 只改行为（dropout/BN），不影响显存；no_grad() 不构建计算图、不存中间激活，才真正省显存。验证时两个都要。
:::

:::related
依赖 | 第 1 章 反向传播, 第 2 章 优化器, 第 7 章 Attention
用于 | 第 12 章 组件篇 Lab, 第 13 章 训练篇 Lab, 第 16 章 分布式训练
:::
