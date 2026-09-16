# Projects —— Job-Ready Track 的真实项目

这里是本课程「能跑起来」的部分：每个目录都是**真实可运行**的工程，而不是网页上的代码片段。
**6 Runnable Projects** · 全部含 README / requirements / src / tests。

## Guided Build（starter）：亲手把项目做出来

前三个项目额外提供 `starter/`——一个**刻意不完整**的版本：核心函数是 TODO，
测试初始为红，学生按课程 Step 一步步实现，直到全部变绿；之后才对照完整参考实现。

| Starter | 对应章节 | 初始状态（真实） | 完成状态 |
| --- | --- | --- | --- |
| [`log-analyzer/starter/`](log-analyzer/starter/) | 第 25 章 Python Engineering | `41 failed` | `41 passed`（10 步） |
| [`hf-mini-lab/starter/`](hf-mini-lab/starter/) | 第 26 章 HuggingFace | `38 failed` | `38 passed`（13 步） |
| [`llm-eval/starter/`](llm-eval/starter/) | 第 27 章 Capstone 1 · Eval Harness | `77 failed, 2 passed` | `79 passed`（15 步） |

每个 starter 有独立 `pytest.ini`（`testpaths = tests`），父项目不会误收集 starter 的测试；
CI 的 `guided-starters` job 断言 starter 初始必须为红。用法：

```bash
cd <project>/starter
pip install -r requirements.txt
pytest -q        # 看到红色 → 打开课程对应章节，按 Step 逐组实现
```

## 项目总览

| Project | Track | Core Skills | Tests | Status |
| --- | --- | --- | --- | --- |
| [`log-analyzer/`](log-analyzer/) | A · 基础工程 | argparse · dataclass · logging · pathlib · JSONL · pytest | 14 functions / 14 cases | ✅ CPU 实测（含 CLI 真实输出）· 🧭 starter（10 步） |
| [`hf-mini-lab/`](hf-mini-lab/) | A/B · 框架 | Tokenizer · Chat Template · generate · PEFT/LoRA · save/load | 11 functions / 11 cases | ✅ CPU 实测（Qwen2.5-0.5B 全流程）· 集成测试需联网下载模型 · 🧭 starter（13 步） |
| [`llm-eval/`](llm-eval/) | A · 评测 | Adapter × Task × Parser × Metrics · asyncio/Semaphore · 重试 · SQLite 缓存 · bad case | 21 functions / 32 cases | ✅ 真实 C3/XCOPA 评测（缓存复跑 0.0s）· API 路径用本地 mock 验证 · 🧭 starter（15 步） |
| [`rag-service/`](rag-service/) | A · 检索/服务 | BM25 · 向量 · RRF · cross-encoder 精排 · FastAPI/SSE · 检索评测 | 39 functions / 39 cases | ✅ 真实 22 查询评测 · 🐳 Docker build ✅（CI 已验证） |
| [`sft-lora/`](sft-lora/) | B · 算法 | response-only loss · LoRA · best/final checkpoint · Base–Best–Final 评测 · 实验报告 | 15 functions / 15 cases | ✅ CPU 实测（真实训练与三路对比） |
| [`inference-benchmark/`](inference-benchmark/) | C · Infra | torch.profiler · device-aware 计时 · SDPA 对比 · torch.compile · serving 压测 | 15 functions / 15 cases | ✅ CPU 实测 · ⚠️ CUDA / vLLM / Triton：**NOT EXECUTED ON CUDA** |

**状态列的口径**：`✅` 只代表该项在当时环境真实执行过；未执行项逐条标注（CUDA / vLLM / Docker / 真实 API 等），
不使用一个勾掩盖所有维度。验证环境快照见 [`../docs/environment.txt`](../docs/environment.txt)。

## 项目标准

```
<project>/
├── README.md            # Quick Start + 设计说明 + 真实运行记录
├── requirements.txt     # 依赖
├── src/<package>/       # 源码（可 import）
├── tests/               # pytest（N test functions / M pytest cases）
├── starter/             # （可选）Guided Build 起点：不完整 + 分步测试
├── scripts/ 或 configs/ # 入口 / 配置
└── samples/ 或 data/    # 小样例数据
```

Guided Build 章节（25/26/27）对应的 starter 与参考实现保持**同包名、同 API**——
学生完成后可以直接逐文件对照，差异只在完成度，不在接口。

## 运行方式

```bash
cd projects/<project>
pip install -r requirements.txt
# 按 README 的 Quick Start 执行（每个项目都有 pytest 与真实运行命令）
```

## 纪律

- **不伪造实验数据**：README 与课程页面中的数字均来自真实运行；未执行项用 `NOT EXECUTED` 标注；
- **单卡/CPU 优先**：默认模型与数据规模以「学生能在一台普通机器上跑完」为准；
- **代码可读优先**：不过度设计（无工厂、无依赖注入框架、无微服务），目标是第一段实习能讲清楚的工程；
- **测试口径**：统一写明 `N test functions / M pytest cases`（参数化会让一个函数生成多个 case，两者不混用）。
