# llm-eval —— Mini LLM Evaluation Harness（历史参考）

> **已退出主线（非当前作业）。** 当前动手任务在网站「我的学习」。本目录是历史参考实现，待后续审计后再处理。不要把 `starter/` 或下面的 Quick Start 当作现在要交的作业。

一个**可运行**的评测框架：统一模型接口 × 可插拔任务 × 并发/重试/缓存 → 自动产出
`results.json` / `summary.md` / `badcases.jsonl`。

这是 Job-Ready Track 的 Checkpoint C 项目：不只是「知道评测指标」，而是**做出一套评测系统**。

## Quick Start

```bash
cd projects/llm-eval
pip install -r requirements.txt

# ① 本地 HF 模型（CPU 可跑）
python run_eval.py --model Qwen/Qwen2.5-0.5B-Instruct --tasks c3 xcopa --limit 20

# ② 用真实数据切片（先拉数据：XCOPA 中文 / C3 对话）
python scripts/fetch_data.py --task xcopa --n 60 --out data/xcopa_zh_60.jsonl
python scripts/fetch_data.py --task c3   --n 60 --out data/c3_dialog_60.jsonl
python run_eval.py --model Qwen/Qwen2.5-0.5B-Instruct --tasks c3 xcopa qa \
  --data c3=data/c3_dialog_60.jsonl --data xcopa=data/xcopa_zh_60.jsonl \
  --limit 60 --output outputs/run_001

# ③ OpenAI-compatible 服务（vLLM / Ollama / 任意网关，并发 + 限流 + 重试）
python run_eval.py --adapter openai --model qwen2.5 --base-url http://localhost:8000 \
  --tasks c3 xcopa --concurrency 8 --api-key sk-xxx

# ④ Mock 冒烟（验证管线，不评测真实能力）
python run_eval.py --adapter mock --tasks c3 --limit 12

pytest -q    # 32 passed
```

## 真实运行记录（本机，CPU）

128 题（C3 60 + XCOPA 60 + QA 8），Qwen2.5-0.5B-Instruct：

```text
评测完成：Qwen/Qwen2.5-0.5B-Instruct  用时 32.3s
  c3     n=60   accuracy=55.0%   （badcase 27）
  xcopa  n=60   accuracy=55.0%   （badcase 27）
  qa     n=8    em=0.0% / f1=21.9%  （badcase 8）
解析失败 0 | API 错误 0
```

- **第二次运行**（同参数）：评测阶段 **0.0s**——128 条响应全部命中 SQLite 缓存（总墙钟 5.9s 全花在加载模型）。
- XCOPA 55% vs 随机基线 50%、C3 55% vs 随机基线 25%：0.5B 模型的小样本结果，**n=60 置信区间很宽**，不作为能力结论（见第 23 章）。

## 项目结构

```text
llm-eval/
├── run_eval.py                  # CLI 入口
├── configs/default.json         # EvalConfig（dataclass）+ JSON 覆盖
├── data/
│   ├── mini_c3.jsonl            # 教学夹具（12 题，答案均衡）
│   ├── mini_xcopa.jsonl         # 教学夹具（12 题）
│   ├── mini_qa.jsonl            # 教学夹具（8 题）
│   ├── c3_dialog_60.jsonl       # 真实切片：C3 dialog（60 题）
│   └── xcopa_zh_60.jsonl        # 真实切片：XCOPA zh（60 题）
├── src/llm_eval/
│   ├── adapters/                # ModelAdapter：hf / openai / mock
│   ├── tasks/                   # EvalTask：c3 / xcopa / qa
│   ├── parsers.py               # 多选题答案解析（A/B/C/D）
│   ├── metrics.py               # accuracy / EM / F1 / pass@k
│   ├── cache.py                 # SQLite 响应缓存
│   ├── runner.py                # 并发 + 重试 + badcase 收集
│   └── reports.py               # results.json / summary.md / badcases.jsonl
├── scripts/fetch_data.py        # 拉取真实数据切片（XCOPA / C3）
└── tests/test_eval.py           # 21 个测试函数（参数化后共 32 个用例）
```

## 设计要点对照（课程章节）

| 课程知识 | 本项目的实现 |
| --- | --- |
| 第 23 章 评测指标 | `metrics.py`：accuracy / EM / F1 / pass@k（k≤n） |
| 第 23 章 bad case 分析 | `error_type`：parse_failure / wrong_answer / empty_output / api_error / low_f1 |
| 第 25 章 Python 工程 | dataclass 配置、pathlib、logging、退出码、pytest |
| 第 25 章 asyncio + Semaphore | `runner._generate_missing`（API 并发上限） |
| 第 25 章 重试 | 指数退避（`retry_backoff_s * 2^attempt`） |
| 第 26 章 HF 推理 | `adapters/hf.py`：chat template + left padding + batch |
| 第 26 章 OpenAI 接口 | `adapters/openai_compat.py`：只依赖通用 `/v1/chat/completions` |

## 三个真实踩坑（开发中遇到并已修复）

1. **Mock 全选同一选项会「假高分」**：夹具答案必须先均衡（测试里就有这条断言）；
2. **parser 是 accuracy 的隐形杀手**：模型输出 `"The correct answer is C."`、`"**D**"`、`"C)"` 都要能解析——本项目 32 个用例里有 12 条在测 parser；
3. **缓存 key 必须包含全部影响输出的参数**（model / prompt / max_tokens / temperature），否则改参数会拿到旧答案。

## 数据来源与许可

- [xcopa](https://huggingface.co/datasets/xcopa)（cambridgeltl，zh 配置）——因果推理；
- [dataset-org/c3](https://huggingface.co/datasets/dataset-org/c3)（dialog 配置）——中文阅读理解；
- 仓库内只保留 60 题/任务的小切片用于教学，完整评测请用 `scripts/fetch_data.py` 自行拉取。
