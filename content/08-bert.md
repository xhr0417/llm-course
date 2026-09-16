> **本章对应课件**：《2-4 BERT&GPT&前沿大语言模型》。核心知识点全部按统一模板展开：直觉、公式、逐项拆解、shape、数字算例、交互演示、代码、误区、面试问题。

## 8.1 BERT 的定位：Encoder-only Transformer

:::unfold 先懂直觉
BERT 是一个「阅读理解型」模型：它同时看句子的左右两边，学习每个词的上下文相关表示。它不擅长从头生成文本，但非常适合分类、抽取、匹配这类「理解」任务。
:::

BERT 擅长：

- 文本分类（情感、主题）
- NER（命名实体识别）
- Question Answering（抽取式问答）
- 语义匹配（句子相似度）

而不是 GPT 那种从左到右持续生成。

:::demo bert-vs-gpt 交互：两者能看到哪些 token
选择要预测的位置，上方 BERT 面板显示整句可见（双向），下方 GPT 面板显示只有左侧可见（因果）。
:::

**关键区别**：

| | BERT | GPT |
| --- | --- | --- |
| 结构 | Encoder-only | Decoder-only |
| 注意力 | 双向（全句可见） | 因果（只看左侧） |
| 预训练目标 | MLM（完形填空） | next token prediction |
| 擅长 | 理解类任务 | 生成类任务 |
| 能否直接生成 | 不能（没有自回归训练） | 能 |

:::shapeflow
输入 [B, S] → Embedding 相加 [B, S, 768] → 12 × Encoder Block（双向注意力）→ 每层输出 [B, S, 768]
:::

:::warning 常见误区
**BERT 不是 Decoder**：它是 Encoder-only，没有 causal mask，每个位置可以看到全句。因此它不能像 GPT 那样直接做自回归生成。
:::

:::interview 面试常问
**Q1：BERT 和 GPT 的核心区别？**

:::answer
BERT 是 Encoder-only、双向注意力、MLM 训练，擅长理解；GPT 是 Decoder-only、因果注意力、next token prediction 训练，擅长生成。前者每个位置能看到全句，后者只能看到左侧。
:::

**Q2：BERT 为什么不能直接做生成？**

:::answer
两个原因：① 训练目标是完形填空（MLM），没有学过从左到右的生成模式；② 双向注意力在生成时会「看到未来」，无法用于自回归推理。要生成需改用 Decoder-only 或 Encoder-Decoder。
:::
:::

## 8.2 BERT Base / Large

| 规格 | 层数 $L$ | hidden $d$ | heads $h$ | 参数量 |
| --- | --- | --- | --- | --- |
| BERT Base | 12 | 768 | 12 | 约 110M |
| BERT Large | 24 | 1024 | 16 | 约 340M |

:::math 参数量具体算一遍（Base）
| 部分 | 计算 | 参数量 |
| --- | --- | --- |
| Token Embedding | 30522 × 768 | 23.4M |
| Position Embedding | 512 × 768 | 0.4M |
| Segment Embedding | 2 × 768 | 0.002M |
| 每层 Attention（Q/K/V/O） | 4 × 768 × 768 | 2.36M |
| 每层 FFN | 2 × 768 × 3072 | 4.72M |
| 每层合计 | 2.36 + 4.72 | 7.08M |
| 12 层合计 | 7.08 × 12 | 85.0M |
| **总计** | 85.0 + 23.8 | **约 108.8M ≈ 110M** ✅ |

:::

**观察**：Embedding 占了约 21%，12 层 Transformer 占约 79%。这也是「词表大小显著影响小模型参数量」的原因。

## 8.3 三种 Embedding 相加 ★

:::unfold 先懂直觉
BERT 的输入向量是三种信息逐元素相加：这个词是什么（token）、它在哪个位置（position）、它属于哪句话（segment）。加完再送进 Transformer。
:::

### 公式

$$
\text{Input}_i = \text{TokenEmb}(x_i) + \text{PositionEmb}(i) + \text{SegmentEmb}(s_i)
$$

### 逐项拆解

| Embedding | 回答的问题 | 词表/大小 | 是否可学习 |
| --- | --- | --- | --- |
| Token Embedding | 词本身是什么 | 30522 × 768 | ✅ |
| Position Embedding | 词在什么位置 | 512 × 768 | ✅（不是 sinusoidal！） |
| Segment Embedding | 属于句子 A 还是 B | 2 × 768 | ✅ |

### 矩阵 shape

:::shapeflow
input_ids [B, S] + position_ids [B, S] + segment_ids [B, S]
→ 三次查表 → [B, S, 768] + [B, S, 768] + [B, S, 768]
→ 逐元素相加 → 输入 [B, S, 768]
:::

### 数字算例（4 维示意）

以 token `"cute"`（位置 5，Segment B）为例：

| 分量 | 向量 |
| --- | --- |
| Token | [0.6, −0.2, 0.3, 0.5] |
| Position（pos=5） | [0.25, −0.15, 0.20, 0.10] |
| Segment（B） | [−0.1, −0.1, −0.1, −0.1] |
| **相加** | **[0.75, −0.45, 0.40, 0.50]** |

:::demo bert-embeddings 交互：三种 Embedding 相加
点击任意 token，查看它的 Token/Position/Segment 向量如何逐元素相加得到输入向量。
:::

:::fold 工程里怎么用（HuggingFace）
```python
from transformers import BertTokenizer, BertModel

tok = BertTokenizer.from_pretrained("bert-base-chinese")
enc = tok("我喜欢机器学习", return_tensors="pt")
# enc 里已经包含 input_ids、token_type_ids（segment）、attention_mask
out = BertModel.from_pretrained("bert-base-chinese")(**enc)
print(out.last_hidden_state.shape)   # [1, S, 768]
```
:::

:::warning 常见误区
- **是相加不是拼接**：输出维度仍是 768（拼接会变成 2304，权重矩阵对不上）。
- **Position Embedding 是可学习的**，与原始 Transformer 的 sinusoidal 不同；上限 512。
- **Segment Embedding 只有 2 个**（A/B），不是每句话一个。
:::

:::interview 面试常问
**Q1：BERT 的三种 Embedding 怎么组合？**

:::answer
逐元素相加：Token + Position + Segment，输出仍是 [B, S, d_model]。相加让每种信息都直接影响同一个向量；拼接会让维度翻倍且需要额外参数。
:::

**Q2：为什么 BERT 需要 Segment Embedding？**

:::answer
NSP 和问答等任务需要区分「句子 A」和「句子 B」，segment embedding 给两个句子不同的可学习偏置，让模型知道每个 token 属于哪一句。
:::
:::

## 8.4 [CLS] 与 [SEP]

:::unfold 先懂直觉
BERT 需要两个特殊 token：一个放在句首当「整句摘要位」（[CLS]），一个用来分隔句子（[SEP]）。分类任务只用 [CLS] 的最终向量。
:::

**[CLS]**：放在序列开头。经过 12 层后：

$$
h_{CLS} \in \mathbb R^{768}
$$

被当作整句表示，接一个分类头：

$$
\text{logits} = W_{cls}\, h_{CLS} + b, \qquad W_{cls} \in \mathbb R^{C \times 768}
$$

**[SEP]**：分隔句子（问答的 question/context、NSP 的两句），也标记句尾。

:::shapeflow
[CLS] 我 喜欢 机器学习 [SEP] → 12 层 → h_CLS [768] → Linear(768, C) → logits [C] → softmax
:::

:::fold 工程里怎么用（分类微调）
```python
from transformers import BertForSequenceClassification

model = BertForSequenceClassification.from_pretrained("bert-base-chinese", num_labels=2)
batch = tok("这部电影很好看", return_tensors="pt", padding=True)
logits = model(**batch).logits       # [1, 2]
# 内部：h_CLS → Dropout → Linear(768, 2)
```
:::

:::interview 面试常问
**Q：BERT 为什么用 [CLS] 做句表示？**

:::answer
[CLS] 没有自身语义（不来自真实词），经过多层注意力后会「汇聚」整句信息（对所有 token 都有注意力），其最终 hidden state 可作为整句表示。也可以对全部 token 做 mean pooling，效果有时更好。
:::
:::

## 8.5 Attention Mask（Padding Mask）★

:::unfold 先懂直觉
一个 batch 里句子长短不一，短的要用 PAD 补齐。这些 PAD 没有意义，不应该参与注意力计算，所以用 mask 把它们的注意力分数设为 −∞。
:::

### 公式

$$
\text{mask}_i = \begin{cases} 1, & \text{真实 token} \\ 0, & \text{PAD} \end{cases}
$$

加到分数上：

$$
\text{Attention} = \text{Softmax}\left(\frac{QK^\top}{\sqrt{d_k}} + M\right)V, \qquad M_i = \begin{cases} 0, & \text{mask}_i = 1 \\ -\infty, & \text{mask}_i = 0 \end{cases}
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| mask | 形状 [B, S]，1 = 有效，0 = PAD |
| $M$ | 广播到 [B, S, S]，被遮位置的分数变 −∞ |
| 效果 | softmax 后 PAD 位置权重为 0，不参与信息混合 |

### 矩阵 shape

:::shapeflow
mask [B, S] → 广播成 [B, 1, S] → 加到 scores [B, S, S] → softmax → PAD 列权重为 0
:::

### 数字算例

序列 `[CLS] my dog [SEP] PAD PAD`（S=6）：

```
mask = [1, 1, 1, 1, 0, 0]
```

某行原始分数 `[2, 1, 3, 2, 4, 5]`：

- 不加 mask：softmax 后 PAD 位置（4、5）分别拿到约 21%、57% 的注意力——错误！模型会「关注空白」。
- 加 mask 后：`[2, 1, 3, 2, −∞, −∞]` → softmax 只在真实 token 上分配权重，和仍为 1。

:::warning 常见误区（高频考点）
**Attention Mask（padding mask）≠ Causal Mask**：

| | Padding Mask | Causal Mask |
| --- | --- | --- |
| 遮什么 | PAD 补齐位置 | 未来位置 |
| 形状 | [B, S]（可广播） | [S, S] |
| 用在哪 | BERT / GPT 都需要 | 仅自回归模型（GPT） |
| 目的 | 排除无意义 token | 防止偷看答案 |

两者可以同时使用（GPT 的 batch 推理既有 padding 又需要 causal）。
:::

:::interview 面试常问
**Q：为什么 BERT 的 batch 需要 attention mask？**

:::answer
同一 batch 的句子长度不同，短的用 PAD 补齐。如果不遮，PAD 会参与注意力计算并污染真实 token 的表示。mask 把 PAD 的分数设为 −∞，softmax 后权重为 0。
:::
:::

## 8.6 MLM：Masked Language Modeling ★

:::unfold 先懂直觉
MLM 就是「完形填空」：随机挖掉句中 15% 的词，让模型根据左右两边猜被挖掉的是什么。因为要猜的词位置未知，模型必须学习双向上下文表示。
:::

### 公式

$$
\mathcal L_{MLM} = -\sum_{i \in \mathcal M} \log P_\theta\left(x_i \mid \tilde x\right)
$$

其中 $\mathcal M$ 是被选中的 token 集合，$\tilde x$ 是被破坏后的输入。

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $\mathcal M$ | 被选中做预测的位置（约 15%） |
| $\tilde x$ | 处理后的输入（含 [MASK]/随机词/原词） |
| $P_\theta(x_i \mid \tilde x)$ | 模型对正确 token 的预测概率 |
| 求和范围 | **只对被选中的 15% 位置求和**（不是全句！） |

### 矩阵 shape

:::shapeflow
输入 [B, S] → BERT → 每个位置输出 [B, S, 768]
→ MLM Head：Linear(768→768) + GELU + LayerNorm + Linear(768→30522)
→ logits [B, S, 30522] → 只取 mask 位置算交叉熵
:::

### 数字算例

句子 `my dog is cute`，选中 `cute`（位置 3）：

- 输入变为 `my dog is [MASK]`
- 模型输出该位置的概率分布：`P(cute) = 0.62`
- 该位置 loss：

$$
-\ln(0.62) \approx 0.478
$$

如果模型只给 `P(cute) = 0.01`，loss 就是 $-\ln(0.01) \approx 4.6$——重罚。

:::demo mlm 交互：完形填空全流程
点击「下一步」经历：选 15% → 80/10/10 处理 → 模型预测。可以切换三种处理方式，观察输入如何变化。
:::

:::fold 工程里怎么用（MLM loss 计算）
```python
logits = model(input_ids, attention_mask=mask).logits      # [B, S, V]
# labels 中，非选中位置设为 -100（忽略）
loss = F.cross_entropy(
    logits.view(-1, V),
    labels.view(-1),          # 只有被遮位置有真实标签
    ignore_index=-100,
)
```
:::

:::warning 常见误区
- **MLM loss 只算被选中的 15% 位置**，不是全句——所以 BERT 的 loss 数值不能直接和 GPT（全位置）比较。
- **不是只有 [MASK] 位置才预测**：80/10/10 里，随机词和原词位置同样参与预测（模型不知道哪个被改了）。
- **MLM 不是去噪自编码器**：它预测的是被破坏位置的原词，不是重建整个输入。
:::

:::interview 面试常问
**Q1：为什么 MLM 能让 BERT 学到双向表示？**

:::answer
被遮位置的正确答案需要同时依赖左侧和右侧上下文（如「我 昨天 去了 ___」需要右侧「看病」才能确定是「医院」）。要降低 loss，模型必须学会利用两侧信息，从而形成双向表示。
:::

**Q2：MLM 和 GPT 的 next token prediction 有什么区别？**

:::answer
MLM 是「挖空+双向」，每个位置都能看到全句（除自己），预测被选中的 15%；GPT 是「因果+单向」，每个位置只能看左侧，预测下一个 token（全部位置都算 loss）。前者适合理解，后者适合生成。
:::
:::

## 8.7 15% 与 80/10/10 策略 ★

:::unfold 先懂直觉
如果永远只用 [MASK] 替换，模型只在看到 [MASK] 时才认真预测，而真实文本里根本没有 [MASK]——训练和使用的输入分布不一致。80/10/10 就是为缓解这个问题设计的。
:::

| 处理方式 | 比例 | 例子 |
| --- | --- | --- |
| 替换成 `[MASK]` | 80% | `my dog is [MASK]` |
| 替换成随机 token | 10% | `my dog is banana` |
| 保持原 token 不变 | 10% | `my dog is cute` |

### 逐项拆解：为什么这样设计

| 策略 | 解决的问题 |
| --- | --- |
| 80% [MASK] | 提供明确的「要预测这里」信号 |
| 10% 随机词 | 迫使模型不能盲目信任输入（随机词可能是错的，也要保持编码能力） |
| 10% 保持原词 | 让输入分布接近真实文本，模型对正常句子也要认真编码 |

:::math 为什么是 15%？
- 太小（1%）：每个 batch 的训练信号太少，收敛慢；
- 太大（50%）：上下文破坏太严重，任务变得不可解，且与真实分布差距大。
- 15% 是 BERT 论文通过对比实验确定的平衡点。

:::

:::warning 常见误区
- **80/10/10 是「在被选中的 15% 内部」的比例**，不是全句比例。
- **随机替换的 10% 也用原词做标签**（模型仍要预测出原词）。
- **推理时没有 [MASK]**：这也是 80/10/10 存在的原因。
:::

:::interview 面试常问
**Q：为什么 MLM 要用 80/10/10 而不是全用 [MASK]？**

:::answer
全用 [MASK] 会让预训练与微调/推理的输入分布不一致（真实文本没有 [MASK]），模型会「只在看到 [MASK] 时才认真编码」。随机词迫使模型对任何输入保持警惕，原词保持真实分布，三者共同缓解 mismatch。
:::
:::

## 8.8 NSP：Next Sentence Prediction

:::unfold 先懂直觉
除了猜词，BERT 还想学会「句子之间的关系」。NSP 给模型两句话，让它判断第二句是不是真的接在第一句后面。
:::

给：

```
Sentence A
Sentence B
```

判断 `IsNext`（真的相邻）或 `NotNext`（随机拼的）。数据构造：

- 50% 保持原文相邻（IsNext）；
- 50% 从别处随机抽一句（NotNext）。

### 公式

$$
\mathcal L_{NSP} = -\log P_\theta(y \mid h_{CLS}), \qquad y \in \{\text{IsNext}, \text{NotNext}\}
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $h_{CLS}$ | [CLS] 位置的输出向量（聚合两句信息） |
| 分类头 | Linear(768, 2) |
| 用途 | 问答、自然语言推理等句间任务 |

**总预训练目标**：

$$
\mathcal L = \mathcal L_{MLM} + \mathcal L_{NSP}
$$

课件也提到，后续工作（如 RoBERTa）发现 **NSP 并非一定需要**，所以不少后来的 BERT 类模型删掉了 NSP。

:::warning 常见误区
- **NSP ≠ 判断两句是否语义相关**：它判断的是「是否相邻」，不是「是否相关」。
- **NSP 用 [CLS] 的输出**，不是 [SEP]。
- **现代 BERT 变体常去掉 NSP**（RoBERTa、DeBERTa），改为更长的连续文本段或句子顺序预测（SOP）。
:::

## 8.9 微调：三类任务头

:::unfold 先懂直觉
预训练好的 BERT 是一台「文本理解引擎」，微调就是在它上面接一个小小的任务头，用少量标注数据教会它做具体任务。
:::

| 任务类型 | 任务头 | 输入取哪个位置 | 输出 shape |
| --- | --- | --- | --- |
| 句分类 | Linear(768, C) | $h_{CLS}$ | [B, C] |
| 序列标注（NER） | Linear(768, C) 逐位置 | 每个 $h_i$ | [B, S, C] |
| 抽取式问答 | 两个向量预测 start/end | 所有位置 | [B, 2, S] |

:::fold 工程里怎么用（三种任务的代码骨架）
```python
# ① 句分类
logits = Linear(model(x).last_hidden_state[:, 0])       # 取 [CLS]

# ② 序列标注
logits = Linear(model(x).last_hidden_state)             # 每个位置

# ③ 抽取式问答（SQuAD 风格）
h = model(x).last_hidden_state
start_logits = (h @ W_start).squeeze(-1)                # [B, S]
end_logits   = (h @ W_end).squeeze(-1)                  # [B, S]
```
:::

:::interview 面试常问
**Q：BERT 微调时更新哪些参数？**

:::answer
通常更新全部参数（全量微调），学习率比预训练小 1~2 个数量级（如 2e-5~5e-5）。也可以只训练任务头（frozen backbone，省显存但效果略差），或用 LoRA（第 13 章）做参数高效微调。
:::
:::

## 8.10 本章总结

:::key 本节必须记住
| 概念 | 一句话 |
| --- | --- |
| Encoder-only | 双向理解，不擅长自回归生成 |
| 三种 Embedding | token + segment + position **相加**，形状不变 |
| [CLS] / [SEP] | 整句表示 / 句子分隔 |
| Attention Mask | 遮 PAD（[B,S]），不是遮未来 |
| MLM | 挖空 15% 猜词，loss 只算被选中位置 |
| 80/10/10 | 缓解预训练与微调输入分布不一致 |
| NSP | 判断句对相邻，后被认为可去掉 |
| 微调 | 接任务头，小学习率全量更新 |
:::

:::quiz
BERT 的三种 Embedding 是如何组合的？

A. 拼接成 3×768 维
B. 相加
C. 只取 token embedding
D. 取最大值

答案: B
解析: Token + Segment + Position 逐元素相加，输出仍是 [B, S, 768]。拼接会让维度变成 2304，与后续权重不匹配。
:::

:::quiz
BERT 的 MLM loss 在哪些位置计算？

A. 全部位置
B. 只在被选中的 15% 位置
C. 只在 [MASK] 替换的 80% 位置
D. 只在 [CLS] 位置

答案: B
解析: loss 只对被选中的 15% 位置求和。注意 80/10/10 里随机词和原词位置也算（模型不知道哪些被改过），所以不是「只在 [MASK] 位置」。
:::

:::quiz
Attention Mask（padding mask）的作用是？

A. 遮住未来位置
B. 遮住 PAD 补齐位置
C. 归一化注意力
D. 加速训练

答案: B
解析: padding mask 让 PAD token 不参与注意力计算；遮未来的是 causal mask（GPT 使用）。两者形状与用途不同，可以同时出现。
:::

:::quiz
关于 NSP，下列说法正确的是？

A. 它是 BERT 唯一的预训练目标
B. 后续研究（RoBERTa）发现去掉 NSP 影响不大甚至更好
C. NSP 要求生成下一句
D. NSP 使用 causal mask

答案: B
解析: RoBERTa 等后续工作发现 NSP 任务过于简单、收益有限，去掉后效果不降反升。BERT 的主任务是 MLM。
:::

:::related
依赖 | Transformer Encoder, 位置编码, 双向注意力
用于 | 文本分类, NER, 问答, 语义匹配, 检索
:::
