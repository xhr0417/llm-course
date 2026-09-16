# Projects —— Job-Ready Track 的真实项目

这里是本课程「能跑起来」的部分：每个目录都是**真实可运行**的工程，而不是网页上的代码片段。
**6 Runnable Projects** · 全部含 README / requirements / src / tests。

## 项目总览

| Project | Track | Core Skills | Tests | Status |
| --- | --- | --- | --- | --- |
| [`log-analyzer/`](log-analyzer/) | A · 基础工程 | argparse · dataclass · logging · pathlib · JSONL · pytest | 14 functions / 14 cases | ✅ CPU 实测（含 CLI 真实输出） |
| [`hf-mini-lab/`](hf-mini-lab/) | A/B · 框架 | Tokenizer · Chat Template · generate · PEFT/LoRA · save/load | 10 functions / 10 cases | ✅ CPU 实测（Qwen2.5-0.5B 全流程）· 集成测试需联网下载模型 |
| [`llm-eval/`](llm-eval/) | A · 评测 | Adapter × Task × Parser × Metrics · asyncio/Semaphore · 重试 · SQLite 缓存 · bad case | 21 functions / 32 cases | ✅ 真实 C3/XCOPA 评测（缓存复跑 0.0s）· API 路径用本地 mock 验证 |
| [`rag-service/`](rag-service/) | A · 检索/服务 | BM25 · 向量 · RRF · cross-encoder 精排 · FastAPI/SSE · 检索评测 | 39 functions / 39 cases | ✅ 真实 22 查询评测 · 🐳 Docker build：CI 验证（docker-build job） |
| [`sft-lora/`](sft-lora/) | B · 算法 | response-only loss · LoRA · best/final checkpoint · Base–Best–Final 评测 · 实验报告 | 14 functions / 14 cases | ✅ CPU 实测（真实训练与三路对比） |
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
├── scripts/ 或 configs/ # 入口 / 配置
└── samples/ 或 data/    # 小样例数据
```

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
