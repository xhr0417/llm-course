> **本章定位**：Scale 主线的核心缺口。回答三个问题：① 一张卡为什么不够；② 多卡为什么还会慢；③ DP / TP / PP / ZeRO / FSDP 分别在什么场景用。本章自带 Ring AllReduce 动画与 ZeRO 显存对比两个交互演示。

## 16.1 一张卡为什么不够

:::unfold 先懂直觉
两个瓶颈同时出现：**显存**（7B 模型训练要 100GB+，单卡 80GB 放不下）和**时间**（8.4e22 FLOPs 在单卡上要几年）。分布式训练就是「把模型和数据切开，摊到多卡上，同时让通信尽量不拖后腿」。
:::

回顾第 17 章的显存账（混合精度 + Adam ≈ 16~18 bytes/参数）：

| 模型 | 仅训练状态 | 单卡 80GB 能否放下 |
| --- | --- | --- |
| 1B | ~18 GB | ✅ |
| 7B | ~126 GB | ❌ |
| 70B | ~1.26 TB | ❌（要 16 卡分片起步） |

**两条路**：切数据（DP/ZeRO）或切模型（TP/PP）。真实训练是组合使用（3D 并行）。

## 16.2 Data Parallel 与 DDP

:::unfold 先懂直觉
最简单的并行：**每张卡存一份完整模型，各喂不同的数据**，算完各自的梯度后「求和平均」，再各自更新——这样所有卡永远保持同一份参数。同步梯度的操作就是 AllReduce。
:::

```
GPU0: 模型副本 + batch_0 → 梯度 g0 ┐
GPU1: 模型副本 + batch_1 → 梯度 g1 ├─ AllReduce(平均) → ḡ → 每张卡各自 optimizer.step()
GPU2: 模型副本 + batch_2 → 梯度 g2 ┘
```

```python
# PyTorch DDP：三行代码的变化
model = nn.parallel.DistributedDataParallel(model, device_ids=[rank])
# 其余训练循环与单卡完全一致——DDP 在 backward 时自动触发梯度 AllReduce
```

### 数学上等价于大 batch

$$
g_{DP} = \frac{1}{N}\sum_{i=1}^{N} g_i \quad\Longleftrightarrow\quad \text{用 batch size } N \times B \text{ 做单卡训练}
$$

| 特点 | 说明 |
| --- | --- |
| 显存 | **每张卡都是完整模型**（未省显存） |
| 通信 | 每步一次梯度 AllReduce，通信量 ≈ 2×参数量 |
| 优点 | 实现简单、计算通信可重叠、扩展性好 |
| 缺点 | 模型必须能放进单卡 |

:::warning 学习率要调整
DP 等价于 batch 变大 N 倍。经验规则：lr 随 batch 增大而适度放大（linear scaling 或 sqrt scaling），并配合 warmup（第 18 章）。
:::

## 16.3 AllReduce 与 Ring AllReduce

:::unfold 先懂直觉
AllReduce = 所有卡把各自的梯度加起来，结果发回给所有卡。笨办法是「都发给 GPU0 让它算」（GPU0 带宽成瓶颈）；**Ring AllReduce** 让数据沿环流转，每张卡的通信量相同，与卡数几乎无关。
:::

### 两步算法

```
① Reduce-Scatter（N−1 步）：每卡把自己的数据切成 N 块，
   沿环传递并累加，结束时每卡恰好拥有一块的完整和。
② All-Gather（N−1 步）：把完整块沿环传播，
   结束时所有卡拥有所有块的完整和。
```

### 通信量公式

$$
\text{每卡通信量} = 2 \times \frac{N-1}{N} \times S \approx 2S
$$

其中 $S$ 是数据总量（如梯度大小）。**关键**：$\frac{N-1}{N} \to 1$，所以每卡通信量趋近 $2S$，不随卡数线性增长。

:::demo allreduce-ring 交互：Ring AllReduce 分步动画
点「下一步」看 4 张卡如何沿环传递并累加（Reduce-Scatter），再把完整结果传播回去（All-Gather）。方块颜色表示该块包含了几张卡的数据。
:::

| 方案 | 每卡通信量 | 瓶颈 |
| --- | --- | --- |
| 朴素（全发 GPU0） | O(N·S) | GPU0 带宽 |
| Ring AllReduce | ≈ 2S（与 N 无关） | 环上最慢链路 |
| Tree AllReduce | ≈ 2S·log N / N | 适合小消息 |

:::note NCCL 与拓扑
实际使用的是 NVIDIA 的 **NCCL** 库，它会自动利用 NVLink / NVSwitch（卡间专用高速互联）和 InfiniBand（跨机）。拓扑意识：**同一台机器内用 NVLink（数百 GB/s）远快于跨机网络（几十 GB/s）**——这直接决定了并行策略的选择。
:::

## 16.4 通信与计算重叠

:::unfold 先懂直觉
通信很慢，但如果让通信和计算同时进行，它就可以「免费」隐藏掉。DDP 的做法是把梯度按桶（bucket）分组：某层梯度算完就立即开始 AllReduce，同时反向传播继续算后面的层。
:::

```
时间线（理想情况）：
反向:   [layer5] [layer4] [layer3] ...
通信:            [allreduce5] [allreduce4] ...
                 ↑ 与前面的计算重叠，几乎不占额外时间
```

| 技术 | 作用 |
| --- | --- |
| Gradient Bucketing | 小梯度合并成大消息（提高带宽利用率） |
| 通信流（comm stream） | 通信走独立 CUDA stream，与计算并行 |
| `bucket_cap_mb` 参数 | 控制桶大小（越大越省启动开销，越小越早开始通信） |

:::warning 反例：为什么「多卡还会更慢」
如果通信无法重叠（如每步都做参数 AllGather 的 naive ZeRO-3 实现）、或跨机带宽太小，扩展效率会低于 1（8 卡只快 6 倍甚至更少）。判断标准是 **扩展效率 = 实际加速比 / 卡数**。
:::

## 16.5 ZeRO：把训练状态切开

:::unfold 先懂直觉
DDP 的问题：每张卡都存了一份完整的「显存三件套」（参数、梯度、优化器状态）。但这些数据在每张卡上是**重复的**。ZeRO 的思想：既然重复，那就切开分给各卡，用的时候再 AllGather 回来。
:::

### 三阶段（逐级把重复数据分片）

| 阶段 | 分片什么 | 每卡显存（16 bytes/参数形式） | 通信变化 |
| --- | --- | --- | --- |
| ZeRO-0（DDP） | 无 | 16Ψ | 每步一次梯度 AllReduce |
| **ZeRO-1** | 优化器状态（m/v + fp32 主权重） | 4Ψ + 12Ψ/N | 不变（更新时 all-gather 一次） |
| **ZeRO-2** | + 梯度 | 2Ψ + 14Ψ/N | 不变（梯度用 reduce-scatter） |
| **ZeRO-3** | + 参数 | 16Ψ/N | **前向/反向都要 all-gather 参数** |

:::demo zero-stages 交互：ZeRO 显存对比
拖动参数量和 GPU 数，看四个阶段的单卡显存如何下降，以及能否放进 80GB 卡。
:::

:::math 数字感受（7B 模型，8 卡）
| 阶段 | 单卡显存 |
| --- | --- |
| ZeRO-0 | 112 GB（放不下） |
| ZeRO-1 | 38.5 GB |
| ZeRO-2 | 26.3 GB |
| ZeRO-3 | 14 GB |

从「8 卡也放不下」到「8 卡轻松放下」——代价是通信量依次增加。
:::

### 选择口诀

> ZeRO-1 几乎总是划算（省显存、通信增加最少）；ZeRO-2 更省；ZeRO-3 最省但通信最多，要配合 prefetch 掩盖。

## 16.6 FSDP：ZeRO-3 的工程实现

:::unfold 先懂直觉
FSDP（Fully Sharded Data Parallel）就是 PyTorch 原生的 ZeRO-3：把参数分片存，前向时按层 AllGather、用完立即释放。它让你用「写 DDP 的方式」获得 ZeRO-3 的显存收益。
:::

```python
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP

model = FSDP(model, sharding_strategy=ShardingStrategy.FULL_SHARD)  # ≈ ZeRO-3
# 另有 SHARD_GRAD_OP（≈ZeRO-2）、HYBRID_SHARD（机内全切、跨机复制）等策略
```

| FSDP 策略 | 等价 | 场景 |
| --- | --- | --- |
| `FULL_SHARD` | ZeRO-3 | 显存最紧 |
| `SHARD_GRAD_OP` | ZeRO-2 | 通信与显存折中 |
| `HYBRID_SHARD` | 机内 ZeRO-3 + 机间 DDP | 多机训练常用（省跨机通信） |

## 16.7 Tensor Parallel：把单层切开

:::unfold 先懂直觉
DP 切数据、ZeRO 切状态，但单个矩阵乘还是太大或太慢怎么办？**把矩阵本身切开**：一张卡算左半列、一张卡算右半列，再拼起来。这就是张量并行（Megatron 的核心）。
:::

### 两种切法（Megatron 的经典设计）

**列并行（用于 QKV 投影、FFN 第一层）**：

$$
Y = XW, \quad W = [W_1, W_2] \implies Y_1 = XW_1, \ Y_2 = XW_2
$$

- 输入 $X$ 每张卡都要（复制），输出按列切分；
- **不需要通信**（各卡算自己的部分列）。

**行并行（用于 Attention 输出投影、FFN 第二层）**：

$$
Y = XW, \quad X = [X_1, X_2], \ W = \begin{pmatrix}W_1\\W_2\end{pmatrix} \implies Y = X_1W_1 + X_2W_2
$$

- 每张卡算部分和，最后 **AllReduce 一次**。

### 一层 Transformer 的通信次数

```
QKV 投影（列并行，无通信）
→ Attention（本地计算）
→ 输出投影（行并行，1 次 AllReduce）
→ FFN 第一层（列并行，无通信）
→ FFN 第二层（行并行，1 次 AllReduce）
合计：每层前向 2 次 AllReduce（反向再 2 次）
```

| 特点 | 说明 |
| --- | --- |
| 显存 | 参数/激活都按卡数切分 |
| 通信 | **每层都要通信**（频繁），所以必须在机内 NVLink 上做 |
| 典型配置 | TP ≤ 8（不超过单机 GPU 数） |

:::warning TP 不宜跨机
TP 每层通信 2 次，对带宽极其敏感。跨机 InfiniBand 只有 NVLink 的 1/10 带宽 → TP 通常限制在机内，跨机用 DP/PP。
:::

## 16.8 Pipeline Parallel：把层切开

:::unfold 先懂直觉
按深度切：GPU0 放第 1-8 层、GPU1 放第 9-16 层……数据像流水线一样从前往后流。代价是「气泡」：流水线没填满时有的卡在空转。
:::

```
micro-batch 1: GPU0[fwd] → GPU1[fwd] → GPU2[fwd] → GPU3[fwd]
micro-batch 2:            GPU0[fwd] → GPU1[fwd] → ...
（1F1B 调度：前向和反向交错，让气泡最小化）

气泡率 ≈ (P - 1) / (M + P - 1)
P = 流水段数，M = micro-batch 数量
```

| 特点 | 说明 |
| --- | --- |
| 显存 | 参数按层切分，激活可优化（只存阶段边界） |
| 通信 | 只传阶段边界的激活（量小、可重叠） |
| 关键 | **micro-batch 越多，气泡越小** |

:::math 气泡算例
4 段流水线（P=4），micro-batch M=32：气泡率 = 3/(32+3) ≈ 8.6%。
M=4 时：3/7 ≈ 43%（严重浪费）。所以 PP 必须配合较大的 M 使用。
:::

## 16.9 Sequence / Context / Expert Parallel（了解即可）

| 并行方式 | 切什么 | 场景 |
| --- | --- | --- |
| Sequence Parallel | LayerNorm/Dropout 等逐元素算子的序列维 | 与 TP 配合（Megatron），省激活显存 |
| Context Parallel | 长序列的注意力上下文 | 超长上下文训练（如 128K+） |
| Expert Parallel | MoE 的不同专家放不同卡 | MoE 模型（如 Mixtral） |

## 16.10 3D 并行与选型指南

真实的大规模训练是「三维组合」：

```
总 GPU 数 = DP × TP × PP
例：LLaMA-3 405B ≈ 训练用 16K GPU（TP=8 机内 × PP=16 × DP=... 组合）
```

### 决策表（收藏）

| 症状 | 方案 | 为什么 |
| --- | --- | --- |
| 单卡放得下模型，只想更快 | **DDP** | 最简单，通信可重叠 |
| 单卡放不下（显存不够） | **ZeRO-1/2 或 FSDP** | 先切优化器状态与梯度 |
| ZeRO-3 通信太重 | **TP=8（机内）+ FSDP** | 机内 NVLink 扛得住频繁通信 |
| 模型层数多、跨机想少通信 | **PP** | 只传边界激活，配大 M 减少气泡 |
| 想要极限规模 | **DP × TP × PP 组合** | 各取所长：TP 机内、PP 跨机少通信、DP 兜底 |

:::note 从「能用」到「高效」的检查顺序
1. **显存够不够**（先解决能不能训）
2. **扩展效率**（8 卡是否接近 8 倍）
3. **通信占比**（profiler 里看 allreduce 时间占比，目标 < 15%）
4. **MFU**（第 14 章：目标 35%~50%）
:::

:::key 本章必须记住
| 概念 | 一句话 |
| --- | --- |
| DP/DDP | 每卡完整模型 + 梯度 AllReduce，等价大 batch |
| Ring AllReduce | 每卡通信 ≈ 2S，与卡数几乎无关 |
| 通信重叠 | 梯度分桶 + 独立通信流 |
| ZeRO-1/2/3 | 依次切优化器状态 / 梯度 / 参数 |
| FSDP | PyTorch 版 ZeRO-3，策略可选 |
| TP | 切矩阵（列并行无通信+行并行 AllReduce），限机内 |
| PP | 切层，气泡 ≈ (P−1)/(M+P−1)，靠大 M 缓解 |
| 3D | DP × TP × PP 组合，按瓶颈选型 |
:::

:::quiz
DDP 训练中每步的梯度 AllReduce，其作用是？

A. 同步数据加载
B. 对所有卡的梯度求平均，使各卡参数保持一致（等价于大 batch 训练）
C. 压缩参数
D. 加速前向计算

答案: B
解析: 各卡用不同数据算出梯度后 AllReduce 求平均，再各自更新，因此所有副本始终保持相同参数，数学上等价于用 N×B 的大 batch 训练单卡。
:::

:::quiz
ZeRO-3 相比 ZeRO-2 多切分了什么？代价是什么？

A. 多切梯度，代价是显存
B. 多切参数，代价是前向/反向都要 AllGather 参数，通信量增加
C. 多切优化器状态，代价是精度
D. 无区别

答案: B
解析: ZeRO-3（FSDP 的 FULL_SHARD）连参数都分片，单卡显存降到 16Ψ/N，但每次前向/反向用到哪层就要把该层参数 AllGather 回来，通信量最大。
:::

:::quiz
为什么张量并行（TP）通常限制在单机内（≤8 卡）？

A. 因为只有 8 张卡的驱动支持
B. TP 每层都要通信（前向 2 次 AllReduce），跨机带宽远低于机内 NVLink，通信会成为瓶颈
C. 因为参数量太小
D. 因为跨机不支持张量运算

答案: B
解析: TP 的通信频率高（每层），适合高带宽的 NVLink 机内互联；跨机要做就用流水线并行（通信少）或 DP。
:::

:::quiz
流水线并行的「气泡」如何计算和缓解？

A. 气泡 = P，无法缓解
B. 气泡率 ≈ (P−1)/(M+P−1)，通过增加 micro-batch 数量 M 来减小
C. 气泡 = 0，因为前向反向并行
D. 气泡与 micro-batch 无关

答案: B
解析: P 个流水段需要 P−1 步填充/排空，micro-batch 越多，填充成本占比越小。4 段 + 32 microbatch 时气泡约 8.6%。
:::

:::related
依赖 | 第 14 章 Scaling Laws, 第 15 章 GPU 基础, 第 17 章 训练显存
用于 | 大规模预训练实战, 推理系统（下一批章节）
:::
