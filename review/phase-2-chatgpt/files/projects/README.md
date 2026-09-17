# Projects —— 已退出主线的历史参考目录

这些目录曾经是 Job-Ready 作业。它们**不是当前主线任务**，也不再要求完成 starter 或旧 Capstone。物理目录暂留，待后续审计后再删除。

当前动手入口是网站首页「我的学习」（小模型学习实验室—Attention）。

下面仍列出六个子目录，方便对照历史实现与残留测试。数字来自当时真实运行；未执行项保持 `NOT EXECUTED` 标注。

## 目录总览（可选参考，非当前作业）

| Project | 当时方向 | 核心技能（阅读用） | Tests | 当时状态 |
| --- | --- | --- | --- | --- |
| [`log-analyzer/`](log-analyzer/) | 基础工程 | argparse · dataclass · logging · pathlib · JSONL · pytest | 14 functions / 14 cases | CPU 实测（含 CLI 输出） |
| [`hf-mini-lab/`](hf-mini-lab/) | 框架 | Tokenizer · Chat Template · generate · PEFT/LoRA · save/load | 11 functions / 11 cases | CPU 实测（Qwen2.5-0.5B）；集成测试需联网 |
| [`llm-eval/`](llm-eval/) | 评测 | Adapter × Task × Parser × Metrics · asyncio · 重试 · 缓存 · bad case | 21 functions / 32 cases | 真实 C3/XCOPA；缓存复跑 0.0s |
| [`rag-service/`](rag-service/) | 检索/服务 | BM25 · 向量 · RRF · 精排 · FastAPI/SSE · 检索评测 | 39 functions / 39 cases | 22 查询评测；Docker build 曾由 CI 验证 |
| [`sft-lora/`](sft-lora/) | 算法 | response-only loss · LoRA · best/final · 三路评测 | 15 functions / 15 cases | CPU 实测训练与对比 |
| [`inference-benchmark/`](inference-benchmark/) | Infra | torch.profiler · 计时口径 · SDPA · compile · serving 压测 | 15 functions / 15 cases | CPU 实测；CUDA / vLLM：**NOT EXECUTED ON CUDA** |

各目录下若仍有 `starter/`，那是旧 Guided Build 残留，**不要当作现在要做的作业**。父项目 `pytest.ini` 仍锁 `testpaths = tests`，避免误收集 starter 测试。

验证环境快照见 [`../docs/environment.txt`](../docs/environment.txt)。

## 目录形态（残留代码）

```
<project>/
├── README.md
├── requirements.txt
├── src/<package>/
├── tests/               # pytest（N test functions / M pytest cases）
├── starter/             # （部分目录）旧作业起点，已退出教学流程
├── scripts/ 或 configs/
└── samples/ 或 data/
```

若只想对照历史实现：

```bash
cd projects/<project>
pip install -r requirements.txt
# 按该目录 README 的 Quick Start；这不是当前主线任务
```

## 纪律

- **不伪造实验数据**：README 与课程页面中的数字均来自真实运行；未执行项用 `NOT EXECUTED` 标注；
- 代码仍留在仓库期间，测试口径继续写明 `N test functions / M pytest cases`；
- 不要把这些目录接回「我的学习」当必修作业。
