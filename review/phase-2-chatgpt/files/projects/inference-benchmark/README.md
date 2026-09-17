# inference-benchmark —— GPU / Inference Profiling Lab（历史参考）

> **已退出主线（非当前作业）。** 当前动手任务在网站「我的学习」。本目录是历史参考实现，待后续审计后再处理。不要把下面的 Quick Start 当作现在要交的作业。

**AI Infra** 查阅用实验：profiling / CUDA timing / attention benchmark / torch.compile / vLLM serving benchmark 的可复现记录。

> ⚠️ 本机（macOS arm64）**无 CUDA**：所有 CPU 实验已真实运行；GPU/vLLM 部分为
> **NOT EXECUTED ON CUDA**（命令与模板见 `docs/vllm_runbook.md`）。

## Quick Start

```bash
cd projects/inference-benchmark
pip install -r requirements.txt

# CPU 可跑的三个 Lab（attention 伸缩 / profiler / torch.compile）→ results/
python scripts/run_cpu_labs.py

# Serving benchmark 客户端（真实服务端用 vLLM，见 runbook；这里先用 mock 自检）
python scripts/run_serving_bench.py --mock
python scripts/run_serving_bench.py --base-url http://localhost:8000 \
    --model Qwen/Qwen2.5-0.5B-Instruct --concurrency 1 8 32 --num-prompts 64

pytest -q   # 15 passed
```

## 真实运行记录（CPU；`results/` 下有完整 CSV）

### 1. Attention：naive vs SDPA（batch=1, heads=4, head_dim=64, fp32, device=cpu）

| seq_len | naive 延迟 | SDPA 延迟 | naive 理论中间张量 | SDPA 理论中间张量 |
| --- | --- | --- | --- | --- |
| 128 | 0.23 ms | 0.09 ms | 0.5 MB | 0（不物化 S×S） |
| 512 | 2.35 ms | 0.77 ms | 8.0 MB | 0 |
| 1024 | 5.77 ms | 2.02 ms | 32.0 MB | 0 |
| 2048 | **19.57 ms** | **7.20 ms** | **128.0 MB** | 0 |

**口径（重要）**：
- 延迟为真实实测（device-aware 计时）；
- 「理论中间张量」= naive 的 scores+probs 同时存活的估算 `2×B×H×S²×bytes`，**不是进程 peak memory**；
- 独立子进程（`python -m ibench.mem_worker`）测得的**进程 peak RSS**（含 Python/PyTorch 运行时开销）：
  seq=2048 时 sdpa **185.4 MB** vs naive **310.3 MB**，差值 ≈ 125 MB ≈ 理论 footprint 128 MB —— 两种口径相互印证；
- CPU 不再声称「37× peak memory」；CUDA 显存只有真机执行 `reset_peak_memory_stats → max_memory_allocated` 后才会报告（本机 **NOT EXECUTED**）。

伸缩性：naive 1024→2048 延迟 ×3.39（纯 attention 理论 O(n²) ⇒ 接近 4×）。

### 2. Profiler（CPU 算子表，naive attention, seq=512）

| 算子 | 占比 | 调用次数 |
| --- | --- | --- |
| `aten::bmm` | 66.4% | 6 |
| `aten::_softmax` | 23.3% | 3 |
| `aten::div` | 7.2% | 3 |
| `aten::select` | 0.6% | 72 |

「哪一步慢」一目了然：矩阵乘 + softmax 是全部成本。

### 3. torch.compile（CPU，256×256 MLP 融合场景）

```
eager 0.249 ms → compiled 0.345 ms（0.72×，更慢）
首次编译耗时 3.3s；输出一致 ✅
```

**compile 不是「一开就快」**：小算子/CPU/形状多变时，编译开销与额外调度可能超过收益。GPU 大模型 + 固定 shape 才常见正收益（待验证）。

### 4. Serving benchmark 客户端（mock SSE 服务端自检，非真实模型）

```
并发 1：TTFT p50 4.4ms   TPOT p50 25.9ms   tok/s 40.9
并发 4：TTFT p50 851ms   TPOT p50 25.8ms   tok/s 42.2   ← 单线程 mock 服务端排队
```

客户端计时（TTFT/TPOT/吞吐/req-s）全部正常；并发 4 的 TTFT 暴涨正是「服务端吞吐瓶颈 → 排队」的真实写照。**真实模型数据用 `docs/vllm_runbook.md` 在 GPU 机器上填。**

## 项目结构

```text
inference-benchmark/
├── src/ibench/
│   ├── timer.py            # CUDA Event / synchronize 的正确计时（含 CPU 回退）
│   ├── attention_bench.py  # naive vs SDPA：延迟 + 理论 footprint（device-aware）
│   ├── mem_worker.py       # 独立子进程 peak RSS 测量（口径分离）
│   ├── profiler_lab.py     # torch.profiler → Top 算子表
│   ├── compile_lab.py      # eager vs compiled（含编译耗时与输出一致性）
│   ├── serving_bench.py    # OpenAI-compatible 流式客户端：TTFT/TPOT/tok/s/req/s
│   └── report.py           # analysis.md 自动生成（含「GPU 预期行为（待验证）」）
├── scripts/run_cpu_labs.py        # CPU 三件套 → results/
├── scripts/run_attention_bench.py # --device cpu|cuda 显式指定（cuda 不可用即报错）
├── scripts/run_serving_bench.py   # vLLM/Ollama/网关通用 + --mock 自检
├── docs/vllm_runbook.md           # vLLM 命令 + 必答分析问题 + 记录模板
├── results/                       # attention_bench.csv / profile_top_ops.csv / compile.json / serving_bench.csv / analysis.md
└── tests/test_ibench.py           # 15 个测试函数
```

## 必答分析问题（第 31 章 10.7 的四问）

1. **batch ↑ → 吞吐 ↑ 但延迟可能 ↑**：共享权重读取提升吞吐，计算量与排队增加抬高延迟；
2. **长 prompt → TTFT ↑**：prefill 计算随长度近似线性；
3. **output 越长总时长越长**：decode 每步成本近似固定；
4. **naive vs SDPA 差距随 seq 拉大**：naive 物化 S×S 中间矩阵（本机 seq=2048 理论 128 MB），SDPA 通过 tiling + online softmax 避免写回完整矩阵——本仓库 CPU 的延迟与两种内存口径（理论 footprint / 子进程 RSS）互为印证。

## 与课程对应

| 课程知识 | 项目位置 |
| --- | --- |
| 第 15 章 Roofline / 算术强度 | `profile_top_ops.csv` 的算子构成 |
| 第 19 章 FlashAttention / IO-aware | naive vs SDPA 实测（延迟 + 内存） |
| 第 20 章 TTFT/ITL / batching | `serving_bench.py` + runbook 四问 |
| 第 31 章（本章） | 全部实验与报告模板 |
