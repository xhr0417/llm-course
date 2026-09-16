> **本章定位**：第二批第二模块（Kernel Bridge）。第 15 章建立了 Roofline 心智模型，本章是它的**第一个真实案例**：为什么 Attention 的数学没变、FLOPs 没少，却可以显著更快？
>
> 前置：第 7 章（Attention 数学）、第 15 章（GPU 存储层次 / Roofline）。本章不重讲 Attention 数学，只回答「数据在哪、怎么搬」。

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测；CPU 可跑的部分均已实测）
- 【Runnable on CUDA】需要 GPU（当前验证环境无 CUDA，已标注 NOT EXECUTED）
- 【Skeleton】工程骨架：逻辑完整，需要自备环境
- 【Pseudo-code】算法示意
:::

## 19.1 换一个视角：从「数学」到「数据在哪」

:::unfold 先懂直觉
第 7 章我们问「Attention 的数学是什么」；本章问一个系统问题：**这些矩阵算出来之后放在哪、从哪里读、往哪里写？** 你会发现：标准实现的瓶颈不是乘加次数，而是**HBM 的读写量**。
:::

回顾 Attention 三步（数学完全不变）：

$$
S = \frac{QK^\top}{\sqrt{d_k}} \quad\Rightarrow\quad P = \text{softmax}(S) \quad\Rightarrow\quad O = PV
$$

**新增的问题**：$S$ 是 $S_{len} \times S_{len}$ 的矩阵。在标准实现里，它被**物化**（materialize）到 HBM，然后 softmax 再读回来、写回去，再和 V 相乘……数据在 HBM 与计算单元之间来回搬运。

:::math 先估算一下这个搬运量（教学量级估算）
设序列长度 $S$、head 维度 $d$，FP16（2 字节）：

- $S$ 矩阵大小：$S^2 \times 2$ 字节；
- 标准实现里它至少被「写一次 + 读多次」（softmax 读、PV 再读）→ 量级 $O(S^2)$ 的 HBM 流量（仅这一个中间矩阵）。

对比：$Q/K/V$ 的体量是 $O(S \cdot d)$。当 $S \gg d$（长上下文常见），**$S^2$ 项完全主导**——这就是问题所在。
:::

## 19.2 标准 Attention 的真实问题：HBM I/O

:::unfold 先懂直觉
把标准 attention 的每个操作拆开看，你会看到「计算—写 HBM—读 HBM—计算—写 HBM」的反复横跳。
:::

```
① S = QKᵀ          → 写出 S（S² 个元素）到 HBM
② softmax(S)       → 从 HBM 读 S → 计算 → 把 P 写回 HBM
③ O = P·V          → 从 HBM 读 P（和 V）→ 计算 → 写出 O
```

| 问题 | 说明 |
| --- | --- |
| S×S 中间矩阵物化 | 显存占用 $O(S^2)$（长上下文直接爆） |
| 反复读写 | 每一步都要把大矩阵搬进搬出 HBM |
| 算力闲置 | 计算单元等数据——典型的 memory-bound（第 15 章） |

:::demo attention-io 交互：数据搬运对比
对比「标准实现」与「分块融合」两条数据路径，看中间矩阵是否被写入 HBM、搬运量差多少（教学示意量级）。
:::

## 19.3 HBM vs SRAM：第 15 章的 Roofline 终于用上了

:::unfold 先懂直觉
GPU 的片上 SRAM（shared memory / register）带宽比 HBM 高一个数量级、容量小两个数量级。**如果能让中间结果待在片上完成全部计算，就省掉了绝大部分 HBM 流量。** 这正是 FlashAttention 的思路。
:::

| 存储 | 容量（量级） | 带宽（量级） | 角色 |
| --- | --- | --- | --- |
| Register | KB / SM | 最高 | 计算直接使用 |
| Shared Memory / SRAM | ~百 KB / SM | ~10+ TB/s | 分块暂存 |
| HBM | 几十 GB | ~2 TB/s（A100） | 大矩阵的家 |

**Roofline 联系**：朴素 Attention 的算术强度低（第 15 章表中「数 ~ 数十」），落在带宽墙上；分块融合把算术强度抬高，性能向上移动。

## 19.4 Tiling：分块计算

:::unfold 先懂直觉
不一次算完整的 S×S。把 Q 切成行块（tile），K/V 切成列块，每次把小小的 block 载入 SRAM，算一小块结果并「累积」到输出里。中间结果**从不写入 HBM**。
:::

```
for each Q_tile (在 SRAM 中):
    for each K_tile, V_tile:
        载入 SRAM → 算局部 scores → 更新 running 统计 → 累积到输出
    输出 O_tile 写出 HBM（只写一次）
```

:::demo tiling 交互：一块一块算 Attention
点「下一步」观察 Q tile 如何逐个与 K/V tile 相乘、累积；高亮当前在 SRAM 中的块与被复用/丢弃的块。
:::

## 19.5 Online Softmax：本章最难但必须讲懂的地方

:::unfold 先懂直觉
Softmax 需要**全局**最大值和**全局**指数和——但分块计算时我们只有一部分分数。Online softmax 的做法：**边看边修**——维护 running max 和 running sum，每来一个新块就更新它们，并**按新 max 修正之前累积的结果**。
:::

### 普通 softmax（一次看全）

$$
\text{softmax}(x_i) = \frac{e^{x_i - m}}{\sum_j e^{x_j - m}}, \qquad m = \max_j x_j
$$

### Online 版本（分块看）

维护三个量：running max $m$、running denominator $\ell$、partial output $o$。新块到来时：

$$
m_{new} = \max(m, \max(\text{block})), \qquad
\ell_{new} = \ell \cdot e^{m - m_{new}} + \sum_{\text{block}} e^{x_i - m_{new}}
$$

$$
o_{new} = o \cdot e^{m - m_{new}} + \sum_{\text{block}} e^{x_i - m_{new}} v_i
$$

**关键**：旧结果乘上修正因子 $e^{m - m_{new}}$，等价于「用新 max 重新归一化」。

### 超小数值例子：scores = [1, 2] 与 [3, 4]

**标准 softmax（一次算）**：

$$
e^{[1,2,3,4]} = [2.718,\ 7.389,\ 20.09,\ 54.60], \quad \text{sum} = 84.79
$$

$$
\text{weights} = [0.0321,\ 0.0871,\ 0.2369,\ 0.6439]
$$

**Online 分两块算**：

| 步骤 | $m$ | $\ell$ | 说明 |
| --- | --- | --- | --- |
| 看到块 1 = [1,2] | 2 | $e^{1-2} + e^{2-2} = 0.3679 + 1 = 1.3679$ | 局部 max/sum |
| 看到块 2 = [3,4] | 4（更新） | 旧 $\ell$ 修正：$1.3679 \times e^{2-4} = 0.1851$；加新块：$0.1851 + (0.3679 + 1) = 1.5530$ | 旧结果按新 max 修正 |
| 最终权重 | — | 块 1：$e^{1-4}/\ell = 0.0321$、$e^{2-4}/\ell = 0.0871$；块 2：$e^{3-4}/\ell = 0.2369$、$e^{4-4}/\ell = 0.6439$ | **与标准结果一致** ✅ |

:::demo online-softmax 交互：分块算 softmax，逐步验证
点「下一步」看 running max / denominator / partial output 如何更新；每一步都可以和上面的手算表核对。最后与「一次算」的结果对比，验证**完全相等**。
:::

:::key online softmax 的意义
**不需要保存完整 score matrix**——任意时刻只需要当前块的分数、running 统计和 partial output。这就是 FlashAttention 能「不物化 S×S」的全部秘密。
:::

## 19.6 FlashAttention 的核心（正确表述）

:::unfold 先懂直觉
FlashAttention 是**精确注意力**（exact attention）：数学结果与标准实现完全一致，不是近似算法。它优化的是**数据搬运**与**显存占用**。
:::

| 维度 | 标准 Attention | FlashAttention |
| --- | --- | --- |
| 数学结果 | 精确 | **精确（相同）** |
| 计算复杂度 | $O(S^2 d)$ | **仍是 $O(S^2 d)$（没有变）** |
| S×S 中间矩阵 | 物化到 HBM | **不物化**（分块 + online softmax） |
| 显存占用 | $O(S^2)$ | $O(S)$（只存输出与统计量） |
| HBM 流量 | 高（反复读写大矩阵） | 显著降低（tile 载入/写出） |
| Wall-clock | 基准 | 实际更快（尤其长序列） |

:::warning 三个不要写错的结论
1. **FLOPs 没有减少**：乘加次数与标准 attention 同量级；
2. **不是近似**：没有抽样、没有稀疏化（那是别的技术）；
3. **「更快」有条件**：收益主要来自减少 HBM 流量，具体加速比取决于序列长度、head 维度、硬件与实现——**不要给没有出处的固定倍数**。
:::

## 19.7 FA1 → FA2：高层演进（不深入 kernel 细节）

| 版本 | 主要改进 | 一句话 |
| --- | --- | --- |
| **FA1**（2022） | IO-aware：tiling + online softmax，不物化 S×S | 「把数据留在片上」 |
| **FA2**（2023） | 更好的 work partitioning 与并行度；减少非 matmul 的 FLOPs；提高 occupancy | 「同样的思路，把 GPU 用得更满」 |

> 学习顺序建议：先把「tiling + online softmax + 不物化」讲清楚，再去看论文细节。kernel 级的调度优化属于工程深入，不影响对核心思想的理解。

## 19.8 什么时候收益最大

| 场景 | 为什么 |
| --- | --- |
| 长序列（$S$ 大） | $S^2$ 项主导，省下的 HBM 流量最多 |
| 训练（需要存 attention 矩阵） | 显存从 $O(S^2)$ 降到 $O(S)$，可训更长上下文 |
| 大 batch 推理的 prefill | prefill 是「长序列的一次性大计算」，与训练同构 |

在很短的序列上（$S$ 小），$S^2$ 本来就不大，收益有限——**这不是「永远快 3 倍」的魔法**。

## 19.9 Triton：定位

:::unfold 先懂直觉
PyTorch 是「调用别人写好的 kernel」；Triton 是「用 Python 语法自己写 kernel」。它不要求你学 CUDA C++、线程索引、shared memory 手工管理——你只需要描述「每个 program 处理哪一块数据」。
:::

| | PyTorch | CUDA | Triton |
| --- | --- | --- | --- |
| 你写什么 | 组合算子 | 线程级 kernel | **块级（block-level）kernel** |
| 门槛 | 低 | 高 | 中 |
| 控制力 | 低 | 最高 | 中高 |
| 典型用途 | 99% 的模型代码 | 极致优化的库 | 自定义 fused kernel |

**为什么需要 Triton**：像本章这种「多个算子融合成一个 kernel」的优化（softmax 的 max/sub/exp/sum/div 融合、attention 的 QKᵀ+softmax+PV 融合），PyTorch 组合写法会产生多次 HBM 往返；Triton 让你在一个 kernel 里完成。

## 19.10 第一个 Triton Kernel：Vector Add

```python
# 类型：【Runnable on CUDA】需要 GPU + pip install triton
import torch, triton
import triton.language as tl

@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(0)                     # 我是第几个 program（块）
    offsets = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)   # 本块负责的元素下标
    mask = offsets < n_elements                # 边界掩码（最后一块可能不满）
    x = tl.load(x_ptr + offsets, mask=mask)    # 从 HBM 载入本块
    y = tl.load(y_ptr + offsets, mask=mask)
    tl.store(out_ptr + offsets, x + y, mask=mask)   # 写回本块

def add(x, y):
    out = torch.empty_like(x)
    n = x.numel()
    grid = lambda meta: ((n + meta["BLOCK_SIZE"] - 1) // meta["BLOCK_SIZE"],)
    add_kernel[grid](x, y, out, n, BLOCK_SIZE=1024)
    return out

x = torch.randn(1_000_000, device="cuda")
y = torch.randn(1_000_000, device="cuda")
assert torch.allclose(add(x, y), x + y)
```

**视觉对应**：

```
N = 10,000,000，BLOCK_SIZE = 1024
→ grid = 9766 个 program，每个 program 处理 1024 个连续元素
program 0: offsets [0..1023]
program 1: offsets [1024..2047]
...
最后一个 program: mask 掉越界元素
```

:::demo triton-block 交互：program / block / mask 视图
拖动 N 与 BLOCK_SIZE，看 grid 如何切分、最后一个 program 的 mask 如何工作。
:::

## 19.11 Triton Softmax：融合的意义

```python
# 类型：【Runnable on CUDA】row-wise softmax 的 fused kernel（教学简化版）
@triton.jit
def softmax_kernel(out_ptr, in_ptr, row_stride, n_cols, BLOCK_SIZE: tl.constexpr):
    row = tl.program_id(0)                     # 每个 program 处理一行
    cols = tl.arange(0, BLOCK_SIZE)
    mask = cols < n_cols
    x = tl.load(in_ptr + row * row_stride + cols, mask=mask, other=-float("inf"))
    x = x - tl.max(x, axis=0)                  # 稳定 softmax：减最大值
    num = tl.exp(x)
    denom = tl.sum(num, axis=0)
    tl.store(out_ptr + row * row_stride + cols, num / denom, mask=mask)
```

**对比 PyTorch 组合写法**：

```python
# PyTorch：5 个算子 → 可能 5 次以上的 kernel 启动与 HBM 往返
x = x - x.max(dim=-1, keepdim=True).values
e = torch.exp(x)
out = e / e.sum(dim=-1, keepdim=True)
```

在算子是小算子、带宽受限时（第 15 章：softmax 是 memory-bound），**融合成一个 kernel** 意味着中间结果留在片上、读写 HBM 的次数从多次降到一次左右。

## 19.12 Mini Lab：Attention Tiling Simulator

:::unfold 目标
用**纯 CPU 的 NumPy** 模拟分块注意力：验证「分块 + online softmax」的结果与标准 attention **数值一致**。这是不依赖 GPU 也能亲手验证 FlashAttention 核心思想的方式。**本节代码已实际运行验证。**
:::

```python
# 类型：【Runnable】依赖：numpy
# tiled_attention.py —— 分块注意力模拟器（CPU）
import numpy as np

def standard_attention(Q, K, V):
    S = Q @ K.T / np.sqrt(Q.shape[-1])
    P = np.exp(S - S.max(-1, keepdims=True))
    P = P / P.sum(-1, keepdims=True)
    return P @ V

def tiled_attention(Q, K, V, q_tile=4, k_tile=4):
    """分块 + online softmax：不物化完整 S×S 矩阵"""
    n, d = Q.shape
    out = np.zeros((n, d))
    for qi in range(0, n, q_tile):
        q = Q[qi:qi + q_tile]                 # [tq, d]
        m = np.full((q.shape[0], 1), -np.inf) # running max
        l = np.zeros((q.shape[0], 1))         # running denominator
        acc = np.zeros((q.shape[0], d))       # partial output
        for ki in range(0, n, k_tile):
            k = K[ki:ki + k_tile]             # [tk, d]
            v = V[ki:ki + k_tile]
            s = q @ k.T / np.sqrt(d)          # 局部 scores [tq, tk]
            m_new = np.maximum(m, s.max(-1, keepdims=True))
            alpha = np.exp(m - m_new)         # 旧结果修正因子
            # 更新统计与输出（全部在"片上"完成，s 不写回"HBM"）
            p = np.exp(s - m_new)
            l = l * alpha + p.sum(-1, keepdims=True)
            acc = acc * alpha + p @ v
            m = m_new
        out[qi:qi + q_tile] = acc / l         # 最后才归一化并写出
    return out

# 验证
rng = np.random.default_rng(0)
Q, K, V = rng.normal(size=(16, 8)), rng.normal(size=(16, 8)), rng.normal(size=(16, 8))
ref = standard_attention(Q, K, V)
sim = tiled_attention(Q, K, V, q_tile=4, k_tile=4)
print("max diff =", np.abs(ref - sim).max())    # < 1e-12
assert np.allclose(ref, sim, atol=1e-10)
print("Tiled attention 与标准 attention 数值一致 ✅")
```

:::note 这个 Lab 说明什么
- **分块 + online softmax 是精确的**：结果与标准 attention 一致（上面的断言）；
- **中间量从不物化**：`s` 只活在局部变量里，循环结束即回收——这正是 FlashAttention 的显存/IO 优势来源；
- **CPU 也能验证数学正确性**（虽然 CPU 上不会更快——加速来自 GPU 的 HBM/SRAM 层次）。
:::

## 19.13 Benchmark 规范（写进任何 kernel 对比）

```python
# 类型：【Runnable on CUDA】
import torch, time

def bench(fn, warmup=10, rep=50):
    for _ in range(warmup):                      # ① warmup
        fn()
    torch.cuda.synchronize()                     # ② 同步（CUDA 异步！）
    t0 = time.perf_counter()
    for _ in range(rep):
        fn()
    torch.cuda.synchronize()
    return (time.perf_counter() - t0) / rep      # ③ 平均（更稳可用 median / min）
```

:::warning 没有 CUDA 就不要编数据
本课程验证环境**没有 CUDA**，因此：
- 本章所有 Triton 代码标记【Runnable on CUDA】，**未在本课程环境执行**；
- 第 19.12 节的 tiled attention 是 **CPU 实测**（数学正确性）；
- **任何「FlashAttention 快 N 倍」的具体数字都不应来自本课程**——需要你自己在目标硬件上用规范 benchmark（warmup + sync + 多次测量）得出。
:::

:::key 本章必须记住
| 概念 | 一句话 |
| --- | --- |
| 标准 attention 的瓶颈 | S×S 中间矩阵的 HBM 反复读写（memory-bound） |
| Tiling | 把 Q/K/V 切块进 SRAM，中间结果不落 HBM |
| Online softmax | running max/denom + 修正因子，分块也能精确 softmax |
| FlashAttention 本质 | 精确注意力 + IO 优化；**计算复杂度仍是 O(S²)** |
| 显存收益 | 不再物化 S×S → 从 O(S²) 到 O(S) |
| FA1/FA2 | IO-aware → 更好的并行与 occupancy |
| Triton | Python-like 块级 kernel 语言；用于融合自定义 kernel |
| Benchmark 纪律 | warmup + synchronize + 多次测量；无 GPU 不编数据 |
:::

:::quiz
FlashAttention 为什么能加速，但计算复杂度没有从 O(S²) 降低？

A. 因为它用了近似采样
B. 它保持精确计算，减少的是 S×S 中间矩阵在 HBM 的读写与显存占用
C. 因为它降低了 head 维度
D. 因为它跳过了 softmax

答案: B
解析: FlashAttention 是 exact attention：乘加次数与标准实现同量级（O(S²d)），但通过 tiling + online softmax 不物化 S×S 矩阵，把瓶颈从 HBM 流量与显存容量上解除。
:::

:::quiz
Online softmax 为什么需要「修正因子」$e^{m - m_{new}}$？

A. 为了加速计算
B. 因为新块带来了更大的 max，之前累积的 sum/output 需要用新 max 重新归一化
C. 为了减少显存
D. 为了处理负数

答案: B
解析: softmax 依赖全局最大值做数值稳定；分块时 max 会被后续块更新，旧结果必须按新 max 修正后继续累积。修正后的最终结果与一次算的 softmax 完全一致。
:::

:::quiz
关于 Triton 与 PyTorch 的关系，说法正确的是？

A. Triton 是 PyTorch 的替代品
B. Triton 用于写块级自定义 kernel（如算子融合），PyTorch 用于组合现成算子
C. Triton 只能写矩阵乘法
D. Triton 不需要 GPU

答案: B
解析: PyTorch 调用现成 kernel；Triton 让你用 Python 语法写块级 kernel，典型用途是把多个小算子融合（减少 HBM 往返）。两者互补，不是替代关系。
:::

:::related
依赖 | 第 7 章 Attention, 第 15 章 GPU 基础与 Roofline, 第 18 章 packed 序列
用于 | 第 20 章 Inference（prefill 加速）, 长上下文训练
:::
