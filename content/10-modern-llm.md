> **本章对应课件**：《2-4 BERT&GPT&前沿大语言模型》后半部分。核心知识点全部按统一模板展开。这一章就是 LLaMA/Qwen 这一代模型的骨架说明书。

## 10.1 KV Cache：推理加速的关键 ★

:::unfold 先懂直觉
生成第 100 个 token 时，前 99 个 token 的 Key/Value 其实已经算过了。不缓存的话每次都要重算一遍，白白浪费算力。KV Cache 就是把历史的 K、V 存下来，新 token 只算自己的 K、V。
:::

### 公式

$$
K = [K_{past},\ K_{new}], \qquad V = [V_{past},\ V_{new}]
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $K_{past}, V_{past}$ | 历史 token 的 K/V（缓存中，不重算） |
| $K_{new}, V_{new}$ | 新 token 的 K/V（本次计算） |
| 拼接维度 | 沿序列维拼接：[B, H, t−1, d] ⊕ [B, H, 1, d] → [B, H, t, d] |

### 矩阵 shape

:::shapeflow
生成第 t 步：K_past [B, H_kv, t−1, d_head] ⊕ K_new [B, H_kv, 1, d_head] → K [B, H_kv, t, d_head]
Q_new [B, H_q, 1, d_head] × Kᵀ [B, H_kv, d_head, t] → scores [B, H_q, 1, t]
:::

### 数字算例（计算量对比）

生成 4 个 token 的序列：

| 步骤 | 无缓存计算量 | 有缓存计算量 |
| --- | --- | --- |
| 第 1 步 | 1 个 token | 1 个 token |
| 第 2 步 | 2 个 token | 1 个 token |
| 第 3 步 | 3 个 token | 1 个 token |
| 第 4 步 | 4 个 token | 1 个 token |
| **总计** | **1+2+3+4 = 10** | **1+1+1+1 = 4** |

序列越长差距越大：$n$ 个 token 时，无缓存 $O(n^2)$ vs 有缓存 $O(n)$。

### 显存公式与算例

$$
\text{bytes} = 2 \times L \times H_{kv} \times d_{head} \times S \times \text{bytes\_per\_elem}
$$

**例**：LLaMA-2-7B（L=32, H_kv=32, d_head=128），S=4096，FP16（2 字节）：

$$
2 \times 32 \times 32 \times 128 \times 4096 \times 2 \approx 2.1\ \text{GB}
$$

单条序列就要 2GB！如果 batch=8 就是 17GB——这就是为什么需要 GQA（10.2 节）。

:::demo kv-cache 交互：有无缓存的对比 + 显存估算器
左边是「无缓存」每次都重算全部历史（↻），右边是「有缓存」只算新 token。下面还有显存估算器，改层数/head 数/序列长度看显存变化。
:::

:::fold 工程里怎么用（简化版 KV Cache 实现）
```python
class CachedAttention(nn.Module):
    def forward(self, x, cache=None):
        Q, K, V = self.Wq(x), self.Wk(x), self.Wv(x)
        if cache is not None:
            K = torch.cat([cache["K"], K], dim=1)   # 拼接历史 K
            V = torch.cat([cache["V"], V], dim=1)   # 拼接历史 V
        new_cache = {"K": K, "V": V}
        scores = Q @ K.transpose(-2, -1) / math.sqrt(Q.size(-1))
        out = F.softmax(scores, dim=-1) @ V
        return out, new_cache
```
:::

:::warning 常见误区
**KV Cache 减少计算，但增加显存**。这是最经典的 trade-off：省的是 FLOPs，花的是显存和带宽。长上下文推理时，显存往往才是瓶颈（batch 维度还会再乘上去）。
:::

:::interview 面试常问
**Q1：KV Cache 为什么能加速推理？代价是什么？**

:::answer
生成第 t 个 token 时，历史 K/V 已在缓存中，只需计算新 token 的 K/V，把单步计算从 O(t) 降到 O(1)，总计算量从 O(n²) 降到 O(n)。代价是显存：缓存大小随层数、KV head 数、序列长度线性增长（公式见上），长上下文时非常可观。
:::

**Q2：为什么只缓存 K/V，不缓存 Q？**

:::answer
Q 只用于当前 token 的查询，用完即弃；而 K/V 会被后续所有 token 反复使用（每一步都要和全部历史做注意力）。缓存 Q 没有复用价值。
:::
:::

## 10.2 MHA → MQA → GQA ★

:::unfold 先懂直觉
KV Cache 太大，是因为每个 Query head 都配了独立的 KV head。那就让多个 Query head 共享 KV——这就是 GQA。共享得越多，KV Cache 越小，但表达能力越受限。
:::

### 对比公式

$$
\text{MHA}: H_{kv} = H_q, \qquad \text{GQA}: H_{kv} = H_q / g, \qquad \text{MQA}: H_{kv} = 1
$$

其中 $g$ 是分组大小（每组 $g$ 个 Q head 共享 1 组 K/V）。

### 逐项拆解

| 方案 | Q heads | KV heads | KV Cache | 特点 |
| --- | --- | --- | --- | --- |
| MHA | 32 | 32 | 基准 2.1 GB | 表达力最强，显存最贵 |
| GQA | 32 | 8 | 1/4 → 0.54 GB | 质量与显存的折中（现代主流） |
| MQA | 32 | 1 | 1/32 → 0.07 GB | 显存最省，质量损失最大 |

### 矩阵 shape

:::shapeflow
MHA：Q [B, 32, S, d] × Kᵀ [B, 32, d, S] → scores [B, 32, S, S]
GQA：Q [B, 32, S, d] → 每 4 个 Q head 共用 K/V [B, 8, S, d]（广播匹配）
:::

:::demo mha-gqa 交互：三种注意力结构对比
在 MHA / MQA / GQA 之间切换，观察 Q heads 与 K/V heads 的连接方式，以及 KV Cache 的相对大小。
:::

:::fold 工程里怎么用（HuggingFace 配置）
```python
from transformers import AutoConfig
cfg = AutoConfig.from_pretrained("meta-llama/Llama-3-8b")
print(cfg.num_attention_heads, cfg.num_key_value_heads)   # 32 8
# LLaMA-2-7B:  32 Q / 32 KV（MHA）
# LLaMA-2-70B: 64 Q / 8 KV（GQA）
# LLaMA-3-8B:  32 Q / 8 KV（GQA）
```
:::

:::warning 常见误区
- **GQA 不减少 Q head 数**：只减少 K/V head 数，Q 的表达力不变。
- **GQA 的质量损失很小**：这是它取代 MQA 成为主流的原因（MQA 压得太狠，质量掉得多）。
:::

:::interview 面试常问
**Q：为什么大模型推理用 GQA 而不是 MQA？**

:::answer
MQA 把 KV head 压到 1，KV Cache 最省，但所有 Q head 共享同一组 K/V，表达力下降明显、质量损失较大；GQA 用分组折中（如 8 组），KV Cache 降到 1/4~1/8，质量几乎无损。因此现代 LLM（LLaMA-2-70B、LLaMA-3、Qwen）普遍采用 GQA。
:::
:::

## 10.3 RoPE：旋转位置编码 ★

:::unfold 先懂直觉
RoPE 不去「加」位置向量，而是把 Q/K 向量按位置「旋转」一个角度。两个向量各自旋转后做点积，结果只取决于它们的角度差——也就是相对位置。这是现代 LLM 最常用的位置编码。
:::

### 公式

二维旋转矩阵：

$$
R_m = \begin{pmatrix} \cos m\theta & -\sin m\theta \\ \sin m\theta & \cos m\theta \end{pmatrix}
$$

对位置 $m$ 的向量应用旋转：

$$
q_m' = R_m q_m, \qquad k_n' = R_n k_n
$$

### 逐项拆解（为什么点积只依赖相对位置）

$$
(R_m q)^\top (R_n k) = q^\top R_m^\top R_n k = q^\top R_{n-m} k
$$

因为旋转矩阵满足 $R_m^\top R_n = R_{n-m}$。所以点积只依赖 $m - n$，与绝对位置无关。

| 符号 | 含义 |
| --- | --- |
| $m, n$ | 两个 token 的绝对位置 |
| $\theta$ | 旋转频率（每个二维子空间不同） |
| $R_{n-m}$ | 相对位置旋转，点积因此只含相对信息 |

### 矩阵 shape

$$
q, k \in \mathbb R^{d_{head}} \rightarrow \text{按二维子空间旋转} \rightarrow \text{形状不变}
$$

实际实现中，向量被分成 $d/2$ 个二维子空间，每个用不同频率 $\theta_i = 10000^{-2i/d}$ 旋转。

### 数字算例（θ = 45°，向量 [1, 0]）

| q 位置 m | k 位置 n | q 旋转后 | k 旋转后 | 点积 | 相对位置 m−n |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | [0.707, 0.707] | [1, 0] | **0.707** | 1 |
| 2 | 1 | [0, 1] | [0.707, 0.707] | **0.707** | 1 |
| 2 | 0 | [0, 1] | [1, 0] | **0** | 2 |

关键：前两行相对位置相同（m−n=1），点积也相同（0.707）——**无论绝对位置怎么变，只要相对距离一样，注意力分数就一样**。

:::demo rope 交互：旋转 Q/K 看相对位置不变性
拖动 m、n 滑块改变两个向量的位置，观察它们各自旋转；点击「同时 +1」按钮——两个向量一起旋转，点积保持不变。
:::

:::fold 工程里怎么用（RoPE 简化实现）
```python
def apply_rope(x, positions, dim, base=10000.0):
    half = dim // 2
    freqs = 1.0 / (base ** (torch.arange(0, half, device=x.device) / half))
    angles = positions[:, None].float() * freqs[None, :]     # [S, half]
    cos, sin = angles.cos()[None, None], angles.sin()[None, None]
    x1, x2 = x[..., :half], x[..., half:]
    return torch.cat([x1 * cos - x2 * sin, x1 * sin + x2 * cos], dim=-1)
```
:::

:::warning 常见误区
- **RoPE 不是「加到输入上」**：它作用在每一层的 Q/K 上（不是 embedding 阶段），而且只作用于 Q 和 K，不作用于 V。
- **旋转的是二维子空间**：不是整个向量一起转。
- **相对位置性质是数学结论**：由 $R_m^\top R_n = R_{n-m}$ 保证，不是近似。
:::

:::interview 面试常问
**Q1：RoPE 相比 Sinusoidal PE 的优势？**

:::answer
① 内积天然只依赖相对位置，符合 Attention 的需求；② 外推性更好（配合 NTK/YaRN 插值可扩展上下文）；③ 无额外参数、实现简单；④ 作用在 Q/K 上而非输入，每层都能感知位置。
:::

**Q2：为什么 RoPE 只作用于 Q 和 K，不作用于 V？**

:::answer
位置信息只需要影响「匹配分数」（Q·K），V 是被加权取用的内容，不需要参与位置匹配。对 V 加旋转反而会破坏内容表示。
:::
:::

## 10.4 RMSNorm：更简单的归一化 ★

:::unfold 先懂直觉
LayerNorm 要算均值和方差；RMSNorm 发现「减均值」这一步其实不那么重要，只除以均方根就够了。少一次归约运算，更快更省。
:::

### 公式

$$
\text{RMS}(x) = \sqrt{\frac{1}{d}\sum_i x_i^2}, \qquad \text{RMSNorm}(x) = \gamma \cdot \frac{x}{\text{RMS}(x) + \epsilon}
$$

### 逐项拆解

| 符号 | 含义 | 与 LayerNorm 的差别 |
| --- | --- | --- |
| $\text{RMS}(x)$ | 均方根（只算平方均值开根） | LN 还要减均值 |
| $\gamma$ | 可学习缩放 | LN 还有 $\beta$ 平移 |
| 无 $\mu$、$\beta$ | — | 省一次归约、少一组参数 |

### 数字算例（x = [1, 2, 3, 4]）

$$
\text{RMS} = \sqrt{\frac{1+4+9+16}{4}} = \sqrt{7.5} \approx 2.739
$$

$$
\text{RMSNorm}(x) = \left[\frac{1}{2.739},\ \frac{2}{2.739},\ \frac{3}{2.739},\ \frac{4}{2.739}\right] \approx [0.365,\ 0.730,\ 1.095,\ 1.460]
$$

对比 LayerNorm 的 $[-1.34, -0.45, 0.45, 1.34]$：RMSNorm 不把均值拉到 0，保留了整体的「偏移」信息。

:::demo norm-compare 交互：LayerNorm vs RMSNorm 逐步计算
拖动 x 的每个分量，左右并排看两种归一化的完整计算过程和结果差异。
:::

:::fold 工程里怎么用（PyTorch 手写 RMSNorm）
```python
class RMSNorm(nn.Module):
    def __init__(self, d, eps=1e-6):
        super().__init__()
        self.g = nn.Parameter(torch.ones(d))
        self.eps = eps
    def forward(self, x):
        rms = x.pow(2).mean(-1, keepdim=True).sqrt()
        return x / (rms + self.eps) * self.g
```
:::

:::warning 常见误区
- **RMSNorm 不是「简化版 LayerNorm 的近似」**：它是一个独立的、效果相当甚至更好的归一化方法。
- **没有 β 不是缺陷**：实验表明去掉平移项影响很小，但省了参数和计算。
- **仍然是对每个 token 的 hidden 维归一化**，不跨 token。
:::

:::interview 面试常问
**Q：RMSNorm 为什么能省计算？效果为什么不受影响？**

:::answer
省掉了「减均值」的归约和 β 参数，只需平方均值开根。研究发现 LayerNorm 的主要收益来自「尺度不变性」（除以范数），而中心化（减均值）贡献很小，因此 RMSNorm 在保持效果的同时更省带宽——对显存带宽瓶颈的大模型推理尤其有价值。
:::
:::

## 10.5 Pre-Norm 与 Post-Norm ★

:::unfold 先懂直觉
归一化放在子层前面还是后面？原始 Transformer 放在后面（Post-Norm），结果深层训练很不稳定；现代 LLM 放在前面（Pre-Norm），残差路径变成一条「干净的高速公路」，梯度可以直达底层。
:::

### 公式

**Post-Norm**：

$$
x_{t+1} = \text{Norm}\left(x_t + F(x_t)\right)
$$

**Pre-Norm**：

$$
x_{t+1} = x_t + F\left(\text{Norm}(x_t)\right)
$$

### 逐项拆解

| | Post-Norm | Pre-Norm |
| --- | --- | --- |
| 归一化位置 | 残差之后 | 子层之前 |
| 残差路径 | 穿过 Norm | 纯恒等（干净） |
| 梯度 | 每层乘 Norm 的雅可比 | $\partial x_{t+1}/\partial x_t = 1 + \partial F/\partial x$ |
| 深层训练 | 难，需要 warmup | 容易 |
| 代表模型 | 原始 Transformer、BERT | GPT-2 之后几乎所有 LLM |
| 额外处理 | — | 末尾加 final norm |

### 数字算例（梯度传播对比）

假设每层 Norm 的雅可比约 0.7：

| 层数 | Post-Norm：$0.7^n$ | Pre-Norm：$1 + 0.7^n$ |
| --- | --- | --- |
| 4 | 0.240 | 1.240 |
| 12 | 0.014 | 1.014 |
| 24 | 0.0002 | 1.0002 |

:::demo pre-post-norm 交互：两种结构的残差路径对比
并排看两种 Block 结构，绿色标出残差路径。Pre-Norm 的残差路径上没有 Norm，梯度可以无阻碍回传。
:::

:::fold 工程里怎么用（两种写法）
```python
# Pre-Norm（现代 LLM 标准）
x = x + self.attn(self.norm1(x))
x = x + self.ffn(self.norm2(x))
x = self.final_norm(x)          # 末尾补一次

# Post-Norm（原始 Transformer）
x = self.norm1(x + self.attn(x))
x = self.norm2(x + self.ffn(x))
```
:::

:::warning 常见误区
- **Pre-Norm 也需要 final norm**：因为表示方差随深度增长，末尾要归一化后再进 LM Head。
- **Pre-Norm 不是「更好」的普适结论**：它主要是训练稳定性优势；Post-Norm 在浅层、小模型上也可用。
:::

:::interview 面试常问
**Q：为什么现代 LLM 用 Pre-Norm？**

:::answer
Pre-Norm 的残差路径是纯恒等映射（x + F(Norm(x))），梯度含常数 1、可无衰减直达浅层，深层训练稳定，不需要像 Post-Norm 那样依赖精细的 warmup；代价是表示方差随深度增长，需要末尾加 final norm。
:::
:::

## 10.6 SwiGLU：现代 FFN ★

:::unfold 先懂直觉
ReLU FFN 只有一条路；SwiGLU 有两条路——一条产生「内容」，另一条产生 0~1 的「门」，两者逐元素相乘。门控让网络能动态决定放行多少信息。
:::

### 公式

$$
\text{SwiGLU}(x) = \text{SiLU}(xW_1) \odot (xW_3), \qquad \text{输出} = \text{SwiGLU}(x)\,W_2
$$

其中 SiLU（Swish）：

$$
\text{SiLU}(x) = x \cdot \sigma(x)
$$

### 逐项拆解

| 符号 | 作用 | 形状 |
| --- | --- | --- |
| $W_1$ | 门控分支（过 SiLU 变成 0~1 附近） | [d, d_ff] |
| $W_3$ | 内容分支 | [d, d_ff] |
| $\odot$ | 逐元素相乘（门控） | [d_ff] |
| $W_2$ | 输出投影 | [d_ff, d] |

### 矩阵 shape

:::shapeflow
x [B, S, d] × W₁ [d, d_ff] → SiLU → [B, S, d_ff]（门）
x [B, S, d] × W₃ [d, d_ff] → [B, S, d_ff]（内容）
门 ⊙ 内容 → [B, S, d_ff] × W₂ [d_ff, d] → [B, S, d]
:::

### 数字算例（标量）

设 $x = 1.0$，$W_1 = 1.5$，$W_3 = 0.8$，$W_2 = 1.2$：

| 步骤 | 计算 | 结果 |
| --- | --- | --- |
| gate | $\text{SiLU}(1.0 \times 1.5) = 1.5\sigma(1.5)$ | 1.5 × 0.818 = 1.227 |
| value | $1.0 \times 0.8$ | 0.8 |
| hidden | $1.227 \times 0.8$（门控） | 0.982 |
| output | $0.982 \times 1.2$ | 1.178 |

:::demo swiglu 交互：SwiGLU 的标量演算与曲线
拖动 x，看 gate = SiLU(xW₁)、value = xW₃、hidden = gate ⊙ value 的逐步计算；图上对比 SiLU 与 ReLU 的形状。
:::

:::math 为什么中间维度是 8/3 d
SwiGLU 有 3 个权重矩阵（W₁、W₂、W₃），ReLU FFN 只有 2 个。为了保持总参数量相当：

$$
3 \times d \times d_{ff} \approx 2 \times d \times 4d \quad \Rightarrow \quad d_{ff} \approx \frac{8}{3}d
$$

这就是 LLaMA 的 FFN 中间维度是 $\frac{8}{3}d_{model}$ 而不是 $4d_{model}$ 的原因。
:::

:::warning 常见误区
- **SwiGLU 的 d_ff 不是 4d**：用 8/3 d 才能与 ReLU FFN 参数量相当；直接套 4d 会让参数量多 50%。
- **门控是逐元素相乘**，不是矩阵乘。
- **SiLU 非单调**：在负区间先降后升，这是它与 ReLU 的显著区别。
:::

:::interview 面试常问
**Q：SwiGLU 相比 ReLU FFN 的优势？**

:::answer
门控机制让网络能动态控制信息流（乘性交互比单纯的激活更灵活），实验上在同等参数量下效果更好，因此成为 LLaMA/Qwen 等现代 LLM 的标配。代价是多一个投影矩阵，所以中间维度要调成 8/3 d。
:::
:::

## 10.7 现代 LLM 骨架：一图记住

```
Tokenizer
  ↓
Embedding
  ↓
┌─ 重复 N 层 ────────────────────────┐
│  Pre-RMSNorm                       │
│  ↓                                 │
│  GQA / MHA（RoPE 作用于 Q/K）       │
│  ↓                                 │
│  Residual ⊕                        │
│  ↓                                 │
│  Pre-RMSNorm                       │
│  ↓                                 │
│  SwiGLU FFN                        │
│  ↓                                 │
│  Residual ⊕                        │
└────────────────────────────────────┘
  ↓
Final Norm
  ↓
LM Head
  ↓
Logits
```

| 组件 | 原始 Transformer (2017) | 现代 LLM（LLaMA 类） |
| --- | --- | --- |
| 位置编码 | Sinusoidal（相加） | RoPE（旋转 Q/K） |
| 归一化 | LayerNorm + Post-Norm | RMSNorm + Pre-Norm |
| Attention | MHA | GQA / MHA |
| FFN 激活 | ReLU | SwiGLU |
| 推理优化 | 无 | KV Cache |

## 10.8 本章总结

:::key 本节必须记住
| 组件 | 解决的问题 | 一句话 |
| --- | --- | --- |
| KV Cache | 推理重复计算 | 缓存历史 K/V，省计算花显存（O(n²)→O(n)） |
| GQA | KV Cache 太大 | 多个 Q head 共享 K/V（如 32→8，降到 1/4） |
| RoPE | 位置信息 | 旋转 Q/K，点积只依赖相对位置 m−n |
| RMSNorm | 归一化成本 | 不减均值，只除均方根 |
| Pre-Norm | 深层训练 | 残差路径干净，梯度直达（1 + F′） |
| SwiGLU | FFN 表达力 | 双路门控，中间维 8/3 d |
:::

:::quiz
KV Cache 的核心作用是？

A. 减少显存占用
B. 避免重复计算历史 token 的 K/V
C. 提高模型精度
D. 加速训练

答案: B
解析: KV Cache 缓存历史的 Key/Value，新 token 只算自己的 K/V，把推理计算从 O(n²) 降到 O(n)。代价是显存占用随序列增长（A 说反了）。
:::

:::quiz
GQA 相比 MHA 的主要优势是？

A. 参数量更少
B. KV Cache 更小，推理更省显存和带宽
C. 训练更快
D. 不需要位置编码

答案: B
解析: GQA 让多个 Query head 共享一组 KV head，直接减少 KV Cache 大小（如 32→8 降到 1/4），显著降低长上下文推理的显存和带宽压力。
:::

:::quiz
RoPE 的核心性质是？

A. 把位置向量加到输入上
B. 旋转 Q/K，使点积只依赖相对位置
C. 可学习的位置嵌入
D. 不需要位置信息

答案: B
解析: RoPE 按位置旋转 Q/K，由于旋转矩阵性质 R_mᵀR_n = R_{n−m}，点积只依赖 m−n（相对位置）。A 是 sinusoidal PE 的做法。
:::

:::quiz
RMSNorm 与 LayerNorm 的主要区别是？

A. RMSNorm 不减均值，只除以均方根
B. RMSNorm 需要 batch 统计
C. RMSNorm 不能用于 Transformer
D. RMSNorm 参数量更大

答案: A
解析: RMSNorm = x / RMS(x) · γ，省掉减均值（和 β），计算更简单、更省带宽，效果接近 LayerNorm，被 LLaMA/Qwen 等采用。
:::

:::quiz
现代 LLM 采用 Pre-Norm 的主要原因是？

A. 参数量更少
B. 残差路径无归一化，梯度更容易传回浅层，深层训练更稳
C. 推理更快
D. 不需要 final norm

答案: B
解析: Pre-Norm 的残差路径是纯恒等映射，∂x_{t+1}/∂x_t 中始终有常数 1；Post-Norm 每层都要穿过 Norm 的雅可比，深层不稳定。注意 Pre-Norm 反而需要额外加 final norm（D 错）。
:::

:::quiz
SwiGLU 的 FFN 中间维度通常取 8/3 d 而不是 4d，原因是？

A. 计算更快
B. SwiGLU 有 3 个权重矩阵，需要缩小中间维度以保持参数量相当
C. 显存限制
D. 8/3 是随机选的

答案: B
解析: ReLU FFN 有 2 个矩阵（2 × d × 4d），SwiGLU 有 3 个矩阵（3 × d × d_ff）。令 3·d·d_ff ≈ 2·d·4d 得 d_ff ≈ 8/3 d。
:::

:::related
依赖 | Self-Attention, LayerNorm, FFN, 位置编码
用于 | LLaMA, Qwen, 推理优化, 长上下文
:::
