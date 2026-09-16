> **本章定位**：Build 主线收尾。7 个 Lab 把第 12 章的 TinyLM 真正训练起来、评估、生成、微调、做一次偏好优化实验。做完本章，你就完整走过了一次「mini 版 LLM 生命周期」。

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
把原始文本变成「一个巨大的 token 数组」。LLM 数据集的本质就这么简单——复杂的是清洗和配比（第 18 章）。
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
        return len(self.data) - self.seq_len - 1
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
把第 11 章的五步循环 + 第 18 章将学的 warmup/decay 组合成一个**完整的、可断点续训的**训练脚本。
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
def lr_at(step):
    if step < cfg["warmup"]:
        return cfg["lr"] * step / cfg["warmup"]
    progress = (step - cfg["warmup"]) / (cfg["max_steps"] - cfg["warmup"])
    return cfg["lr"] * (cfg["min_lr_ratio"] + (1 - cfg["min_lr_ratio"]) * 0.5 * (1 + math.cos(math.pi * progress)))

# ============ 训练循环 ============
model.train()
step, tokens_seen = 0, 0
t0 = time.time()
while step < cfg["max_steps"]:
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)

        with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
            logits = model(x)
            loss = F.cross_entropy(logits.view(-1, cfg["vocab_size"]), y.view(-1))
            loss = loss / cfg["accum"]                     # 梯度累积：缩放损失

        loss.backward()

        if (step + 1) % cfg["accum"] == 0:
            torch.nn.utils.clip_grad_norm_(model.parameters(), cfg["grad_clip"])
            for g in optimizer.param_groups:
                g["lr"] = lr_at(step)
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
            step += 1
            tokens_seen += cfg["batch_size"] * cfg["accum"] * cfg["max_seq"]

            if step % 50 == 0:
                dt = time.time() - t0
                print(f"step {step:5d} | loss {loss.item()*cfg['accum']:.4f} | lr {lr_at(step):.2e} | {tokens_seen/1e6:.1f}M tok | {dt:.0f}s")

            # 定期验证 + 保存
            if step % cfg["eval_every"] == 0:
                model.eval()
                with torch.no_grad():
                    xv, yv = next(iter(torch.utils.data.DataLoader(val_ds, batch_size=8)))
                    xv, yv = xv.to(device), yv.to(device)
                    vl = F.cross_entropy(model(xv).view(-1, cfg["vocab_size"]), yv.view(-1))
                print(f"           val loss {vl.item():.4f} | ppl {math.exp(vl.item()):.1f}")
                model.train()

            if step % cfg["ckpt_every"] == 0:
                torch.save({"model": model.state_dict(), "optimizer": optimizer.state_dict(), "step": step}, f"ckpt_{step}.pt")
                print(f"           saved ckpt_{step}.pt")
```

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
| PPL = e^loss | 平均「犹豫多少个候选」 | 只能和同 tokenizer 比（第 18 章） |
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
# 生成第 t 个 token 时，模型对前 t 个位置全部重新做一遍 QKV 投影
# 总计算量 ∝ 1 + 2 + 3 + ... + n = O(n²)
```

### 最小实现：带缓存的单层注意力

```python
class CachedAttention(nn.Module):
    """演示版：一层带 KV Cache 的注意力"""
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

### 速度对比（同一层，生成 200 个 token）

```python
import time
layer = CachedAttention(256, 8).cuda().eval()

# 无缓存：每一步重新喂入整个序列
x = torch.randn(1, 1, 256).cuda()
seq = x.clone()
t0 = time.time()
with torch.no_grad():
    for _ in range(200):
        out, _ = layer(seq)          # 全序列重算
        seq = torch.cat([seq, out[:, -1:]], dim=1)
t_no = time.time() - t0

# 有缓存：每次只喂新 token
seq = x.clone(); cache = None
t0 = time.time()
with torch.no_grad():
    for _ in range(200):
        out, cache = layer(seq[:, -1:], cache)
        seq = torch.cat([seq, out], dim=1)
t_yes = time.time() - t0

print(f"无缓存 {t_no:.2f}s  有缓存 {t_yes:.2f}s  加速 {t_no/t_yes:.1f}×")
```

:::math 为什么序列越长收益越大
无缓存第 t 步要算 $t$ 个位置 → 总计算 $\sum t = O(n^2)$；
有缓存每步只算 1 个位置 → 总计算 $O(n)$。
代价是显存：缓存大小 = $2 \times L \times H \times d_h \times n \times \text{bytes}$（第 10 章公式，`kv-cache` 演示的估算器可复核）。
:::

## Lab 13：SFT（让模型学会「回答问题」）

:::unfold 目标
在预训练模型上做指令微调：数据换成「指令-回答」对，损失只算回答部分（第 18 章 Loss Mask 原理）。
:::

```python
# ① 构造 SFT 数据（格式 = 第 18 章的 chat template）
data = [
    {"instruction": "把下面的话翻译成英文：我爱编程。", "response": "I love programming."},
    {"instruction": "3 + 5 等于几？", "response": "3 + 5 = 8。"},
    {"instruction": "用一句话解释什么是 token。", "response": "token 是模型处理文本的最小单位。"},
    # ... 几十~几百条即可看到效果
]

def format_example(ex):
    prompt = f"<|user|>{ex['instruction']}<|assistant|>"
    return prompt, ex["response"] + "<|endoftext|>"

# ② Loss Mask：只对回答部分算损失
def tokenize_sft(tok, ex, max_len=256):
    p, r = format_example(ex)
    p_ids = tok.encode(p).ids
    r_ids = tok.encode(r).ids
    ids = (p_ids + r_ids)[:max_len]
    labels = ([-100] * len(p_ids) + r_ids)[:max_len]   # -100 = 忽略（prompt 部分）
    return torch.tensor(ids), torch.tensor(labels)

# ③ 训练（与预训练唯一区别：loss 用 masked 版本）
ids, labels = tokenize_sft(tok, data[0])
logits = model(ids[None].to(device))
loss = F.cross_entropy(logits.view(-1, V), labels[None].to(device).view(-1), ignore_index=-100)
```

:::fold 工程里怎么用（SFT 的完整循环骨架）
```python
opt = torch.optim.AdamW(model.parameters(), lr=2e-5)   # SFT 学习率比预训练小 10 倍
for epoch in range(3):
    for ex in data:
        ids, labels = tokenize_sft(tok, ex)
        logits = model(ids[None].to(device))
        loss = F.cross_entropy(logits.view(-1, V), labels[None].to(device).view(-1), ignore_index=-100)
        opt.zero_grad(); loss.backward(); opt.step()

# 对比 SFT 前后
print("SFT 前:", generate(model, tok, "<|user|>3 + 5 等于几？<|assistant|>"))
print("SFT 后:", generate(model, tok, "<|user|>3 + 5 等于几？<|assistant|>"))
```
:::

## Lab 14：DPO / GRPO 小实验

:::unfold 目标
在 mini 模型上体验一次偏好优化（第 19 章完整原理）。DPO 用「更好/更差」回答对直接优化模型；GRPO 用「同一问题采样一组 + 组内比较」。
:::

### DPO：用偏好对直接训练

```python
def sequence_logprob(model, ids, labels, device):
    """计算「模型给回答部分的 log 概率之和」"""
    logits = model(ids[None].to(device))
    logp = F.log_softmax(logits, dim=-1)[0]
    mask = labels[None].to(device) != -100
    # 对齐：位置 t 的 logits 预测 t+1 处的 token
    tok_logp = logp[:-1].gather(-1, labels[None][:, 1:].to(device).clamp(min=0).transpose(0, 1)).squeeze(-1)
    return (tok_logp * mask[0, 1:]).sum()

def dpo_loss(policy, ref, pair, beta=0.1, device="cuda"):
    """pair: {prompt_ids, chosen_ids, chosen_labels, rejected_ids, rejected_labels}"""
    lc = sequence_logprob(policy, pair["chosen_ids"], pair["chosen_labels"], device)
    lr_ = sequence_logprob(policy, pair["rejected_ids"], pair["rejected_labels"], device)
    with torch.no_grad():
        rc = sequence_logprob(ref, pair["chosen_ids"], pair["chosen_labels"], device)
        rr = sequence_logprob(ref, pair["rejected_ids"], pair["rejected_labels"], device)
    logits = (lc - lr_) - (rc - rr)
    return -F.logsigmoid(beta * logits)      # 让 chosen 相对 rejected 的概率比升高

# 用法：ref = SFT 模型的冻结副本
# ref.load_state_dict(model.state_dict())
# loss = dpo_loss(model, ref, pair); loss.backward(); optimizer.step()
```

### GRPO：同一问题采样一组，组内比较

```python
# 伪代码（完整原理见第 19 章）
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

## 13.x 全课验收：你现在能做什么

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
解析: PyTorch 的 cross_entropy 用 ignore_index=-100 跳过这些位置。这保证模型学习「如何回答」而不是「复述问题」（第 18 章 Loss Mask）。
:::

:::quiz
KV Cache 为什么能在推理时带来加速？

A. 它减少了模型的参数量
B. 新 token 只需计算自己的 K/V，历史 K/V 直接读缓存，总计算从 O(n²) 降到 O(n)
C. 它使用更低的精度
D. 它跳过了 softmax

答案: B
解析: 无缓存时每生成一步都要重算整个前缀的 K/V；缓存后每步只算 1 个新位置。代价是显存随序列增长。
:::

:::related
依赖 | 第 12 章 组件篇, 第 9 章 生成, 第 10 章 KV Cache, 第 18 章 Loss Mask
用于 | 第 14 章 Scaling Laws, 第 17 章 显存, 第 19 章 Post-training
:::
