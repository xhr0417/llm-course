# 第 28 章 · Retrieval & RAG Engineering：让模型用上外部知识

:::intuition 一句话
模型权重里没有你的私有知识、也不知道昨天发生的事、更没法给出「这句话出自哪」。RAG 用一条检索管线补上这三件事——而**检索本身是一门可评测的工程**。
:::

**配套项目**：[`projects/rag-service/`](https://github.com/xhr0417/llm-course/tree/main/projects/rag-service)（本批交付，含 27 个测试用例与真实评测数据）。

## 28.1 为什么纯 LLM 不够

| 问题 | 表现 | RAG 的解法 |
| --- | --- | --- |
| 私有知识 | 模型没见过你的文档/代码库 | 把文档放进上下文 |
| 知识过期 | 训练有截止时间 | 检索最新内容 |
| 无法溯源 | 回答不可验证 | 返回引用来源 |
| 幻觉成本 | 编造看起来很像的答案 | 有据可依 + 失败可归因 |

但这三个问题**不是加个向量库就解决的**。真实 RAG 是七个环节的管线，每一环都可以失败：

```
documents → chunk → 索引（BM25 + embedding）→ 检索 → 融合 → 精排 → 上下文 → LLM → answer + citations
```

本章按这条管线逐段讲，并在最后用**真实评测数据**证明：回答不好时，先判断是检索失败还是生成失败。

## 28.2 Chunking：最不起眼、最影响上限的一步

文档太长不能整篇塞进上下文，需要切成「可检索段落」（chunk）。三种基础策略：

:::demo chunking 交互：三种切分策略 vs chunk_size / overlap
拖动滑块切换策略与大小，观察 chunk 边界如何变化。
:::

| 策略 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| fixed | 定长字符 + overlap | 简单、可预测 | 可能切断句子 |
| sentence | 整句合并到接近上限 | 语义完整 | 超长句无解 |
| recursive | 段落 → 换行 → 句号逐级降级 | 工业默认 | 实现稍复杂 |

本项目选用 **recursive + size 512 + overlap 64**：课程内容 28 篇 markdown → **841 chunks**。

:::warning 切分是超参数，不是常量
- 切太碎：每块信息不足，检索噪声大；
- 切太大：一块里混多个主题，相关性被稀释，还挤占上下文预算；
- overlap 缓解「边界信息被切开」，但会让 chunk 数上涨（存储与检索成本上升）。
:::

## 28.3 Embedding：把语义变成几何

```python
q = embedder.encode(["LoRA 怎么微调大模型"], is_query=True)[0]
d1 = embedder.encode(["LoRA 冻结原权重，只训练低秩矩阵 A 和 B"])[0]
d2 = embedder.encode(["今天天气很好，适合出去散步"])[0]
cosine(q, d1)   # ≫
cosine(q, d2)   # 相关文档在向量空间里更近
```

三个工程要点：

1. **查询与文档要按模型要求区分编码**（本项目用 BGE，查询侧加指令前缀，文档侧不加）；
2. **归一化后内积 = 余弦相似度**（本项目向量全部 L2 归一化）；
3. embedding 模型也是一个要选型的组件——本项目用 `BAAI/bge-small-zh-v1.5`（24M 参数，CPU 可跑）。

## 28.4 向量检索：FAISS 最小实现

```python
import faiss
index = faiss.IndexFlatIP(dim)      # 内积索引（配合归一化向量 = 余弦）
index.add(vectors)                  # 841 × 512
scores, idxs = index.search(query_vector, k=20)
```

- `IndexFlatIP` 是**精确检索**：全量算相似度，小规模（几万块）足够快；
- 上亿规模再考虑 IVF/HNSW/量化等近似索引——**先把它跑对，再谈规模**；
- 本项目在无 FAISS 环境自动回退 numpy 精确实现（接口不变）。

## 28.5 BM25：关键词检索不是落后技术

BM25 是经典的稀疏检索：**词频（TF）× 逆文档频率（IDF）× 文档长度归一化**。本项目从零实现（约 40 行，见 `bm25.py`），中文用 jieba 分词。

它在什么场景赢过向量检索？

- 「RTX 5090」「pass@k」「0x80070005」这类**精确术语**；
- 术语密集、缩写多的领域文档（论文、代码库、**本课程内容**）。

:::note 真实数据（我们的课程语料，22 条标注查询）
| 模式 | Hit@10 | Recall@10 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- |
| **BM25** | **100.0%** | **100.0%** | **0.9091** | 0.9329 |
| Dense（bge-small-zh） | 86.4% | 86.4% | 0.6417 | 0.6991 |

在这份语料上 **BM25 全面不输向量检索**——「dense 一定更好」是误解。
:::

## 28.6 Hybrid Retrieval：小孩子才做选择

把 BM25 与向量结果融合。最常用 **RRF（Reciprocal Rank Fusion）**：

$$
\text{score}(d) = \sum_{r \in \text{rankers}} \frac{1}{k + \text{rank}_r(d)} \quad (k = 60)
$$

只用排名、不用分数——不用调权重、鲁棒。

真实结果：hybrid Recall@10 = **100%**（与 BM25 持平），MRR 0.8485。
注意 **hybrid 的 MRR 反而低于纯 BM25**（0.8485 < 0.9091）：向量结果把一部分原本排第一的正确文档挤到了后面。

:::warning 融合不等于免费午餐
RRF 让召回更稳（两路互补），但不保证排序更好。
**排序质量要靠下一步**——reranker。
:::

## 28.7 Reranker：bi-encoder vs cross-encoder

| | bi-encoder（embedding 检索） | cross-encoder（reranker） |
| --- | --- | --- |
| 结构 | query、doc 分别编码 | (query, doc) 拼接后一起进模型 |
| 交互 | 只有最后一步内积 | 每一层都在交互 |
| 速度 | 快（可预计算） | 慢（必须实时） |
| 用途 | **召回** top-50 | **精排** top-50 → top-5 |

标准两段式：

```
query →（BM25 + 向量）召回 50 → cross-encoder 精排 → top-5 → 注入 prompt
```

:::note 真实提升（同一批查询）
| 模式 | Hit@10 | Recall@10 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- |
| Hybrid | 100.0% | 100.0% | 0.8485 | 0.8884 |
| **Hybrid + Reranker** | **100.0%** | **100.0%** | **0.9318** | **0.9497** |

精排把 MRR 从 0.849 提到 **0.932**（并超过纯 BM25 的 0.909）——整条管线里收益最大的一步。
:::

## 28.8 检索评测：把「检索」与「生成」拆开评

这是本章最重要的一节：**回答不好时，你必须能回答「是检索没找到，还是模型没用/乱说」**。

四个核心指标（doc 级二值相关；**chunk 排名必须先按 doc_id 去重**）：

| 指标 | 公式 | 敏感于 |
| --- | --- | --- |
| Hit@k | `1[R_k ∩ G ≠ ∅]` | 「有没有找到」 |
| Recall@k | `|R_k ∩ G| / |G|` | 多相关文档下的**召回比例** |
| MRR | 第一条相关的 1/rank | 第一个就命中的能力 |
| nDCG@k | `DCG@k / IDCG@k`（计入**所有**相关文档） | 整体排序质量 |

:::warning Hit@k ≠ Recall@k（本轮实测修正的真实问题）
早期实现把「top-k 命中至少一条相关」当作 Recall——那其实是 **Hit@k**。
当 ground truth 有多个相关文档时（例如 `gold=[A,B]`、top-k 只找到 A），正确的 Recall = **0.5** 而不是 100%。
本项目已修正定义并全部重跑，同时增加了 12 个指标单元测试（含多 gold 用例）。
:::

:::demo retrieval-metrics 交互：三个指标怎么算
点击结果行切换「相关/不相关」，拖动 k，观察指标变化。
:::

本项目评测规范（可在 `eval/retrieval_eval.py` 复现）：

- 语料：课程内容 28 篇 → 841 chunks；
- 查询集：人工标注 22 条（`data/eval_queries.jsonl`），**标注到文档级 ground truth**；
- 每模式跑 top-10，输出 Recall@10 / MRR / nDCG@10 + 未命中明细。

:::note 真实教训：评测集自己的错会伪装成系统失败
第一轮评测显示「5 条未命中」，逐条排查后发现 **5 条全是标注错误**——章节 id 与文件名不一致（`efficient` 章对应 `13-efficient.md`，标注却写成 `17-efficient.md`）。

修复标注后：BM25/ hybrid 的 Recall@10 从 **77.3% → 100%**。

**纪律：指标异常时，先怀疑数据和标注，再怀疑模型。** 这一步能省掉大量无效调参。
:::

## 28.9 RAG 评测：四个维度

生成侧不能只看「回答对不对」——要拆成：

| 维度 | 问题 | 本项目检查方式 |
| --- | --- | --- |
| Retrieval relevance | 找到的段落相关吗？ | 检索指标（28.8） |
| Answer correctness | 回答内容对吗？ | 人工/规则（0.5B 场景下人工为主） |
| Citation correctness | 引用编号对得上来源吗？ | 解析 `[n]` 并校验范围 |
| Faithfulness | 回答有没有超出资料？ | 当前版本限制（见 Known Limitations） |

对 6 道题的真实评测（Qwen2.5-0.5B，检索+精排+生成全链路）：

```
检索命中 6/6 | 引用规范 4/6 | 用时中位数 19.1s（CPU）
```

**检索 100% 命中而生成 2/6 失败**——瓶颈定位到生成侧，不是检索侧。

## 28.10 失败案例：四类，各有各的修法

来自本项目真实运行（含 prompt 迭代过程）：

| 失败类型 | 表现 | 该修什么 |
| --- | --- | --- |
| `retrieval_miss` | 正确文档没进 top-k | chunking / 融合 / 加 reranker / 换 embedding |
| `ignored_context` | 检索到了，回答却说「无法回答」 | prompt / 模型能力 |
| `citation_only` | 只输出 `[1][2]`，没有答案正文 | 格式脚手架 / SFT（Capstone 3） |
| `uncited_answer` | 有答案但没标引用 | prompt / 后处理强制引用 |
| `hallucination` | 答案超出资料范围 | 更严格的 prompt / faithfulness 检查 |

:::note 真实 prompt 迭代（0.5B 模型）
1. 初版「关键处标注 [编号]」→ 4/6 只输出 `[1][2]`（分类器第一次还把它们误判为 ok——**先修评测器，再改 prompt**）；
2. 加 few-shot 示例 → 更糟（4/6 citation_only）；
3. 换成**格式脚手架**（`回答：<完整内容>\n引用：[n]`）→ 4/6 规范作答。

结论：**小模型的指令遵循是 RAG 生成侧的瓶颈，检索修不了它**——这正是下一批 Capstone 3（SFT/LoRA）的动机：用真实 bad case 驱动微调。
:::

## 28.11 面试复盘：RAG

1. chunk size 怎么选？overlap 解决什么问题？
2. BM25 和 embedding 检索的区别？各自什么时候更强？
3. 为什么 reranker 有用？bi-encoder 和 cross-encoder 的结构差异？
4. Recall@k 和 MRR 分别对什么敏感？nDCG 为什么"打折"？
5. retrieval 对了但回答错了，你怎么定位？拆开评什么？
6. 引用（citation）怎么保证对得上？模型不配合怎么办？
7. 你的检索评测集怎么建的？标注错了会发生什么？

:::quiz
你的 RAG 系统上线后用户反馈「回答经常不对」。排查时第一个该看的指标是？

A. 直接换一个更大的生成模型
B. 检索命中率（Recall@k）——先确认正确文档是否进了上下文
C. 把 temperature 调到 0
D. 增加 system prompt 的字数

答案: B
解析: 必须先拆开评。本项目实测：检索 6/6 命中、生成 2/6 失败——如果只看「回答不对」就换模型，可能掩盖检索失败的真实原因；反之若检索就先挂了，再强的生成模型也无解。先定位环节，再优化该环节。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| Chunking | recursive 是工业默认；size/overlap 是超参数 |
| 检索 | BM25 与 dense 互补；术语密集语料 BM25 不输向量（实测） |
| 融合 | RRF 稳召回但不保证排序 |
| 精排 | cross-encoder 是收益最大的一步（MRR 0.845→0.932 实测） |
| 评测 | Recall@k / MRR / nDCG，doc 级 ground truth |
| 纪律 | 检索与生成分开评；指标异常先查标注 |
| 失败 | 五类失败各有各的修法；citation_only 是 0.5B 的真实瓶颈 |
:::

:::related
依赖 | 第 23 章 LLM Evaluation, 第 25 章 Python 工程, 第 26 章 HuggingFace
用于 | Capstone 2（rag-service）, Capstone 3（用 bad case 驱动 SFT）, RAG 类实习面试
:::
