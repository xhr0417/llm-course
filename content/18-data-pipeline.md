> **本章定位**：第二批第一优先级。回答一个工程问题：**一篇网页是怎么变成 GPU 上的 training batch 的？** 本章不是「爬虫教程」，而是数据工程管线的完整视图——每一站做什么、为什么做、做错的后果是什么。
>
> 前置：第 6 章（BPE/Tokenizer）、第 21 章（数据清洗基础概念）。本章在其上建立**完整的 pipeline 视角**。

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测）
- 【Skeleton】工程骨架：逻辑完整，需要自备数据/环境/权重
- 【Pseudo-code】算法示意：用于解释思路，不保证可直接运行
:::

## 18.1 全景管线：从网页到 Batch

:::unfold 先懂直觉
预训练数据不是「一大坨文本」。它是**一条流水线**：从脏乱的网页出发，经过抽取、清洗、过滤、去重、去污染、配比、切词、打包、分片、打乱，最后变成训练器能按需流式读取的 token 序列。任何一站做错，都会在最终的模型能力上体现出来。
:::

```
Raw Web
  ↓  ① HTML extraction       把网页变成「正文文本」
  ↓  ② Normalization         Unicode / 空白 / 乱码
  ↓  ③ Language ID           这份文档到底是什么语言
  ↓  ④ Quality filtering     低质量内容剔除
  ↓  ⑤ Exact dedup           完全相同文档
  ↓  ⑥ Near dedup            近似重复（MinHash + LSH）
  ↓  ⑦ PII filtering         个人信息
  ↓  ⑧ Benchmark decontam.   评测集泄漏
  ↓  ⑨ Dataset mixture       各领域配比
  ↓  ⑩ Tokenization          文本 → token id
  ↓  ⑪ Document boundary     EOS / mask / packing
  ↓  ⑫ Packing               定长序列、提高利用率
  ↓  ⑬ Sharding              切分文件 + manifest
  ↓  ⑭ Shuffle               全局 / 分片 / 缓冲
  ↓  ⑮ Streaming             按需读取（不装进 RAM）
Training Batch
```

:::demo data-pipeline 交互：逐步走完整条数据管线
点击「下一步」看一段样例文本在每一站被如何处理、以及处理前后的对照（示意样例，非真实抓取数据）。
:::

:::warning 两条主线别混淆
- **数据管线**（本章）：把原始网页变成训练用的 token 序列；
- **训练管线**（第 13 章 Lab 9）：把 token 序列喂给模型、算 loss、更新参数。
两者之间只通过一个接口连接：**tokenized + packed + sharded 的数据文件**（`.bin` + manifest）。
:::

## 18.2 Raw Web 与 HTML Extraction

:::unfold 先懂直觉
网页不是文本文件，而是「给浏览器看的程序输出」：正文之外还有导航栏、侧边栏、页脚、广告、脚本、评论区、模板化样式。直接 `get_text()` 拿到的往往是「正文 + 一堆垃圾」的混合物。
:::

```python
# ❌ 天真做法：拿到的是「页面文字」，不是「正文」
text = soup.get_text()

# ✅ 目标是 main content extraction：识别并保留正文块
# 常见方案：DOM 结构启发式（正文密度、标签路径、段落长度分布）、
#           文本密度算法（如 trafilatura 类方法）、小模型分类
```

| 噪声来源 | 例子 | 对训练的影响 |
| --- | --- | --- |
| 导航/页脚 | "首页 关于 联系我们" | 高频模板，教模型说废话 |
| 广告/推广 | "限时优惠点击领取" | 垃圾分布 |
| 脚本/样式残留 | `<script>` 内容被当文本 | 乱码 token |
| 评论区 | 短句、垃圾灌水 | 噪声 |
| 模板重复 | 每个页面都有的固定段落 | 近似重复（第 ⑥ 站处理） |

:::note 这一站的目标
不是「得到干净的单篇文章」，而是**得到不污染训练分布的正文文本**。允许不完美，但要可控（可抽样人工检查、可统计模板重复率）。
:::

## 18.3 Normalization：规范化

:::unfold 先懂直觉
不同来源的文本在「看起来一样」的层面差异巨大：全角/半角、不同换行符、不可见控制字符、编码错误产生的乱码。规范化把它们对齐到统一表示。
:::

常见操作：

| 类别 | 操作 | 例子 |
| --- | --- | --- |
| Unicode | NFC / NFKC 归一 | 全角 `Ａ` ↔ 半角 `A` |
| 空白 | 折叠连续空格/制表符 | `"a   b"` → `"a b"` |
| 换行 | 统一 `\r\n` / `\r` | → `\n` |
| 控制字符 | 移除不可见控制符 | `\x00` 等 |
| 编码 | 修复 mojibake | `"ä½ å¥½"` → `"你好"` |
| 标点 | 引号/破折号统一 | 可选 |

:::warning 规范化过猛会「洗掉信息」
- **代码**：缩进是语法的一部分，折叠空白会破坏 Python；
- **数学**：`−`（数学减号）与 `-`（连字符）语义不同；
- **格式信息**：表格、列表的排版结构本身携带信息。

所以规范化策略必须**按数据域区分**（网页文本 / 代码 / 数学语料不同策略），不能一把梭。
:::

## 18.4 Language Identification：语言识别

:::unfold 先懂直觉
数据来源 ≠ 语言。`.cn` 域名下可能有英文页面；GitHub 上有大量中文 README；一本书里可能混多种语言。语言识别决定「这份数据进入哪个语言桶、按什么配比训练」。
:::

两个粒度：

| 粒度 | 做法 | 适用 |
| --- | --- | --- |
| **文档级** | 整篇投票（fastText 等分类器） | 过滤/分桶主流做法 |
| **片段级** | 按段落/chunk 判定 | 混语言长文档（如技术文档） |

:::warning 常见坑
- **短文本判定不可靠**：几个词的表头、代码片段经常被误判——短文档建议丢弃或单独处理；
- **代码混合**：代码里的自然语言注释会让语言判定混乱；
- **多语言公平性**：判定错误会让小语种数据被系统性丢弃，进一步恶化多语言能力。
:::

## 18.5 Quality Filtering：质量过滤

:::unfold 先懂直觉
「质量」没有绝对定义，但有很多**可观测的信号**：长度、符号比例、重复度、是否像自然语言。先用便宜规则粗筛，再用模型细筛。
:::

### 常见信号与手段

| 手段 | 信号 | 例子 |
| --- | --- | --- |
| **启发式规则** | 文档长度 | 过短（<50 词）多为导航/片段 |
| | 符号/数字比例 | `"!!!!????112233"` 数字符号占比异常 |
| | 重复行/重复 n-gram 比例 | 模板化文本 |
| | 平均词长、停用词比例 | 区分自然语言与乱码 |
| **分类器** | 训练「高质量 vs 低质」二分类器 | 用高质量语料（书/维基）当正例 |
| **PPL 过滤** | 用语言模型打分 | 困惑度过高的段落视为噪声 |

:::warning 过滤不是越严格越好
过于激进的过滤会系统性丢掉：
- **论坛/口语**（真实对话分布）
- **代码**（符号比例天然异常）
- **稀有语言**（分类器训练数据少 → 误杀）
- **创意文本**（重复修辞被当成低质）

过滤阈值是**超参数**：要在「质量提升」和「分布收窄」之间做消融实验，而不是拍脑袋调最严。
:::

## 18.6 Exact Dedup：完全相同去重

:::unfold 先懂直觉
同一篇文章被转载到 100 个网站，算 100 份数据吗？不算。最简单的去重：对文档算哈希（如 SHA-256），哈希相同即完全相同。
:::

```python
import hashlib
def doc_hash(text: str) -> str:
    norm = " ".join(text.split())        # 轻度归一（防空白差异）
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()

seen = set()
for doc in corpus:
    h = doc_hash(doc)
    if h in seen:
        continue          # 完全重复：丢弃
    seen.add(h)
    keep.append(doc)
```

:::demo exact-dedup 交互：10 篇小文本的去重演示
点击文档查看哈希桶；同一桶里第二篇起被标记为重复。可以切换「开启/关闭去重」看保留量变化。
:::

:::note 为什么先做「轻度归一」再哈希
`"你好 世界"` 与 `"你好  世界"`（双空格）哈希不同但内容相同。轻度归一（折叠空白/统一换行）能显著提升精确去重命中率，又不会像激进规范化那样破坏语义。
:::

## 18.7 Near Dedup：近似去重（MinHash + LSH 全链路）

:::unfold 先懂直觉
互联网上更多是「99% 相同」的转载：正文一样，只差广告/页脚/排版。精确哈希抓不到它们。**MinHash** 用「集合相似度」来近似文档相似度，**LSH** 让「相似文档对」不用两两比较就能找到。
:::

### 完整链路（五步）

```
Document
  ↓ ① shingles   切成 k-gram 集合（如 5-gram 词序列）
  ↓ ② Jaccard    集合相似度 J(A,B) = |A∩B| / |A∪B|
  ↓ ③ MinHash    用 h 个哈希函数压缩成 h 维签名（估计 Jaccard）
  ↓ ④ LSH        签名分桶，同桶内才是「候选对」
  ↓ ⑤ decision   候选对按阈值判定是否重复 → 去重
```

:::math 为什么 MinHash 能估计 Jaccard
$$
P\left(\min h(A) = \min h(B)\right) = J(A,B)
$$

直觉：随机一个哈希函数，把两个集合元素都映射到随机顺序，两边「最小元素」相同的概率，正好等于两个集合的重叠比例。用 h 个独立哈希函数取 h 个最小值，统计相等比例即可估计 $J$。h 越大估计越准。
:::

:::demo minhash-lab 交互：编辑两段文本，实时看相似度
修改两段文本（或调整 shingle 大小与阈值），实时计算：精确 Jaccard、MinHash 估计、是否判为近似重复。
:::

:::fold 工程里怎么用（MinHash + LSH：datasketch 标准用法）
```python
# 类型：【Skeleton】需要 pip install datasketch
from datasketch import MinHash, MinHashLSH

def minhash_of(text, num_perm=128, k=5):
    m = MinHash(num_perm=num_perm)
    words = text.split()
    for i in range(len(words) - k + 1):
        shingle = " ".join(words[i:i + k])
        m.update(shingle.encode("utf-8"))
    return m

lsh = MinHashLSH(threshold=0.8, num_perm=128)
for doc_id, text in enumerate(corpus):
    lsh.insert(str(doc_id), minhash_of(text))

dups = lsh.query(minhash_of(new_doc))    # 找出与 new_doc 相似的已有文档
```
:::

## 18.8 为什么 Dedup 这么重要

:::unfold 先懂直觉
重复数据的危害有三层，但都不是「绝对坏」——要理解边际效应。
:::

| 影响 | 机制 | 说明 |
| --- | --- | --- |
| **A. 浪费算力** | 同一内容被反复训练 | 6ND 的算力预算被稀释（第 14 章） |
| **B. 评测泄漏** | 重复导致训练集与 benchmark 重叠 | 分数虚高（见 18.9 去污染） |
| **C. 记忆化（memorization）** | 高频重复样本被逐字背下 | 复现风险 + 泛化下降 |

:::warning 不要把「memorization = 一定坏」简单化
- 一定程度的记忆是**正常且必要**的（模型需要记住知识、事实、代码模式）；
- 危险的是**对长尾高频重复内容的逐字复现**（隐私泄漏、版权、评测作弊）；
- 所以重点不是「消灭记忆」，而是：**控制重复度 + 去污染 + 隐私过滤**。
:::

## 18.9 Benchmark Decontamination：去污染

:::unfold 先懂直觉
如果 MMLU / GSM8K / HumanEval 的题目（甚至答案）出现在预训练语料里，模型可能是「背答案」而不是「会解题」——benchmark 分数就失真了。
:::

### 流程

```
Benchmark sample（问题 + 答案）
  ↓ normalize（与训练数据同一套规范化）
  ↓ n-gram / substring / MinHash 匹配训练文档
  ↓ 命中 → 移除该文档（或该段落）
```

| | Training Dedup（20.6/20.7） | Decontamination（本节） |
| --- | --- | --- |
| 比较对象 | 训练集**内部**两两比较 | 训练集 vs **评测集** |
| 目标 | 减少重复 | 保证评测有效性 |
| 判定 | 相似度阈值 | 通常更严格（n-gram 重叠即删） |

:::note 为什么同一套 normalize 很关键
去污染匹配前必须把**训练文本和评测文本**做同样的规范化（Unicode/空白/标点）。否则「全角冒号」这种差异会让匹配漏掉，污染悄悄留在数据里。
:::

## 18.10 PII / Privacy（概念层）

:::unfold 先懂直觉
预训练语料来自互联网，天然包含个人信息：邮箱、电话、地址、身份证号、账号等。训练前应做**模式识别 + 移除/遮蔽**。
:::

| 类型 | 识别方式 | 处理 |
| --- | --- | --- |
| Email / 电话 / 地址 | 正则 + 规则 | 移除或替换为占位符 |
| 身份证 / 账号类标识 | 正则 + 校验位 | 移除 |
| 姓名等人名实体 | NER 模型 | 视策略（高精度场景才做） |

> 本节只建立概念边界：PII 过滤的目标是**降低个人数据被模型记忆与复现的风险**。它是数据管线的一站，不是单独的安全合规课程。

## 18.11 Dataset Mixture：数据配比

:::unfold 先懂直觉
Mixture 不是「把数据全混起来」，而是在回答：**模型最终的能力分布长什么样？** 代码比例高 → 代码强；数学少 → 数学弱；中文少 → 中文差。
:::

:::demo mixture-calculator 交互：数据配比计算器
拖动各领域比例（Web / Code / Books / Wikipedia / Math / Other），实时看每个领域的 token 量与占比校验（和必须为 100%）。
:::

| 领域 | 提升什么 | 过量后果 |
| --- | --- | --- |
| Web | 通用语言、世界知识 | 噪声/重复占比高 |
| Code | 代码、结构化推理 | 自然语言流畅度偏移 |
| Books | 长文理解、叙事 | 风格单一 |
| Wikipedia | 事实密度 | 模板化文本 |
| Math | 符号推理 | 分布过窄 |

:::warning 配比是「超参数」而非「拍脑袋」
真实训练会做**小规模消融**：固定算力，改配比，看目标能力（代码/数学/多语言）的变化再放大。没有放之四海皆准的百分比。
:::

## 18.12 Tokenization Pipeline

:::unfold 先懂直觉
文本必须经 tokenizer 变成 id 序列，训练器才认识。关键纪律：**tokenizer 训练一次并冻结**——整条数据管线（所有 shard、所有阶段）必须用同一个 tokenizer。
:::

```
Raw Document → tokenizer → token ids（uint16/uint32 存储）
```

:::warning 三条纪律
1. **训练一次、冻结**：中途换 tokenizer = embedding 层语义错位（第 6 章）；
2. **全局一致**：不同 shard 用不同 tokenizer 会造成灾难性的分布不一致；
3. **padding 不落盘**：打包阶段处理变长问题，数据文件里**不存储 padding token**。
:::

## 18.13 文档边界：两个不同维度的问题

:::unfold 先懂直觉
初学者常把 EOS、document mask、packing 并列成「三种方案」——但它们**不是同一维度**：EOS/mask 回答的是「怎么表示文档边界」，packing 回答的是「怎么把变长文档装进定长序列」。两者正交、可以同时使用。
:::

### 问题 A：怎么表示 / 隔离文档边界？

如果把 A 文章结尾直接接上 B 文章开头，模型会学到**假的跨文档关联**（「上一篇的结语」预测「下一篇的标题」）。边界语义的处理方式：

| 方案 | 做法 | 特点 |
| --- | --- | --- |
| **EOS / EOD token** | 每篇结尾插入 `<|endoftext|>` | 简单、主流；给模型显式「文档结束」信号 |
| **position reset** | 新文档从位置 0 重新计数（部分实现） | 位置语义上的隔离，实现依赖具体系统 |
| **document-aware attention mask** | 用块对角 mask 禁止跨文档注意力 | 语义最严格，实现与开销更大 |
| **loss mask** | 特定拼接场景下屏蔽边界的 loss | 按任务需要选用 |

:::warning 一条重要的教材边界
**插入 EOS 并不在数学上阻止跨文档 attention。** EOS 只是给模型一个显式的结束标记；如果没有 block-diagonal / document-aware attention mask，文档 B 的 token 仍然可以 attend 到文档 A 的 token。

是否隔离跨文档注意力，取决于 **attention mask / packing 策略**，而不是 EOS 本身。EOS 提供的是**边界信号**，mask 提供的是**硬隔离**。
:::

### 问题 B：怎么把变长文档装进固定长度的训练序列？

| 方案 | 做法 | 特点 |
| --- | --- | --- |
| **padding** | 补齐到 max_seq | 最简单；padding 位置浪费，需要 pad_id + loss/attention mask 处理 |
| **concatenate + chunk** | 连续 token 流按 max_seq 切块 | 利用率高、实现简单；**本课程 Lab 采用**（见 18.14） |
| **sequence packing** | 把多篇短文档贪心装进定长桶 | 利用率高；需要边界标记，工程上还常配 attention mask |

> **两者的关系**：先把所有文档连成「Doc A + EOS + Doc B + EOS + …」的流（问题 A 的边界处理），再把流切成定长块（问题 B 的空间利用）。**EOS 与 chunk/packing 同时存在**——例如：

```
Doc A
EOS
Doc B
EOS
Doc C ← 同一块里可以包含多篇文档，EOS 标记分界
```

## 18.14 定长切块与 Packing：空间利用策略

:::unfold 先懂直觉
变长文档直接拼 batch 需要 padding 到最大长度——padding 是纯浪费。目标是把「有效 token」的比例尽可能提高。主流做法有两类：**连续流切块（本 Lab 采用）** 与 **sequence packing**。
:::

### 本课程 Lab 采用：continuous stream + EOS + fixed chunk

```
step 1：把文档连成 token 流：docA + EOS + docB + EOS + docC + EOS ...
step 2：按 max_seq 连续切定长块（block）
step 3：最后不足一块的 remainder 直接丢弃（drop_last）
```

```python
def build_token_stream(token_lists, eos_id):
    """连续 token 流：每篇文档后跟一个真实 EOS"""
    stream = []
    for tokens in token_lists:
        stream.extend(tokens)
        stream.append(eos_id)
    return stream

def chunk_stream(stream, seq_len):
    """按 seq_len 连续切块；remainder 由调用方处理（本 Lab drop_last）"""
    return [stream[i:i + seq_len] for i in range(0, len(stream) - seq_len + 1, seq_len)]
```

:::warning EOS ≠ padding filler（一个常见的实现错误）
不要用**重复 EOS 填充**块的剩余位置：

```
正文 + EOS + EOS + EOS + EOS + EOS     ❌
```

如果这些位置都参与 next-token loss，模型会被**人为训练**出「EOS → EOS → EOS」的伪分布——这是数据管线制造出来的，不是语言的真实结构。

真实 EOS 与填充物是两类完全不同的 token：

| | 真实 EOS | padding / filler |
| --- | --- | --- |
| 语义 | 「一个文档结束了」 | 无语义，只为 shape 对齐 |
| 正确处置 | 参与 loss（它是真实序列的一部分） | **不参与 loss**（loss mask / ignore_index），或干脆不产生 |
| 本 Lab 策略 | 每篇文档后恰好一个 | **不填充**：连续流切块，剩余不足一块直接 drop_last |

**如果确实要保留 padding 方案**（正式系统也常用）：必须使用独立 `pad_id`、对 padding 位置设 loss mask（如 `labels[padding_positions] = -100`）、并且不要把 pad 当 EOS 用。
:::

:::demo packing-demo 交互：Naive Padding vs Packing（概念比较）
文档长度 [5, 8, 3, 12]，max_seq = 16。切换两种策略，实时对比 token 利用率与 padding 浪费。
> 注意：本演示是**空间利用策略的概念比较**；Mini Pipeline Lab 实际使用的落盘策略是「连续流 + EOS + 固定切块（drop_last）」——两者不是同一个实现。
:::

| | Naive padding | Packing / 连续切块 |
| --- | --- | --- |
| 利用率 | 低（padding 全浪费） | 高（接近 100%） |
| 实现 | 简单 | 需要边界处理 |
| 风险 | 无 | 跨文档 attention / loss 需要 EOS 标记或 mask（见 18.13 的边界说明） |

:::math 算一笔利用率
文档 5 + 8 + 3 + 12 = 28 个 token，max_seq = 16：
- **Naive**（每篇单独 + pad 到 16）：4 篇 × 16 = 64 个位置，有效 28 → 利用率 **43.75%**
- **Packing**（贪心装箱）：[5+8+3=16（满）] + [12（余 4）] → 32 个位置，有效 28 → 利用率 **87.5%**
- **连续切块（本 Lab）**：流总长 = 28 + 4（每篇一个 EOS）= 32 → 恰好 2 个完整块，利用率 **100%**（remainder 为 0 时）
:::

## 18.15 Sharding：分片

:::unfold 先懂直觉
一个 3TB 的 `train.bin` 无法单机管理。标准做法是切成大量 shard（如每个 1~4GB），每个 shard 配 metadata：token 数、校验和、来源统计。
:::

```
data/
├── shard-00000.bin    # token id 序列（如 uint16）
├── shard-00001.bin
├── ...
└── manifest.json      # 每个 shard 的：token 数 / sha256 / tokenizer 版本 / 领域标签
```

| manifest 字段 | 作用 |
| --- | --- |
| `tokens` | 训练步数规划（第 14 章 6ND） |
| `sha256` | 完整性校验（防传输损坏） |
| `tokenizer` | 版本锁定（一致性） |
| `domain` | 配比采样与统计 |

## 18.16 Shuffle：打乱

:::unfold 先懂直觉
网页抓取顺序 = 某站点的目录顺序；数据集拼接顺序 = 各领域分块排列。如果直接按顺序训练，模型会看到「一整个网站的文章」「一整段代码」，分布极度不平滑。
:::

| 层级 | 做法 | 特点 |
| --- | --- | --- |
| **全局 shuffle** | 所有数据完全随机 | 最理想，但需要随机访问 |
| **分片 shuffle** | 先随机 shard，再 shard 内随机 | 流式友好，主流方案 |
| **缓冲 shuffle** | 维护 K 个样本的随机缓冲，边读边换 | 流式 + 局部随机化 |

> 生产中常用「分片 shuffle + 缓冲 shuffle」组合：既保持流式读取，又让局部顺序足够随机。

## 18.17 Streaming 与 DataLoader 瓶颈

:::unfold 先懂直觉
10T token 不可能装进内存。数据必须**按需从磁盘/对象存储流式读取**，还要提前预取（prefetch），否则 GPU 会饿着等数据。
:::

```
Disk / Object Storage
   ↓ prefetch（提前把下一批搬进内存）
CPU workers（解码 / 拼接 / 打乱）
   ↓ pinned memory（锁页内存，加速 H2D 拷贝）
GPU（计算）
```

:::demo dataloader-timeline 交互：GPU 在等谁？
拖动「数据准备时间」与「GPU 计算时间」，看时间线上 GPU 利用率如何被拖垮——GPU 利用率低不一定是模型问题。
:::

:::fold 工程里怎么用（PyTorch DataLoader 的三个关键参数）
```python
# 类型：【Skeleton】
loader = DataLoader(
    dataset,
    batch_size=32,
    shuffle=True,          # ① 打乱
    num_workers=8,         # ② 并行 worker 预取（关键！）
    pin_memory=True,       # ③ 锁页内存，加速 CPU→GPU 拷贝
    prefetch_factor=4,     # 每个 worker 预取批数
    persistent_workers=True,
)
```
:::

## 18.18 实战 Lab：Mini Pretraining Data Pipeline

:::unfold 目标
不复现 Common Crawl，但**真的跑通一条 mini 管线**：输入 txt → normalize → exact dedup → （可选）MinHash → tokenize → EOS → pack → shard → manifest。**本节代码已实际运行验证。**
:::

```python
# 类型：【Runnable】依赖：pip install tokenizers numpy
# mini_pipeline.py —— 迷你预训练数据管线
import hashlib, json, os
import numpy as np
from tokenizers import Tokenizer, models, trainers, pre_tokenizers

# ============ ① normalize ============
def normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")   # 统一换行
    text = "".join(ch for ch in text if ch == "\n" or ch >= " ")  # 去控制字符
    lines = [" ".join(line.split()) for line in text.split("\n")]  # 折叠空白
    return "\n".join(l for l in lines if l)

# ============ ② exact dedup ============
def exact_dedup(docs):
    seen, keep = set(), []
    for d in docs:
        h = hashlib.sha256(d.encode("utf-8")).hexdigest()
        if h not in seen:
            seen.add(h); keep.append(d)
    return keep

# ============ ③ tokenizer（小语料上现训一个 BBPE） ============
def train_tiny_tokenizer(docs, vocab_size=512, path="mini_tokenizer.json"):
    tok = Tokenizer(models.BPE(unk_token=None))
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.train_from_iterator(docs, trainers.BpeTrainer(
        vocab_size=vocab_size,
        special_tokens=["<|endoftext|>"],
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
    ))
    tok.save(path)
    return tok

# ============ ④ 连续 token 流 + 定长切块（drop_last） ============
def build_token_stream(token_lists, eos_id):
    """连续流：每篇文档后跟【恰好一个】真实 EOS（不做任何填充）"""
    stream = []
    for tokens in token_lists:
        stream.extend(tokens)
        stream.append(eos_id)
    return stream

def chunk_stream(stream, seq_len):
    """按 seq_len 连续切块；返回 (blocks, dropped) —— 不足一块的 remainder 丢弃"""
    n_blocks = len(stream) // seq_len
    blocks = [stream[i * seq_len:(i + 1) * seq_len] for i in range(n_blocks)]
    dropped = len(stream) - n_blocks * seq_len
    return blocks, dropped

# ============ ⑤ shard + manifest ============
def write_shards(blocks, out_dir, seq_len, shard_size=8, dropped=0):
    os.makedirs(out_dir, exist_ok=True)
    manifest = []
    for s, i in enumerate(range(0, len(blocks), shard_size)):
        chunk = blocks[i:i + shard_size]
        arr = np.array(chunk, dtype=np.uint16)
        fname = f"shard-{s:05d}.bin"
        arr.tofile(os.path.join(out_dir, fname))
        manifest.append({
            "file": fname, "sequences": len(chunk),
            "tokens": int(arr.size), "dtype": "uint16",
        })
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump({"shards": manifest, "seq_len": seq_len,
                   "dropped_remainder_tokens": dropped}, f, indent=2)
    return manifest

# ============ 端到端跑一遍 ============
if __name__ == "__main__":
    raw_docs = [
        "Hello world!\n\nThis is doc A.", "Hello world!\nThis is doc A.",   # 归一化后完全相同
        "doc B about 机器学习。", "doc C about transformers and attention.",
        "doc D " * 40,   # 长文档
    ]
    docs = exact_dedup([normalize(d) for d in raw_docs])
    print(f"normalize + dedup: {len(raw_docs)} → {len(docs)} 篇")

    tok = train_tiny_tokenizer(docs, vocab_size=512)
    eos = tok.token_to_id("<|endoftext|>")
    token_lists = [tok.encode(d).ids for d in docs]

    seq_len = 16
    stream = build_token_stream(token_lists, eos)
    blocks, dropped = chunk_stream(stream, seq_len)
    manifest = write_shards(blocks, "mini_data", seq_len, dropped=dropped)

    total = sum(s["tokens"] for s in manifest)
    print(f"token 流总长 {len(stream)}；切成 {len(blocks)} 个定长块（每块 {seq_len}）")
    print(f"Dropped final remainder: {dropped} tokens（drop_last：不足一块的部分主动丢弃）")
    print(f"落盘 {total} token，{len(manifest)} 个 shard")
    print(json.dumps(manifest, indent=2))
```

**验收输出**（本课程实测）：

```
normalize + dedup: 5 → 4 篇
token 流总长 105；切成 6 个定长块（每块 16）
Dropped final remainder: 9 tokens（drop_last：不足一块的部分主动丢弃）
落盘 96 token，1 个 shard
```

（可自检的语义不变量：流中 EOS 数 = 文档数 = 4；不存在相邻 EOS（说明没有用 EOS 做填充）；每块长度都是 16；丢弃量 = 流长 % 16 = 9。）

:::note 为什么 drop_last 是可接受的（以及正式系统怎么做）
- 本 Lab 为保持实现简单：丢弃的不是「数据」，而是一段**未被使用的尾部 token**（9 个 token，约占总量 8.6%）；
- 正式大规模管线常见做法：连续流跨 shard 续切（remainder 与下一个 shard 的头部拼接）、或改用 packing / padding + loss mask——目标是不浪费，同时**不制造伪分布**；
- 无论哪种方案，都要保证：**真实 EOS 恰好每篇一个；填充物（如果有）绝不参与 loss**。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| HTML extraction | 网页 ≠ 正文；目标是 main content |
| Normalization | 按域区分策略，过猛会破坏代码/数学 |
| Language ID | 来源 ≠ 语言；短文档不可靠 |
| Quality filtering | 过滤不是越严越好，会丢分布 |
| Exact dedup | 轻度归一 + 哈希 |
| Near dedup | MinHash 估计 Jaccard + LSH 找候选 |
| Decontamination | 训练集 vs 评测集，同一套 normalize |
| Mixture | 决定能力分布的超参数 |
| Tokenization | 训一次、冻结、全局一致 |
| Boundary/Packing | EOS + 打包，利用率 43.75% → 87.5% |
| Sharding | 分片 + manifest（tokens/checksum/版本） |
| Shuffle | 分片 + 缓冲，流式友好 |
| Streaming | prefetch + workers + pinned memory |
:::

:::quiz
关于 near dedup，说法正确的是？

A. 用 SHA-256 就能找到近似重复
B. MinHash 用哈希签名估计集合的 Jaccard 相似度，配合 LSH 找候选对
C. Jaccard 相似度需要两两比较全部文档
D. 近似重复不影响训练

答案: B
解析: SHA-256 只能抓「完全相同」；近似重复需要集合相似度（Jaccard），MinHash 提供无偏估计，LSH 避免 O(n²) 两两比较。近似重复会浪费算力、造成评测泄漏、加剧记忆化。
:::

:::quiz
为什么 packing 能提高 GPU 利用率？

A. 它减少了模型参数量
B. 它把多篇短文档塞进定长序列，几乎不产生 padding 浪费
C. 它跳过了 tokenization
D. 它降低了学习率

答案: B
解析: padding 是纯浪费位置。文档 5+8+3+12、max_seq=16 时，naive padding 利用率 43.75%，packing 可到 87.5%。代价是跨文档边界需要 EOS/mask 处理。
:::

:::quiz
关于 tokenizer 在数据管线中的纪律，错误的是？

A. tokenizer 训练一次后应冻结
B. 所有 shard 必须使用同一个 tokenizer
C. 不同领域数据可以用不同 tokenizer 以提高压缩率
D. tokenizer 版本应记录在 manifest 中

答案: C
解析: 不同 shard 用不同 tokenizer 会造成 embedding 语义错位与分布不一致，是灾难性错误。tokenizer 必须全局统一、训一次、冻结，并记录版本。
:::

:::related
依赖 | 第 6 章 BPE/Tokenizer, 第 21 章 数据清洗基础, 第 14 章 数据配比与算力
用于 | 第 19 章 FlashAttention 的输入（packed 序列）, 第 20 章 Inference, 第 23 章 Evaluation 的 Contamination
:::
