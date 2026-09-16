> **本章定位**：Scale 主线的地基。不理解 GPU 的算力与带宽模型，后面 FlashAttention、分布式训练、推理优化都只能「背结论」。本章目标：让你看到任何算子都能问出「它是 compute-bound 还是 memory-bound」。

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测）
- 【Skeleton】工程骨架：逻辑完整，需要自备数据/环境/权重
- 【Pseudo-code】算法示意：用于解释思路，不保证可直接运行
:::

## 15.1 为什么必须懂 GPU

:::unfold 先懂直觉
训练 LLaMA-2-7B 要 8.4e22 FLOPs。做一道数量级估算（**注意：下面 CPU 的 1 TFLOPS 是为了直觉而设的教学假设**，真实 CPU 训练吞吐取决于 SIMD 宽度、核心数与内存带宽）：按 1 TFLOPS 算需要

$$
8.4\times10^{22} \div 10^{12} = 8.4\times10^{10}\ \text{秒} \approx 2660\ \text{年}
$$

而用 1000 张 A100 只要 9 天。**GPU 不是「更快的 CPU」，而是完全不同的计算哲学**——理解它的强项和瓶颈，才能理解后面所有的系统优化。
:::

本章回答四个问题：

| 问题 | 答案在哪 |
| --- | --- |
| GPU 为什么快？ | 15.2~15.3：吞吐优先的架构 |
| 什么限制了它？ | 15.4~15.5：带宽与 Roofline |
| 为什么矩阵乘是核心？ | 15.6：GEMM 与 Tensor Core |
| 怎么知道瓶颈在哪？ | 15.7~15.8：Kernel 融合与 Profiling |

## 15.2 CPU vs GPU：延迟 vs 吞吐

:::unfold 先懂直觉
CPU 是「几个博士生」——聪明的核心，擅长复杂的串行逻辑；GPU 是「几千个小学生」——单个很笨，但几千人同时搬砖的吞吐量惊人。LLM 的计算恰好是「大量简单重复的乘加」，完美匹配 GPU。
:::

| | CPU | GPU（A100） |
| --- | --- | --- |
| 核心数 | 8~64 个复杂核心 | 108 个 SM / 6912 个 CUDA Core |
| 单核能力 | 强（分支预测、乱序执行、大缓存） | 弱（简单流水线） |
| 设计目标 | 低延迟（一件事尽快做完） | 高吞吐（单位时间做最多事） |
| 内存带宽 | ~50~200 GB/s | **2039 GB/s**（A100 80GB HBM2e） |
| BF16 算力 | ~0.5~2 TFLOPS（量级示意） | **312 TFLOPS**（Tensor Core，dense） |
| 适合 | 操作系统、分支复杂逻辑 | 矩阵乘、逐元素运算 |

## 15.3 GPU 硬件结构：从 SM 到 warp

:::unfold 先懂直觉
GPU 的层级组织像「公司 → 部门 → 小组 → 员工」：一个 GPU 有多个 SM（部门），每个 SM 有一批 CUDA Core / Tensor Core（员工），线程按 32 个一组（warp，小组）统一行动。
:::

```
GPU
├── SM 0（流多处理器）
│   ├── 128 × CUDA Core（通用浮点/整数计算）
│   ├── 4 × Tensor Core（矩阵乘专用，算力是 CUDA Core 的 8~16 倍）
│   ├── Shared Memory / L1（~192 KB，片上）
│   └── Register File（256 KB）
├── SM 1 ... SM 107
└── L2 Cache（40 MB，片内共享）
    └── HBM 显存（40~80 GB，片外）
```

| 概念 | 含义 | 一句话记忆 |
| --- | --- | --- |
| SM | 流多处理器，GPU 的「部门」 | A100 有 108 个 |
| CUDA Core | 通用计算单元 | 一个周期一次 FMA |
| Tensor Core | 矩阵乘单元（4×4 / 16×16 块乘加） | 同样的周期算多得多 |
| thread / block / grid | 线程 / 线程块 / 网格 | 软件层的组织方式 |
| warp | **32 个线程一组**，统一调度 | 最小执行单位 |
| SIMT | Single Instruction, Multiple Threads | 一条指令 32 个线程同时执行 |

:::math 用数字感受 Tensor Core 的威力
A100 单个 SM 的 BF16 算力：4 个 Tensor Core 每秒约 2.9 TFLOPS → 108 个 SM ≈ 312 TFLOPS。
如果用 CUDA Core 做同样的矩阵乘：只有约 19.5 TFLOPS（FP32）。
**16 倍差距**——这就是「大模型必须用 Tensor Core」的原因，也是低精度（bf16）训练流行的原因。
:::

:::note SIMT 与分支
warp 里的 32 个线程执行同一条指令。如果代码有 `if` 分支导致线程走不同路径，warp 会**串行执行两个分支**（利用率减半）——所以 GPU 讨厌复杂控制流，喜欢整齐的向量/矩阵运算。
:::

## 15.4 存储层次：GPU 世界的「内存墙」

:::unfold 先懂直觉
GPU 算得极快，但数据住在离计算单元很远的 HBM 里。计算单元等数据的时间可能比算的时间还长——这就是「内存墙」。所有高性能 kernel（FlashAttention 等）本质上都在做同一件事：**让数据尽量待在离计算近的地方**。
:::

```
                容量        带宽         延迟
Register      256 KB/SM   ~20 TB/s     1 cycle        ← 最快，线程私有
Shared/L1     192 KB/SM   ~19 TB/s     ~30 cycles     ← 片上共享
L2 Cache      40 MB        ~7 TB/s     ~200 cycles    ← 片内全局
HBM 显存      40~80 GB    2 TB/s       ~400 cycles    ← 最慢，但最大
```

### 把「1 次 HBM 访问」当作单位时间

| 操作 | 相对耗时 | 类比（若 HBM = 1 秒） |
| --- | --- | --- |
| 寄存器访问 | 0.0025 | 瞬间 |
| Shared memory | 0.075 | 眨眼 |
| L2 | 0.5 | 半秒 |
| HBM | **1** | 1 秒 |
| 一次矩阵乘（算 100 次） | — | 干活的时间 |

**关键洞察**：从 HBM 读一个数的时间，够计算单元算几十次。所以优化方向往往是「**减少 HBM 读写**」而不是「减少计算量」。

:::warning 常见误判
「卡是因为 GPU 算不过来」——多数时候是错的。绝大多数 LLM 算子（softmax、LayerNorm、激活、逐元素加法、朴素 attention）都是**带宽瓶颈**，算力在闲置。判断方法就是下一节的 Roofline。
:::

## 15.5 算术强度与 Roofline 模型

:::unfold 先懂直觉
一个算子到底受限于带宽还是算力？答案取决于它的「算术强度」：每搬运 1 字节数据，能做多少次浮点运算。算术强度低 → 等数据（memory-bound）；高 → 等计算（compute-bound）。
:::

### 公式

$$
\text{算术强度 } AI = \frac{\text{FLOPs}}{\text{Bytes moved}}, \qquad
\text{性能上限} = \min\left(P_{peak},\ BW \times AI\right)
$$

### 关键概念：拐点（ridge point）

$$
AI^* = \frac{P_{peak}}{BW} = \frac{312 \times 10^{12}}{2039 \times 10^9} \approx 153\ \text{FLOPs/Byte}
$$

- $AI < AI^*$：**memory-bound**（带宽墙）
- $AI > AI^*$：**compute-bound**（算力平台）

### 常见算子的算术强度（教学量级近似）

> **假设约定**：以下按 bf16、计入 HBM **读+写**流量估算；不同实现差异很大（融合程度、是否物化中间矩阵等），表中数值只用于**判断瓶颈方向**，不是精确测量值。

| 算子 | AI（量级） | 判定 | 优化方向 |
| --- | --- | --- | --- |
| 向量加法（读 2 写 1） | ~0.2 | memory-bound | 融合、减少读写 |
| GELU / 逐元素激活 | ~1 | memory-bound | 融合进邻近算子 |
| Softmax（每行） | ~1 | memory-bound | 在线 softmax、融合 |
| LayerNorm | ~1.3 | memory-bound | 融合 |
| 朴素 Attention | 数 ~ 数十 | 偏 memory-bound | FlashAttention |
| FlashAttention | 数十以上 | 接近/越过拐点 | — |
| 大 GEMM（M=N=K 大） | 100~1000+ | compute-bound | Tensor Core、低精度 |

:::demo roofline 交互：算术强度与瓶颈判断
拖动滑块改变算子算术强度，或直接点选常见算子，观察它在 Roofline 图上的位置：左侧「斜线墙」是带宽瓶颈，右侧「平顶」是算力瓶颈。（演示中的 AI 数值同为教学近似。）
:::

:::math 一个具体算例：为什么 LayerNorm 慢（理想下界估算）
LayerNorm 处理 `[B, S, d] = [8, 512, 4096]`，bf16：

- 元素数 = $8 \times 512 \times 4096 \approx 1.68\times10^7$
- 内存流量（读入 + 写出）= $2 \times 1.68{\times}10^7 \times 2\ \text{B} \approx 67\ \text{MB}$
- 计算量 ≈ 每元素约 5 FLOPs → $\approx 8.4\times10^7$ FLOPs
- $AI = 84\text{e}6 / 67\text{e}6 \approx 1.25$ → 远低于拐点 153 → **memory-bound**
- 内存时间下界 = 67 MB ÷ 2039 GB/s ≈ **33 微秒**
- 计算时间 = 84 MFLOPs ÷ 312 TFLOPS ≈ **0.27 微秒**（比内存时间小约 120 倍）

（这是假设带宽 100% 利用率的**理想下界**；真实 kernel 通常达到峰值带宽的 60%~80%。）

结论：LayerNorm 再省计算也没用，唯一的优化是**少读写**。
:::

## 15.6 为什么 GEMM 快：分块与 Tensor Core

:::unfold 先懂直觉
矩阵乘是大模型唯一的 compute-bound 主力。它快的秘诀是「分块（tiling）」：把大矩阵切成小块，反复复用搬到 shared memory / register 里的小块——同一份数据用很多次，掩盖了 HBM 的慢。
:::

```
朴素做法：每算一个输出元素读 2K 个数 → AI 很低
分块做法：把 M×K 和 K×N 切成 B×B 小块
          每块加载一次到 shared memory，被复用 B×B 次
          → AI ≈ B（块越大复用越多）
```

| 技术 | 作用 |
| --- | --- |
| 分块（tiling） | 数据复用，提高算术强度 |
| Tensor Core | 一次算 4×4 / 16×16 的乘加块 |
| 双缓冲（double buffering） | 算当前块时预取下一块 |
| cuBLAS / CUTLASS | 官方高度优化实现（大模型都直接调用） |

:::note 大模型里的「GEMM 等级」
NVIDIA 给矩阵乘按精度分类（也是性能对比的行业术语）：
- **GEMM「9」**：理论峰值 ~100%（极难达到）
- 实际训练中 GEMM 时间占比：LLM 前向反向约 70%~90%
- 所以 cuBLAS 的效率直接决定模型 FLOPS 利用率
:::

## 15.7 Kernel 与融合：省的是带宽

:::unfold 先懂直觉
每次算子启动（kernel launch）都要把数据从 HBM 读进来、算完写回去。很多小算子叠在一起，数据被反复搬运。**Kernel 融合**把它们合成一个大 kernel，数据在片上就完成多步计算——省的全是带宽。
:::

### 例子：GELU + 残差加法的两种写法

```python
# ① 不融合：两次读 HBM、两次写 HBM
h = gelu(x)          # 读 x(4MB) → 写 h(4MB)
y = h + residual     # 读 h(4MB) + 读 residual(4MB) → 写 y(4MB)  = 共 16MB 流量

# ② 融合：一次读、一次写
y = gelu_and_add(x, residual)   # 读 8MB → 写 4MB = 12MB 流量（省 25%）
```

| 现象 | 原因 |
| --- | --- |
| `torch.compile` 让模型变快 | 自动做 kernel fusion |
| FlashAttention 快 | 把 QKᵀ、softmax、×V 融合为一个 kernel（FlashAttention 章节将在第二批上线，见第 16 章末的路线图） |
| 逐元素操作「太慢」 | 每个算子各搬一次 HBM |

## 15.8 Profiling 入门：找到瓶颈

:::unfold 先懂直觉
不要猜性能。用工具看：**时间花在哪个 kernel、它是带宽还是算力瓶颈**。这是把「训练慢」变成「知道为什么慢」的唯一途径。
:::

### 两把常用工具

| 工具 | 看什么 | 用法 |
| --- | --- | --- |
| `torch.profiler` | 每个算子的耗时占比、CUDA kernel 时间 | `with torch.profiler.profile(...)` |
| Nsight Systems / Nsight Compute | 时间线、kernel 细节（利用率/带宽） | 命令行/图形界面 |

```python
import torch
from torch.profiler import profile, ProfilerActivity

with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
    for _ in range(10):
        y = model(x)
        y.sum().backward()

print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=15))
```

### 判断清单（背下来）

| 观察 | 结论 | 行动 |
| --- | --- | --- |
| 大量小 kernel、时间分散 | 启动开销/逐元素瓶颈 | 融合（torch.compile） |
| GPU 利用率低但显存带宽满 | memory-bound | 减少读写、提高复用 |
| Tensor Core 利用率低 | 精度/形状问题 | 检查 bf16、矩阵尺寸对齐（64 的倍数） |
| 等通信时间长 | 分布式通信瓶颈 | 见第 16 章（重叠、拓扑） |
| batch 太小 | 无法打满 | 增大 batch / 梯度累积 |

## 15.9 为什么 Transformer 特别适合 GPU

**适合的部分**：

| 结构 | 为什么适合 |
| --- | --- |
| QKV 投影、FFN、LM Head | 大 GEMM，compute-bound，Tensor Core 友好 |
| 批量多头注意力 | 形状整齐（[B,H,S,D]），极易并行 |
| 序列内并行（训练） | 各位置独立，没有 RNN 的串行依赖 |

**不适合的部分（优化的重点）**：

| 结构 | 瓶颈 |
| --- | --- |
| Softmax / LayerNorm / Dropout | memory-bound，AI ≈ 0.3~2 |
| 朴素 Attention 的 S×S 矩阵 | 显式物化 S² 张量：读写 O(S²) |
| 自回归生成 | 每步计算量小、kernel 启动多、KV 读写量大 |

> **一句话总结本章**：GPU 是「吞吐机器」，矩阵乘是它的主场；但 LLM 里大量算子输在内存带宽上。理解 `min(峰值, 带宽×AI)` 这一个公式，就理解了后面 FlashAttention、量化、融合、显存优化的全部动机。

:::key 本章必须记住
| 概念 | 一句话 |
| --- | --- |
| CPU vs GPU | 延迟优先 vs 吞吐优先 |
| SM / warp / Tensor Core | 部门 / 32 线程组 / 矩阵乘单元 |
| 存储层次 | Register > Shared > L2 > HBM（带宽差百倍） |
| 算术强度 | AI = FLOPs/Bytes |
| Roofline | 性能 = min(峰值, 带宽×AI)，拐点 AI*≈153 |
| memory-bound | AI 低 → 等数据（softmax/LayerNorm/朴素 attention） |
| compute-bound | AI 高 → 等计算（大 GEMM） |
| Kernel 融合 | 省 HBM 读写，torch.compile 的核心收益 |
| Profiling | 先看时间线再优化，不猜 |
:::

:::quiz
A100 的 Roofline 拐点 AI* = 峰值 ÷ 带宽 ≈ 153 FLOPs/Byte。一个算子的算术强度是 2，它属于？

A. compute-bound
B. memory-bound
C. 两者都不是
D. 取决于 batch size

答案: B
解析: AI=2 远低于拐点，性能由带宽×AI 决定，属于 memory-bound。Softmax（0.25）、LayerNorm（0.5）、逐元素操作都在这一象限。
:::

:::quiz
为什么 FlashAttention 能大幅加速注意力计算，却没有改变 O(S²) 的复杂度？

A. 它用了近似算法
B. 它通过分块 + 在线 softmax 避免把 S×S 矩阵写入 HBM，优化的是内存流量而不是计算量
C. 它减少了 Q/K/V 的维度
D. 它跳过了 softmax

答案: B
解析: 朴素 attention 的主要代价是读写 O(S²) 的中间矩阵。FlashAttention 让这些中间结果留在片上 SRAM 中完成计算，HBM 流量降到 O(S)，但计算次数仍是 O(S²)。
:::

:::quiz
代码里两个连续的逐元素算子（如 GELU 后接残差加法）比融合版本慢，主要原因是？

A. 计算量多了
B. 每个算子都要独立读写一遍 HBM，内存流量翻倍
C. GPU 不支持多个算子
D. 精度损失

答案: B
解析: 逐元素算子算术强度极低，瓶颈在 HBM 读写。融合后中间结果留在片上，流量从 16MB 降到 12MB。
:::

:::related
依赖 | 第 7 章 Attention, 第 14 章 MFU
用于 | 第 16 章 分布式训练, FlashAttention（第二批）, 推理优化（第二批）
:::
