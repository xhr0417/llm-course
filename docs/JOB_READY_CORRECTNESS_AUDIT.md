# Job-Ready Correctness & Portfolio Pass · 审计报告

> 范围：不新增章节，只做正确性 / 实验口径 / 可复现性 / 作品集展示。
> 原则：正确 > 实验口径 > 可复现性 > 展示 > 数量。

---

## 一、Infra（inference-benchmark）

### 1.1 CPU memory 测量修正（核心问题）

| 项 | 修正前（错误） | 修正后 |
| --- | --- | --- |
| CPU 内存口径 | `ru_maxrss` 跑前跑后相减 → 当作单 case peak memory（并推导出「省 37×」） | ① **理论中间张量 footprint**（`2×B×H×S²×bytes`，naive scores+probs 同时存活）；② 可选 **独立子进程 peak RSS**（`python -m ibench.mem_worker`，明确标注含运行时开销） |
| 旧结论 | 「naive 128.2 MB vs SDPA 3.5 MB，省 37×」 | 已全局删除；替换为双口径实测 |

**修正后实测（CPU, seq=2048）**：
- latency：naive 19.57 ms → SDPA 7.20 ms（2.7×）；
- 理论中间张量：128.0 MB → 0；
- 子进程 peak RSS：**310.3 MB → 185.4 MB**，差值 ≈ 125 MB ≈ 理论 footprint 128 MB（两口径互证）。
- `ru_maxrss` 是进程生命周期 high-water mark——该项目文件与页面均已写明不可用于单 case 结论。

### 1.2 CUDA device bug 修复

- `bench_attention(..., device="cpu"|"cuda")`：张量显式建在目标 device；
- `timeit(fn, device=...)`：计时方式由**被 benchmark 的 device** 决定（不再用 `torch.cuda.is_available()` 猜测）；
- `--device cuda` 在无 CUDA 时**直接报错退出**（不静默回退 CPU）；
- CUDA 路径：`reset_peak_memory_stats` → 运行 → `max_memory_allocated`，并区分 **allocated / reserved**；
- fp16/bf16：仅 CUDA 执行（CPU 跳过并说明）。

### 1.3 仍未执行（NOT EXECUTED ON CUDA）

CUDA 真机实验、vLLM serving benchmark、Triton kernel —— 代码/命令/模板齐全，标注不变。

---

## 二、RAG（rag-service）

### 2.1 指标定义修正

| 问题 | 修正 |
| --- | --- |
| 把「命中即 1」当 Recall@k（实际是 Hit@k） | 新增 `eval_metrics.py`：**Hit@k 与 Recall@k 分离**，Recall = `|R_k ∩ G| / |G|` |
| chunk 级排名直接计算（同 doc 多 chunk 污染） | **先 collapse 到 doc 级**（按 doc_id 去重，保留首次 rank），所有指标在 doc ranking 上计算 |
| nDCG 只看第一条相关 | 标准二值 nDCG@k：DCG 计入 top-k **全部**相关文档，IDCG 按理想排序 |
| 缺测试 | 新增 `tests/test_eval_metrics.py`（12 个用例，含规格中的 Case 1/2 与 Hit≠Recall 反例） |

### 2.2 重跑后的检索指标（22 条标注查询，doc 级）

| 模式 | Hit@10 | Recall@10 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- |
| BM25 | 100.0% | 100.0% | 0.9091 | 0.9329 |
| Dense | 86.4% | 86.4% | 0.6417 | 0.6991 |
| Hybrid (RRF) | 100.0% | 100.0% | 0.8485 | 0.8884 |
| Hybrid + Reranker | 100.0% | 100.0% | **0.9318** | **0.9497** |

结论不变但更严谨：BM25 在本语料不输向量；**精排把 MRR 提到 0.932（超过 BM25 的 0.909）**——收益最大的一步。
（早期表格的列名与数值为旧 evaluator 口径，已全部更新 README / 第 28 章 / 第 29 章 / 审计。）

---

## 三、SFT（sft-lora）

### 3.1 best checkpoint 真实落地

- 训练中每次 val 改善即保存 `adapter_best/`；结束保存 `adapter_final/`；
- `TrainLog` 记录 `best_step` / `best_val_loss`，写入报告。

### 3.2 Base / Best / Final 三路评测（同一 held-out + 同一 harness）

| 指标 | Base | Best (step 60) | Final (step 150) |
| --- | --- | --- | --- |
| held-out response-only loss | 3.7565 | **2.7301** | 3.2947 |
| QA F1（20 题） | 20.2% | **24.4%** | 22.5% |
| QA EM | 0.0% | 0.0% | 0.0% |

**本 run 观察**：best val loss 的 checkpoint 同时是 QA F1 最高点——但明确写入报告：
这是**单次运行的经验观察**，val 最优不必然等于 downstream 最优（反之亦然）。

### 3.3 结论口径收敛

- +4.2pt 改为**描述性结果**：n=20，不足以单独证明稳定能力提升；能确定的是 train loss 下降、val 过拟合、输出风格改变；
- 「SFT 教格式，不教知识」改为准确表述：**小数据 regime（0.5B + 48 样本）下最明显的是风格变化**；SFT 也可注入任务知识，与 RAG 不互斥；
- **Training Data Correctness** 小节新增：错误 teacher answer → loss 照样下降 → 模型认真学错。

### 3.4 训练数据 correctness audit

逐条审查 48 条训练数据，修正 5 处过度绝对表述：LoRA alpha（常见比例非固定）、RoPE（不外推保证）、量化（精度影响依配置）、SwiGLU（非必然更优）、混合精度（状态保留依实现）。

---

## 四、Evaluation（llm-eval）

| 问题 | 修复 | 测试 |
| --- | --- | --- |
| `report.cache_hits = cache.hits`（累计值串账） | 进入 task 前记录基线，只统计本 task 命中 | 新增 2 用例（含三任务暴露累计泄漏的场景） |
| `AsyncClient` 通过 `run_until_complete` 关闭（脆弱） | 新增 `aclose()`，runner 在事件循环内 `await adapter.aclose()`；同步适配器走 `close()` | 新增 1 用例（aclose 被调用） |

测试：**21 个测试函数 / 32 个用例** 全部通过。

---

## 五、Portfolio 与可复现性

| 项 | 交付 |
| --- | --- |
| 根 README | 10 秒可读定位：32 Chapters / 6 Runnable Projects / 3 Tracks；Featured 4 项目；诚实纪律；Quick Start；仓库结构 |
| projects/README | 6 项目全表（Track / Core Skills / Tests / Status 多维，不用一个 ✅ 掩盖） |
| 第 0 章 | 两轨制（Knowledge 0-23 + Job-Ready 24-31）、Track A/B/C、清除 stale（79 demos / 未来 profiling / RAG 暂不展开） |
| 第 24 章 | 清除全部「下一批」；Checkpoint A-E 全部标注已交付 |
| 首页 | 「N 个可运行项目」动态读取 `content/projects.json`（构建时扫描，不硬编码） |
| 环境快照 | `docs/environment.txt`（platform + pip freeze） |
| CI | `.github/workflows/ci.yml`：validators + 5 项目轻量单测 + docker build；重模型 `workflow_dispatch` |
| 门禁链 | build → validate-static → validate-content → validate-batch2 → **validate-jobs（165）** → **validate-portfolio（50）** → publish |

测试口径统一：README 一律写 `N 个测试函数（M 个用例）`，validate-jobs 按 `def test_` 数量核对，不再混用。

---

## 六、Known Limitations（本轮结束后仍存在）

1. **CUDA / vLLM / Triton**：仍未执行（无 GPU）；标注 `NOT EXECUTED ON CUDA`；
2. **SFT 单种子**：三路对比是单次运行，没有多 seed 均值与置信区间；
3. **QA n=20**：所有 QA F1/EM 结论均为描述性；
4. **RAG faithfulness 未自动化**：引用校验 + 人工检查；
5. **Docker**：本机无 Docker，构建由 CI `docker-build` job 验证；
6. **CPU attention 内存**：子进程 RSS 含运行时开销，不能等同于纯张量峰值。
