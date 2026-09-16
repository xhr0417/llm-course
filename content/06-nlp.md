> **本章对应课件**：《2.1 自然语言处理》。核心内容：文本如何变成 token、三种切分粒度、BPE 训练与编码、BBPE、Tokenizer 评估、Embedding 查表、Word2Vec。

## 6.1 Tokenization：文本如何变成数字

:::unfold 先懂直觉
神经网络只会算矩阵乘法，不认识文字。所以第一步必须把文本切成小块（token），再给每个 token 分配一个编号（token id）。切分的方式（粒度）直接决定了词表大小、序列长度和多语言成本。
:::

$$
\text{text} \rightarrow \text{token} \rightarrow \text{token id}
$$

例如：

```
I love coding  →  ["I", "love", "coding"]  →  [51, 872, 16372]
```

Token 是模型处理文本的**基本单位**。注意：

:::warning 常见误区
**Token ≠ Word（单词）**。一个词可能被切成多个 token（`learning → learn + ing`），多个字符也可能合并成一个 token（`ing` 是一个 token）。中文里一个汉字可能是一个 token，也可能是 2~3 个 token 的一部分。GPT 说的「上下文 128k」指的是 128k 个 **token**，不是 128k 个单词。
:::

:::demo tokenizer 交互：三种粒度对比
输入任意文本，在 Word / Character / Subword 之间切换，观察 token 数量和序列长度的巨大差异。这直接决定训练成本与上下文利用率。
:::

## 6.2 三种切分粒度

### Word-based（按词）

```
learning / learned / learns / learner  →  4 个不同 token
```

问题：

- 词表爆炸（英文常用词几十万，加上变形、专名、拼写错误会更多）；
- 新词 `superhyperGPT` 直接 **OOV（Out-of-Vocabulary）**，只能映射到 `<UNK>`。

### Character-based（按字符）

```
l e a r n i n g
```

- 优点：几乎不会 OOV（字符集有限）；
- 缺点：序列太长——一句话变成几十个 token，训练慢、上下文利用率低，而且单个字符语义太弱。

### Subword-based（子词）——现代主流

```
learning → learn + ing
unbelievable → un + believ + able
```

兼顾三者：

| 维度 | 子词方案的表现 |
| --- | --- |
| 词表大小 | 可控（通常 32k～150k） |
| 序列长度 | 合理（常用词一个 token） |
| OOV | 几乎不存在（任何词都能拆成子词或字符） |

## 6.3 BPE：字节对编码 ★

:::unfold 先懂直觉
BPE 的思想一句话：**从单个字符开始，反复把「最常一起出现的相邻 pair」合并成一个新 token。** 高频组合（如 `ing`、`tion`）会逐渐变成独立 token，低频词则保持被拆开的状态。它不是人设计的规则，而是从语料里统计出来的。
:::

:::demo bpe 交互：亲手跑一遍 BPE 训练
用课件里的语料 low×5、lower×2、newest×6、widest×3，点击「下一步合并」看频率最高的 pair 如何被合并成新 token；再用输入框试试编码新词 `slowest`。
:::

假设语料统计如下：

```
low      ×5
lower    ×2
newest   ×6
widest   ×3
```

**第 0 轮**：全部拆成字符（词尾加 `</w>` 标记）：

```
l o w</w>
l o w e r</w>
n e w e s t</w>
w i d e s t</w>
```

**第 1 轮**：统计相邻 pair 的频率。`e + s` 出现最多（newest 6 次 + widest 3 次 = 9 次）→ 合并：

```
e s → es
```

**第 2 轮**：`es + t` 现在频率最高 → 合并：

```
es t → est
```

**第 3 轮**：`est + </w>` → 合并：

```
est </w> → est</w>
```

**第 4 轮**：`l + o` → 合并 `lo`。

**第 5 轮**：`lo + w` → 合并 `low`。

以此类推，直到达到预设的词表大小或没有可合并的 pair。

:::math 算法形式化
```
初始化：每个词 = 字符序列 + </w>
循环：
  1. 统计所有相邻 token pair 的频率（按词频加权）
  2. 选频率最高的 pair (a, b)
  3. 把所有出现的 a b 合并为 ab
  4. 记录 merge rule: a + b → ab
直到：词表达到目标大小 或 无 pair 可合并
```

`</w>` 是**词尾标记**（word boundary），让模型区分「词中间的 est」和「词尾的 est」——`est</w>` 和 `est` 是不同的 token。
:::

:::fold 工程里怎么用（20 行 Python 实现 BPE 训练）
```python
from collections import Counter

def get_pairs(words):
    pairs = Counter()
    for word, freq in words.items():
        symbols = word.split()
        for i in range(len(symbols) - 1):
            pairs[(symbols[i], symbols[i+1])] += freq
    return pairs

def merge(words, pair):
    new_words = {}
    bigram = " ".join(pair)
    for word, freq in words.items():
        new_words[word.replace(bigram, "".join(pair))] = freq
    return new_words

corpus = {"l o w </w>": 5, "l o w e r </w>": 2,
          "n e w e s t </w>": 6, "w i d e s t </w>": 3}

for i in range(10):
    pairs = get_pairs(corpus)
    if not pairs: break
    best = max(pairs, key=pairs.get)
    corpus = merge(corpus, best)
    print(f"merge {i+1}: {best[0]} + {best[1]} -> {best[0]+best[1]}  (freq={pairs[best]})")
```
:::

## 6.4 BPE Training 与 Encoding 必须分开理解 ★

:::unfold 先懂直觉
训练 tokenizer 是「学规则」；编码文本是「用规则」。训练只做一次（在几十 GB 语料上），编码是每次推理都要做的（毫秒级）。很多人把两者混在一起，这是理解 BPE 最常见的障碍。
:::

**Training tokenizer**：在大语料上学习 merge rules：

```
e + s → es
es + t → est
est + </w> → est</w>
l + o → lo
lo + w → low
...
```

**Encoding**：来了新词 `slowest`，**按学到的规则顺序**逐步应用：

```
s l o w e s t
↓ (e+s)
s l o w es t
↓ (es+t)
s l o w est
↓ (est+</w>)     ← 词尾标记
s l o w est</w>
↓ (l+o)
s lo w est</w>
↓ (lo+w)
s low est</w>
```

最终：

```
["s", "low", "est</w>"]
```

再查词表得到 token IDs。

:::math 编码的关键性质
- 编码时**必须按训练时学到的 merge 顺序**执行（先学的先合并）；
- 编码结果可能仍包含未合并的片段（如 `s`），这是正常的；
- 任何字符串都能编码：最坏情况退化为逐字符，因此 BPE 无 OOV。

:::

## 6.5 BBPE：字节级 BPE

:::unfold 先懂直觉
BBPE 不直接对「字符」做 BPE，而是先按 UTF-8 把文本变成字节，再对字节做 BPE。字节只有 256 种，所以词表的基础单位永远够用——emoji、生僻字、任何语言都不会 OOV。
:::

BBPE（Byte-Level BPE）的流程：

```
文本 "你好" → UTF-8 字节 [E4 BD A0 E5 A5 BD] → 对字节序列做 BPE
```

优点：

- **零 OOV**：任何输入都能拆到字节；
- **多语言统一**：所有语言共享同一套字节基础；
- **处理特殊符号**：emoji、控制字符都不成问题。

代价：

- 一个汉字通常是 3 个 UTF-8 字节，所以在 BBPE 下**中文的 token 数往往比英文多**——同样的信息量，中文消耗的上下文更多。

现代很多 tokenizer 都受这种思路影响。课件第 10 页专门介绍 BBPE，并把它和 UTF-8 联系起来。

:::warning 常见误区
**中文 token 消耗**：由于 UTF-8 编码，一个汉字约占 2~3 个字节，因此中文在多数 tokenizer 中每个字要 1~3 个 token。这直接导致中文的「上下文更贵、推理更慢、可用上下文更少」。好的中文 tokenizer 会把常见汉字/词合并成单 token 来改善这一点。
:::

## 6.6 如何评价一个 Tokenizer

:::unfold 先懂直觉
Tokenizer 是 LLM 的「输入压缩器」。压缩率越高（同样文本 token 越少），训练和推理越省；多语言越公平，各语种能力越均衡。
:::

### 压缩率

一句文本被拆成多少 token。如果：

- tokenizer A：一句中文 → 30 token；
- tokenizer B：同一句 → 12 token。

后者通常更节省上下文和算力。

### OOV

是否出现无法编码的字符/词。BBPE 基本解决了这个问题。

### 多语言公平性

同样的信息量：

```
英文：20 tokens
中文：80 tokens
```

意味着中文的上下文成本是英文的 4 倍。

:::example 压缩率对成本的影响
假设上下文窗口 8192 token：

- 英文文档（1.3 token/词）≈ 6300 词；
- 中文文档（1.5 token/字）≈ 5400 字。

如果中文 tokenizer 优化到 1.0 token/字，同样的窗口能放 8000 字——信息量提升 48%。这就是 tokenizer 是「LLM 工程的重要设计」的原因。
:::

## 6.7 Embedding：从 one-hot 到稠密向量 ★

:::unfold 先懂直觉
Token id 只是字典的行号，`15236` 和 `15237` 之间没有任何大小或语义关系。Embedding 就是一张巨大的查找表：用 id 当行号取出一行稠密向量，这个向量才是模型真正处理的输入，语义关系就编码在向量里。
:::

token id 例如 `15236` 只是编号。数字大小没有语义：

```
dog id = 100
cat id = 101
```

不代表 cat 比 dog 大 1。所以要用 **embedding table** 查表：

$$
E \in \mathbb R^{V \times d}
$$

如果 $V = 100000$、$d = 4096$，token `15236` 对应：

$$
E[15236] \in \mathbb R^{4096}
$$

:::shapeflow
token id [B, S] → 查表 E [V, d_model] → 向量 [B, S, d_model]
:::

:::demo embedding 交互：查表与语义空间
点击表格里的任意 token，看它如何从 token id 查到 4 维向量（示意），并在右侧 2D 语义空间中定位；观察 king − man + woman ≈ queen。
:::

### one-hot vs 稠密向量

| | one-hot | Embedding |
| --- | --- | --- |
| 维度 | $V$（如 100000） | $d$（如 4096） |
| 稀疏性 | 只有一个 1 | 稠密 |
| 语义 | 任意两个词距离相同 | 相似词距离近 |
| 参数量 | 0（不用学） | $V \times d$ |

:::math Embedding 层的参数量
$$
\text{params} = V \times d
$$

例如 $V=100000$、$d=4096$ → 约 **4.1 亿参数**。这就是为什么词表大小会显著影响模型总参数量，也是为什么「扩大词表」必须慎重（会新增大量 embedding 参数）。

:::

:::fold 工程里怎么用（nn.Embedding）
```python
import torch, torch.nn as nn

emb = nn.Embedding(num_embeddings=100000, embedding_dim=4096)
ids = torch.tensor([[51, 872, 16372]])       # [B=1, S=3]
vecs = emb(ids)
print(vecs.shape)                             # [1, 3, 4096]

# 它本质上就是一个可学习的查表：
# forward 等价于 one_hot(ids) @ E
```
:::

:::warning 常见误区
- **Embedding ≠ one-hot**：one-hot 是手工的高维稀疏表示，embedding 是学出来的低维稠密表示。
- **Embedding 不是 token id**：id 是整数索引，embedding 是浮点向量。
- **不同模型之间 embedding 不通用**：它是模型的一部分，换模型必须换 embedding。
:::

## 6.8 Word2Vec：让词向量带上语义

:::unfold 先懂直觉
Word2Vec 的核心假设：**一个词的含义由它周围的词决定**（分布假设）。通过「用上下文猜词」或「用词猜上下文」这两个游戏，词向量会自动把语义相近的词拉近、把类比关系编码成向量方向。
:::

两个经典任务：

### CBOW（Continuous Bag of Words）

根据上下文预测中间词：

```
I ___ machine learning     →  预测 learning
```

即：$\text{context} \rightarrow \text{target}$。

### Skip-Gram

给定中心词预测周围词：

```
learning  →  I, machine, ...（周围词）
```

即：$\text{target} \rightarrow \text{context}$。

:::demo cbow-skipgram 交互：滑动窗口与训练目标
移动中心词位置、调整窗口大小，看 CBOW（上下文→中心词）和 Skip-Gram（中心词→上下文）分别构造出哪些训练样本对。
:::

:::math 为什么会产生 king − man + woman ≈ queen
Skip-Gram 的目标是让「共同上下文的词」向量内积大。当语料中「国王」「男人」「女人」「女王」的上下文模式高度相关时，它们的向量会被组织成近似的平行四边形状：

$$
\vec{king} - \vec{man} \approx \vec{queen} - \vec{woman}
$$

不是魔法，而是训练目标在高维空间留下的几何结构。
:::

:::fold 工程里怎么用（现代用法）
Word2Vec 本身已被 contextual embedding（BERT/GPT 的隐藏状态）取代，但思想仍无处不在：

- 训练目标从「预测邻居词」升级成「预测下一个 token」；
- 静态词向量升级成「随上下文变化的向量」；
- 负采样、softmax 近似等技巧仍在使用。

```python
# 现代等价的「预测」：语言模型头
logits = model.transformer(...)     # [B, S, d_model]
logits = lm_head(logits)            # [B, S, vocab_size]
loss = F.cross_entropy(logits[:, :-1].reshape(-1, V), ids[:, 1:].reshape(-1))
```
:::

:::interview 面试常问
**Q1：Token 和 Word 的区别？**

:::answer
Word 是语言学单位（空格/标点分隔），Token 是模型处理单位。一个词可能对应多个 token（learning → learn + ing），一个 token 也可能只是词的一部分或跨字符组合。模型的「上下文长度」以 token 计。
:::

**Q2：BPE 训练和编码的区别？**

:::answer
训练：在大语料上统计 pair 频率，反复合并最高频 pair，得到有序的 merge rules（只做一次）。编码：对输入文本按 merge rules 的顺序依次应用合并（每次推理都做）。编码不会改变规则。
:::

**Q3：为什么 tokenizer 会影响中文能力？**

:::answer
UTF-8 下汉字通常占 2~3 字节，BBPE 中中文的 token 数往往多于英文。同样信息量消耗更多上下文，导致中文有效上下文更短、推理更贵、训练效率更低。好的 tokenizer 会通过语料配比让常见汉字/词合并为单 token 来改善。
:::
:::

:::key 本节必须记住
| 概念 | 一句话 |
| --- | --- |
| Tokenization | 文本 → token → id；token 是模型的最小处理单位 |
| Subword | 平衡词表大小、序列长度、OOV 的最优解 |
| BPE | 反复合并最高频相邻 pair，学到 merge rules |
| Training vs Encoding | 学规则（一次） vs 用规则（每次推理） |
| BBPE | 字节级 BPE，零 OOV；中文 token 成本偏高 |
| Embedding | $E \in \mathbb R^{V\times d}$ 查表，参数量 $V \times d$ |
| Word2Vec | CBOW / Skip-Gram，语义关系变成向量几何 |
:::

:::quiz
为什么现代 LLM 几乎不用 word-level tokenizer？

A. 实现太简单
B. 词表过大且无法处理未登录词（OOV）
C. 训练速度太快
D. 无法处理英文

答案: B
解析: 按词切分会导致词表爆炸（含变形、专名、拼写变体），且新词直接 OOV。子词方案把词表控制在 32k~150k，任何词都能拆成子词或字符。
:::

:::quiz
BPE 训练和编码的区别，正确的是？

A. 训练和编码是同一个过程
B. 训练学 merge rules，编码按规则顺序应用
C. 编码会修改 merge rules
D. 训练只处理单个句子

答案: B
解析: 训练在大语料上统计并学习合并规则（一次性）；编码把学到的规则按顺序应用到新文本上（每次推理都做）。编码不修改规则。
:::

:::quiz
一个 Embedding 层有 50000 个 token、每个向量 768 维，参数量是多少？

A. 约 3800 万
B. 约 768 万
C. 约 5000 万
D. 50000

答案: A
解析: 参数量 = V × d = 50000 × 768 = 38,400,000 ≈ 3840 万。这也是词表大小显著影响模型参数量的原因。
:::

:::quiz
BBPE 相比字符级 BPE 的最大优势是？

A. 训练更快
B. 词表更小
C. 几乎不可能出现 OOV（任何输入都能拆到字节）
D. 中文 token 更少

答案: C
解析: BBPE 以 256 个字节为基础单位，emoji、生僻字、任意 Unicode 都能表示，因此零 OOV。注意它并不保证中文 token 更少（UTF-8 下汉字通常占 3 字节）。
:::

:::quiz
「压缩率」对 tokenizer 意味着什么？

A. 模型文件的大小
B. 同样文本被切成多少个 token
C. 训练数据的压缩格式
D. 参数量的多少

答案: B
解析: 压缩率指一段文本被编码成多少 token。token 越少，同样的上下文窗口能装的信息越多，训练/推理成本越低。跨语言比较时要特别注意公平性。
:::

:::related
依赖 | 子词切分, Unicode/UTF-8, 分布假设
用于 | Embedding, Transformer, 语言模型训练
:::
