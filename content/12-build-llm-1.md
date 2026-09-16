> **本章定位**：Build 主线核心。7 个 Lab 从零搭出一个可运行的 decoder-only LM（约 10M 参数，单卡可训）。每个 Lab 都是**小而完整**的：有代码、有测试、有 shape 检查。做完本章，你已经手写过现代 LLM 的每一个零件。

:::note 项目目标（贯穿 12、13 章）
```
TinyLM 规格：vocab 32000 · d_model 256 · 6 层 · 8 头 · 上下文 512
参数量 ≈ 12 · L · d² + V·d ≈ 12×6×256² + 32000×256 ≈ 12.9M
单卡（8GB 显存）可训练，训练数据用任意中文/英文文本即可
```
:::

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测）
- 【Skeleton】工程骨架：逻辑完整，需要自备数据/环境/权重
- 【Pseudo-code】算法示意：用于解释思路，不保证可直接运行
:::

## Lab 1：训练一个 BPE Tokenizer

:::unfold 目标
把原始文本变成 token id 序列——这是模型的第一道工序。第 6 章讲过 BPE 原理（可回去看 `bpe` 演示），这里是工程落地。
:::

### 代码（用 HuggingFace tokenizers，工业标准实现）

```python
from tokenizers import Tokenizer, models, trainers, pre_tokenizers, decoders

def train_tokenizer(text_file, vocab_size=32000, out="tokenizer.json"):
    tok = Tokenizer(models.BPE(unk_token=None))
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()

    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        special_tokens=["<|endoftext|>"],     # 文档分隔符
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),   # 256 字节起步（BBPE）
    )
    tok.train([text_file], trainer)
    tok.save(out)
    return tok

tok = train_tokenizer("corpus.txt", vocab_size=32000)
enc = tok.encode("大模型很有趣")
print(enc.tokens)    # ['大', '模型', '很', '有趣'] 之类（取决于语料）
print(enc.ids)       # [1234, 5678, ...]
```

### 验证清单

```python
assert tok.token_to_id("<|endoftext|>") == 0
s = "Hello 世界！"
assert tok.decode(tok.encode(s).ids) == s      # 编码再解码应无损
print("压缩率:", len(s.encode("utf-8")) / len(tok.encode(s).ids), "bytes/token")
```

| 该检查什么 | 为什么 |
| --- | --- |
| 压缩率（bytes/token） | 越高越好，中文常见 2~4 |
| 特殊 token 是否可用 | `<|endoftext|>` 用于文档边界 |
| 无损往返 | BPE 必须能还原原文 |

:::warning 坑
语料太小会训出奇怪词表（比如把整句话当一个 token）。语料至少几 MB 才有意义；vocab_size 不是越大越好——它直接决定 embedding 参数量 $V \times d$。
:::

## Lab 2：实现 RMSNorm

:::unfold 目标
实现现代 LLM 的归一化层（第 10 章原理，`norm-compare` 演示可复习）。它比 LayerNorm 少一次归约。
:::

```python
import torch, torch.nn as nn

class RMSNorm(nn.Module):
    def __init__(self, d_model, eps=1e-6):
        super().__init__()
        self.g = nn.Parameter(torch.ones(d_model))   # 可学习缩放
        self.eps = eps

    def forward(self, x):
        # x: [..., d_model]
        # 标准形式：x / sqrt(mean(x²) + eps) —— 注意 eps 在根号【内】
        rms_inv = torch.rsqrt(x.pow(2).mean(dim=-1, keepdim=True) + self.eps)
        return x * rms_inv * self.g

# 验证 1：形状与 RMS≈1
x = torch.randn(2, 5, 256)
out = RMSNorm(256)(x)
assert out.shape == x.shape
assert torch.allclose(out.pow(2).mean(-1), torch.ones(2, 5), atol=1e-3)  # RMS≈1

# 验证 2：与官方实现数值对比（torch.nn.RMSNorm 同样把 eps 放在根号内）
official = torch.nn.RMSNorm(256, eps=1e-6)
mine = RMSNorm(256)
assert torch.allclose(mine(x), official(x), atol=1e-5)   # 两者 weight 都初始化为全 1
print("RMSNorm 与 torch.nn.RMSNorm 输出一致 ✅")
```

:::math 与 LayerNorm 的代码差异（顺带纠正一个常见错误写法）
```python
# LayerNorm 需要：减均值 → 除标准差
x = (x - x.mean(-1, keepdim=True)) / x.std(-1, keepdim=True) * g + b

# ✅ RMSNorm 标准写法：eps 在根号内（与论文 / torch.nn.RMSNorm 一致）
x = x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + eps) * g

# ❌ 常见错误写法：eps 加在根号外 —— 当 mean(x²) 很小时行为与标准实现不同
# x = x / (x.pow(2).mean(-1, keepdim=True).sqrt() + eps) * g
```

区别在哪：标准写法是 $\dfrac{x}{\sqrt{\mathbb E[x^2]+\epsilon}}$；错误写法是 $\dfrac{x}{\sqrt{\mathbb E[x^2]}+\epsilon}$。虽然 eps 很小时数值接近，但**公式含义不同**（前者防止根号内除零，后者改变了归一化尺度），工程实现（如 LLaMA 系）统一采用标准写法。
:::

## Lab 3：实现 RoPE（旋转位置编码）

:::unfold 目标
给 Q/K 注入位置信息（第 10 章原理，`rope` 演示可复习）。这里实现 GPT-NeoX 风格的「半拆旋转」版本——LLaMA 系模型的标配写法。
:::

```python
def build_rope_cache(seq_len, head_dim, base=10000.0, device="cpu"):
    """预先算好每个位置的 cos/sin，训练时查表即可"""
    half = head_dim // 2
    freqs = 1.0 / (base ** (torch.arange(0, half, device=device).float() / half))
    t = torch.arange(seq_len, device=device).float()
    angles = torch.outer(t, freqs)            # [S, half]
    return angles.cos(), angles.sin()          # 各 [S, half]

def apply_rope(x, cos, sin):
    """x: [B, H, S, D]，cos/sin: [S, D/2]"""
    cos = cos[None, None, :, :]                # [1, 1, S, D/2]
    sin = sin[None, None, :, :]
    x1, x2 = x[..., :x.shape[-1] // 2], x[..., x.shape[-1] // 2:]
    return torch.cat([x1 * cos - x2 * sin,
                      x1 * sin + x2 * cos], dim=-1)
```

**验证：相对位置性质**。注意正确做法——**固定同一组内容向量 $q_0, k_0$**，只改变它们的绝对位置：

$$
(R_m q_0)^\top (R_n k_0) = q_0^\top R_{n-m}\, k_0
$$

点积只取决于相对距离 $n-m$，与绝对位置无关。

```python
def rope_at(vec, pos, cos, sin):
    """对单个 [D] 向量在位置 pos 施加旋转（便于精确验证）"""
    half = vec.shape[-1] // 2
    x1, x2 = vec[:half], vec[half:]
    c, s = cos[pos], sin[pos]
    return torch.cat([x1 * c - x2 * s, x1 * s + x2 * c])

D = 64
cos, sin = build_rope_cache(16, D)

q0 = torch.randn(D)                    # ← 同一组内容向量
k0 = torch.randn(D)

# 相同相对距离（8-6 = 2，5-3 = 2）→ 点积应相同
score_a = (rope_at(q0, 8, cos, sin) * rope_at(k0, 6, cos, sin)).sum()
score_b = (rope_at(q0, 5, cos, sin) * rope_at(k0, 3, cos, sin)).sum()
assert torch.allclose(score_a, score_b, atol=1e-5)

# 反例：不同相对距离（5-1 = 4）→ 点积不同
score_c = (rope_at(q0, 5, cos, sin) * rope_at(k0, 1, cos, sin)).sum()
assert not torch.allclose(score_a, score_c, atol=1e-4)
print("RoPE 相对位置性质通过 ✅")
```

:::warning 一个容易写错的测试
如果像下面这样写测试，是**错的**：

```python
q = torch.randn(1, 1, 16, D)   # 16 个位置的随机向量
k = torch.randn(1, 1, 16, D)
# ❌ 错误：q[8] 和 q[5] 是两个完全不同的随机向量！
# 它们点积相同不是因为位置性质，而是纯属巧合（几乎不可能成立）
```

相对位置性质的前提是**同一个内容向量**在不同位置被旋转。测试必须固定 $q_0, k_0$（本章验证脚本已实际运行，两种相对距离的对比均通过）。
:::

:::warning 坑
- cos/sin 要搬到和 x 相同的 device；
- 训练时 `seq_len` 不够长会报索引错——按最大上下文预生成；
- 旋转只作用于 **Q 和 K**，不要碰 V（第 10 章讲过原因）。
:::

## Lab 4：实现 Attention（MHA + Causal Mask）

:::unfold 目标
把第 7 章的全部知识组装成一个可用的多头注意力模块：投影 → 拆头 → RoPE → 打分 → mask → softmax → 加权 → 拼回。
:::

```python
class Attention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        assert d_model % n_heads == 0
        self.h = n_heads
        self.d = d_model // n_heads
        self.Wq = nn.Linear(d_model, d_model, bias=False)
        self.Wk = nn.Linear(d_model, d_model, bias=False)
        self.Wv = nn.Linear(d_model, d_model, bias=False)
        self.Wo = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x, cos, sin, mask):
        # x: [B, S, d_model]   cos/sin: [S, D/2]   mask: [S, S] (True=遮住)
        B, S, _ = x.shape
        # ① 投影 + 拆头 → [B, H, S, D]
        q = self.Wq(x).view(B, S, self.h, self.d).transpose(1, 2)
        k = self.Wk(x).view(B, S, self.h, self.d).transpose(1, 2)
        v = self.Wv(x).view(B, S, self.h, self.d).transpose(1, 2)
        # ② 位置信息（只对 Q/K）
        q = apply_rope(q, cos, sin)
        k = apply_rope(k, cos, sin)
        # ③ 打分 + 缩放 + mask + softmax
        scores = q @ k.transpose(-2, -1) / (self.d ** 0.5)   # [B,H,S,S]
        scores = scores.masked_fill(mask, float("-inf"))
        attn = scores.softmax(dim=-1)
        # ④ 加权求和 + 拼回 [B, S, d_model]
        out = attn @ v                                       # [B,H,S,D]
        out = out.transpose(1, 2).contiguous().view(B, S, -1)
        return self.Wo(out)

# 验证
x = torch.randn(2, 8, 256)
cos, sin = build_rope_cache(8, 32)
mask = torch.triu(torch.ones(8, 8), 1).bool()
out = Attention(256, 8)(x, cos, sin, mask)
assert out.shape == (2, 8, 256)
```

:::shapeflow
x [B,S,256] → Wq/Wk/Wv → [B,S,256] → view+transpose → q,k,v [B,8,S,32]
q@kᵀ [B,8,S,S] → ÷√32 → +mask → softmax → @v → [B,8,S,32]
→ transpose+view → [B,S,256] → Wo → 输出 [B,S,256]
:::

:::fold 关键检查：因果性测试（每个位置不能看到未来）
```python
# 改动位置 7 的输入，前面位置的输出不应变化
x2 = x.clone(); x2[:, 7] += 100.0
out2 = Attention(256, 8)(x2, cos, sin, mask)
assert torch.allclose(out[:, :7], out2[:, :7], atol=1e-5)   # 前 7 个位置不变
print("因果性通过 ✅")
```
:::

## Lab 5：实现 SwiGLU

:::unfold 目标
现代 FFN：两条分支，一条当门（第 10 章 `swiglu` 演示可复习）。
:::

```python
class SwiGLU(nn.Module):
    def __init__(self, d_model, d_ff=None):
        super().__init__()
        d_ff = d_ff or int(8 / 3 * d_model)
        d_ff = 64 * ((d_ff + 63) // 64)          # 对齐到 64（工程习惯，利于 kernel）
        self.w1 = nn.Linear(d_model, d_ff, bias=False)   # 门
        self.w3 = nn.Linear(d_model, d_ff, bias=False)   # 内容
        self.w2 = nn.Linear(d_ff, d_model, bias=False)   # 输出

    def forward(self, x):
        return self.w2(F.silu(self.w1(x)) * self.w3(x))

# 验证参数量（≈ 8/3 d² × 3 = 8d²）
d = 256
print(sum(p.numel() for p in SwiGLU(d).parameters()) / d**2)   # ≈ 8.0
```

## Lab 6：组装 Transformer Block

:::unfold 目标
Pre-Norm + 残差 + Attention + FFN。一个 Block 就是现代 LLM 的全部骨架（第 7 章 `transformer-block` 演示可复习）。
:::

```python
class Block(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        self.norm1 = RMSNorm(d_model)
        self.attn = Attention(d_model, n_heads)
        self.norm2 = RMSNorm(d_model)
        self.ffn = SwiGLU(d_model)

    def forward(self, x, cos, sin, mask):
        x = x + self.attn(self.norm1(x), cos, sin, mask)   # Pre-Norm + 残差
        x = x + self.ffn(self.norm2(x))
        return x

# 验证参数量公式：每层 ≈ 12 d²（Attention 4d² + FFN 8d²）
blk = Block(256, 8)
print(round(sum(p.numel() for p in blk.parameters()) / 256**2, 1))   # ≈ 12.0
```

:::math 为什么每层是 12d²
- Attention：Wq/Wk/Wv/Wo 各 d×d → 4d²
- SwiGLU：w1/w3 各 d×d_ff ≈ d×(8/3)d，w2 同款 → 3 × (8/3)d² = 8d²
- 合计 12d²（归一化参数可忽略）
:::

## Lab 7：搭出完整的 Decoder-only LM

:::unfold 目标
Embedding → N 个 Block → Final Norm → LM Head，加权重共享。这就是 GPT（第 9 章）的最小可运行版本。
:::

```python
class TinyLM(nn.Module):
    def __init__(self, vocab_size, d_model=256, n_layers=6, n_heads=8, max_seq=512):
        super().__init__()
        self.max_seq = max_seq
        self.tok_emb = nn.Embedding(vocab_size, d_model)
        self.blocks = nn.ModuleList([Block(d_model, n_heads) for _ in range(n_layers)])
        self.norm_f = RMSNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)
        self.lm_head.weight = self.tok_emb.weight        # weight tying：省 V×d 参数
        self.apply(self._init_weights)

    def _init_weights(self, m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)

    def forward(self, idx):
        B, S = idx.shape
        assert S <= self.max_seq
        x = self.tok_emb(idx)                            # [B,S,d]
        cos, sin = build_rope_cache(S, self.blocks[0].attn.d, device=idx.device)
        mask = torch.triu(torch.ones(S, S, device=idx.device), 1).bool()
        for blk in self.blocks:
            x = blk(x, cos, sin, mask)
        x = self.norm_f(x)
        return self.lm_head(x)                           # [B,S,V] logits

# 验收测试
model = TinyLM(vocab_size=32000)
idx = torch.randint(0, 32000, (2, 32))
logits = model(idx)
assert logits.shape == (2, 32, 32000)

# 参数量核对
total = sum(p.numel() for p in model.parameters())
formula = 12 * 6 * 256**2 + 32000 * 256
print(f"实际 {total/1e6:.2f}M  公式 {formula/1e6:.2f}M")
```

:::shapeflow
idx [B,S] → Embedding → [B,S,256]
→ 6 × Block（Attention + FFN，形状不变）→ [B,S,256]
→ Final RMSNorm → [B,S,256] → LM Head [256, V] → logits [B,S,V]
:::

### 阶段验收清单（做完才能进第 13 章）

| 检查 | 通过标准 |
| --- | --- |
| 参数量 | `12·L·d² + V·d` 与实际误差 < 1% |
| 形状 | 输出 [B, S, V] |
| 因果性 | 修改末尾 token 不影响前面位置的输出 |
| 参数初始化 | std=0.02，loss 初始 ≈ ln(V) ≈ 10.4 |
| 参数量小抄 | embedding + 每层 12d² + final norm |

:::key 本章必须记住
| 组件 | 关键实现细节 |
| --- | --- |
| Tokenizer | BBPE + `<|endoftext|>`，检查压缩率与无损往返 |
| RMSNorm | 只除均方根，无 bias，eps 防零 |
| RoPE | 预生成 cos/sin 查表，只作用于 Q/K，验证相对位置性质 |
| Attention | 拆头 [B,H,S,D] → mask 用 -inf → 拼回，用因果性测试验收 |
| SwiGLU | 三矩阵、中间维 8/3 d、按 64 对齐 |
| Block | Pre-Norm + 双残差，每层 12d² |
| LM | 权重共享、std 0.02 初始化、loss 初始 ≈ ln(V) |
:::

:::quiz
TinyLM 里 `self.lm_head.weight = self.tok_emb.weight` 这行的作用是？

A. 加快训练速度
B. 权重共享（weight tying），省一份 V×d 的参数并使输入输出词向量空间对齐
C. 冻结 embedding 不训练
D. 修正初始化的方差

答案: B
解析: embedding 是 [V,d]，LM Head 是 [d,V]，形状互为转置。共享能省一份参数（30M 级别）且实践中效果常更好。
:::

:::quiz
Attention 的因果性测试应该怎么设计？

A. 检查输出形状
B. 修改序列末尾的输入，验证前面位置的输出保持不变
C. 检查 loss 是否下降
D. 对比有/无 RoPE 的结果

答案: B
解析: 因果性意味着位置 t 的输出只依赖 ≤t 的输入。改动末尾 token 后，前 t-1 个位置的输出必须不变，这是对 mask 实现最直接的验收。
:::

:::quiz
RoPE 的 cos/sin 为什么要预生成（build_rope_cache）？

A. 为了让代码更短
B. 角度只取决于位置和维度，与输入无关，预生成后训练时查表即可，避免重复计算
C. 因为 torch.cos 不支持 GPU
D. 防止梯度爆炸

答案: B
解析: 旋转角度是确定的（位置 × 频率），与数据无关。预生成 [S, D/2] 的 cos/sin 后，每个 batch 直接查表，节省算力。
:::

:::related
依赖 | 第 6 章 BPE, 第 7 章 Attention, 第 10 章 RMSNorm/RoPE/SwiGLU
用于 | 第 13 章 训练篇（数据/预训练/SFT）, 第 17 章 训练显存
:::
