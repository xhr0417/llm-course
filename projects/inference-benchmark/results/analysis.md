# Inference Benchmark 分析报告（自动生成）

## 0. 环境

- 平台：Darwin arm64 | Python 3.9.6 | torch 2.8.0
- 设备：CPU | CUDA 可用：False

## 1. Attention：naive vs SDPA（latency）

| impl | device | seq_len | dtype | latency_ms | 理论中间张量 MB |
| --- | --- | --- | --- | --- | --- |
| naive | cpu | 128 | float32 | 0.233 | 0.5 |
| sdpa | cpu | 128 | float32 | 0.092 | 0.0 |
| naive | cpu | 256 | float32 | 0.641 | 2.0 |
| sdpa | cpu | 256 | float32 | 0.206 | 0.0 |
| naive | cpu | 512 | float32 | 2.354 | 8.0 |
| sdpa | cpu | 512 | float32 | 0.767 | 0.0 |
| naive | cpu | 1024 | float32 | 5.773 | 32.0 |
| sdpa | cpu | 1024 | float32 | 2.02 | 0.0 |
| naive | cpu | 2048 | float32 | 19.567 | 128.0 |
| sdpa | cpu | 2048 | float32 | 7.195 | 0.0 |

> **口径**：`理论中间张量 MB` 是按 `2×B×H×S²×bytes`（naive 的 scores 与 probs 同时存活）估算的张量 footprint，**不是进程 peak memory**；CUDA 的 peak allocated/reserved 为真机实测。

**伸缩性（seq_len 翻倍时的延迟倍数；纯 attention 理论 O(n²) ⇒ 接近 4×）**：
- naive/float32: 128→256 = 2.75×
- naive/float32: 256→512 = 3.67×
- naive/float32: 512→1024 = 2.45×
- naive/float32: 1024→2048 = 3.39×
- sdpa/float32: 128→256 = 2.24×
- sdpa/float32: 256→512 = 3.72×
- sdpa/float32: 512→1024 = 2.63×
- sdpa/float32: 1024→2048 = 3.56×

## 1b. 独立子进程 peak RSS（CPU 参照）

| impl | seq_len | 理论中间张量 MB | 进程 peak RSS MB |
| --- | --- | --- | --- |
| sdpa | 512 | 0.0 | 174.3 |
| naive | 512 | 8.0 | 186.3 |
| sdpa | 2048 | 0.0 | 185.4 |
| naive | 2048 | 128.0 | 310.3 |

> **口径**：`进程 peak RSS` 由**独立子进程**（`python -m ibench.mem_worker`）测得，是该进程生命周期的 high-water mark，**包含 Python / PyTorch / BLAS 运行时开销**，不是纯 attention 张量内存。它与理论张量 footprint 的差距主要来自运行时基线。

## 2. Profiler：Top 算子（CPU）

| op | calls | cpu_ms | cpu% | cuda_ms |
| --- | --- | --- | --- | --- |
| `aten::bmm` | 6 | 7.334 | 71.7% | 0.0 |
| `aten::_softmax` | 3 | 1.715 | 16.8% | 0.0 |
| `aten::div` | 3 | 0.918 | 9.0% | 0.0 |
| `aten::select` | 72 | 0.06 | 0.6% | 0.0 |
| `aten::matmul` | 6 | 0.042 | 0.4% | 0.0 |
| `aten::as_strided` | 87 | 0.031 | 0.3% | 0.0 |
| `aten::expand` | 12 | 0.023 | 0.2% | 0.0 |
| `aten::reshape` | 12 | 0.02 | 0.2% | 0.0 |
| `aten::transpose` | 3 | 0.016 | 0.2% | 0.0 |
| `aten::view` | 9 | 0.015 | 0.1% | 0.0 |
| `aten::copy_` | 3 | 0.011 | 0.1% | 0.0 |
| `aten::_to_copy` | 3 | 0.01 | 0.1% | 0.0 |

## 3. torch.compile

- eager：0.253 ms | compiled：0.332 ms | 加速比：**0.762×**
- 首次编译耗时：1.8s | 输出一致：True
- 结论：compiled 更慢（常见于小模型/CPU/形状多变的场景）

## 4. Serving benchmark（OpenAI-compatible）

（未运行：需要 OpenAI-compatible 服务端，见 docs/vllm_runbook.md）

## 5. GPU 预期行为（待验证）

以下预期行为来自理论/公开资料，**需在目标硬件上按本仓库脚本实测**：

- **并发 ↑ → 吞吐 ↑、TTFT/TPOT 可能 ↑**：batch 内请求共享权重读取（吞吐上升），但每步计算量与排队增加（延迟上升）；
- **prompt 变长 → TTFT 通常 ↑**：dense Transformer 的 prefill 同时含随 S 线性增长的投影/MLP 项与随 S² 增长的 attention 项；在具体模型/硬件/长度区间内常观察到近似线性的 wall-clock 区间，但不应简化为「prefill 复杂度 = O(S)」；
- **output 变长 → 总时长 ↑**：在上下文长度变化不大的区间内，decode 每步近似稳定；从更大尺度看，单步 attention / KV 读取成本会随当前 context length 增长；
- **naive vs SDPA 差距随 seq_len 拉大**：naive 物化 S×S 中间矩阵，带宽/容量压力更大；SDPA/FlashAttention 通过 tiling + online softmax 避免把完整 attention 矩阵写回 HBM；
- **BF16 通常比 FP32 快**（Tensor Core），但 CPU 上不适用。

## 6. 未执行清单（诚实标注）

本机未执行（如实标注）：

- **CUDA 相关全部实验**：本机无 NVIDIA GPU（`cuda_available=False`）。`--device cuda` 会直接报错退出，不做静默回退；
- **vLLM 服务端 benchmark**：vLLM 需要 CUDA 环境，见 `docs/vllm_runbook.md`（命令齐全，待有 GPU 机器验证）；
- **Triton kernel**：同属 CUDA 环境（第 19 章代码标注 NOT EXECUTED ON CUDA）；
- **Docker build**：本机未安装 Docker（由 CI 的 docker-build job 验证，见 `.github/workflows/ci.yml`）；
- 已完成：CPU 上的 attention 伸缩（latency + 理论张量 footprint + 子进程 RSS）、profiler 算子表、torch.compile 对比、serving 客户端（对 mock 服务端验证）。
