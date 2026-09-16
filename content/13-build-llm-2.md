> **本章定位**：Build 主线收尾。7 个 Lab 把第 12 章的 TinyLM 真正训练起来、评估、生成、微调、做一次偏好优化实验。做完本章，你就完整走过了一次「mini 版 LLM 生命周期」。

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测）
- 【Skeleton】工程骨架：逻辑完整，需要自备数据/环境/权重
- 【Pseudo-code】算法示意：用于解释思路，不保证可直接运行
:::

## 13.1 训练全景图

```
语料文本 ──→ [Lab 8] tokenize + 打包 ──→ train.bin / val.bin
                                            │
TinyLM（第 12 章）──→ [Lab 9] 预训练循环 ──→ ckpt.pt
                                            │
                       [Lab 10] 评估（val loss / PPL / 采样）
                                            │
                       [Lab 11-12] 生成 + KV Cache
                                            │
                       [Lab 13] SFT（指令数据 + Loss Mask）
                                            │
                       [Lab 14] DPO / GRPO 小实验
```

## Lab 8：准备数据集

:::unfold 目标
把原始文本变成「一个巨大的 token 数组」。LLM 数据集的本质就这么简单——复杂的是清洗和配比（第 21 章）。
:::

```python
import numpy as np
from tokenizers import Tokenizer

tok = Tokenizer.from_file("tokenizer.json")

# ① 读取语料（先用 50~200MB 文本即可练手）
text = open("corpus.txt", encoding="utf-8").read()
ids = tok.encode(text).ids
print("总 token:", len(ids))

# ② 存成 uint16 二进制（vocab 32000 < 65536，比 int32 省一半空间）
arr = np.array(ids, dtype=np.uint16)
split = int(len(arr) * 0.9)
arr[:split].tofile("train.bin")
arr[split:].tofile("val.bin")
```

### 为什么用 .bin + memmap

| 方案 | 内存占用 | 随机访问 | 适用 |
| --- | --- | --- | --- |
| 直接存 token list（json/pkl） | 全部载入内存 | 慢 | 小数据练习 |
| `.bin` + `np.memmap` | 只映射，按需读页 | 快（O(1) 定位） | **标准做法** |

```python
# 切窗口（Dataset 的核心，10 行）
class TokenDataset(torch.utils.data.Dataset):
    def __init__(self, path, seq_len):
        self.data = np.memmap(path, dtype=np.uint16, mode="r")
        self.seq_len = seq_len
    def __len__(self):
        # 合法起点共 N - seq_len 个（最后一个样本 y 的右端恰好取到 data[N-1]）
        return len(self.data) - self.seq_len
    def __getitem__(self, i):
        x = torch.from_numpy(self.data[i:i+self.seq_len].astype("int64"))
        y = torch.from_numpy(self.data[i+1:i+1+self.seq_len].astype("int64"))
        return x, y
```

:::warning 文档边界问题
直接把多篇文档首尾相接会造出「假样本」（上文是 A 文章结尾，下文是 B 文章开头）。练手可忽略；正式训练要么用 `<|endoftext|>` 分隔并在 loss 上跳过边界，要么按文档 packing（第 18 章）。
:::

## Lab 9：预训练

:::unfold 目标
把第 11 章的五步循环 + 第 21 章将学的 warmup/decay 组合成一个**完整的、可断点续训的**训练脚本。
:::

```python
import math, time, torch, torch.nn.functional as F

# ============ 配置 ============
cfg = dict(
    vocab_size=32000, d_model=256, n_layers=6, n_heads=8, max_seq=512,
    batch_size=32, accum=4,          # 有效 batch = 32×4 = 128 条 × 512 token
    lr=3e-4, min_lr_ratio=0.1, warmup=200, max_steps=6000,
    grad_clip=1.0, eval_every=200, ckpt_every=1000, device="cuda",
)
device = cfg["device"]

# ============ 数据 / 模型 / 优化器 ============
train_ds = TokenDataset("train.bin", cfg["max_seq"])
val_ds   = TokenDataset("val.bin", cfg["max_seq"])
train_loader = torch.utils.data.DataLoader(train_ds, batch_size=cfg["batch_size"], shuffle=True, num_workers=4, pin_memory=True, drop_last=True)

from model import TinyLM                     # 第 12 章的模型
model = TinyLM(cfg["vocab_size"], cfg["d_model"], cfg["n_layers"], cfg["n_heads"], cfg["max_seq"]).to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=cfg["lr"], betas=(0.9, 0.95), weight_decay=0.1)

# ============ 学习率调度：warmup + cosine ============
# 约定：lr_at(k) 表示「第 k 次参数更新」使用的学习率（k 从 1 开始）
def lr_at(step):
    if step < cfg["warmup"]:
        return cfg["lr"] * step / cfg["warmup"]
    progress = (step - cfg["warmup"]) / (cfg["max_steps"] - cfg["warmup"])
    return cfg["lr"] * (cfg["min_lr_ratio"] + (1 - cfg["min_lr_ratio"]) * 0.5 * (1 + math.cos(math.pi * progress)))

# 注意传入的是 global_step + 1：
# 第 1 次更新（global_step=0）使用 lr_at(1) = base_lr / warmup，而不是 lr_at(0) = 0。
# 这样 warmup 的第一步就有实际步长（否则第一次更新参数完全不变）。

# ============ 训练循环 ============
# 术语约定（全文统一）：
#   micro_step   ：每喂一个 micro-batch +1（无论是否更新参数）
#   global_step  ：每个【参数更新】+1（优化器真正 step 一次）
#   lr 调度 / eval / checkpoint 全部基于 global_step
# loss 有两个变量，语义不同，不要混：
#   raw_loss ：当前 micro-batch 的原始交叉熵（用于日志）
#   loss     ：raw_loss / accum，只用于 backward（梯度累积缩放）
model.train()
micro_step, global_step, tokens_seen = 0, 0, 0
t0 = time.time()
loss_running = 0.0
stop = False
while not stop and global_step < cfg["max_steps"]:
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)

        with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
            logits = model(x)
            raw_loss = F.cross_entropy(logits.view(-1, cfg["vocab_size"]), y.view(-1))
            loss = raw_loss / cfg["accum"]                 # 梯度累积：只缩放 backward 用的 loss

        loss.backward()
        micro_step += 1
        loss_running += raw_loss.item()                    # 记录【原始】loss

        # 每 accum 个 micro-batch 才更新一次参数
        if micro_step % cfg["accum"] == 0:
            torch.nn.utils.clip_grad_norm_(model.parameters(), cfg["grad_clip"])
            for g in optimizer.param_groups:
                g["lr"] = lr_at(global_step + 1)           # warmup 第一个更新用 lr_at(1)>0
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
            global_step += 1
            tokens_seen += cfg["batch_size"] * cfg["accum"] * cfg["max_seq"]

            if global_step % 50 == 0:
                dt = time.time() - t0
                avg_loss = loss_running / (50 * cfg["accum"])   # 50 个 global step = 50*accum 个 micro-batch
                print(f"step {global_step:5d} | loss {avg_loss:.4f} | lr {lr_at(global_step):.2e} | {tokens_seen/1e6:.1f}M tok | {dt:.0f}s")
                loss_running = 0.0

            # 定期验证 + 保存（都基于 global_step）
            if global_step % cfg["eval_every"] == 0:
                model.eval()
                with torch.no_grad():
                    xv, yv = next(iter(torch.utils.data.DataLoader(val_ds, batch_size=8)))
                    xv, yv = xv.to(device), yv.to(device)
                    vl = F.cross_entropy(model(xv).view(-1, cfg["vocab_size"]), yv.view(-1))
                print(f"           val loss {vl.item():.4f} | ppl {math.exp(vl.item()):.1f}")
                model.train()

            # 定期保存 checkpoint（都基于 global_step）
            if global_step % cfg["ckpt_every"] == 0:
                torch.save({"model": model.state_dict(), "optimizer": optimizer.state_dict(),
                            "global_step": global_step, "micro_step": micro_step}, f"ckpt_{global_step}.pt")
                print(f"           saved ckpt_{global_step}.pt")

            # 到达 max_steps 立即停止（不能等当前 epoch 跑完）
            if global_step >= cfg["max_steps"]:
                stop = True
                break
```

:::warning 一个真实的 bug（原版代码踩过）
很多教程写成：

```python
step = 0
loss.backward()
if (step + 1) % accum == 0:    # ❌ step 一直是 0 → 条件永远为 False
    optimizer.step()
    step += 1                  # step 只在条件内 +1 → 永远进不去，死循环
```

**症状**：循环一直跑但 loss 永远不降、显存慢慢涨（梯度一直累积）。
**根因**：把「micro-batch 计数」和「参数更新计数」混为一个变量。
**修法**：如上文，明确分开 `micro_step`（每个 batch +1）与 `global_step`（每次更新 +1）。
:::

:::note 第一次训练应该期待什么
以 TinyLM（12.9M）+ 100MB 中文语料为例：

| 阶段 | loss | 说明 |
| --- | --- | --- |
| 初始 | ≈ ln(32000) ≈ 10.4 | 随机猜测 |
| 300 步 | 6~7 | 学会字频和常见搭配 |
| 2000 步 | 4~5 | 学会语法结构，能写通顺短句 |
| 6000 步 | 3~4 | 记住语料风格，局部连贯 |

跑完约几十分钟（视 GPU）。**这个 loss 数字没有意义，重要的是你有了一条从零到能生成的完整链路。**
:::

:::fold 常见故障排查表（训练必备）
| 症状 | 最可能原因 | 检查 |
| --- | --- | --- |
| loss 一直 ≈ 10.4 不降 | lr=0 / 参数没进优化器 / 标签错位 | 打印 lr、检查 `y` 是右移一位 |
| loss 变 NaN | lr 太大 / fp16 溢出 | 降 lr、换 bf16、加 grad clip |
| loss 剧烈震荡 | batch 太小 / lr 太大 | 增大 batch、开梯度累积 |
| 显存 OOM | batch/seq 太大 | 降 batch、开累积、看第 17 章 |
| 生成重复 | 采样太贪心 | 调高温度 / top-p（Lab 11） |
:::

## Lab 10：评估

:::unfold 目标
评测三件套：val loss（PPL）、采样样质量、下一步（SFT 后的对比）。
:::

```python
import math, torch, torch.nn.functional as F

@torch.no_grad()
def evaluate(model, ds, n_batches=20, batch_size=8):
    model.eval()
    loader = torch.utils.data.DataLoader(ds, batch_size=batch_size)
    losses = []
    for i, (x, y) in enumerate(loader):
        if i >= n_batches: break
        x, y = x.to(device), y.to(device)
        logits = model(x)
        losses.append(F.cross_entropy(logits.view(-1, V), y.view(-1)).item())
    mean = sum(losses) / len(losses)
    return mean, math.exp(mean)

loss, ppl = evaluate(model, val_ds)
print(f"val loss {loss:.4f}  ppl {ppl:.1f}")
```

| 指标 | 含义 | 注意 |
| --- | --- | --- |
| val loss | 每个 token 的平均交叉熵 | 最有用的训练监控信号 |
| PPL = e^loss | 平均「犹豫多少个候选」 | 只能和同 tokenizer 比（第 21 章） |
| 采样目测 | 生成几句话看语法/事实 | 最终用户视角，loss 不能替代 |

:::demo next-token 交互：生成流程三步（第 9 章实现）
复习 logits → softmax → 采样的完整循环，下面 Lab 11 就是它的代码版。
:::

## Lab 11：生成推理

:::unfold 目标
把训练好的模型变成「会说话的模型」：自回归循环 + 采样策略（第 9 章原理，`temperature` / `top-k-p` 演示可复习）。
:::

```python
@torch.no_grad()
def generate(model, tok, prompt, max_new_tokens=100, temperature=0.8, top_k=50, top_p=0.9):
    model.eval()
    idx = torch.tensor([tok.encode(prompt).ids], device=device)   # [1, S]
    for _ in range(max_new_tokens):
        logits = model(idx[:, -model.max_seq:])[:, -1, :]          # 取最后位置 [1, V]
        logits = logits / temperature

        # Top-K 截断
        if top_k:
            kth = torch.topk(logits, top_k).values[..., -1, None]
            logits = logits.masked_fill(logits < kth, float("-inf"))
        # Top-P（nucleus）截断
        if top_p and top_p < 1.0:
            sorted_logits, sorted_idx = torch.sort(logits, descending=True)
            probs = sorted_logits.softmax(-1)
            cum = probs.cumsum(-1)
            remove = cum - probs > top_p                        # 累计概率超过 p 之后的都去掉
            sorted_logits[remove] = float("-inf")
            logits = torch.empty_like(logits).scatter_(-1, sorted_idx, sorted_logits)

        probs = logits.softmax(-1)
        next_id = torch.multinomial(probs, num_samples=1)        # 采样
        idx = torch.cat([idx, next_id], dim=1)
    return tok.decode(idx[0].tolist())

print(generate(model, tok, "从前有座山，", max_new_tokens=80))
```

:::note 参数经验值
| 任务 | temperature | top_p |
| --- | --- | --- |
| 代码 / 数学 | 0.2 ~ 0.3 | 0.95 |
| 通用对话 | 0.7 | 0.9 |
| 创意写作 | 0.9 ~ 1.2 | 0.95 |
:::

## Lab 12：KV Cache（把生成提速一个数量级）

:::unfold 目标
理解并实现推理加速的核心机制（第 10 章原理，`kv-cache` 演示可复习）：缓存历史的 K/V，新 token 只算自己的。
:::

### 先看问题：无缓存时每一步都在重算

```python
# 无缓存的问题：生成第 t 个 token 时，模型对整个 prefix 重新做一遍完整前向
# （历史 token 的 QKV 投影、注意力、FFN 全部重算）
# 仅 K/V 投影的累计计算量：1 + 2 + 3 + ... + n = O(n²)
```

### 最小实现：带缓存的单层注意力

```python
class CachedAttention(nn.Module):
    """演示版：一层带 KV Cache 的注意力。

    【简化说明】为了突出 KV Cache 机制，这里**省略了 RoPE**、省略了多层结构与
    causal mask 的逐 token 处理。真实推理实现还需要缓存/传递：
      - position index（每个 token 的绝对位置，用于 RoPE 旋转）
      - RoPE 的 cos/sin 查表
      - GQA 的 KV head 映射（多个 Q head 共享一组 K/V）
      - attention mask（padding / causal）
    完整推理系统见第二批章节；这里只用于理解缓存的读写模式。
    """
    def __init__(self, d_model, n_heads):
        super().__init__()
        self.h, self.d = n_heads, d_model // n_heads
        self.Wq = nn.Linear(d_model, d_model, bias=False)
        self.Wk = nn.Linear(d_model, d_model, bias=False)
        self.Wv = nn.Linear(d_model, d_model, bias=False)
        self.Wo = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x, cache=None):
        B, S, _ = x.shape
        q = self.Wq(x).view(B, S, self.h, self.d).transpose(1, 2)
        k = self.Wk(x).view(B, S, self.h, self.d).transpose(1, 2)
        v = self.Wv(x).view(B, S, self.h, self.d).transpose(1, 2)

        if cache is not None:                            # ← 关键 3 行
            k = torch.cat([cache["k"], k], dim=2)        # 拼接历史 K
            v = torch.cat([cache["v"], v], dim=2)        # 拼接历史 V

        new_cache = {"k": k, "v": v}                     # 存回缓存
        scores = q @ k.transpose(-2, -1) / (self.d ** 0.5)
        # 单 token 推理（S=1）时 q 只能看自己，无需 causal mask；
        # 若一次喂多个 token，仍需 mask（略）
        attn = scores.softmax(dim=-1)
        out = (attn @ v).transpose(1, 2).contiguous().view(B, S, -1)
        return self.Wo(out), new_cache
```

### 速度对比：Attention-only 教学 microbenchmark（同一层，生成 200 个 token）

> 说明：这是**单层注意力的教学 microbenchmark**，用于展示「缓存避免 K/V 投影重算」的趋势，**不等同于端到端 LLM serving benchmark**（真实 serving 还涉及整个模型前向、批处理、显存带宽、调度等，见第二批推理系统章节）。

```python
import time, torch

layer = CachedAttention(256, 8)
device = "cuda" if torch.cuda.is_available() else "cpu"
layer = layer.to(device).eval()

def sync():
    """CUDA 是异步执行：计时前必须同步，否则测到的是 kernel 排队时间"""
    if device == "cuda":
        torch.cuda.synchronize()

def make_input():
    return torch.randn(1, 1, 256, device=device)

N_TOKENS, WARMUP = 200, 10

def bench_no_cache():
    seq = make_input()
    with torch.no_grad():
        for _ in range(WARMUP):                       # ① warmup（避免把 CUDA 初始化/编译算进去）
            out, _ = layer(seq)
            seq = torch.cat([seq, out[:, -1:]], dim=1)
        sync()
        t0 = time.perf_counter()                      # ② 正式计时
        for _ in range(N_TOKENS):
            out, _ = layer(seq)                       # 全序列重算
            seq = torch.cat([seq, out[:, -1:]], dim=1)
        sync()
        return time.perf_counter() - t0

def bench_cache():
    seq, cache = make_input(), None
    with torch.no_grad():
        for _ in range(WARMUP):
            out, cache = layer(seq[:, -1:], cache)
            seq = torch.cat([seq, out], dim=1)
        sync()
        t0 = time.perf_counter()
        for _ in range(N_TOKENS):
            out, cache = layer(seq[:, -1:], cache)    # 只喂新 token
            seq = torch.cat([seq, out], dim=1)
        sync()
        return time.perf_counter() - t0

t_no = min(bench_no_cache() for _ in range(3))        # ③ 多次重复取最小值，降低噪声
t_yes = min(bench_cache() for _ in range(3))
print(f"无缓存 {t_no*1000:.1f} ms  有缓存 {t_yes*1000:.1f} ms  加速 {t_no/t_yes:.1f}×")
```

:::warning 测量陷阱（为什么上面的写法是对的）
- **CUDA 异步**：不 `synchronize()` 就计时，测到的是「kernel 入队时间」而不是执行时间；
- **warmup 必做**：第一次运行包含 CUDA 上下文初始化等一次性开销；
- **重复取 min**：单次测量受系统噪声影响；
- **CPU 环境也能跑**（同步是 no-op），但结论只对当前设备成立。
:::

:::math KV Cache 到底省了什么？（一个常被讲错的点）
先看**无缓存**：生成第 t 个 token 时，对**整个 prefix（t 个 token）**重新做完整 Transformer 前向——历史 token 的 Q/K/V 投影、注意力、FFN、Norm 全部重算：

- K/V 投影重算量：$\sum_{t=1}^{n} t = O(n^2)$（这就是 Lab 里 1+2+3+4 的来源）
- 每步还要对 prefix 内部做一遍注意力：单步 $O(t^2 d)$

**有缓存**后，第 t 步只做：**1 个新 token 的完整计算 + 新 Query 对 t 个历史 K/V 的注意力**：

- 新 token 的投影/FFN/Norm：$O(d^2)$（常量，不随 t 变）
- **注意力部分：仍要算 $\text{score} = Q_{new} K_{past}^\top \in \mathbb R^{1 \times t}$ → $O(t \cdot d)$，随上下文长度线性增长**

所以准确的结论是：

$$
\text{每步成本：}\quad \underbrace{O(t \cdot d^2 + t^2 d)}_{\text{无缓存}} \;\longrightarrow\; \underbrace{O(d^2 + t \cdot d)}_{\text{有缓存}}
$$

- **省掉的是**：历史 token 的 K/V 投影、FFN、Norm 等**完整前向重算**；
- **没有省掉**：新 token 仍需对全部历史 K 做注意力——**decode 并不变成「每 token O(1)」**；
- 生成 n 个 token：注意力累计仍约 $O(n^2 d)$；但由于免去了 prefix 的重复前向，总成本从「每步重跑整个 prefix」降为「每步只处理一个新 token + 注意力」。

**另一个隐藏成本**：KV Cache 每步要从显存读取 $t \times d \times 2$ 个元素，长上下文时 decode 往往受**显存带宽**限制（见第 15 章 Roofline）。缓存大小 = $2 \times L \times H \times d_h \times n \times \text{bytes}$（第 10 章公式，`kv-cache` 演示的估算器可复核）。
:::

## Lab 13：SFT（让模型学会「回答问题」）

:::unfold 目标
在预训练模型上做指令微调：数据换成「指令-回答」对，损失只算回答部分（第 21 章 Loss Mask 原理）。
:::

```python
# ① 构造 SFT 数据（格式 = 第 21 章的 chat template）
data = [
    {"instruction": "把下面的话翻译成英文：我爱编程。", "response": "I love programming."},
    {"instruction": "3 + 5 等于几？", "response": "3 + 5 = 8。"},
    {"instruction": "用一句话解释什么是 token。", "response": "token 是模型处理文本的最小单位。"},
    # ... 几十~几百条即可看到效果
]

def format_example(ex):
    prompt = f"<|user|>{ex['instruction']}<|assistant|>"
    return prompt, ex["response"] + "<|endoftext|>"

# ② Loss Mask：只对回答部分算损失（prompt 部分标 -100）
def tokenize_sft(tok, ex, max_len=256):
    p, r = format_example(ex)
    p_ids = tok.encode(p).ids
    r_ids = tok.encode(r).ids
    ids = (p_ids + r_ids)[:max_len]
    labels = ([-100] * len(p_ids) + r_ids)[:max_len]   # -100 = 忽略
    return torch.tensor(ids), torch.tensor(labels)
```

### 必须理解：next-token 对齐 + Shift

GPT 的铁律：**位置 $t$ 的 logits 预测的是 token $t+1$**。所以损失必须**错位一位**：

```python
# ③ 训练一步（注意 shift！）
ids, labels = tokenize_sft(tok, data[0])
ids, labels = ids[None].to(device), labels[None].to(device)      # [1, S]

logits = model(ids)                                              # [1, S, V]

# ✅ 正确：位置 t 的 logits 对齐位置 t+1 的 label
shift_logits = logits[:, :-1, :]                                 # [1, S-1, V]
shift_labels = labels[:, 1:]                                     # [1, S-1]
loss = F.cross_entropy(shift_logits.reshape(-1, V),
                       shift_labels.reshape(-1),
                       ignore_index=-100)

# ❌ 错误示范：不 shift 直接对齐 → 用位置 t 的 logits 预测 token t（模型在学习抄自己）
# loss = F.cross_entropy(logits.reshape(-1, V), labels.reshape(-1), ignore_index=-100)
```

### 手算例子：prompt 最后一个位置如何预测回答的第一个 token

设 prompt = `[A, B, C]`（3 个 token），response = `[x, y]`（2 个 token）：

| 位置 t | ids | labels | shift 后预测的 label | 是否算 loss |
| --- | --- | --- | --- | --- |
| 0 | A | −100 | labels[1] = −100 | ❌ 忽略 |
| 1 | B | −100 | labels[2] = −100 | ❌ 忽略 |
| 2 | C | −100 | labels[3] = **x** | ✅ **用最后一个 prompt 位置的 logits 预测回答首 token** |
| 3 | x | x | labels[4] = **y** | ✅ |
| 4 | y | y | （无 logits 可用，被 `[:-1]` 切掉） | — |

**关键点**：labels 里 prompt 部分虽然是 −100，但它们**仍然出现在输入序列中作为上下文**；而「预测 x」这个训练信号来自位置 2（最后一个 prompt token）的 logits。这正是 shift 与 Loss Mask 组合后自然得到的正确行为——**不需要**手工为「最后一个 prompt 位置」做任何特殊处理。

:::fold 工程里怎么用（SFT 的完整循环骨架）
```python
# 类型：【Skeleton】需要 tokenizer 与数据
opt = torch.optim.AdamW(model.parameters(), lr=2e-5)   # SFT 学习率比预训练小 10 倍
model.train()

# 先记录 SFT 之前的生成效果（★ 必须在训练之前）
prompt = "<|user|>3 + 5 等于几？<|assistant|>"
before = generate(model, tok, prompt, max_new_tokens=20)

for epoch in range(3):
    for ex in data:
        ids, labels = tokenize_sft(tok, ex)
        ids, labels = ids[None].to(device), labels[None].to(device)
        logits = model(ids)
        loss = F.cross_entropy(logits[:, :-1].reshape(-1, V),
                               labels[:, 1:].reshape(-1),
                               ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step()

# 训练后再生成，与 before 对比
after = generate(model, tok, prompt, max_new_tokens=20)
print("SFT 前:", before)
print("SFT 后:", after)
```
:::

## Lab 14：DPO / GRPO 小实验

:::unfold 目标
在 mini 模型上体验一次偏好优化（第 22 章完整原理）。DPO 用「更好/更差」回答对直接优化模型；GRPO 用「同一问题采样一组 + 组内比较」。
:::

### DPO：用偏好对直接训练

**数据约定**：一条偏好样本 = 同一 prompt 的两个回答（chosen 更好 / rejected 更差）。tokenize 时沿用 SFT 的规则：prompt 部分 label 为 −100，只对回答算 log 概率。**本节代码已实际运行验证**（与手算结果逐位一致）。

```python
# 类型：【Runnable】核心函数已实测（见 docs/V2_CORRECTNESS_AUDIT.md）

def sequence_logprob(model, ids, labels):
    """回答部分的 log 概率之和（批大小 1，便于教学）。
    ids:    [S]  完整序列（prompt + response）
    labels: [S]  prompt 位置为 -100，response 位置为真实 token id
    返回：标量（response 各 token 的 log P 之和）
    """
    logits = model(ids[None])                        # [1, S, V]
    logp = F.log_softmax(logits, dim=-1)[0]          # [S, V]
    # 对齐：位置 t 的 logits 预测 token t+1（next-token 铁律，与 SFT 相同）
    tgt = labels[1:]                                 # [S-1]  被预测的 token
    valid = (tgt != -100)                            # [S-1]  只保留 response 部分
    safe = tgt.clamp(min=0)                          # 让 -100 变成合法索引（随后被 mask 掉）
    tok_logp = logp[:-1].gather(-1, safe[:, None]).squeeze(-1)   # [S-1]
    return (tok_logp * valid).sum()                  # 忽略 mask 位置的贡献

def dpo_loss(policy, ref, batch, beta=0.1):
    """batch 包含四条序列：
    chosen_ids / chosen_labels / rejected_ids / rejected_labels
    """
    lc = sequence_logprob(policy, batch["chosen_ids"],   batch["chosen_labels"])
    lr_ = sequence_logprob(policy, batch["rejected_ids"], batch["rejected_labels"])
    with torch.no_grad():                            # 参考模型不产生梯度
        rc = sequence_logprob(ref, batch["chosen_ids"],   batch["chosen_labels"])
        rr = sequence_logprob(ref, batch["rejected_ids"], batch["rejected_labels"])
    margin = (lc - lr_) - (rc - rr)                  # policy 相对 ref 的偏好提升
    return -F.logsigmoid(beta * margin)              # 策略==参考时，loss = ln(2)

# 用法（ref = SFT 模型的冻结副本）：
# ref = TinyLM(...); ref.load_state_dict(policy.state_dict())
# for p in ref.parameters(): p.requires_grad_(False)
# loss = dpo_loss(policy, ref, batch); loss.backward(); optimizer.step()
```

:::note 为什么这个实现是对的（可在 Jupyter 里自查）
- 若 `policy` 与 `ref` 对同一批数据的 log 概率完全相同，则 `margin = 0`，loss = −log σ(0) = **ln 2 ≈ 0.693**；
- 训练后 chosen 的 log 概率应相对上升（`lc − rc` 增大），rejected 相对下降；
- 本课程验证脚本对 `sequence_logprob` 做了**逐位手算核对**：函数输出与「手工 gather + 求和」完全一致。
:::

### GRPO：同一问题采样一组，组内比较

以下为**算法伪代码**（不保证直接运行，完整原理见第 22 章）：

```python
# 【Pseudo-code】算法示意
for prompt in prompts:
    responses = [sample(model, prompt) for _ in range(G)]     # 采样 G 个回答
    rewards = [reward_fn(prompt, r) for r in responses]       # 规则打分（如答案是否正确）
    mean = sum(rewards) / G
    std = (sum((r - mean) ** 2 for r in rewards) / G) ** 0.5 + 1e-8
    for r, resp in zip(rewards, responses):
        adv = (r - mean) / std                                # 组内相对优势
        loss = -adv * sequence_logprob(model, resp.ids, resp.labels)   # 提高优势为正的回答概率
        loss.backward(); optimizer.step()
```

| | DPO | GRPO |
| --- | --- | --- |
| 数据 | 现成偏好对（chosen/rejected） | 在线采样，无需标注 |
| 需要 Reward Model | 不需要 | 不需要（规则 reward 即可） |
| 需要 Reference | 需要（冻结副本） | 需要（冻结副本） |
| 适合 | 有偏好数据 | 可验证任务（数学/代码） |

## 13.8 全课验收：你现在能做什么

:::key 完工清单
完成 14 个 Lab 后，你应该能够独立完成：
1. 训练一个自己的 tokenizer，并解释压缩率
2. 从零实现 RMSNorm / RoPE / MHA / SwiGLU / Block / LM，并写测试
3. 准备 `.bin` 数据集、跑通预训练、看 loss/PPL、断点续训
4. 实现带 KV Cache 的生成，并解释为什么快
5. 构造 SFT 数据 + Loss Mask，让模型学会按指令回答
6. 用偏好对跑 DPO，用规则 reward 跑 GRPO，并说清两者区别

**接下来往哪走**：第 14 章（Scaling Laws，决定怎么配置训练）→ 第 15 章（GPU 基础，理解为什么慢）→ 第 16 章（分布式，把规模放大）。
:::

:::quiz
Lab 8 用 uint16 存 token 的前提是什么？

A. 文本是英文
B. 词表大小 < 65536（uint16 的表示范围）
C. 序列长度小于 512
D. 训练数据小于 2GB

答案: B
解析: uint16 最大 65535。vocab 32000 能放下，比 int32 省一半磁盘和 IO。若词表超过 65535 需换 uint32。
:::

:::quiz
SFT 训练时 prompt 部分的 label 设为 -100 的作用是？

A. 加快训练
B. 在 cross_entropy 中忽略该位置，只对回答部分计算损失
C. 标记特殊 token
D. 防止过拟合

答案: B
解析: PyTorch 的 cross_entropy 用 ignore_index=-100 跳过这些位置。这保证模型学习「如何回答」而不是「复述问题」（第 21 章 Loss Mask）。
:::

:::quiz
KV Cache 为什么能在推理时带来加速？

A. 它减少了模型的参数量
B. 它避免了历史 token 的 K/V 投影与完整前向重算；新 token 仍需对全部历史 K 做注意力（该部分随上下文线性增长）
C. 它使用更低的精度
D. 它跳过了 softmax

答案: B
解析: 无缓存时每生成一步都要对整个前缀做完整 Transformer 前向；缓存后只做新 token 的计算。注意：注意力分数仍需与全部历史 K 计算（每步 O(t·d)），并非「每 token O(1)」。代价是显存随序列增长。
:::

:::related
依赖 | 第 12 章 组件篇, 第 9 章 生成, 第 10 章 KV Cache, 第 21 章 Loss Mask
用于 | 第 14 章 Scaling Laws, 第 17 章 显存, 第 22 章 Post-training
:::
