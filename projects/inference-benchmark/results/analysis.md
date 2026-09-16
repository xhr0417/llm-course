# Inference Benchmark 分析报告（自动生成）

## 0. 环境

- 平台：Darwin arm64 | Python 3.9.6 | torch 2.8.0
- 设备：CPU | CUDA 可用：False

## 1. Attention：naive vs SDPA

| impl | seq_len | dtype | latency_ms | peak_mem_mb |
| --- | --- | --- | --- | --- |
| naive | 128 | float32 | 0.217 | 2.7 |
| sdpa | 128 | float32 | 0.113 | 0.3 |
| naive | 256 | float32 | 0.496 | 4.3 |
| sdpa | 256 | float32 | 0.289 | 1.2 |
| naive | 512 | float32 | 3.029 | 29.0 |
| sdpa | 512 | float32 | 1.164 | 1.8 |
| naive | 1024 | float32 | 8.289 | 32.0 |
| sdpa | 1024 | float32 | 5.198 | 9.0 |
| naive | 2048 | float32 | 29.238 | 128.2 |
| sdpa | 2048 | float32 | 10.886 | 3.5 |

**伸缩性（seq_len 翻倍时的延迟倍数，理论 O(n²) ⇒ ≈4×）**：
- naive/float32: 128→256 = 2.29×
- naive/float32: 256→512 = 6.11×
- naive/float32: 512→1024 = 2.74×
- naive/float32: 1024→2048 = 3.53×
- sdpa/float32: 128→256 = 2.56×
- sdpa/float32: 256→512 = 4.03×
- sdpa/float32: 512→1024 = 4.47×
- sdpa/float32: 1024→2048 = 2.09×

## 2. Profiler：Top 算子（CPU）

| op | calls | cpu_ms | cpu% | cuda_ms |
| --- | --- | --- | --- | --- |
| `aten::bmm` | 6 | 7.027 | 66.4% | 0.0 |
| `aten::_softmax` | 3 | 2.469 | 23.3% | 0.0 |
| `aten::div` | 3 | 0.76 | 7.2% | 0.0 |
| `aten::select` | 72 | 0.066 | 0.6% | 0.0 |
| `aten::matmul` | 6 | 0.053 | 0.5% | 0.0 |
| `aten::view` | 9 | 0.035 | 0.3% | 0.0 |
| `aten::as_strided` | 87 | 0.032 | 0.3% | 0.0 |
| `aten::expand` | 12 | 0.029 | 0.3% | 0.0 |
| `aten::reshape` | 12 | 0.026 | 0.2% | 0.0 |
| `aten::transpose` | 3 | 0.019 | 0.2% | 0.0 |
| `aten::copy_` | 3 | 0.016 | 0.2% | 0.0 |
| `aten::_to_copy` | 3 | 0.013 | 0.1% | 0.0 |

## 3. torch.compile

- eager：0.249 ms | compiled：0.345 ms | 加速比：**0.721×**
- 首次编译耗时：3.3s | 输出一致：True
- 结论：compiled 更慢（常见于小模型/CPU/形状多变的场景）

## 4. Serving benchmark（OpenAI-compatible）

（未运行：需要 OpenAI-compatible 服务端，见 docs/vllm_runbook.md）

## 5. GPU 预期行为（待验证）

以下预期行为来自理论/公开资料，**需在目标硬件上按本仓库脚本实测**：

- **并发 ↑ → 吞吐 ↑、TTFT/TPOT 可能 ↑**：batch 内请求共享一次权重读取（吞吐上升），但每步计算量与排队增加（延迟上升）；
- **prompt 变长 → TTFT ↑（近似线性）**：prefill 计算量随 prompt 长度增长（第 20 章）；
- **output 变长 → 总时长 ↑、tokens/s 大致稳定**：decode 每步成本近似固定（带宽受限），总时间正比于输出长度；
- **naive vs SDPA 差距随 seq_len 拉大**：naive 物化 [B,H,S,S]，显存与带宽是瓶颈；SDPA/FlashAttention IO-aware（第 19 章）；
- **BF16 通常比 FP32 快 1.5-3×**（Tensor Core），但 CPU 上不适用。

## 6. 未执行清单（诚实标注）

本机未执行（如实标注）：

- **CUDA 相关全部实验**：本机无 NVIDIA GPU（`cuda_available=False`）；
- **vLLM 服务端 benchmark**：vLLM 需要 CUDA 环境，见 `docs/vllm_runbook.md`（命令齐全，待有 GPU 机器验证）；
- **Triton kernel**：同属 CUDA 环境（第 19 章代码标注 NOT EXECUTED ON CUDA）；
- 已完成：CPU 上的 attention 伸缩、profiler 算子表、torch.compile 对比、serving 客户端（对 mock 服务端验证）。
