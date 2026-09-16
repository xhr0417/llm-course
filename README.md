# LLM Course

**从 Transformer 原理，到训练、推理系统，再到真实 AI 工程项目。**

🌐 在线课程：**https://llm.xhr0417.cn/**（镜像：https://xhr0417.github.io/llm-course/）
📚 **32 Chapters** — Knowledge Track（0-23）+ Job-Ready Track（24-31）
🧭 **3 Guided Build Starters** — 不完整的 starter + 分步测试，让你亲手把项目做出来
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

## Guided Build：亲手做出来，而不是看懂

每个 Guided Build 项目有三层：

| 层级 | 内容 | 位置 |
| --- | --- | --- |
| **Learn** | 章节正文 + 参考手册（原理与工程细节） | 第 25 / 26 / 27 章 |
| **Guided Build** | 不完整的 starter：核心函数是 TODO，分步测试初始为红，按章节 Step 逐组变绿 | `<project>/starter/` |
| **Reference Solution** | 完整可运行工程（做完之后再对照） | `projects/<project>/` |

| Starter | 章节 | 初始状态 | 完成状态 |
| --- | --- | --- | --- |
| [log-analyzer/starter](projects/log-analyzer/starter/) | 第 25 章 Python 工程 | 41 failed | 41 passed（10 步） |
| [hf-mini-lab/starter](projects/hf-mini-lab/starter/) | 第 26 章 HuggingFace | 38 failed | 38 passed（13 步） |
| [llm-eval/starter](projects/llm-eval/starter/) | 第 27 章 Capstone 1 · Eval Harness | 77 failed / 2 passed | 79 passed（15 步） |

课程页面的 Guided Build 进度面板记录每个 Step 的状态与 Learned / Implemented / Ran / Explained 四态自检
（存本地浏览器，不上传；打开 Solution 不会自动算完成）。CI 有一个专门的 job 验证「starter 初始必须是红的」——
如果哪天 starter 全绿了，说明教学设计失效。

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

# 2) 从零做项目（Guided Build）：以 Python 工程为例
cd projects/log-analyzer/starter
pip install -r requirements.txt
pytest -q                          # 初始 41 failed —— 按课程 Step 一步步变绿

# 3) 跑参考实现（示例：评测 harness）
cd projects/llm-eval
pip install -r requirements.txt
python run_eval.py --adapter mock --tasks c3 --limit 12   # 冒烟
pytest -q

# 4) 跑 SFT 实验（CPU 约 8 分钟，含 Base/Best/Final 三路评测）
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
├── js/                 # 交互演示与站点逻辑（含 Guided Lab 组件与进度）
├── projects/           # 6 个真实工程项目（见 projects/README.md）
│   ├── log-analyzer/       # Python 工程 CLI（14 test functions）+ starter（41 测试）
│   ├── hf-mini-lab/        # HuggingFace + LoRA 全流程（11 test functions）+ starter（38 测试）
│   ├── llm-eval/           # Evaluation Harness（21 test functions / 32 cases）+ starter（79 测试）
│   ├── rag-service/        # RAG Service（39 test functions）
│   ├── sft-lora/           # SFT/LoRA 实验（15 test functions）
│   └── inference-benchmark # Profiling Lab（15 test functions）
├── tools/              # 构建与校验（发布门禁见下）
├── docs/               # 审计文档与实验环境快照
└── .github/workflows/  # CI：校验 + 单测 + starter 红灯断言 + docker build
```

## 发布门禁（每次发布必须全绿）

```
build-static → validate-static → validate-content → validate-batch2
→ validate-jobs → validate-portfolio → validate-guided → 发布（服务器 + GitHub）
```

`validate-guided` 校验 Guided Build 的完整链路：渲染器一致性（app.js ↔ build-static.js）、
三个 Lab 的 step 结构与教学设计（每步有目标/你来写/运行/验收/解释、Solution 默认折叠）、
starter 结构与 README 的初始红灯声明、Reference Solution 未被削弱。

CI（`.github/workflows/ci.yml`）在每次 push 自动运行 Node 校验器、轻量 Python 单测与 RAG 镜像构建；
重模型集成测试（0.5B 下载）通过 `workflow_dispatch` 手动触发。

## 数据来源

- 课程内评测数据切片：XCOPA（cambridgeltl/xcopa，zh）· C3（dataset-org/c3，dialog）——仅保留小切片用于教学；
- 模型：Qwen2.5-0.5B-Instruct（生成/微调实验）· bge-small-zh-v1.5（向量）· mmarco-mMiniLMv2 cross-encoder（精排）· tiny 模型（单元测试）。
