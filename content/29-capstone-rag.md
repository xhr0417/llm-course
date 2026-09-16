# 第 29 章 · Capstone 2：Search + Rerank + RAG Service

:::intuition 一句话
把第 28 章的检索管线做成一个**能对外提供服务的系统**：`/chat` 返回 answer + citations + sources + latency，`/chat/stream` 流式输出，超时可保护、失败可定位——Checkpoint D。
:::

**项目位置**：[`projects/rag-service/`](https://github.com/xhr0417/llm-course/tree/main/projects/rag-service)
**真实运行**：课程内容 28 篇 → 841 chunks；22 条标注查询评测；Qwen2.5-0.5B 生成（CPU）。

## 29.1 目标：从「跑通检索」到「交付服务」

Checkpoint D 的验收标准：

| 能力 | 验收物 |
| --- | --- |
| 完整管线 | documents → chunk → BM25+向量 → hybrid → rerank → LLM → answer+citations |
| 评测 | 检索侧 4 组对照（Hit@k / Recall@k / MRR / nDCG@k，doc 级）+ 生成侧失败分类 |
| 服务 | FastAPI：`/health` `/retrieve` `/chat` `/chat/stream(SSE)` |
| 工程 | Pydantic schema、超时保护（504）、并发线程池、pytest 27 用例 |
| 部署 | Dockerfile（本机无 Docker，标注 NOT EXECUTED） |

## 29.2 Pipeline 架构与实测数字

```text
ingest：  文档目录 → chunk（recursive 512/64）→ BM25 索引 + BGE 向量（FAISS）
query：   BM25 top-20  ┐
          向量 top-20  ┴→ RRF 融合 → cross-encoder 精排 top-5 → prompt → Qwen → answer + [n] 引用
```

**真实评测结果**（22 条标注查询，全部可复现）：

| 模式 | Hit@10 | Recall@10 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- |
| BM25 | 100.0% | 100.0% | 0.9091 | 0.9329 |
| Dense | 86.4% | 86.4% | 0.6417 | 0.6991 |
| Hybrid（RRF） | 100.0% | 100.0% | 0.8485 | 0.8884 |
| **Hybrid + Reranker** | **100.0%** | **100.0%** | **0.9318** | **0.9497** |

调用链路的服务端耗时拆解（每个回答都返回）：

```json
"latency_ms": { "retrieve": 42, "rerank": 1850, "generate": 13000, "total": 14900 }
```

**rerank 占大头、generate 更甚**——这就是服务优化时该先动的地方（更小的 reranker / 更快的模型 / 缓存）。

## 29.3 FastAPI 服务化：五个工程要点

```python
@app.post("/chat")
async def chat(req: ChatRequest) -> ChatResponse:
    result = await asyncio.wait_for(
        run_in_threadpool(pipeline.answer, req.question, req.mode, req.top_k, req.top_n, req.use_rerank),
        timeout=pipeline.cfg.request_timeout_s,
    )
    return ChatResponse(answer=..., citations=..., sources=..., latency_ms=...)
```

| 要点 | 做法 | 为什么 |
| --- | --- | --- |
| Pydantic schema | `ChatRequest` / `ChatResponse` / `RetrieveRequest` 等 | 请求校验 + 自动文档 + 类型安全 |
| 线程池 | `run_in_threadpool` 包装同步 CPU 任务 | 不阻塞事件循环，服务还能响应健康检查 |
| 超时 | `asyncio.wait_for(..., 60s)` → 504 | 模型生成慢，必须有上限，防拖垮服务 |
| SSE 流式 | `/chat/stream` 先发 `sources` 事件再发 token | ChatGPT 式体验；引用在生成前就可见 |
| 健康检查 | `/health` 返回 docs/chunks/模型名 | 部署探活、容器编排必需 |

**测试方式（无需真实 API key）**：FastAPI `TestClient` 直接打端点——健康检查、检索、chat、SSE 首事件、超时 504，全在 `tests/test_rag.py` 里（27 个用例）。

:::warning 常见错误：async def 里跑 CPU 密集任务
`async def chat()` 里直接调用同步的 `pipeline.answer()`（里面是模型推理）会**阻塞整个事件循环**——所有请求排队，健康检查都会超时。
正确做法：`run_in_threadpool`（本项目）。CPU 密集 + async 是 FastAPI 服务最常见的坑。
:::

## 29.4 流式（SSE）：为什么 ChatGPT 是"打字机"

```python
def event_source():
    for kind, payload in pipeline.answer_stream(question, ...):
        if kind == "sources":
            yield "data: " + json.dumps({"type": "sources", "sources": payload}) + "\n\n"
        else:
            yield "data: " + json.dumps({"type": "token", "text": payload}) + "\n\n"
    yield "data: {\"type\": \"done\"}\n\n"
```

客户端按 `data: ` 行解析事件。首字节时间（用户感知速度）从「全部生成完」降到「秒级首批 token + sources」。

## 29.5 Docker：提供但未实测

```bash
docker build -t rag-service .
docker run -p 8000:8000 \
  -v $(pwd)/../../content:/corpus \
  -e RAG_CORPUS=/corpus \
  rag-service
```

:::note Docker build：由 CI 真实验证
开发机未安装 Docker；本仓库的 GitHub Actions `docker-build` job 会真实执行 `docker build`（**当前状态：通过**）。
Dockerfile 使用 `python:3.11-slim` + CPU 版 torch 轮子 + uvicorn；本地构建与挂载方式如上（命令：`docker build -t rag-service .`）。
:::

## 29.6 真实运行：6 题端到端

```
检索命中 6/6 | 引用规范 4/6 | 耗时中位数 19.1s（CPU，0.5B 模型）

✅ PagedAttention  → 回答了显存碎片机制，引用 [1]
✅ GQA vs MQA     → 回答了分组折中与 KV 压缩，引用 [1]
✅ pass@k         → 写出无偏估计公式，引用 [1]
✅ MinHash        → 回答了签名估计与 LSH，引用 [1]
❌ online softmax → 长回答但未标注引用（uncited_answer）
❌ Chat Template  → 回答了但未标注引用（uncited_answer）
```

样本外结论（纪律）：6 题、CPU、0.5B —— 这是**流程验证**级实验，不是能力结论；但它完整展示了「如何用失败分类定位系统瓶颈」。

## 29.7 面试复盘：RAG Service

1. 为什么 `/chat` 要把同步推理放进线程池？不放会怎样？
2. 超时怎么设计？504 和 500 的区别是什么场景？
3. SSE 相比一次性返回有什么体验差异？服务端怎么实现？
4. `/retrieve` 调试端点为什么有价值？（提示：线上定位「检索还是生成」）
5. 响应里的 `latency_ms` 拆解对性能优化有什么用？
6. Docker 镜像里模型权重怎么处理？（提示：构建时下载 vs 运行卷挂载）
7. 如果并发上来了，哪些环节可以缓存？（提示：索引、embedding、rerank 结果、LLM 响应）

:::quiz
你的 RAG 服务上线后，高峰期所有请求都超时，但单次请求测试正常。最可能的原因是？

A. 模型变小了
B. 同步推理阻塞了事件循环 / 线程池被打满，请求排队
C. 检索索引坏了
D. prompt 写错了

答案: B
解析: 单请求正常、并发崩——典型的资源阻塞问题。若在 async 端点里直接跑同步推理（未放线程池），或线程池/并发配置太小，请求全部排队直至超时。修法：推理放线程池 + 限制并发 + 必要时多副本扩展。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 管线 | chunk → BM25+向量 → RRF → rerank → LLM → answer+citations |
| 实测 | reranker 收益最大（MRR 0.849→0.932，超越 BM25 的 0.909）；检索 6/6、生成 4/6 |
| 服务 | FastAPI + Pydantic + 线程池 + 超时 504 + SSE |
| 坑 | async 里跑同步推理 = 阻塞事件循环 |
| 部署 | Dockerfile 已提供；本机无 Docker → NOT EXECUTED |
| 定位 | `/retrieve` + latency 拆解 + 失败分类三件套 |
:::

:::related
依赖 | 第 28 章 Retrieval & RAG, 第 25 章 Python 工程, 第 27 章 Eval Harness
用于 | Capstone 3（bad case 驱动 SFT）, AI 应用开发实习面试
:::
