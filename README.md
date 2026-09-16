# LLM Course

**从 Transformer 原理，到训练、推理系统，再到真实 AI 工程项目。**

🌐 在线课程：**https://llm.xhr0417.cn/**（镜像：https://xhr0417.github.io/llm-course/）
📚 **32 Chapters** — Knowledge Track（0-23）+ Job-Ready Track（24-31）
🧪 **6 Runnable Projects** — 每个都含 README / requirements / src / tests，CPU 可复现
🎯 **3 Tracks** — AI Application · LLM Algorithm · AI Infra

> 一套中文交互式课程（每章配交互演示 + 测验 + 面试题），加一组**真实可运行**的求职项目。
> 所有实验数字来自真实运行；没有 GPU 的部分明确标注 `NOT EXECUTED`——纪律本身就是课程内容。

---

## 这个仓库是什么

| | Knowledge Track（懂） | Job-Ready Track（能做） |
| --- | --- | --- |
| 章节 | 0-23：深度学习 → Transformer → 训练/数据/GPU/分布式 → 推理系统 → SFT/GRPO → 评测 | 24-31：Python 工程 → HuggingFace → Eval Harness → RAG → RAG Service → SFT/LoRA → Profiling |
| 产出 | 能推导、能解释、能做失败分析 | 6 个可运行项目 + 实验报告 + 面试复盘清单 |
| 阅读方式 | https://llm.xhr0417.cn/ 从第 0 章开始 | 直接进 `projects/`（见下方 Quick Start） |

## 三条岗位路线

### Track A · AI 应用 / 大模型应用开发
```
Python Engineering(25) → PyTorch(11) → Transformer(07) → HuggingFace(26)
→ LLM Evaluation(23) → Eval Harness(27) → RAG 工程(28) → RAG Service(29) → 开始投递
```
对应岗位：大模型应用开发 / AI 应用研发 / 大模型评测 / AI 平台研发 / LLM Engineer Intern

### Track B · 大模型算法
```
Transformer(07) → Build Small LLM(12-13) → Data Pipeline(18) → Pretraining(21)
→ HuggingFace(26) → SFT/LoRA(30) → DPO/GRPO(22) → Evaluation(23) → Experiment Design
```
对应岗位：大模型算法 / 机器学习算法 / 模型训练与后训练实习

### Track C · AI Infra / ML Systems
```
PyTorch(11) → GPU(15) → FlashAttention/Triton(19) → Distributed(16)
→ Inference Systems(20) → Profiling Lab(31) → vLLM Benchmark（需 CUDA）
```
对应岗位：AI Infra / ML Systems / 大模型推理框架 / 性能工程实习

## Featured Projects（4 个核心）

| 项目 | 证明什么 | 真实运行记录 |
| --- | --- | --- |
| **[llm-eval](projects/llm-eval/)** · Eval Harness | adapters × tasks × parsers × metrics；asyncio 并发 + 重试 + SQLite 缓存；bad case 分类与自动报告 | 真实 C3/XCOPA 切片 128 题 32.3s；二次运行缓存命中 0.0s |
| **[rag-service](projects/rag-service/)** · RAG Service | BM25（从零实现）+ 向量 + RRF 混合 + cross-encoder 精排；FastAPI/SSE；**retrieval 与 generation 分开评测** | 22 条标注查询：hybrid+rerank MRR **0.9318**；检索 6/6 命中 |
| **[sft-lora](projects/sft-lora/)** · SFT/LoRA | response-only loss、best/final checkpoint、Base–Best–Final 三路公平评测、自动实验报告 | train loss 3.89→1.46；best@60 val 2.73；QA F1 20.2%→**24.4%** |
| **[inference-benchmark](projects/inference-benchmark/)** · Profiling Lab | torch.profiler 算子表、device-aware 计时、naive vs SDPA、torch.compile 反例、serving TTFT/TPOT 压测 | SDPA 快 2.7×；compile 反例 0.76×；vLLM 部分 `NOT EXECUTED ON CUDA` |

其余两个项目见 **[projects/README.md](projects/README.md)**（log-analyzer · hf-mini-lab）。

## Quick Start

```bash
# 1) 本地跑课程网站
python3 -m http.server 8000        # 然后打开 http://127.0.0.1:8000

# 2) 跑任意项目（示例：评测 harness）
cd projects/llm-eval
pip install -r requirements.txt
python run_eval.py --adapter mock --tasks c3 --limit 12   # 冒烟
pytest -q

# 3) 跑 SFT 实验（CPU 约 8 分钟，含 Base/Best/Final 三路评测）
cd ../sft-lora && pip install -r requirements.txt
python scripts/run_experiment.py --steps 150 --run-harness
```

## 可复现性与诚实纪律

- **所有实验数字来自真实运行**（CPU 环境快照见 [docs/environment.txt](docs/environment.txt)）；
- **CUDA / vLLM / Triton 实验未执行**：无 GPU 环境，代码与 runbook 齐全，逐处标注 `NOT EXECUTED ON CUDA`；
- **Docker**：本机无 Docker；`rag-service` 的镜像构建由 CI 的 `docker-build` job 验证（见 [.github/workflows/ci.yml](.github/workflows/ci.yml)）；
- **HTTP 路径使用 mock 服务端验证协议**（OpenAI-compatible / SSE），不伪造真实 API 结果；
- 评测指标按标准定义实现（Hit@k ≠ Recall@k、doc 级去重、nDCG 计入全部相关文档）。

## 仓库结构

```
├── content/            # 32 章源文件（markdown）
├── chapters/           # 构建产物：静态阅读页
├── js/                 # 交互演示与站点逻辑
├── projects/           # 6 个真实工程项目（见 projects/README.md）
│   ├── log-analyzer/       # Python 工程 CLI（14 test functions）
│   ├── hf-mini-lab/        # HuggingFace + LoRA 全流程
│   ├── llm-eval/           # Evaluation Harness（21 test functions / 32 cases）
│   ├── rag-service/        # RAG Service（39 test functions）
│   ├── sft-lora/           # SFT/LoRA 实验（14 test functions）
│   └── inference-benchmark # Profiling Lab（15 test functions）
├── tools/              # 构建与校验（发布门禁见下）
├── docs/               # 审计文档与实验环境快照
└── .github/workflows/  # CI：校验 + 单测 + docker build
```

## 发布门禁（每次发布必须全绿）

```
build-static → validate-static → validate-content → validate-batch2
→ validate-jobs → validate-portfolio → 发布（服务器 + GitHub）
```

CI（`.github/workflows/ci.yml`）在每次 push 自动运行 Node 校验器、轻量 Python 单测与 RAG 镜像构建；
重模型集成测试（0.5B 下载）通过 `workflow_dispatch` 手动触发。

## 数据来源

- 课程内评测数据切片：XCOPA（cambridgeltl/xcopa，zh）· C3（dataset-org/c3，dialog）——仅保留小切片用于教学；
- 模型：Qwen2.5-0.5B-Instruct（生成/微调实验）· bge-small-zh-v1.5（向量）· mmarco-mMiniLMv2 cross-encoder（精排）· tiny 模型（单元测试）。
