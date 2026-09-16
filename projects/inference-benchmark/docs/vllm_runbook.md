# vLLM Benchmark Runbook（需 CUDA 环境 —— 本机状态：NOT EXECUTED）

> 本机（macOS / 无 NVIDIA GPU）无法运行 vLLM。以下命令与检查清单在有 GPU 的机器上可直接执行；
> 完成后把 `results/serving_bench.csv` 与 `analysis.md` 的数字回填即可。

## 1. 安装与启动

```bash
# 需要 CUDA 12.x 环境
pip install vllm
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-0.5B-Instruct \
    --port 8000 \
    --max-model-len 4096
```

健康检查：

```bash
curl http://localhost:8000/v1/models
```

## 2. 冒烟请求

```bash
curl http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model": "Qwen/Qwen2.5-0.5B-Instruct",
       "messages": [{"role": "user", "content": "你好"}],
       "max_tokens": 32, "stream": true}'
```

## 3. 用本仓库的客户端做 benchmark

```bash
python scripts/run_serving_bench.py \
  --base-url http://localhost:8000 \
  --model Qwen/Qwen2.5-0.5B-Instruct \
  --concurrency 1 8 32 128 \
  --num-prompts 64 \
  --max-tokens 128
```

输出 `results/serving_bench.csv`：每档并发的 TTFT p50/p95、TPOT p50、tokens/s、req/s。

## 4. 必答的四个分析问题（对应第 31 章 10.7）

1. **为什么 batch ↑ throughput ↑ 但 latency 可能 ↑？**
   批量共享权重读取（吞吐上升），但每步计算量与排队时间增加（延迟上升）。
2. **为什么长 prompt TTFT ↑？**
   prefill 计算量随 prompt 长度近似线性增长。
3. **为什么 output length 影响 decode 总时长？**
   decode 每步成本近似固定（带宽受限），总时长正比输出长度。
4. **naive vs SDPA 差距为什么随 seq_len 拉大？**
   naive 物化 [B,H,S,S]；SDPA/FlashAttention 做 IO-aware 分块，HBM 流量从 O(n²) 降到 O(n²/M)。

## 5. 记录模板

| 并发 | TTFT p50 | TTFT p95 | TPOT p50 | tokens/s | req/s |
| --- | --- | --- | --- | --- | --- |
| 1 | 待填 | 待填 | 待填 | 待填 | 待填 |
| 8 | 待填 | 待填 | 待填 | 待填 | 待填 |
| 32 | 待填 | 待填 | 待填 | 待填 | 待填 |

> 纪律：只填**真实运行**的数据；未跑过的一律保留「待填 / NOT EXECUTED ON CUDA」。
