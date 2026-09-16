# Job-Ready Track · Batch 2 完成报告（Capstone 1）

> 范围：Mini LLM Evaluation Harness（`projects/llm-eval/`）+ 第 27 章 + 门禁扩展。
> 定位：Checkpoint C —— 「能做出评测系统」，而不只是「知道评测指标」。
> 纪律：全部数字来自真实运行（真实数据切片 + 本地模型）。

---

## 一、本批交付

| # | 交付物 | 状态 |
| --- | --- | --- |
| 1 | `projects/llm-eval/`：Adapter × Task × Runner × Reports 完整评测框架 | ✅ 29 用例全过 |
| 2 | 真实数据通道：`scripts/fetch_data.py`（XCOPA zh / C3 dialog 流式拉取） | ✅ 已拉取 60+60 题 |
| 3 | 第 27 章 Capstone 1 内容章（含面试复盘 8 问） | ✅ |
| 4 | EvalConfig 配置系统 + CLI（hf / openai / mock 三适配器） | ✅ |
| 5 | validate-jobs 门禁扩展（新增 llm-eval 项目检查，共 80 项） | ✅ |

## 二、真实运行记录

### 2.1 主实验（Qwen2.5-0.5B-Instruct，CPU）

数据：C3 dialog 切片 60 题 + XCOPA zh 切片 60 题（真实公开数据集，流式拉取）+ QA 教学夹具 8 题。

```text
评测完成：Qwen/Qwen2.5-0.5B-Instruct  用时 32.3s
  c3     n=60   accuracy=55.0%   （badcase 27）
  xcopa  n=60   accuracy=55.0%   （badcase 27）
  qa     n=8    em=0.0% / f1=21.9%  （badcase 8）
解析失败 0 | API 错误 0
```

### 2.2 缓存效果实测

| 运行 | 评测阶段用时 | 说明 |
| --- | --- | --- |
| 第一次 | 32.3s | 128 条全部真实推理 |
| 第二次（同参数） | **0.0s** | 128 条全部命中 SQLite 缓存（总墙钟 5.9s 为模型加载时间） |

### 2.3 QA 配置敏感性实验（真实发现）

`max_new_tokens` 16 → 64 后，QA F1 从 21.9% **降到 17.6%**：瓶颈不在生成长度，而在回答风格与指标的匹配（模型输出长句 vs 标准短语）。  
结论：评测工程里「先怀疑配置，再怀疑模型」；该发现已写入第 27 章。

### 2.4 开发中被测试抓住的问题（已修复）

1. 夹具答案全 A 会造成 Mock「假高分」→ 夹具答案均衡 + 测试断言分布；
2. parser 需处理 `c`（小写）、`**D**`（markdown）、CJK 空格等格式 → 12 条 parser 用例；
3. OpenAI 适配器测试用本地 mock HTTP 服务器验证（含 5xx 可重试路径），不需要真实 API key。

## 三、门禁与验收

- 全部门禁：build-static（28 章）→ validate-static（28 页）→ validate-content（82 demos）→ validate-batch2（45）→ **validate-jobs（80，含 llm-eval）**；
- 浏览器验收：Home 三条 Track + Capstone 1 入口、三级进度、新章 27 无 console error；
- 全站回归：**28 章 / 91 demos / 404 quiz / 0 console error**。

## 四、Known Limitations

1. **评测样本量小**：60 题/任务的置信区间约 ±12pt（95%），只用于验证管线与建立基线，不作能力结论；
2. **QA 指标局限**：EM/F1 对长回答不友好；更合理的是 LLM-as-a-Judge 或人工评分（后续专题）；
3. **未测 API 真实服务**：OpenAI-compatible 适配器用本地 mock server 验证协议正确性；真实服务端到端需要用户自己的端点；
4. **judge 模块留白**：`judges/` 目录在下一批（RAG 评测）中实现。

## 五、下一批（Job Batch 3）计划

**Retrieval / RAG Engineering + Capstone 2 · Search + Rerank + RAG Service**：

- Chunking（fixed/sentence/recursive）+ 交互 demo；
- Embedding + FAISS 最小实现；BM25；Hybrid retrieval；Reranker（bi-encoder vs cross-encoder）；
- Retrieval 评测：Recall@k / MRR / nDCG（**把 retrieval quality 与 generation quality 拆开**）；
- Capstone 2：RAG Service（documents → chunk → hybrid → rerank → LLM → answer + citations），输出 answer/sources/scores/latency；
- 验收：真实运行 + retrieval 指标 + faithfulness 分析。
