# Job-Ready Track · Batch 3 完成报告（Retrieval/RAG + Capstone 2）

> 范围：第 28 章（Retrieval & RAG Engineering）+ 第 29 章（Capstone 2 · RAG Service）+ `projects/rag-service/`。
> 定位：Checkpoint D —— 「能做出一套带评测的 RAG 服务」。
> 纪律：全部数字来自真实运行；未执行项明确标注。

---

## 一、本批交付

| # | 交付物 | 状态 |
| --- | --- | --- |
| 1 | `projects/rag-service/`：chunk → BM25+向量 → hybrid → rerank → LLM → citations 全管线 | ✅ 27/27 测试 |
| 2 | 检索评测（22 条人工标注查询 + 4 组对照） | ✅ 真实数据 |
| 3 | RAG 失败分类（5 类）+ prompt 迭代记录 | ✅ 真实数据 |
| 4 | FastAPI 服务（/health /retrieve /chat /chat/stream SSE + 超时 504） | ✅ TestClient 验证 |
| 5 | Dockerfile | ⚠️ 本机无 Docker → NOT EXECUTED |
| 6 | 第 28/29 章 + 2 个新演示（chunking / retrieval-metrics） | ✅ 浏览器验证 |
| 7 | validate-jobs 扩展至 106 项 | ✅ |

## 二、真实运行记录

### 2.1 检索评测（课程内容语料：28 篇 → 841 chunks；22 条标注查询）

| 模式 | Hit@10 | Recall@10 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- |
| BM25 | 100.0% | 100.0% | 0.9091 | 0.9329 |
| Dense (bge-small-zh-v1.5) | 86.4% | 86.4% | 0.6417 | 0.6991 |
| Hybrid (RRF) | 100.0% | 100.0% | 0.8485 | 0.8884 |
| Hybrid + Reranker (cross-encoder) | **100.0%** | **100.0%** | **0.9318** | **0.9497** |

> 上述为本轮 Correctness Pass **修正指标定义后重跑**的结果（doc 级去重 + 标准 Recall/nDCG 定义）；早期表格中的列名与数值为旧 evaluator 口径，见 `JOB_READY_CORRECTNESS_AUDIT.md`。

关键结论（已写入章节）：
1. 术语密集语料上 **BM25 全面不输向量**（Recall 100% vs 86.4%）；
2. RRF 提升召回但 MRR 反降（向量噪声挤排）→ 精排把 MRR 从 0.845 提到 0.932，是收益最大的一步。

### 2.2 RAG 端到端（Qwen2.5-0.5B，6 题）

```
检索命中 6/6 | 引用规范 4/6 | 耗时中位数 19.1s（CPU）
失败分类：ok 4 / uncited_answer 2
```

### 2.3 三个真实发现（全部写入章节）

1. **评测标注 bug**：首轮「5 条未命中」全部是标注错误（章节 id 与文件名不一致）→ 修复后 Recall 77.3% → 100%。教训：指标异常先查标注；
2. **分类器 bug**：初版把「只输出 [1][2]」判为 ok → 先修评测器（新增 citation_only），再改 prompt；
3. **prompt 迭代**：初版/ few-shot 都失败（4/6 citation_only）→ 格式脚手架（回答：…/引用：[n]）后 4/6 规范。小模型指令遵循是生成侧瓶颈 → 直接引出 Capstone 3（SFT）动机。

### 2.4 工程坑（已修复并写入 README）

- macOS 上 faiss-cpu × torch 的 OpenMP 冲突会 segfault → `conftest.py` 内置 `KMP_DUPLICATE_LIB_OK=TRUE`；
- FastAPI `on_event` 弃用 → 迁移 lifespan；
- async 端点里跑同步推理会阻塞事件循环 → `run_in_threadpool`（章节重点）。

## 三、门禁与验收

- 门禁：build-static（30 章）→ validate-static（30 页）→ validate-content（84 demos）→ validate-batch2（45）→ validate-jobs（106）；
- 浏览器：chunking / retrieval-metrics 演示交互验证 + 三级进度 + 0 console error；
- 全站回归：**30 章 / 93 demos / 412 quiz / 0 console error**。

## 四、Known Limitations

1. **评测集规模**：22 条查询、doc 级 ground truth；n 小，指标绝对值仅供流程验证与相对比较；
2. **faithfulness 未自动化**：当前靠引用校验 + 人工检查；LLM-as-a-Judge 方案属后续专题；
3. **生成模型 0.5B**：生成质量受限（见 2.2 失败分类）；retrieval/评测部分不受影响；
4. **Docker 未实测**：本机无 Docker；Dockerfile 为提供状态（NOT EXECUTED）。

## 五、下一批（Job Batch 4）计划

**Capstone 3 · Real SFT / LoRA Experiment**：

- 用本批的 bad case（citation_only / uncited_answer）作为**真实动机**；
- 指令数据集（含引用格式样本）→ chat template → response-only loss → LoRA 训练 → merge/adapter 保存；
- 用 Capstone 1 的 Eval Harness 做 before/after 对比 + bad case 分析；
- 自动生成 experiment.md（model / data / hyperparams / hardware / training curve / eval / failure cases / limitations）；
- 验收：SFT 前后同套评测的对比数据 + 至少 10 个失败样本分析。
