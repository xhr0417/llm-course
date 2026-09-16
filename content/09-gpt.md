> **本章对应课件**：《2-4 BERT&GPT&前沿大语言模型》。核心知识点全部按统一模板展开：直觉、公式、逐项拆解、shape、数字算例、交互演示、代码、误区、面试问题。

## 9.1 GPT：Decoder-only Transformer ★

:::unfold 先懂直觉
GPT 的全部秘密只有一句话：**根据前文预测下一个 token**。它把原始 Transformer 的 Decoder 拿出来，去掉 Cross-Attention，堆很多层，用海量文本训练。
:::

核心训练任务：

```
The capital of France is  →  Paris
```

### 公式（自回归分解）

$$
P(x_1, \ldots, x_T) = \prod_{t=1}^{T} P(x_t \mid x_{<t})
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $x_{<t}$ | 前文（$x_1, \ldots, x_{t-1}$） |
| $P(x_t \mid x_{<t})$ | 给定前文，下一个 token 的概率分布 |
| 连乘 | 整句概率 = 每个位置条件概率的乘积（链式法则） |

### 结构对比

原始 Decoder 包含 `Masked Self-Attention + Cross Attention + FFN`；GPT 没有 Encoder，所以没有 Cross Attention，主要剩：

```
Masked Self-Attention + FFN（堆 N 层）
```

| 模型 | 结构 | 注意力 | 训练目标 |
| --- | --- | --- | --- |
| GPT | Decoder-only | 因果（只看左侧） | next token prediction |
| BERT | Encoder-only | 双向 | MLM |
| T5 / 原始 Transformer | Encoder-Decoder | 双向 + 因果 + Cross | span 去噪 / 翻译 |

:::shapeflow
输入 tokens [B, S] → Embedding + 位置 [B, S, d]
→ N × Block(Masked Self-Attn + FFN) → [B, S, d]
→ LM Head [d, V] → logits [B, S, V]
:::

:::note 为什么现在几乎都是 Decoder-only
统一、简单、可扩展：任何任务都能写成「给一段前缀，续写下去」（prompt → completion）。不需要为任务设计专门架构，预训练目标直接就是使用形式。
:::

:::interview 面试常问
**Q：为什么 GPT 是 Decoder-only？**

:::answer
生成任务只需要「看左侧、预测下一个」，Masked Self-Attention + FFN 就够了，不需要 Encoder 和 Cross-Attention。去掉后架构更简单、参数利用率更高、更容易扩展，且任何任务都能统一成「续写」形式。
:::
:::

## 9.2 Next Token Prediction ★

:::unfold 先懂直觉
模型每读一个位置，就输出「词表里每个 token 作为下一个词的概率」。整句话的概率就是每一步概率的连乘。训练就是让「正确答案」的概率越来越大。
:::

### 公式（单步）

$$
P(x_t \mid x_{<t}) = \text{Softmax}\left(W_{lm}\, h_t + b\right)
$$

### 逐项拆解

| 符号 | 含义 | 形状 |
| --- | --- | --- |
| $h_t$ | 第 $t$ 个位置的 hidden state | [B, d_model] |
| $W_{lm}$ | LM Head（输出投影） | [d_model, V] |
| logits | 词表中每个 token 的分数 | [B, V] |
| Softmax | 归一化成概率 | [B, V]，和为 1 |

### 矩阵 shape

:::shapeflow
h [B, S, d_model] × W_lm [d_model, V] → logits [B, S, V]
logits → softmax → P(next token) [B, S, V]
:::

**注意**：一次前向会给**每个位置**都输出一个「下一个 token」的分布，所以训练时一个序列产生 $S$ 个训练信号。

### 数字算例

```
The capital of France is ___
```

模型在最后一个位置输出 logits：

| 候选 | logit |
| --- | --- |
| Paris | 8.3 |
| London | 4.2 |
| Berlin | 3.8 |
| Rome | 3.1 |
| Madrid | 2.4 |

softmax 后：

| 候选 | 概率 |
| --- | --- |
| Paris | 约 91% |
| London | 约 4% |
| Berlin | 约 2.5% |
| 其余 | 约 2.5% |

:::demo next-token 交互：完整走一遍生成流程
点击按钮依次经历「logits → softmax → 选择 token」，看 "The capital of France is" 如何生成 "Paris"。
:::

:::fold 工程里怎么用（训练 loss）
```python
logits = model(input_ids)                     # [B, S, V]
# 预测第 t+1 个 token 用第 t 个位置的输出 → 错位一位
shift_logits = logits[:, :-1, :].reshape(-1, V)
shift_labels = input_ids[:, 1:].reshape(-1)
loss = F.cross_entropy(shift_logits, shift_labels)
```
:::

:::warning 常见误区
- **LM Head 输出的是 logits，不是概率**；概率要经过 softmax。
- **每个位置都有输出**：位置 $t$ 的输出用来预测 $x_{t+1}$，不是预测自己。
- **词表 V 通常 32k~150k**，所以 LM Head 参数量 = d_model × V，可能很大（可与 embedding 权重共享，weight tying）。
:::

:::interview 面试常问
**Q：为什么 LM Head 常与 Embedding 权重共享？**

:::answer
输入 embedding 是 [V, d]，LM Head 是 [d, V]，两者形状互为转置。共享（weight tying）能省一份参数量（大词表时可达上亿），并常带来更好的效果——因为「输入词向量」和「输出词向量」语义空间对齐。
:::
:::

## 9.3 训练时为什么能并行 ★

:::unfold 先懂直觉
虽然生成是一个一个来的，但训练时整句话都是已知的。causal mask 保证每个位置只能看到自己及之前，所以一次前向就能同时算出所有位置的 loss。
:::

例如：

```
输入： <BOS> I love
标签： I love AI
```

一次前向同时算：

| 位置 | 可见范围 | 预测目标 |
| --- | --- | --- |
| 0 | `<BOS>` | I |
| 1 | `<BOS> I` | love |
| 2 | `<BOS> I love` | AI |

### 公式

$$
\mathcal L = -\frac{1}{S}\sum_{t=1}^{S} \log P_\theta(x_t \mid x_{<t})
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $S$ | 序列长度（产生 $S$ 个训练信号） |
| $x_t$ | 位置 $t$ 的**真实** token（teacher forcing） |
| $x_{<t}$ | 真实前缀（不是模型自己生成的） |
| causal mask | 保证位置 $t$ 看不到 $x_{>t}$，预测合法 |

:::shapeflow
输入 [B, S] → 一次前向 → logits [B, S, V]
错位对齐：logits[:, :-1] 与 labels[:, 1:] → loss [B×(S−1)]
:::

:::demo train-vs-inference 交互：并行训练 vs 逐步推理
点击「运行训练」看一次前向并行点亮所有位置；点击「运行推理」看 token 一个接一个生成。对比前向次数。
:::

:::warning 常见误区
**「GPT 是自回归模型所以训练很慢」是错的**。自回归指的是推理时的生成方式；训练时因为 teacher forcing + causal mask，所有位置的 loss 完全并行计算。这也是 LLM 预训练能吃下几万 GPU 并行的原因。
:::

:::interview 面试常问
**Q：Teacher Forcing 是什么？有什么缺点？**

:::answer
训练时用真实的前一个 token 作为输入（而不是模型自己的预测），让训练稳定、可并行。缺点是训练/推理输入分布不一致：推理时模型看到的是自己生成的（可能有错的）前缀，误差会累积——称为 exposure bias。
:::
:::

## 9.4 推理循环：自回归生成

:::unfold 先懂直觉
推理时没有「正确答案」，只能：前向 → 得到下一个 token 的概率 → 采样一个 → 拼回序列 → 再前向。循环直到生成结束符。
:::

```
prompt → 模型 → logits → softmax → 选择 token → append 到序列 → 再次输入（循环）
```

直到输出 `EOS` 或达到 `max_tokens`。

:::shapeflow
第 1 步：输入 [B, S] → 取最后位置 logits [B, V] → 采样 1 个 token → 序列变 [B, S+1]
第 2 步：输入 [B, S+1] → ...（每步只新增 1 个 token）
:::

:::fold 工程里怎么用（最小生成循环）
```python
@torch.no_grad()
def generate(model, idx, max_new_tokens, temperature=1.0):
    for _ in range(max_new_tokens):
        logits = model(idx)[:, -1, :]          # 只取最后一个位置 [B, V]
        probs = F.softmax(logits / temperature, dim=-1)
        next_id = torch.multinomial(probs, num_samples=1)   # 采样
        idx = torch.cat([idx, next_id], dim=1) # 拼回序列
        if next_id.item() == EOS_ID:
            break
    return idx
```
:::

:::note 工程视角：这个循环每次只多一个 token，但历史 token 的 K/V 每次都重算会非常浪费——这正是 KV Cache（第 10 章）要解决的问题。
:::

## 9.5 Temperature：控制随机性 ★

:::unfold 先懂直觉
温度是「随机性的旋钮」。温度低，分布变尖，模型更保守；温度高，分布变平，模型更发散。
:::

### 公式

$$
P_i = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}
$$

### 逐项拆解

| 温度 | 效果 | 适用场景 |
| --- | --- | --- |
| $T < 1$（如 0.3） | logits 差异被放大，分布更尖 | 代码、数学、事实问答 |
| $T = 1$ | 原始分布 | 默认 |
| $T > 1$（如 1.5） | 分布变平，更随机 | 创意写作、头脑风暴 |
| $T \to 0$ | 趋近 greedy（argmax） | 确定性输出 |

### 数字算例（同一组 logits 在不同温度下的概率）

logits = `[4.0, 3.2, 2.8, 2.0, 1.2]`（Paris/London/Berlin/Rome/Madrid）：

| 温度 | Paris | London | Berlin | Rome | Madrid |
| --- | --- | --- | --- | --- | --- |
| T = 0.5 | **76.1%** | 15.4% | 6.9% | 1.4% | 0.3% |
| T = 1.0 | **51.4%** | 23.1% | 15.5% | 7.0% | 3.1% |
| T = 2.0 | **35.3%** | 23.7% | 19.4% | 13.0% | 8.7% |

观察：温度只改变分布的**尖锐程度**，不改变排序（Paris 始终第一）。

:::demo temperature 交互：拖动温度看分布变化
拖动 T 滑块，实时观察 5 个候选 token 的概率分布如何从「尖锐」变「平坦」。
:::

:::warning 常见误区
**Temperature 不改变排序**。它只改变分布的尖锐程度：原来概率高的依然高。$T \to 0$ 时最大概率 → 1，等价于 greedy。
:::

:::interview 面试常问
**Q：Temperature 和 Top-P 应该怎么配合使用？**

:::answer
Temperature 调整分布形状，Top-P 截断长尾，两者互补。常见组合：temperature=0.7、top_p=0.9（通用对话）；代码/数学用 temperature=0.2~0.3；创意写作用 temperature=0.9~1.2。若追求确定性直接 greedy（do_sample=False）。
:::
:::

## 9.6 Greedy、Top-K、Top-P ★

:::unfold 先懂直觉
即使有了概率分布，怎么选 token 也有策略。Greedy 永远选最大；Top-K 只在概率最高的 K 个里选；Top-P 只在「累计概率达到 p」的最小集合里选。后两者都是为了砍掉长尾里那些「可能很离谱」的低概率 token。
:::

### 公式

**Greedy**：

$$
\hat x = \arg\max_i P_i
$$

**Top-K**：

$$
\mathcal S_K = \{i : P_i \text{ 排名前 } K\}, \qquad P'_i = \frac{P_i \cdot \mathbb 1[i \in \mathcal S_K]}{\sum_{j \in \mathcal S_K} P_j}
$$

**Top-P（nucleus）**：

$$
\mathcal S_P = \text{最小的集合，使} \sum_{i \in \mathcal S_P} P_i \ge p
$$

### 逐项拆解

| 策略 | 保留范围 | 特点 |
| --- | --- | --- |
| Greedy | 1 个 | 确定、可复现、易重复 |
| Top-K | 固定 K 个 | 简单，但 K 不随分布自适应 |
| Top-P | 累计概率 ≥ p | 自适应：确定时少留，不确定时多留 |
| Temperature | 调整分布形状 | 与 Top-K/Top-P 组合使用 |

### 数字算例

假设 8 个 token 的概率（已排序）：

```
Paris 0.42 | London 0.21 | Berlin 0.13 | Rome 0.09 | Madrid 0.06 | Vienna 0.04 | Prague 0.03 | Oslo 0.02
```

- **Greedy**：只选 Paris。
- **Top-K（K=3）**：保留 `[0.42, 0.21, 0.13]`，重新归一化 → `[0.55, 0.28, 0.17]`。
- **Top-P（p=0.8）**：累加 0.42 + 0.21 + 0.13 = 0.76 < 0.8，再加 0.09 → 0.85 ≥ 0.8，保留 4 个 → 归一化 → `[0.49, 0.25, 0.15, 0.11]`。
- **Top-P（p=0.95）**：需要加到 0.97（6 个 token）。

:::demo top-k-p 交互：四种策略对比
在「全采样 / Greedy / Top-K / Top-P」之间切换，观察哪些 token 被保留（绿色）、哪些被截断（灰色），以及重新归一化后的概率。
:::

:::fold 工程里怎么用（HuggingFace 采样参数）
```python
out = model.generate(
    input_ids,
    do_sample=True,
    temperature=0.7,
    top_p=0.9,        # nucleus sampling
    top_k=50,         # 同时限制
    max_new_tokens=256,
)
```
:::

:::warning 常见误区
- **Top-K 不够自适应**：模型很确定时仍然保留 K 个（浪费），很不确定时也只保留 K 个（可能漏掉合理选项）。Top-P 按累计概率动态决定集合大小，更常用。
- **Greedy 容易重复**：一旦进入循环模式，后续上下文又强化该模式，容易死循环。采样可以跳出。
- **截断后必须重新归一化**，否则概率和不为 1。
:::

:::interview 面试常问
**Q1：Top-K 和 Top-P 的区别？**

:::answer
Top-K 保留固定数量的 token，K 不随分布自适应；Top-P 按累计概率动态决定集合大小（确定时集合小、不确定时集合大），更自适应，因此更常用。两者可以同时使用（先 Top-K 再 Top-P）。
:::

**Q2：为什么 greedy 会重复？**

:::answer
Greedy 每步都选最大概率，一旦进入某个循环模式（如重复同一句话），后续上下文又强化了这个模式，容易陷入死循环。采样（temperature/top-p）引入随机性可以跳出。
:::
:::

## 9.7 本章总结

:::key 本节必须记住
| 概念 | 一句话 |
| --- | --- |
| 自回归分解 | $P(x) = \prod_t P(x_t \mid x_{<t})$ |
| Next Token Prediction | 每个位置输出下一个 token 的分布，错位一位算 loss |
| 训练并行 | 正确答案已知 + causal mask → 一次算全句 loss |
| 推理循环 | 生成一个 → 拼回去 → 再生成 |
| Temperature | 调分布尖锐程度，不改排序 |
| Top-K / Top-P | 截断候选集合；Top-P 自适应，截断后需重新归一化 |
| Greedy | 永远选最大概率，稳定但易重复 |
:::

:::quiz
GPT 训练时为什么可以并行计算所有位置的 loss？

A. 因为模型很小
B. 因为训练时正确答案已知，causal mask 保证不偷看未来
C. 因为使用了 KV Cache
D. 因为用了 Top-P 采样

答案: B
解析: teacher forcing 下整句话的标签都已知；causal mask 让位置 t 只能看到 ≤ t 的内容，所以一次前向就能为每个位置生成合法的预测任务，loss 并行计算。
:::

:::quiz
Temperature T → 0 时，采样行为趋近于？

A. 均匀随机采样
B. Greedy（选概率最大的 token）
C. Top-P 采样
D. 模型输出全零

答案: B
解析: T→0 时 e^(z/T) 中最大 logit 占绝对优势，分布趋近 one-hot，采样等价于 argmax（greedy）。
:::

:::quiz
Top-P（nucleus）采样中的「P」指的是？

A. token 的总数
B. 累计概率阈值
C. 模型的参数量
D. 学习率

答案: B
解析: Top-P 按概率降序累加，保留累计概率首次达到 p 的最小 token 集合，集合大小随分布自适应变化。截断后需要重新归一化。
:::

:::quiz
关于 LM Head 与 Embedding 权重共享（weight tying），说法正确的是？

A. 会显著增加参数量
B. 省一份参数量并常带来更好的效果
C. 只能用于 BERT
D. 会破坏模型训练

答案: B
解析: 输入 embedding [V,d] 与 LM Head [d,V] 形状互为转置，共享能省一份参数量（大词表时可达上亿），且让输入/输出词向量空间对齐，常带来更好效果。
:::

:::related
依赖 | Transformer Decoder, Causal Mask, Softmax
用于 | 大语言模型, Chat 模型, KV Cache, 采样策略
:::
