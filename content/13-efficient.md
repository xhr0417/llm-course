> **本章对应课件**：《3.1 大模型工程专题》后半部分。核心知识点全部按统一模板展开：直觉、公式、逐项拆解、shape、数字算例、交互演示、代码、误区、面试问题。

## 17.1 FP32、FP16、BF16：数值格式 ★

:::unfold 先懂直觉
每个数字在计算机里占多少位，决定了它能表示多大范围、多高精度。位数越少越省显存、算得越快，但越容易溢出或精度不够。大模型训练就是在「省」和「稳」之间找平衡。
:::

### 数字算例（7B 模型的权重显存）

| 格式 | 每参数字节 | 7B 权重显存 |
| --- | --- | --- |
| FP32 | 4 | 7×10⁹ × 4 ≈ **28 GB** |
| FP16 / BF16 | 2 | 7×10⁹ × 2 ≈ **14 GB** |
| INT8 | 1 | 约 **7 GB** |
| INT4 | 0.5 | 约 **3.5 GB** |

### 逐项拆解（位分布）

| 格式 | 总位数 | 符号位 | 指数位 | 尾数位 | 特点 |
| --- | --- | --- | --- | --- | --- |
| FP32 | 32 | 1 | 8 | 23 | 基准精度，显存最贵 |
| FP16 | 16 | 1 | 5 | 10 | 精度高，范围小，易 overflow |
| BF16 | 16 | 1 | 8 | 7 | 范围与 FP32 相同，精度略低 |
| INT8 | 8 | 1 | — | 7（整数） | 量化推理常用 |
| INT4 | 4 | 1 | — | 3（整数） | 更激进的量化，显存最省 |

### 矩阵 shape

格式不影响张量形状，只影响每个元素的字节数：

$$
\text{显存} = \text{参数量} \times \text{bytes\_per\_elem}
$$

:::demo mixed-precision 交互：位分布 + 显存计算器
上方用色块展示每种格式的位分布（红=符号、蓝=指数、绿=尾数）；下方选择参数量（7B/14B/32B/70B）和精度，实时计算权重显存与训练显存。
:::

:::math 指数位决定「范围」，尾数位决定「精度」
- **指数位**：决定能表示多大/多小的数。FP16 的 5 位指数最大约 $2^{15}$，超出就溢出成 inf；
- **尾数位**：决定有效数字的位数。BF16 只有 7 位尾数（约 2~3 位十进制有效数字），但动态范围与 FP32 相同（8 位指数）。

所以：FP16 容易 overflow（指数范围小）；BF16 不容易 overflow，但精度粗一些。
:::

:::warning 常见误区
**BF16 不是「低配 FP16」**。FP16 尾数多、范围小；BF16 尾数少、范围大。训练时梯度的动态范围极大，范围比精度更重要，所以 BF16 是训练首选；推理时两者都常见。
:::

:::interview 面试常问
**Q：为什么训练用 BF16 而不是 FP16？**

:::answer
训练中梯度动态范围极大，FP16 的 5 位指数范围小，容易上溢（inf）或下溢（0），需要 GradScaler 做损失缩放；BF16 的 8 位指数与 FP32 相同，几乎不会溢出，训练更稳，代价是尾数精度低（对训练影响很小）。
:::
:::

## 17.2 为什么 BF16 很重要

**FP16**：精度较高，但 exponent（指数）范围相对有限。

**BF16**：mantissa（尾数）精度低一些，但 exponent 范围更接近 FP32。

**直觉对比**：

- FP16 像「刻度很细但尺子很短」——精确但容易超出量程；
- BF16 像「刻度粗但尺子很长」——范围大，适合梯度这种动态范围极大的数值。

现在很多 GPU（A100、H100、H800）上的大模型训练大量使用 BF16。

## 17.3 Mixed Precision：混合精度训练 ★

:::unfold 先懂直觉
前向反向用低精度（省显存、用 Tensor Core 加速），但**参数更新**可能需要更高精度的累加，否则学习率很小时更新会被舍入成 0。具体怎么存参数，取决于框架与精度策略——本节把「经典模型」和「现代实践」分开讲。
:::

### 经典 mixed precision 模型（FP16 时代）

这是理解 mixed precision 的**经典教学模型**（以早期 FP16 训练为代表）：

```
Forward            → FP16
Backward           → FP16（梯度也是 FP16）
Master weights     → FP32（额外保存一份高精度参数）
Optimizer states   → FP32
Loss scaling       → GradScaler 放大 loss，防止 FP16 梯度下溢
```

**为什么需要 master weights？** 假设学习率 $\eta = 10^{-5}$，某参数 $w = 0.5$，更新量：

$$
\Delta w = \eta \cdot g \approx 10^{-5}
$$

FP16 在 0.5 附近的精度（最小间隔）约为 $2^{-11} \approx 4.9 \times 10^{-4}$——**比更新量大一个数量级**。如果直接在 FP16 上原地更新，$w + \Delta w$ 会被舍入回 $w$，模型「学不动」。所以在 FP32 副本上累加更新，再转成 FP16 供前向使用。

### 数字算例小结

| 场景 | 精度 | 能否表示 10⁻⁵ 的更新 |
| --- | --- | --- |
| FP16 直接更新（w=0.5） | 约 5×10⁻⁴ | ❌ 被舍入为 0 |
| FP32 主权重（w=0.5） | 约 6×10⁻⁸ | ✅ 精确累加 |

**16 / 18 bytes per parameter 都只是「明确假设下的估算」**——见 17.4 节的口径说明框。

:::fold 工程里怎么用（FP16 训练：需要 GradScaler）
```python
# 类型：【Skeleton】需要 GPU
scaler = torch.amp.GradScaler("cuda")      # FP16 必须：放大 loss，防止梯度下溢

for x, y in loader:
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        logits = model(x)
        loss = loss_fn(logits, y)
    scaler.scale(loss).backward()          # 放大梯度
    scaler.step(optimizer)                 # 先 unscale，再 step（内部处理 inf/nan）
    scaler.update()
    optimizer.zero_grad()
```
:::

### 现代实践：BF16 / torch.amp

BF16 的指数范围与 FP32 相同，**通常不需要 GradScaler**：

:::fold 工程里怎么用（BF16 训练：常见写法）
```python
# 类型：【Skeleton】需要 GPU
for x, y in loader:
    with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
        logits = model(x)
        loss = loss_fn(logits, y)
    loss.backward()                        # 直接 backward，无需 scaler
    optimizer.step()
    optimizer.zero_grad()
```
:::

:::warning 不要把一个「简化结构」当成所有框架的事实
「一份 BF16 参数 + 一份额外 FP32 参数」是**经典 FP16 时代教学模型**的简化。实际存储取决于：

| 因素 | 影响 |
| --- | --- |
| 优化器 | AdamW 可能内部维护 fp32 状态；有的优化器有 bf16 变体 |
| AMP 实现 | `autocast` 只影响**计算**精度，不改变参数的存储位置 |
| FSDP / DeepSpeed | 参数分片、可能有独立的 master/optimizer 分片 |
| 混合精度策略 | 纯 bf16、fp16+master、fp8 等不同方案 |

所以：**「参数是否有一份独立的 FP32 master」取决于实现**，不要默认所有混合精度训练都严格等于某个固定字节数。
:::

:::interview 面试常问
**Q1：混合精度训练为什么需要 FP32 master weights？**

:::answer
在**经典 FP16 训练**里，FP16 在参数附近的表示精度有限，小学习率下的更新量（如 1e-5）可能小于其最小间隔，更新被舍入为 0、模型学不动；用 FP32 副本累加更新再转 FP16 供前向，兼顾显存效率与数值精度。注意：这是 FP16 时代的典型方案；现代 BF16 训练与不同框架的具体存储方式可能不同（BF16 范围大，通常不需要 loss scaling；master weights 取决于 optimizer/FSDP/DeepSpeed 的实现）。
:::

**Q2：BF16 为什么通常不需要 GradScaler？**

:::answer
GradScaler 是为 FP16 设计的：FP16 指数位少（5 位），小梯度容易下溢成 0，所以放大 loss 让梯度进入可表示范围。BF16 指数位与 FP32 相同（8 位），动态范围足够，梯度不易下溢，因此通常直接 backward 即可。
:::
:::

## 17.4 训练显存估算 ★

:::unfold 先懂直觉
训练时显存里不只有权重，还有梯度、优化器状态（Adam 的 m 和 v）、激活值、临时缓冲。所以「模型文件 14GB」绝不等于「训练只要 14GB 显存」。
:::

### 公式（每参数）

$$
\text{bytes/param} = \underbrace{2}_{\text{BF16 权重}} + \underbrace{4}_{\text{FP32 主权重}} + \underbrace{4}_{\text{FP32 梯度}} + \underbrace{4+4}_{\text{Adam } m, v} = 18
$$

### 逐项拆解

| 项目 | 精度 | 字节 |
| --- | --- | --- |
| BF16 weights | 2 | 2 |
| FP32 master weights | 4 | 4 |
| FP32 gradients | 4 | 4 |
| Adam m | 4 | 4 |
| Adam v | 4 | 4 |
| **合计** | | **约 18 bytes/参数** |

:::note 口径说明（16 vs 18 bytes/参数）
上表是**教学用的经典混合精度模型**：BF16 权重 + FP32 主权重 + FP32 梯度 + Adam m/v = 18 bytes/参数。
现代框架（PyTorch AMP、FSDP、DeepSpeed）的参数/梯度存储方式可能不同：
- 梯度以 bf16/fp16 保存（而非 FP32）→ 约 **16 bytes/参数**（ZeRO 论文口径，见第 16 章）；
- 有的实现不单独维护 FP32 master weights（依赖优化器内部高精度累加或 bf16 优化器变体）。
所以 **18 是一个常见且保守的教学估算**，不是所有框架的精确值——估算显存时请明确所用口径。
:::

### 数字算例

| 模型 | 权重（BF16） | 训练状态（18 B/param） | 加激活后的实际需求 |
| --- | --- | --- | --- |
| 7B | 14 GB | **126 GB** | >140 GB |
| 14B | 28 GB | **252 GB** | >280 GB |
| 70B | 140 GB | **1260 GB** | >1.3 TB |

**7B 训练就超过单卡 80GB**——所以大模型训练必须用分布式技术：

| 技术 | 作用 |
| --- | --- |
| ZeRO / FSDP | 分片优化器状态/梯度/参数到多卡 |
| 张量并行 | 把单层矩阵切到多卡 |
| 流水线并行 | 把不同层放到不同卡 |
| 梯度检查点 | 不存全部激活，反向时重算（时间换显存） |

:::demo mixed-precision 交互：显存计算器
选择参数量与精度，实时查看权重显存与训练显存（含 18 bytes/参数估算）。
:::

:::warning 常见误区
- **参数文件大小 ≠ 训练显存**：训练状态约为权重的 9 倍（18 vs 2 bytes/param）。
- **激活值经常是隐性大头**：与 batch size、序列长度成正比，梯度检查点就是为它设计的。
- **推理显存 ≠ 训练显存**：推理只需权重 + KV Cache，通常小得多。
:::

:::interview 面试常问
**Q：为什么 7B 模型训练需要 100GB+ 显存？**

:::answer
混合精度 + Adam 下每参数约 18 字节（BF16 权重 2 + FP32 主权重 4 + FP32 梯度 4 + Adam m/v 8），7×10⁹×18 ≈ 126 GB，再加上激活值（与 batch、序列长度成正比）。所以必须用 ZeRO/FSDP、张量并行、梯度检查点等分布式技术。
:::
:::

## 17.5 两个显存开关：梯度累积与激活检查点

:::unfold 先懂直觉
显存不够时有两个「以时间换空间」的标准动作：**梯度累积**（用时间换 batch 等价性）和 **激活检查点**（用重算换显存）。它们和混合精度一起，构成训练显存调优的三件套。
:::

### 开关一：梯度累积（Gradient Accumulation）

小显存装不下大 batch 时：把一个大 batch 拆成 $k$ 个 micro-batch，梯度累加 $k$ 次后再更新一次参数。

$$
g_{effective} = \frac{1}{k}\sum_{i=1}^{k} g_i \quad\Longleftrightarrow\quad \text{等效 batch} = k \times B_{micro}
$$

```python
# 类型：【Runnable】核心逻辑（完整训练循环见第 13 章 Lab 9）
accum = 8
for micro_step, (x, y) in enumerate(loader):
    loss = criterion(model(x), y) / accum        # 缩放：保证累加后与平均一致
    loss.backward()                              # 梯度累加进 .grad
    if (micro_step + 1) % accum == 0:            # 攒够 accum 个才更新
        clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)
```

| 维度 | 变化 |
| --- | --- |
| **单次 micro-batch 的激活显存** | 与等效大 batch 相比，约按 micro-batch 比例缩小 |
| **总显存** | **不会整体下降 k 倍**：参数、梯度、优化器状态、临时缓冲不随 micro-batch 变化 |
| 等效 batch | k × B_micro（学习率按大 batch 调） |
| 代价 | 每步多 k−1 次前向/反向的时间（总吞吐基本不变） |

### 开关二：激活检查点（Activation Checkpointing / 梯度检查点）

:::unfold 先懂直觉
**正常训练**：前向时把每层的中间激活（activation）都存下来，反向传播时直接拿来用——省计算，但激活非常吃显存。
**激活检查点**：前向只保存**少量边界激活**，其余中间结果用完即弃；反向传播时，对每个检查点区间**重新执行一次前向**，把需要的中间值算回来。
:::

```
正常：      Forward → 保存全部 activation → Backward 直接使用
Checkpoint：Forward → 只保存边界 activation → 丢弃中间结果
           Backward → 重新执行对应区间的 forward → 得到中间值 → 继续反传
```

**核心 trade-off**：**更少的激活显存 ↔ 更多的重计算（时间）**。粒度越粗（检查点区间的层数越多），保存得越少、重算得越多。

:::warning 不要把它写成固定的复杂度或固定百分比
你可能会看到「激活显存 $\approx O(\sqrt{L})$」「重算开销约 +30%」这类说法——它们成立需要非常具体的假设（如均匀层、只检查每 $\sqrt{L}$ 层、反向只重算一次前向等），**不能当作普遍事实**。实际表现取决于：

- checkpoint 策略与粒度（每层？每几层？只对 attention 还是整个 block？）
- 模型结构与深度、序列长度
- GPU（计算余量 vs 显存余量）
- 框架实现（`torch.utils.checkpoint` / FSDP 内建支持 / Megatron 的方案）

所以本节只给出**定性结论**：它用「重算时间」换「激活显存」；收益与代价都需要在具体配置下实测。
:::

```python
# 类型：【Skeleton】需要模型与输入
from torch.utils.checkpoint import checkpoint
h = checkpoint(block, x, use_reentrant=False)   # 该 block 的中间激活不再全部保存
```

| | 梯度累积 | 激活检查点 |
| --- | --- | --- |
| 省的显存 | 激活（按 micro-batch 计） | 激活（按被检查的区间计） |
| 代价 | 时间几乎不变，**等效 batch 变小** | **重算带来的时间开销**（随粒度变化，需实测） |
| 常用场景 | batch 太大装不下 | 序列长 / 层数深 / 显存紧 |

> **FP8 简报**：H100 起支持 FP8（E4M3/E5M2）训练，进一步减半显存与带宽需求，但需要缩放与兼容的 kernel 支持。它属于「前沿选项」——本节不展开，知道它存在即可。

## 17.6 LoRA：低秩微调 ★

:::unfold 先懂直觉
微调不需要改动整个大矩阵——模型只需要在一个「低维方向」上调整。LoRA 把权重更新分解成两个瘦长矩阵相乘（低秩分解），只训练这两个小矩阵，参数量降到 1% 以下。
:::

### 公式

$$
W = W_0 + \Delta W, \qquad \Delta W = BA
$$

其中：

$$
W_0 \in \mathbb R^{d \times k}, \qquad B \in \mathbb R^{d \times r}, \qquad A \in \mathbb R^{r \times k}, \qquad r \ll d, k
$$

### 逐项拆解

| 符号 | 含义 | 是否训练 |
| --- | --- | --- |
| $W_0$ | 预训练权重 | ❄️ 冻结 |
| $B$ | 低秩矩阵（d×r） | ✅ 训练 |
| $A$ | 低秩矩阵（r×k） | ✅ 训练 |
| $r$ | 秩（超参数） | 8~64 常用 |

### 矩阵 shape

:::shapeflow
W₀ [d, k] 冻结 + B [d, r] × A [r, k] → ΔW [d, k] 低秩
可训练参数：r×(d+k) 对比全量 d×k
:::

### 数字算例（小矩阵，看得见的低秩）

设 d = k = 4，r = 1：

$$
B = \begin{pmatrix}0.5\\-0.3\\0.2\\0.1\end{pmatrix}, \qquad A = \begin{pmatrix}0.4&0.1&-0.2&0.3\end{pmatrix}
$$

$$
\Delta W = BA = \begin{pmatrix}0.20&0.05&-0.10&0.15\\-0.12&-0.03&0.06&-0.09\\0.08&0.02&-0.04&0.06\\0.04&0.01&-0.02&0.03\end{pmatrix}
$$

观察：**ΔW 的每一行都是 A 的倍数**（行之间线性相关）——这就是「低秩」：无论怎么训练，$BA$ 只能表示少数方向的组合。

:::demo lora-math 交互：LoRA 矩阵运算
切换秩 r，看 B×A 如何生成 ΔW，以及 ΔW 的行如何保持线性相关；W = W₀ + ΔW 实时计算。
:::

:::demo lora 交互：参数量对比
拖动秩 r 滑块，实时看 LoRA 可训练参数量（r×(d+k)）与全量微调（d×k）的对比和百分比。
:::

## 17.7 为什么 LoRA 省参数 ★

### 公式与算例

假设 $W \in \mathbb R^{4096 \times 4096}$：

**全量微调**：

$$
4096 \times 4096 = 16{,}777{,}216 \approx 16.8\text{M}
$$

**LoRA（r = 8）**：

$$
\underbrace{4096 \times 8}_{B} + \underbrace{8 \times 4096}_{A} = 65{,}536 \approx 0.066\text{M}
$$

占比：

$$
\frac{65536}{16777216} \approx 0.39\%
$$

| 方案 | 可训练参数 | 优化器状态 | 显存 |
| --- | --- | --- | --- |
| Full Fine-tuning | 100%（16.8M） | 全量 m/v | 极贵 |
| LoRA (r=8) | 0.39%（66K） | 只有 A/B 的 | 大幅降低 |
| LoRA (r=64) | 约 3% | 只有 A/B 的 | 仍远低于全量 |

**关键**：省的不只是权重显存，更是**优化器状态**（Adam 的 m/v 是参数量的 8 字节/参数）——LoRA 只需为 A/B 保存优化器状态。

:::fold 工程里怎么用（HuggingFace PEFT）
```python
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=8,                      # 秩
    lora_alpha=16,            # 缩放系数（实际用 α/r · BA）
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    task_type="CAUSAL_LM",
)
model = get_peft_model(base_model, config)
model.print_trainable_parameters()
# trainable params: 4,194,304 || all params: 6,742,609,920 || trainable%: 0.0622
```
:::

## 17.8 LoRA 为什么可行

它背后的假设：

> **模型微调所需要的参数变化，并不一定占满整个高维参数空间，可能只需要在一个较低维的方向上调整。**

所以 $\Delta W$ 近似是 low rank。这是 LoRA 最核心的思想。

### 矩阵秩的直觉

:::math 秩是什么
一个 $d \times k$ 的矩阵，秩 r 表示它实际能表达的「独立方向数」：

- 满秩（r = min(d,k)）：每个方向都独立，能表达任意线性变换；
- 低秩：所有行/列都是少数几个基向量的组合，表达能力受限。

**关键假设**：微调所需的变化不需要满秩——往往只需要调整少数几个语义方向（如「语气更正式」「更倾向拒绝」），低秩近似就够了。
:::

实践细节：

- **初始化**：$A$ 用高斯随机，$B$ 初始化为 0 → 训练开始时 $\Delta W = 0$，不破坏原模型；
- **缩放**：实际使用 $\frac{\alpha}{r} BA$，$\alpha$ 控制更新幅度；
- **作用位置**：通常加在 Attention 的 $W_Q, W_K, W_V, W_O$ 上；
- **r 的选择**：8～64 常用，任务越复杂/数据越多可以越大。

:::warning 常见误区
- **LoRA ≠ 量化**：LoRA 不改动原权重精度，只是额外挂一对低秩矩阵；量化（QLoRA 里的 4-bit）是另一回事。QLoRA = 4-bit 量化的基座 + LoRA 适配器。
- **LoRA 不是万能的**：需要「学会新知识」的任务（继续预训练级别）低秩可能不够，需要全量或更大 r。
- **推理时可以合并**：$W = W_0 + BA$ 可以离线合并成一个矩阵，推理零额外开销。
- **B 初始化为 0 不是随便选的**：保证训练起点与原模型完全一致。
:::

:::interview 面试常问
**Q1：LoRA 为什么有效？**

:::answer
基于「微调更新矩阵是低秩的」经验假设：任务适配只需要少数方向的调整，因此 ΔW ≈ BA（r ≪ d,k）即可近似。参数从 d×k 降到 r×(d+k)，显存和存储成本大幅下降，效果接近全量微调。
:::

**Q2：为什么 B 初始化为 0？**

:::answer
保证训练开始时 ΔW = BA = 0，模型行为与原始模型完全一致，训练从稳定起点开始；如果 A、B 都随机初始化，初始扰动可能破坏预训练知识。
:::

**Q3：LoRA 和全量微调怎么选？**

:::answer
数据量小、任务适配（风格、格式、领域术语）→ LoRA 性价比最高；需要注入大量新知识或大幅改变行为 → 全量微调或继续预训练。LoRA 的另一个优势是可以为不同任务训练多个适配器，共享同一个基座。
:::
:::

## 17.9 本章总结

:::key 本节必须记住
| 概念 | 一句话 |
| --- | --- |
| FP32/FP16/BF16 | 指数位决定范围，尾数位决定精度 |
| BF16 | 范围同 FP32，训练不易 overflow |
| Mixed Precision | 前向反向低精度 + master weights FP32 |
| 训练显存 | ≈18 bytes/参数（混合精度+Adam），7B 需 126GB |
| LoRA | ΔW = BA 低秩分解，只训 A/B |
| 参数量 | r×(d+k) vs d×k，可降到 0.39% |
| 可行性 | 微调变化集中在低维子空间（秩的直觉） |
| 注意 | LoRA ≠ 量化；推理可合并；B 初始化为 0 |
:::

:::quiz
BF16 相比 FP16 的主要优势是？

A. 精度更高
B. 指数位与 FP32 相同，动态范围大，训练时不易 overflow
C. 占用显存更小
D. 计算更快

答案: B
解析: BF16 有 8 位指数（与 FP32 相同）但只有 7 位尾数；FP16 有 10 位尾数但只有 5 位指数。训练时梯度动态范围大，范围比精度更重要，所以 BF16 更稳。两者都是 16 位。
:::

:::quiz
混合精度训练中 FP32 master weights 的作用是？

A. 加速前向计算
B. 避免小更新量在低精度下被舍入为 0
C. 减少显存
D. 替代优化器

答案: B
解析: 学习率很小时，更新量可能小于低精度格式在该数量级的表示精度，导致参数「学不动」。FP32 主权重保留高精度累加，更新后再转低精度用于前向。
:::

:::quiz
7B 模型用混合精度 + Adam 训练，仅模型状态约占多少显存？

A. 14 GB
B. 28 GB
C. 约 126 GB
D. 7 GB

答案: C
解析: 每参数约 18 字节（BF16 权重 2 + FP32 主权重 4 + FP32 梯度 4 + Adam m/v 8），7×10⁹×18 ≈ 126 GB。还不含激活值，所以必须用分布式训练。
:::

:::quiz
LoRA 的核心假设是？

A. 模型参数量可以减半
B. 微调的权重变化 ΔW 是低秩的，可用 BA 近似
C. 所有权重都可以量化到 4-bit
D. 不需要梯度

答案: B
解析: LoRA 假设任务适配所需的更新集中在低维子空间，因此 ΔW ≈ BA（r ≪ d,k）。它不改动原权重，也不等于量化（QLoRA 才是量化+LoRA）。
:::

:::quiz
LoRA 中 B 矩阵初始化为 0 的目的是？

A. 加速训练
B. 保证训练开始时 ΔW = 0，不破坏预训练模型
C. 减少参数量
D. 防止过拟合

答案: B
解析: ΔW = BA，若 B 初始为 0 则初始更新为 0，模型从原始行为开始平稳训练。A 通常用高斯随机初始化。
:::

:::related
依赖 | 梯度下降, 优化器状态, 显存估算
用于 | 指令微调, QLoRA, 多适配器部署, 分布式训练
:::
