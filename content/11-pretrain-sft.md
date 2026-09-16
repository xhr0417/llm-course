> **本章对应课件**：《3.1 大模型工程专题》。核心知识点全部按统一模板展开：直觉、公式、逐项拆解、shape、数字算例、交互演示、代码、误区、面试问题。

## 11.1 大模型训练完整生命周期

:::unfold 先懂直觉
训练一个可用的大模型分三个阶段：预训练（读遍海量文本，学语言和知识）→ 监督微调（学会按指令回答）→ 偏好优化（学会人类更喜欢哪种回答）。前面几章都在讲「模型是什么」，本章开始讲「怎么真正训出来」。
:::

```
Data → Tokenizer → Pretrain → SFT → RL / Preference Optimization → Evaluation → Deployment
```

:::demo pipeline 交互：点击每个阶段查看详情
从 Raw Data 到 Aligned Model 的 9 个阶段，点击任意阶段看它在做什么、对应哪一章。
:::

| 阶段 | 目标 | 数据规模 | 产出 |
| --- | --- | --- | --- |
| Pretrain | 学语言、知识、推理模式 | 万亿 token 级 | Base Model |
| SFT | 学会按指令回答 | 万～百万条 | Instruction Model |
| RL/偏好优化 | 对齐人类偏好 | 万～十万条偏好数据 | Aligned Model |

:::interview 面试常问
**Q：为什么大模型要分三阶段训练，不能一步到位？**

:::answer
三个目标本质不同：预训练需要海量无标注文本学「能力」，SFT 需要少量高质量示范学「行为」，RL 需要偏好信号学「取舍」。混在一起会导致数据效率低、目标冲突；分阶段让每步用最合适的数据与目标。
:::
:::

## 11.2 Pretrain 数据从哪里来

课件列出的主要来源：

- Common Crawl（网页爬取，最大来源）
- GitHub（代码）
- 网页、论坛
- 电子书
- 教育 / 论文数据（如 arXiv）
- 公司内部数据

真正困难的不是「找到很多文本」，而是：

> **获得海量、干净、多样、高质量的数据。**

:::note 数据决定上限
模型的能力上限很大程度上由数据决定：没有代码数据，代码能力无从谈起；没有数学语料，数学推理弱；中文语料占比低，中文能力就差。所以「数据配比」本身就是模型设计的核心决策。
:::

## 11.3 数据清洗

:::unfold 先懂直觉
原始网页数据充满广告、模板、乱码、重复内容。清洗就是把「垃圾」去掉、把「重复」去掉、把「有毒」去掉，留下高质量文本。这一步的质量直接决定预训练效果。
:::

典型步骤：

| 步骤 | 做什么 | 手段 |
| --- | --- | --- |
| URL filtering | 去掉低质量网站 | 黑名单、域名规则 |
| 内容过滤 | 广告页、模板、导航栏 | 规则 + 分类器 |
| 语言识别 | 判断文本语言 | fastText 等 |
| 质量过滤 | 长度、符号比例、重复度 | heuristic / classifier / perplexity |
| 去重 | 完全重复 + 近似重复 | 哈希 + MinHash |

:::warning 常见误区
**清洗不是「越干净越好」**：过度过滤会损失多样性（如删掉所有短文本、口语内容），导致模型能力变窄。过滤规则需要在大规模消融实验中权衡。
:::

## 11.4 MinHash 去重 ★

:::unfold 先懂直觉
完全一样的文本可以用哈希精确去重，但互联网文本经常「99% 相同、只差一行版权声明」。MinHash 用一个巧妙的方法估计两段文本的相似度，从而找出「近似重复」。
:::

### 公式（Jaccard 相似度）

$$
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
$$

### 逐项拆解（MinHash 的核心技巧）

把文档切成 n-gram 集合，用多个哈希函数 $h_1, \ldots, h_k$ 分别取集合中最小哈希值，得到签名向量。关键性质：

$$
P\left(\min h(A) = \min h(B)\right) = J(A,B)
$$

| 符号 | 含义 |
| --- | --- |
| $A, B$ | 两篇文档的 n-gram 集合 |
| $\min h(A)$ | 集合 A 在哈希函数 $h$ 下的最小值 |
| 性质 | 两个集合最小哈希相等的概率 = Jaccard 相似度 |
| 实践 | 用 k 个哈希函数得到 k 维签名，比较签名相等比例 |

### 数字算例

两篇文章的 5-gram 集合：

- 文章 A：{今天天气很好, 天气很好啊, 气很好啊今, ...}（4 个元素）
- 文章 B：与 A 共享 3 个元素，另有 1 个不同

$$
J(A,B) = \frac{3}{4 + 4 - 3} = \frac{3}{5} = 0.6
$$

如果阈值设为 0.8，这两篇不会被判为重复；如果共享 4 个（J = 4/5 = 0.8），则会被去重。

:::fold 工程里怎么用（datasketch 库）
```python
from datasketch import MinHash, MinHashLSH

m1, m2 = MinHash(num_perm=128), MinHash(num_perm=128)
for d in doc1_ngrams: m1.update(d.encode("utf8"))
for d in doc2_ngrams: m2.update(d.encode("utf8"))
print(m1.jaccard(m2))      # 估计相似度

lsh = MinHashLSH(threshold=0.8, num_perm=128)
lsh.insert("doc1", m1)
print(lsh.query(m2))       # 找出近似重复的文档
```
:::

:::warning 常见误区
- **MinHash 是估计不是精确值**：签名越长（num_perm 越大）估计越准。
- **去重不是只去完全相同的**：近似重复（模板页、转载）才是大头。
- **必须配合 LSH**：直接两两比较是 O(n²)，几十亿文档不可行。
:::

:::interview 面试常问
**Q：为什么预训练数据必须去重？**

:::answer
重复数据会导致：① 模型过度记忆（逐字背诵训练数据）；② 浪费训练算力（同一内容被反复学）；③ 降低泛化能力；④ 评测集泄漏风险。网页数据中同一内容常有几千份副本，所以去重是数据工程的核心步骤。
:::
:::

## 11.5 数据配比

不能只拿「50% GitHub + 50% Wikipedia」随便训练。不同数据影响能力：

| 数据 | 影响 |
| --- | --- |
| 代码数据 ↑ | 代码能力增强，甚至提升结构化推理 |
| 数学数据 ↑ | 数学推理增强 |
| 中文数据太少 | 中文能力差 |
| 高质量书籍/论文 ↑ | 长文理解、知识密度 |
| 低质网页过多 | 输出变「网感」，质量下降 |

课件第 3～4 页专门展示了不同开源模型的数据分布。配比通常按「域（domain）」设定权重，并反复做消融实验（ablation）。

## 11.6 训练 Tokenizer

大模型训练之前，先训练 tokenizer。需要决定：

| 决策 | 选项 | 影响 |
| --- | --- | --- |
| 算法 | BPE / BBPE / SentencePiece | 切分质量、多语言公平性 |
| vocab size | 32k～150k | embedding 参数量（V×d）、压缩率 |
| special tokens | `<|im_start|>` 等 | 对话格式、工具调用 |
| 多语言比例 | 语料配比 | 各语言 token 效率 |

:::warning 常见误区
**Tokenizer 通常在大模型训练之前就固定了**，而且中途换 tokenizer 意味着 embedding 层作废、需要重新训练——代价极高。所以词表设计必须提前想清楚。
:::

## 11.7 Warmup + Learning Rate Decay ★

:::unfold 先懂直觉
训练刚开始时参数是随机的，梯度方向不可靠。一上来用大学习率容易把模型带偏。所以先用小学习率「热热身」（warmup），再逐渐升高，训练后期再慢慢降下来（decay）。
:::

### 公式

**线性 warmup**（step < warmup）：

$$
\eta_t = \eta_{peak} \cdot \frac{t}{T_{warmup}}
$$

**Cosine decay**（step ≥ warmup）：

$$
\eta_t = \eta_{peak}\left(r + (1-r)\cdot\frac{1}{2}\left(1 + \cos\left(\pi \cdot \frac{t - T_{warmup}}{T_{total} - T_{warmup}}\right)\right)\right)
$$

其中 $r$ 是最终学习率比例（通常 0.1）。

### 逐项拆解

| 符号 | 含义 | 典型值 |
| --- | --- | --- |
| $T_{warmup}$ | warmup 步数 | 总步数的 0.1%~2% |
| $\eta_{peak}$ | 峰值学习率 | 1e-4 ~ 3e-4 |
| $r$ | 最终比例 | 0.1 |

**为什么有效？**

- **warmup**：初期梯度方向不可靠（Adam 的二阶矩估计还不准），小步走避免把参数带偏；
- **decay**：后期接近最优时降低学习率，精细收敛、减少震荡。

:::demo warmup-schedule 交互：学习率调度曲线
拖动 warmup 步数、总步数、峰值 LR、最终比例，实时看曲线形状变化。注意 warmup 太短容易不稳定，太长浪费训练。
:::

:::fold 工程里怎么用（PyTorch 实现）
```python
import math

def lr_lambda(step):
    if step < warmup_steps:
        return step / warmup_steps
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    return 0.1 + 0.45 * (1 + math.cos(math.pi * progress))

scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
```
:::

:::warning 常见误区
- **warmup 不是「预热 GPU」**：它是学习率调度策略，目的是稳定初期训练。
- **decay 不是为了省时间**：是为了收敛更精细、减少后期震荡。
- **不是所有训练都要 warmup**：小模型、小数据量时影响不明显；大模型训练几乎必用。
:::

:::interview 面试常问
**Q：为什么大模型训练需要 warmup？**

:::answer
训练初期参数随机、梯度方向不可靠，Adam 的二阶矩估计还不准（v 的估计偏差大），大学习率容易导致不稳定甚至发散。warmup 用极小学习率起步、逐步升到峰值，让优化器统计量先「热身」。
:::
:::

## 11.8 为什么看 Loss 还不够

训练日志：

```
loss 3.0
loss 2.8
loss 2.6
```

当然重要。但异常情况可能出现 **loss spike**：

```
2.1
2.0
2.2
8.7   ← spike！
NaN
```

可能是：

- 数据异常（脏样本、重复样本）；
- learning rate 问题（过大或调度不当）；
- numerical instability（FP16 溢出等）；
- 梯度爆炸。

所以训练大模型时必须持续 monitor，并准备：

- 定期 checkpoint（方便回滚）；
- 梯度裁剪；
- 数据质量监控；
- 遇到 spike 时回滚到上一个 checkpoint，跳过坏数据继续。

## 11.9 Perplexity ★

:::unfold 先懂直觉
PPL 是「模型每一步平均在多少个候选之间犹豫」。loss 是交叉熵（越小越好），PPL 就是把它指数化，变成更容易直觉理解的「困惑度」。
:::

### 公式

$$
\text{PPL} = e^{\text{Loss}}
$$

### 逐项拆解与数字算例

| Loss | PPL = e^Loss | 直觉 |
| --- | --- | --- |
| 0.69 | 2.0 | 平均在 2 个候选间犹豫 |
| 2.0 | 7.39 | 约 7 个候选 |
| 3.0 | 20.09 | 约 20 个候选 |
| 5.0 | 148.4 | 非常困惑 |

**直觉**：PPL 越低通常越好。**但不能跨 tokenizer 随意比较**，因为 tokenizer 不同、token 粒度不同：同样一句话，token 切得越细，每步预测越容易，PPL 会显得更低。

:::warning 常见误区
- **Loss ≠ PPL**：PPL = e^loss，两者单调对应，但数值量级完全不同。
- **PPL 不能跨模型/tokenizer 直接比较**：只有同一 tokenizer、同一评测集上才有可比性。
- **PPL 低 ≠ 对话体验好**：PPL 衡量的是「预测文本的能力」，与指令遵循、安全性等无关。
:::

:::interview 面试常问
**Q：Perplexity 是什么？为什么不能跨 tokenizer 比较？**

:::answer
PPL = e^loss，表示模型预测每个 token 时的平均「犹豫程度」（等效候选数）。tokenizer 不同则 token 粒度不同：粒度细（如字符级）时每步更容易预测、PPL 更低，所以跨 tokenizer 的 PPL 没有可比性。比较必须在同一 tokenizer、同一数据集上进行。
:::
:::

## 11.10 Pretrain 与 SFT ★

:::unfold 先懂直觉
Pretrain 像「读书读得多」——模型见识广、知识多，但只会续写；SFT 像「学会礼貌对话」——用示范数据教它按人类期望的格式回答。
:::

### 对比

| | Pretrain | SFT |
| --- | --- | --- |
| 目标 | 学世界知识、语言模式、代码模式 | 学会按人类指令回答 |
| 数据 | 海量原始文本（万亿 token） | 高质量指令数据（万～百万条） |
| 损失 | 全位置 next token prediction | 通常只算 assistant 回复（Loss Mask） |
| 学习率 | 1e-4 ~ 3e-4 | 1e-5 ~ 2e-5（小 1~2 个数量级） |
| 产出 | Base Model | Instruction Model |

### 数字算例

```
Pretrain 数据：
法国的首都是巴黎。巴黎是……

SFT 数据：
User: 法国首都是哪里？
Assistant: 法国的首都是巴黎。
```

> **Pretrain：学知识/能力。SFT：学怎么使用能力。**

:::demo pipeline 交互：三阶段流水线
点击 Pretrain / SFT / RL 阶段，看每个阶段的目标、数据和产出。
:::

:::warning 常见误区
**SFT 不是从零训练模型**：它在预训练模型的基础上继续训练，学习率小、数据量小，改变的是「行为模式」而不是「知识量」。
:::

:::interview 面试常问
**Q：SFT 和继续预训练（continued pretraining）有什么区别？**

:::answer
继续预训练用海量无标注文本、next token 全位置 loss、较大学习率，目标是注入新知识或适配新语言/领域；SFT 用少量高质量指令-回复数据、response-only loss、小学习率，目标是学会按指令回答的格式和行为。
:::
:::

## 11.11 Chat Template

现代 chat model 往往写成：

```
<|im_start|>system
You are a helpful assistant.
<|im_end|>
<|im_start|>user
你好
<|im_end|>
<|im_start|>assistant
你好！有什么可以帮助你？
<|im_end|>
```

这些特殊 token 会被 tokenizer 转成 token ids。

:::fold 工程里怎么用（应用 chat template）
```python
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("Qwen/Qwen2-7B-Instruct")

messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "1+1等于几？"},
]
text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
ids = tok(text, return_tensors="pt").input_ids
```
:::

:::warning 常见误区
**训练和推理必须使用完全相同的 chat template**。如果训练时用 `<|im_start|>` 格式、推理时手工拼成 `User: ... Assistant: ...`，模型表现会明显下降——因为输入分布不匹配。
:::

## 11.12 SFT 的 Loss Mask ★

:::unfold 先懂直觉
一条对话里，用户的问题不是模型该学的；模型只需要学「assistant 该怎么回答」。所以把用户/system 部分的 loss 权重设为 0，只在 assistant 回复上算 loss。
:::

### 公式

$$
\text{Loss} = \frac{\sum_i \text{mask}_i \, L_i}{\sum_i \text{mask}_i}
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $L_i$ | 位置 $i$ 的交叉熵 |
| $\text{mask}_i$ | 1 = assistant token，0 = system/user token |
| 分母 | 归一化因子（只数 assistant token） |

### 矩阵 shape

:::shapeflow
input_ids [B, S] → logits [B, S, V]
labels = input_ids，但把 prompt 部分设为 -100 → [B, S]
loss 只对 labels ≠ -100 的位置计算
:::

### 数字算例

一条数据共 10 个 token：system/user 占 6 个（mask=0），assistant 回答占 4 个（mask=1）。这 4 个位置的交叉熵分别是 `[0.2, 0.5, 0.3, 0.8]`：

$$
\text{Loss} = \frac{0.2 + 0.5 + 0.3 + 0.8}{4} = 0.45
$$

如果不 mask，把 6 个 prompt token 也算进去（假设它们的 loss 都很小，比如 0.05），损失会被稀释、梯度预算被浪费在「模仿用户输入」上。

:::demo loss-mask 交互：哪些 token 计入 loss
看一段完整对话的 token 序列，system/user 部分 mask=0（灰色），assistant 部分 mask=1（绿色），只有绿色部分产生梯度。
:::

:::fold 工程里怎么用（构造 labels）
```python
labels = input_ids.clone()
labels[:prompt_len] = -100        # prompt 部分忽略
loss = F.cross_entropy(
    logits.view(-1, V), labels.view(-1), ignore_index=-100
)
```
:::

:::warning 常见误区
- **mask 的位置仍参与前向计算**：它们作为上下文帮助预测 assistant 部分，只是不产生 loss。
- **-100 是 PyTorch 的 ignore_index 约定**，不是任意值。
- **多轮对话要逐轮 mask**：只对每轮的 assistant 回复算 loss。
:::

:::interview 面试常问
**Q：SFT 为什么只对 response 计算 loss？**

:::answer
SFT 的目标是「教模型如何回答」，而不是「教模型模仿用户提问」。对 prompt 算 loss 会让模型学习复述用户输入，推理时可能继续「续写用户的话」而不是回答；同时浪费梯度预算在无用的目标上。
:::
:::

## 11.13 SFT 数据：质量与多样性

**SFT 并不是数据越多越好**。特别重要的是：

- **质量**：错误示范会教坏模型；
- **多样性**：覆盖不同任务和场景。

如果 100 万条数据全是「你好」，没有意义。好的 SFT 数据需要覆盖：

- 问答 / 写作 / coding / math / reasoning
- safety（安全性）
- multi-turn（多轮对话）
- tool use（工具调用）

## 11.14 Synthetic Data（合成数据）

:::unfold 先懂直觉
人工标注数据又贵又慢，于是用更强的模型批量生成「指令 + 回答」，再拿来训练小模型——这就是 Self-Instruct 和蒸馏的基本思路。
:::

- **Self-Instruct**：让模型自己生成指令 + 回答；
- **Distillation（蒸馏）**：强模型生成数据，小模型学习。

```
GPT-5 → 生成 instruction + response → 小模型学习
```

:::warning 合成数据的风险
- **Model collapse**：模型反复在自己生成的数据上训练，分布会退化、多样性下降；
- **错误放大**：教师模型的错误被学生继承；
- **分布偏移**：合成数据无法覆盖真实使用场景。

常见缓解：与真实数据混合、质量过滤、多样性约束、教师模型校验。
:::

## 11.15 SFT 怎么评估

不仅看 loss。还要评估不同 task type：

- helpfulness（有用性）
- reasoning（推理）
- coding / math
- instruction following（指令遵循）
- safety（安全性）

| 方法 | 优点 | 缺点 |
| --- | --- | --- |
| Human evaluation | 金标准 | 贵、慢 |
| Benchmark（MMLU/GSM8K 等） | 便宜、可复现 | 可能被刷榜、覆盖有限 |
| LLM-as-a-judge | 便宜、灵活 | 有偏差（偏爱长回答等） |

## 11.16 本章总结

:::key 本节必须记住
| 环节 | 关键点 |
| --- | --- |
| 数据 | 清洗（URL/内容/语言/质量）+ MinHash 去重 + 配比 |
| Tokenizer | BPE/BBPE、vocab、special tokens、多语言 |
| 训练配置 | Warmup + cosine decay，监控 loss spike |
| 指标 | PPL = e^Loss，不能跨 tokenizer 比较 |
| Pretrain vs SFT | 学能力 vs 学回答方式（小 lr、少数据） |
| Chat Template | 训练与推理必须一致 |
| Loss Mask | 只对 assistant 部分计算 loss |
| 数据质量 | 质量 + 多样性 > 数量 |
| 合成数据 | Self-Instruct / Distillation，注意 collapse |
| 评估 | 人工 + Benchmark + LLM-as-judge |
:::

:::quiz
Pretrain 和 SFT 的核心区别是？

A. Pretrain 用 GPU，SFT 用 CPU
B. Pretrain 学知识与能力，SFT 学如何按指令回答
C. SFT 的数据量更大
D. Pretrain 不需要损失函数

答案: B
解析: Pretrain 在海量文本上做 next token prediction，学习语言、知识和推理模式；SFT 用少量高质量指令数据教模型「怎么回答」，学习率小 1~2 个数量级。
:::

:::quiz
SFT 训练中 Loss Mask 的作用是？

A. 屏蔽脏数据
B. 只对 assistant 回复部分计算 loss
C. 加速训练
D. 防止过拟合

答案: B
解析: 把 system/user 部分的 label 设为 -100（忽略），只在 assistant 回复的 token 上计算交叉熵，让模型专注学习「如何回答」。mask 位置仍参与前向计算作为上下文。
:::

:::quiz
Perplexity（PPL）与 Loss 的关系是？

A. PPL = Loss²
B. PPL = e^Loss
C. PPL = log(Loss)
D. 两者无关

答案: B
解析: PPL = e^Loss。注意不能跨 tokenizer 比较 PPL，因为 token 粒度不同会让每步预测难度不同。
:::

:::quiz
为什么训练大模型需要 warmup？

A. 为了让 GPU 预热
B. 训练初期梯度方向不可靠，小学习率避免把参数带偏
C. 为了增加数据量
D. 为了减少显存

答案: B
解析: 初期参数随机、Adam 的二阶矩估计不准，大学习率容易导致不稳定甚至发散。warmup 先用小学习率稳定起步，再升到目标值。
:::

:::quiz
MinHash 主要用于解决什么问题？

A. 数据清洗中的语言识别
B. 海量文本中的近似重复检测（near-duplicate detection）
C. 模型量化
D. 学习率调度

答案: B
解析: MinHash 通过哈希签名估计集合的 Jaccard 相似度，配合 LSH 可以在超大规模语料中高效发现「高度相似但非完全相同」的文档，是去重的核心工具。
:::

:::related
依赖 | Tokenizer, 交叉熵, 优化器, 数据工程
用于 | SFT, RLHF/GRPO, 模型评估, 部署
:::
