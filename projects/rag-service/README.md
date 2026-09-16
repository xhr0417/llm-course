# rag-service —— Capstone 2：Search + Rerank + RAG Service

完整 RAG 服务：**documents → chunk → BM25 + embedding → hybrid → reranker → LLM → answer + citations**，
带检索评测（Recall@k / MRR / nDCG）、RAG 失败分类、FastAPI 服务与 Dockerfile。

这是 Job-Ready Track 的 Checkpoint D 项目。

## Quick Start

```bash
cd projects/rag-service
pip install -r requirements.txt

# ① 用示例文档跑通（3 篇 markdown，几秒完成）
RAG_CORPUS=data/sample_docs python -c "
from rag_service import RAGConfig, RAGPipeline
p = RAGPipeline(RAGConfig(corpus_dir='data/sample_docs', index_dir='.cache/demo'))
p.ingest()
r = p.answer('RAG 常见的失败模式有哪些')
print(r.answer); print([c.chunk.doc_id for c in r.contexts])
"

# ② 用课程内容当语料（28 章 markdown → 841 chunks）
python -c "
import sys; sys.path.insert(0,'src')
from rag_service import RAGConfig, RAGPipeline
p = RAGPipeline(RAGConfig(corpus_dir='../../content', index_dir='.cache/index'))
p.ingest()  # 第一次会构建 embedding 索引（CPU 约 1-2 分钟），之后走缓存
"

# ③ 检索评测：BM25 vs 向量 vs 混合 vs 精排
python eval/retrieval_eval.py --modes bm25 dense hybrid --k 10
python eval/retrieval_eval.py --modes hybrid --rerank --k 10

# ④ RAG 回答侧评测 + 失败分类
python eval/rag_eval.py --limit 6

# ⑤ 启动 HTTP 服务（FastAPI）
uvicorn app:app --port 8000
curl localhost:8000/health
curl -X POST localhost:8000/chat -H 'Content-Type: application/json' \
  -d '{"question": "LoRA 的优势是什么", "top_n": 3}'

# ⑥ 测试
pytest -q   # 39 个测试函数（39 个用例：test_rag 27 + test_eval_metrics 12）
```

## 真实运行记录（本机 CPU，课程内容语料：28 篇 / 841 chunks）

### 检索评测（22 条人工标注查询，doc 级 ground truth；指标定义已修正并重跑）

指标定义（doc 级二值相关；chunk 排名先按 doc_id 去重）：

- **Hit@k**：top-k 有没有命中至少一个相关文档；
- **Recall@k**：top-k 命中的相关文档数 / 相关文档总数（多 gold 查询按分式计）；
- **MRR**：第一条相关文档排名倒数；
- **nDCG@k**：计入 top-k 中**所有**相关文档（不是只看第一条）。

| 模式 | Hit@10 | Recall@10 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- |
| BM25（关键词） | **100.0%** | **100.0%** | **0.9091** | 0.9329 |
| Dense（bge-small-zh） | 86.4% | 86.4% | 0.6417 | 0.6991 |
| Hybrid（RRF 融合） | **100.0%** | **100.0%** | 0.8485 | 0.8884 |
| Hybrid + Reranker（cross-encoder） | **100.0%** | **100.0%** | **0.9318** | **0.9497** |

**结论（真实数据）**：
- 这个语料术语密集（GQA、loss mask、decontamination……），**BM25 不输向量**——「dense retrieval 不是万能」的实证；
- 单独 RRF 融合的 MRR 低于 BM25（0.8485 < 0.9091：向量结果把部分正确文档挤后了）；
- **cross-encoder 精排把 MRR 提到 0.9318**（超过 BM25），是整条 pipeline 提升最大的一步。

> 修正记录：早期版本误将「命中即 1」的 **Hit@k** 标为 Recall@k，且用 chunk 级排名直接计算。本轮 Correctness Pass 已修正为 doc 级 + 标准定义并重跑（`eval/retrieval_results*.json` 为最新结果）。

### RAG 回答侧（Qwen2.5-0.5B-Instruct，6 题）

```
检索命中 6/6 | 引用规范 4/6 | 用时中位数 19.1s（CPU）
失败分类：ok 4 / uncited_answer 2
```

**prompt 迭代过程（真实记录）**：
1. 初版 `关键处标注 [编号]` → 分类器发现 4 题只输出了 `[1][2]` 没有答案 → 先修分类器（新增 `citation_only`），再改 prompt；
2. 加 few-shot 示例 → 反而更糟（4 题 citation_only）；
3. 改为**格式脚手架**（`回答：<...>\n引用：[n]`）→ 4 题规范作答。

教训：**小模型的指令遵循是 RAG 的生成侧瓶颈**，检索修不了它——这正是 Capstone 3（SFT/LoRA）的动机。

### 评测标注 bug（真实发现）

第一轮评测「5 条未命中」，逐条排查后发现**全部是标注错误**（章节 id 与文件名不一致：`efficient` 章的文件是 `13-efficient.md`，而标注写成了 `17-efficient.md`）。
修复标注后 BM25/hybrid 的 Recall@10 从 77.3% → 100%。**评测集本身的错误会伪装成系统失败**——先怀疑标注，再怀疑模型。

## 项目结构

```text
rag-service/
├── app.py                     # uvicorn app:app
├── Dockerfile                 # ⚠️ 本机无 Docker，未实际构建（见「已知问题」）
├── configs/default.json       # RAGConfig
├── data/
│   ├── sample_docs/           # 3 篇示例文档（测试/独立运行）
│   └── eval_queries.jsonl     # 22 条人工标注检索评测集
├── eval/
│   ├── retrieval_eval.py      # Recall@k / MRR / nDCG
│   └── rag_eval.py            # RAG 失败分类（5 类）
├── src/rag_service/
│   ├── chunking.py            # fixed / sentence / recursive 三种切分
│   ├── bm25.py                # BM25 从零实现（jieba 分词）
│   ├── embedder.py            # BGE 中文向量（transformers 实现）
│   ├── vector_index.py        # FAISS IndexFlatIP（+numpy 回退）
│   ├── fusion.py              # RRF / weighted
│   ├── reranker.py            # cross-encoder 精排
│   ├── llm.py                 # Qwen 生成（含 token 流式）
│   ├── pipeline.py            # 检索→融合→精排→生成 + 引用解析
│   └── service_api.py         # FastAPI：/health /retrieve /chat /chat/stream(SSE)
├── src/rag_service/eval_metrics.py  # Hit@k / Recall@k / MRR / nDCG（标准定义）
├── tests/test_rag.py                # RAG 主流程测试（27 个用例）
└── tests/test_eval_metrics.py       # 指标定义测试（12 个用例）
```

## API 一览

| 端点 | 说明 |
| --- | --- |
| `GET /health` | 服务状态 / 文档数 / chunk 数 |
| `POST /retrieve` | 只做检索（调试用，返回 bm25_score + dense_score） |
| `POST /chat` | 完整 RAG：answer + citations + sources + latency |
| `POST /chat/stream` | SSE token 流（先发 sources 事件，再发 token） |

超时保护：`asyncio.wait_for` + 线程池，超时返回 504（已测试）。

## 已知问题

1. **macOS + faiss-cpu + torch 的 OpenMP 冲突**：同一进程加载两者会 segfault。本项目的 `conftest.py` 与 `vector_index.py` 已内置 `KMP_DUPLICATE_LIB_OK=TRUE` 修复。
2. **Dockerfile 未实际构建**：开发机没有安装 Docker（`NOT EXECUTED`）。构建命令为 `docker build -t rag-service .`，语料挂载方式见 Dockerfile 注释。
3. **生成模型是 0.5B**：回答质量受模型限制；检索与评测部分不受影响。

## 数据来源

- 语料：本课程 `content/*.md`（28 章，约 60 万字）或任意 markdown 目录；
- 评测查询：`data/eval_queries.jsonl`（人工标注 22 条，doc 级 ground truth）。
