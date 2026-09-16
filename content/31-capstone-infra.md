# 第 31 章 · Capstone 4：GPU / Inference Profiling Lab（AI Infra Track）

:::intuition 一句话
Infra 岗的面试从「你用过什么工具」开始，但你真正要证明的是：**给你一个慢的系统，你能定位到哪一行代码、为什么慢、怎么证明改了之后更快**。这一章交付一整套可复现的 profiling / benchmark 工具箱。
:::

**项目位置**：[`projects/inference-benchmark/`](https://github.com/xhr0417/llm-course/tree/main/projects/inference-benchmark)
**运行状态**：CPU 实验全部实测 ✅（latency/理论 footprint/子进程 RSS 三口径分离）；**CUDA / vLLM 部分 NOT EXECUTED ON CUDA** ⚠️（命令与模板齐全）。

:::warning AI Infra Track 说明
本章属于 **AI Infra / ML Systems 方向**（Track C）。Track A/B 的同学了解即可——面试问到 profiling 与 serving 指标时，至少能讲清原理与指标含义。
:::

## 31.1 工具链与验收

| 工具 | 回答什么问题 | 本机状态 |
| --- | --- | --- |
| `torch.profiler` | 哪个算子花了多少时间？ | ✅ CPU 实测 |
| CUDA Event / `synchronize` | 这段代码真实跑多久？ | ✅ 代码含 CUDA 路径；本机走 CPU 回退 |
| Attention benchmark | naive vs SDPA 差多少？ | ✅ CPU 实测（延迟 + 理论 footprint + 子进程 RSS） |
| `torch.compile` | 编译到底有没有用？ | ✅ CPU 实测 |
| vLLM + serving bench | TTFT/TPOT/吞吐随并发怎么变？ | ⚠️ 客户端已实测（mock）；vLLM 服务端 NOT EXECUTED |

## 31.2 计时：Infra 的第一课

```python
# ❌ 这样测到的是「下发命令的时间」，不是「计算的时间」
t0 = time.time(); kernel(); dt = time.time() - t0

# ✅ CPU：同步计时即可；GPU：用 CUDA Event + synchronize
start = torch.cuda.Event(enable_timing=True); end = torch.cuda.Event(enable_timing=True)
torch.cuda.synchronize(); start.record()
kernel(); end.record(); torch.cuda.synchronize()
dt_ms = start.elapsed_time(end)
```

CUDA 调用是异步的——`kernel()` 返回时 GPU 可能还没开始算。**不 synchronize 的 benchmark 全部无效**，这是面试中的高频送命题。

## 31.3 Profiler：把「慢」变成一张可读的表

`projects/inference-benchmark/src/ibench/profiler_lab.py` 用 `torch.profiler` 抓 Top 算子。真实输出（naive attention, seq=512, CPU）：

| 算子 | 占比 | 调用次数 |
| --- | --- | --- |
| `aten::bmm` | **66.4%** | 6 |
| `aten::_softmax` | **23.3%** | 3 |
| `aten::div` | 7.2% | 3 |
| `aten::select` | 0.6% | 72 |

结论立刻可读：**矩阵乘 + softmax = 90% 的时间**。优化方向不需要猜。

:::note 面试怎么讲 profiler
「我用 torch.profiler 抓了算子表，发现 bmm 占 66%、softmax 占 23%。bmm 的优化空间在 dtype/并行，softmax 的优化就是 FlashAttention 的动机（fuse + 不物化中间矩阵）。」——比「我学过 FlashAttention」有力得多。
:::

## 31.4 Attention benchmark：naive vs SDPA（真实测量）

同一份输入（batch=1, heads=4, head_dim=64, fp32），只换实现：

| seq_len | naive | SDPA | 加速比 | naive 理论中间张量 |
| --- | --- | --- | --- | --- |
| 128 | 0.23 ms | 0.09 ms | 2.6× | 0.5 MB |
| 512 | 2.35 ms | 0.77 ms | 3.1× | 8.0 MB |
| 1024 | 5.77 ms | 2.02 ms | 2.9× | 32.0 MB |
| 2048 | **19.57 ms** | **7.20 ms** | **2.7×** | **128.0 MB** |

两个可验证的事实：

1. **伸缩性**：naive 1024→2048 延迟 ×3.39（纯 attention 理论 O(n²) ⇒ 接近 ×4），SDPA ×3.56；
2. **两种内存口径，互相印证**：
   - 「理论中间张量」= naive 的 scores+probs 同时存活的估算 `2×B×H×S²×bytes`（seq=2048 时 **128.0 MB**），SDPA 不物化 S×S（估计 0）；
   - 「进程 peak RSS」用**独立子进程**测量（`python -m ibench.mem_worker`，含 Python/PyTorch 运行时开销）：seq=2048 时 sdpa **185.4 MB** vs naive **310.3 MB**，差值 ≈ 125 MB ≈ 理论 footprint。

:::warning 口径纪律（本轮修正）
`resource.getrusage().ru_maxrss` 是**整个进程生命周期的 high-water mark**，不能拿「跑前跑后相减」当作单个 case 的 peak memory。本轮已修正：
- CPU 只报告 **实测 latency + 理论中间张量 footprint**，外加**独立子进程**的进程 peak RSS（含运行时开销，明确标注）；
- CUDA 显存必须用 `reset_peak_memory_stats → max_memory_allocated`，且区分 allocated / reserved——本机无 GPU，**NOT EXECUTED ON CUDA**；
- 旧的「37× 省内存」表述已删除（它来自不可靠的 ru_maxrss delta）。
:::

⚠️ 这是 **CPU 数字**：GPU 上 SDPA 会 dispatch 到 FlashAttention 类后端，通常更快，但必须**在你的目标硬件上用本仓库脚本实测**后再引用（`--device cuda` 会在无 CUDA 时直接报错退出，不静默回退）。

## 31.5 torch.compile：不是「一开就快」

真实结果（CPU，256×256 MLP 融合场景）：

```
eager 0.249 ms → compiled 0.345 ms（0.72×，更慢）
首次编译 3.3s；数值一致 ✅
```

为什么更慢：小算子 + CPU 后端 + 编译与调度开销超过收益。正确姿势：

- **compile 是实验结论，不是信仰**：改动前跑 benchmark，改动后跑同一 benchmark；
- GPU 大模型 + 固定 shape 常见正收益（kernel 融合、减少 launch 开销）——待你在 CUDA 环境验证；
- 动态 shape 场景注意 `dynamic=True` 与重编译代价。

## 31.6 Serving benchmark：四个数字讲清 serving

`scripts/run_serving_bench.py` 是对任何 OpenAI-compatible 服务的**流式**压测客户端（vLLM / Ollama / 网关通用）：

| 指标 | 含义 | 观测方式 |
| --- | --- | --- |
| TTFT | 首 token 延迟 | SSE 第一个 content chunk 的时间戳 |
| TPOT | 每 token 时间 | (总时长 - TTFT) / (tokens - 1) |
| tokens/s | 生成吞吐 | 总 token / 总时长 |
| req/s | 请求吞吐 | 完成请求数 / 总时长 |

本机自检（mock SSE 服务端，非真实模型）：

```
并发 1：TTFT p50 4.4ms   TPOT 25.9ms   tok/s 40.9
并发 4：TTFT p50 851ms   TPOT 25.8ms   tok/s 42.2   ← 单线程服务端排队
```

并发 4 时 TPOT 不变、TTFT 暴涨——服务端吞吐瓶颈导致的**排队**，不是计算变慢。这个区分在真实排查中非常重要。

真实 vLLM 实验：见 [`docs/vllm_runbook.md`](https://github.com/xhr0417/llm-course/tree/main/projects/inference-benchmark/docs/vllm_runbook.md)（含命令、四问与记录模板）。**没有 GPU 就不填数字**。

## 31.7 四个必答分析问题

1. **为什么 batch ↑ → 吞吐 ↑ 但延迟可能 ↑？**
   批量共享权重读取（吞吐↑），每步计算量与排队增加（延迟↑）——用本仓库 serving bench 在不同并发下验证。

2. **为什么长 prompt → TTFT 通常 ↑？**
   dense Transformer 的 prefill 同时包含随 S 近似线性增长的投影/MLP 项与随 S² 增长的 attention 项；在具体模型、硬件与长度区间内常观察到近似线性的 wall-clock 区间，但**不要把 prefill 复杂度简化成 O(S)**。实验：固定输出长度、扫 prompt 长度。

3. **为什么 output length 影响 decode 总时长？**
   上下文长度变化不大的区间内，decode 单步成本可近似看作稳定（TPOT 近似不随 output length 变化），总时长正比输出长度；从更大尺度看，单步 attention / KV 读取成本会随当前 context length 增长。

4. **naive vs SDPA 差距为什么随 seq_len 拉大？**
   naive 物化完整 `[B,H,S,S]` 中间矩阵（本机 seq=2048 理论 128 MB）；SDPA/FlashAttention 通过 tiling + online softmax 避免把完整 attention 矩阵写回 HBM、显著减少 HBM↔on-chip memory traffic。严格的 I/O 复杂度分析留给第 19 章；本章用延迟与两种内存口径做量化验证。

## 31.8 报告的诚实标准

`results/analysis.md` 由脚本自动生成，包含三部分：

1. **真实数据**：表格与 CSV（CPU 实测）；
2. **GPU 预期行为（待验证）**：理论预期明确标注「需在目标硬件验证」；
3. **未执行清单**：CUDA / vLLM / Triton 逐条列出。

:::warning NOT EXECUTED 不是扣分项
「本机无 GPU，CUDA 部分标注 NOT EXECUTED，命令与模板齐全，拿到 GPU 机器当天可跑」——这是**可核查的诚实**。
相反，「我在 A100 上测了 FlashAttention 快 3 倍」但拿不出脚本与环境——面试官两三个追问就会露馅。
:::

## 31.9 面试复盘：Infra / 系统

1. 为什么 CUDA 计时必须 synchronize？不等会测到什么？
2. `torch.profiler` 报告里你会先看哪几列？发现 bmm 占比 66% 后你怎么优化？
3. naive attention 和 SDPA 的本质差异是什么？「理论中间张量」和「进程 peak RSS」两种内存口径分别说明什么？
4. 为什么 seq_len 翻倍延迟约 ×4？什么时候会偏离这个规律？
5. torch.compile 什么时候有用、什么时候有害？怎么验证？
6. TTFT 和 TPOT 分别由什么决定？并发上去之后哪个先恶化？
7. 「吞吐上升但用户变慢」的现象怎么解释、怎么定位？

:::quiz
你在 A100 上 benchmark 两个 attention 实现，发现 numbers 每次波动很大（±50%），且数值普遍偏小。最可能的原因是？

A. A100 性能不稳定
B. 没有 synchronize / 没有 warmup，测到的是异步下发时间与首次编译开销
C. Python 版本太旧
D. 需要把 batch 调到 1024

答案: B
解析: 异步执行 + 未 warmup（cudnn/cublas 首次调用会做算法选择与编译）是 benchmark 波动的两大经典原因。标准做法：warmup 若干次 + CUDA Event 计时 + 多次取均值/中位数；波动大时报告 p50/p95 而不是单次值。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 计时 | CUDA 异步：必须 Event + synchronize |
| Profiler | 先看算子占比表，再谈优化 |
| Attention | naive vs SDPA：实测 2.7× 延迟；内存用理论 footprint + 子进程 RSS 双口径 |
| compile | 是实验结论不是信仰（实测 0.72× 更慢） |
| Serving | TTFT/TPOT/tok/s/req/s；队列 vs 计算要分清 |
| 纪律 | 没 GPU 就标注 NOT EXECUTED，命令与模板留全 |
:::

:::related
依赖 | 第 15 章 GPU/Roofline, 第 19 章 FlashAttention, 第 20 章 Inference Systems
用于 | AI Infra / ML Systems / 推理框架实习面试, Capstone 5（后续：Triton/CUDA 深化）
:::
