> **本章定位**：第二批最重要的章节之一。目标不是「会用 vLLM」，而是回答：**为什么需要 serving system？** 学完你应该能解释：prefill/decode 为什么是两个性能阶段、continuous batching 与 PagedAttention 各自解决什么问题。

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测）
- 【Runnable on CUDA】需要 GPU（当前验证环境无 CUDA，标注 NOT EXECUTED）
- 【Skeleton】工程骨架：逻辑完整，需要自备环境
:::

## 20.1 先从一张图开始：Serving Pipeline

:::unfold 先懂直觉
一次「对话」在服务端要经过：排队 → 切词 → 调度 → 预填充（prefill）→ 逐字解码（decode）→ 采样 → 返回。Serving system 的全部工作，就是把这条流水线上的每个环节**同时服务很多请求**，并且在延迟与吞吐之间做取舍。
:::

```
Request
  ↓  Tokenizer          文本 → token ids
  ↓  Scheduler          排队 / 组批 / 分配 KV 空间
  ↓  Prefill            一次处理完整 prompt（大矩阵计算）
  ↓  KV Cache           每层缓存 K/V
  ↓  Decode             每次生成 1 个 token（循环）
  ↓  Sampler            temperature / top-p → 选出 token
  ↓  Detokenizer        拼回文本
Response
```

:::demo serving-pipeline 交互：点击每个阶段看它在做什么
:::

## 20.2 Prefill vs Decode：两个完全不同的性能阶段 ★

:::unfold 先懂直觉
**Prefill**：把整段 prompt 一次性喂进模型——序列长、矩阵大、并行度高，是「计算密集型」的大 GEMM。
**Decode**：每次只生成一个 token——序列长度是 1，但每一步都要读取全部历史 KV，是「带宽密集 + 串行依赖」。
两者对硬件的需求完全不同，现代 serving 的核心挑战就是把它们高效地混合调度。
:::

| | Prefill | Decode |
| --- | --- | --- |
| 输入 | 完整 prompt（S 个 token） | 1 个新 token（+ 历史 KV） |
| 主要矩阵形状 | $[S, d] \times [d, \cdot]$（大） | $[1, d] \times [d, \cdot]$（瘦长） |
| 并行度 | 高（序列维并行） | 低（每步串行依赖） |
| 瓶颈 | 常见为 **compute-bound** | 常见为 **memory-bandwidth-bound**（KV 读取） |
| 典型指标 | TTFT | ITL / TPOT |

:::demo prefill-decode 交互：切换看两个阶段的计算形态
切换 Prefill / Decode，观察输入形状、KV 读取量、瓶颈类型的变化。
:::

## 20.3 TTFT：Time To First Token

:::unfold 先懂直觉
用户发出请求到看到**第一个字**的时间。它包含：排队时间 + prefill 计算 + 采样。长 prompt 的 TTFT 会显著变大——这是用户「感知卡顿」的主要来源。
:::

```
Request → [queue] → [prefill + first decode] → First Token
         ↑ 调度决定     ↑ 与 prompt 长度近似成正比
```

## 20.4 ITL / TPOT：逐 token 延迟

:::unfold 先懂直觉
第一个字出来后，后面的字是**一个个**生成的：token1 → token2 → token3…… 相邻两个 token 的间隔叫 ITL（Inter-Token Latency），平均到每个输出 token 叫 TPOT。
:::

:::warning 为什么 decode 不能并行生成同一序列的未来 token
自回归依赖：生成 token t+1 需要 token t 作为输入。**同一序列的生成天然串行**——这就是 decode 阶段 GPU 利用率上不去（每步矩阵太瘦）的根本原因，也是 batching 存在的意义。
:::

## 20.5 Throughput vs Latency：serving 的核心取舍 ★

:::unfold 先懂直觉
批越大，GPU 越满，吞吐（tokens/s）越高；但每个请求要等更久才轮到处理，延迟变差。Serving system 的调度器就是在「一次服务多少人」和「每个人等多久」之间找平衡。
:::

:::demo serving-metrics 交互：Serving 指标模拟器（教学模型）
调整请求数 / prompt 长度 / 输出长度 / batch size / prefill 与 decode 速度，实时观察 TTFT、ITL、tokens/s 与 KV 显存占用的变化趋势。
:::

> ⚠️ 该模拟器是**教学模型**（简化假设、不是真实硬件 benchmark），用于建立「参数怎么影响指标」的直觉。

## 20.6 Static Batching：GPU 空位的浪费

:::unfold 先懂直觉
最朴素的组批：把同时到达的请求凑成一批，一起 prefill、一起 decode，直到**最长的那个**生成完才释放整批资源。
:::

```
Request A: 10 tokens
Request B: 100 tokens
Request C: 30 tokens
→ 固定批：B 还在生成时，A/C 已经结束但槽位仍被占用（空转）
```

:::demo batching-viz 交互：Static vs Continuous Batching
切换两种策略，逐步播放生成过程，观察 GPU 槽位的空转与利用率差别。
:::

## 20.7 Continuous Batching：批的「动态进出」★

:::unfold 先懂直觉
不等整批结束：**哪个请求生成完了，立刻把它移出、把等待队列里的新请求塞进来**。批的组成是流动的，GPU 槽位几乎不空转。
:::

这是 vLLM / SGLang 等现代 serving 系统最重要的调度思想之一：

- 每步 decode 后检查：谁完成了？释放它的资源（KV 块）；队列里有谁可以加入？
- 新请求可以立即开始 prefill（或与 decode 交错——见 chunked prefill）。

## 20.8 KV Cache 的系统视角

:::unfold 先懂直觉
第 10 章从模型角度讲了 KV Cache（缓存历史 K/V，避免前缀重算）。在 serving 里，KV Cache 升级成一个**资源管理问题**：同时服务 N 个请求，每个请求都要一块可持续增长的 KV 空间。
:::

$$
\text{KV 总量} \approx 2 \times L \times H_{kv} \times d_{head} \times \text{batch} \times S_{total} \times \text{bytes}
$$

| 特性 | 影响 |
| --- | --- |
| 随序列**动态增长** | 无法预知每个请求要多少（生成多久不知道） |
| 生命周期与请求绑定 | 请求结束才释放 |
| 体量巨大 | 长上下文 + 高并发时，KV 显存常常先于权重成为瓶颈 |

## 20.9 KV Cache 碎片化

:::unfold 先懂直觉
如果给每个请求预分配一整块连续的显存，问题立刻出现：A 要 0.8GB、B 要 0.3GB、C 要 1.2GB——**申请大小未知、生命周期不同**，很快产生大量无法利用的碎片。
:::

```
连续内存布局（碎片化示意）：
[ A（已占用） ][ 空洞 ][ B（已占用） ][ 空洞 ][ C … ]
→ 新请求 D 需要连续 1GB：虽然总空闲够，但没有连续块 → 失败或浪费预留
```

## 20.10 PagedAttention：从操作系统借来的思路 ★

:::unfold 先懂直觉
操作系统解决「内存碎片」的经典方案是**虚拟内存分页**：进程看到连续地址，物理内存却不连续。PagedAttention 把 KV Cache 也切成固定大小的 **page/block**（如 16 个 token 一页），逻辑上连续、物理上可以散落。
:::

```
逻辑视图（请求看到的）：  block0 → block1 → block2 → …
物理视图（显存里的）：    block 在池子里任意位置分配
→ 按需分配：生成到哪、分配到哪；请求结束 → 整块回收
```

| 收益 | 说明 |
| --- | --- |
| 减少碎片 | 固定大小的块可被任意复用 |
| 按需增长 | 不再预分配「最大长度」 |
| 内存共享 | 相同前缀的块可以共享（→ Prefix Cache） |

:::demo paged-attention 交互：分页分配演示
切换「连续分配」与「分页分配」，观察碎片率与「能否放下新请求」的差别。
:::

:::note 类比不是巧合
PagedAttention（vLLM 的核心机制之一）就是显式借用 OS 虚拟内存/分页的设计哲学。想通「为什么 OS 要用分页」，就理解了它在 serving 中要解决什么。
:::

## 20.11 Prefix Cache：复用相同的开头

:::unfold 先懂直觉
很多请求共享同一段前缀：同一个 system prompt、同一篇长文档（问答场景）、同一个 few-shot 示例。前缀的 KV 完全一样——算一次、缓存起来、后续请求直接复用。
:::

:::demo prefix-cache 交互：cache hit / miss
切换「无缓存 / 有前缀缓存」，看相同前缀的请求是否需要重新 prefill。
:::

| 命中条件 | 说明 |
| --- | --- |
| 前缀 token 完全一致 | 通常按块匹配（paged blocks） |
| 多请求共享 | 引用计数 + 写时复制（copy-on-write） |

## 20.12 Chunked Prefill：把长 prompt 切开

:::unfold 先懂直觉
一个 8K token 的 prompt 如果一次性 prefill，会长时间占住 GPU，让其他正在 decode 的请求「卡住」——ITL 抖动。**Chunked prefill** 把它切成几个小块，与 decode 交错执行：`prefill chunk → decode → prefill chunk → decode …`，改善延迟公平性。
:::

| 策略 | TTFT | 其他人的 ITL |
| --- | --- | --- |
| 一次性 prefill | 最短 | 被长请求阻塞，抖动大 |
| Chunked prefill | 略长 | 更稳定（交错执行） |

## 20.13 Speculative Decoding：用小模型「试稿」

:::unfold 先懂直觉
Decode 每步只算一个 token，太浪费。投机解码让一个**小模型（draft）**先连续猜出 k 个 token，然后**大模型（target）一次前向并行验证**这 k 个位置：接受正确的、拒绝错误的。因为验证是并行的，只要接受率够高，等效速度提升。
:::

```
draft:  猜 A B C D
target: 并行打分 → A B C 接受（D 拒绝）
→ 一次 target 前向推进了 3 个 token
```

:::note 为什么输出分布仍然正确
验证阶段的接受/拒绝是**按概率比**进行的（拒绝时回退到 target 自己的采样），数学上保证最终输出分布与「完全用 target 逐步采样」一致。本课程只建立直觉；完整证明见原始论文。
:::

:::demo spec-decoding 交互：draft 与 verify
逐步播放：draft 猜 4 个 → target 验证 → 接受前缀、拒绝并重采样。可以调接受率看平均推进速度。
:::

## 20.14 CUDA Graph：省掉 launch 开销

:::unfold 先懂直觉
Decode 每步是一串**很多小 kernel**（每层好几个）。每个 kernel 的 CPU 启动（launch）都有固定开销；当 kernel 又小又多时，GPU 在等 CPU 发指令。**CUDA Graph** 把一串 kernel 的调用序列「录下来」，之后一键回放，跳过逐条 launch 的开销。
:::

| | 常规 | CUDA Graph |
| --- | --- | --- |
| 每步 | 逐个 launch kernel | replay 预录制的图 |
| 适合 | 形状多变 | **固定形状的重复循环（decode 典型）** |

## 20.15 Quantization：Why it matters for serving

:::unfold 先懂直觉
推理的瓶颈常是显存容量与带宽。把权重从 FP16/BF16 降到 INT8/FP8/INT4：权重显存减半/再减半，每步读取的字节数下降，decode 直接受益——代价是精度与实现复杂度。
:::

```
FP16/BF16 → INT8 / FP8 → INT4
权重显存 ↓    带宽需求 ↓    质量风险 ↑
```

> 本节只建立连接：量化是 serving 的关键优化方向之一。完整的量化理论与工程（校准、per-channel、KV 量化等）适合作为后续专题。

## 20.16 vLLM：它到底解决什么问题

:::unfold 先懂直觉
vLLM 不是「一个更快的模型」，而是一个**推理引擎/服务系统**。它的价值在于把前面几节的问题系统性地解决：
:::

| 问题 | vLLM 的答案 |
| --- | --- |
| KV 显存碎片 | **PagedAttention**（分页化的 KV 管理） |
| 批利用率 | **Continuous batching**（动态进出） |
| 相同前缀重复算 | **前缀缓存**（分页块共享） |
| 高并发调度 | 调度器 + 分块 prefill 等策略 |
| 分布式推理 | 多卡并行（张量并行等） |

> 不要把它当「pip install 教程」——真正要理解的是：**它为什么需要这些机制**（就是本章前面 15 节）。

## 20.17 SGLang：Serving / Runtime 的另一个方向

SGLang 关注的方向包括：

- **前缀复用**（RadixAttention：用前缀树组织缓存，提升多轮/共享前缀场景的命中率）；
- **结构化生成**（约束解码：按 JSON/正则等约束采样，适合 agent/工具调用场景）；
- **调度与运行时优化**。

> 不比较「框架谁快」——不同系统的优化重心不同，且版本迭代很快。学完本章你应该能看懂它们的 README 在说什么。

## 20.18 生态对照：FlashInfer 与 TensorRT-LLM

| 项目 | 定位 | 一句话 |
| --- | --- | --- |
| **FlashInfer** | 推理 kernel 库 | attention/采样等 serving 核心 kernel 的高性能实现，位于 kernel 层 |
| **TensorRT-LLM** | NVIDIA 的推理栈 | 编译式优化 + 融合 kernel + engine 构建 |

**层次关系**（重要）：

```
你的应用
  ↓
Serving runtime（vLLM / SGLang / TensorRT-LLM runtime）
  ↓
Kernel 库（cuBLAS / FlashAttention / FlashInfer / Triton kernels）
  ↓
GPU
```

前面第 19 章的 kernel 知识在这里闭环：**serving 系统的下限由 kernel 与调度的质量决定**。

## 20.19 综合练习：三步定位性能问题

:::unfold 先懂直觉
给你一个「变慢了」的推理服务，按顺序问三个问题：
:::

| 步骤 | 问题 | 可能结论 |
| --- | --- | --- |
| ① 看指标 | TTFT 大还是 ITL 大？ | TTFT 大 → prefill/排队问题；ITL 大 → decode/带宽问题 |
| ② 看资源 | KV 显存是否接近上限？ | 是 → 并发被 KV 卡住（分页/量化/换更长序列策略） |
| ③ 看瓶颈 | GPU 利用率和带宽读数？ | 双低 → 调度/launch 问题（batching、CUDA Graph） |

:::fold 课堂案例（教学模拟）
**案例 1**：短 prompt 很快，长 prompt TTFT 暴涨 → prefill 计算随长度增长；考虑 chunked prefill 改善公平性，或限制最大 prompt。
**案例 2**：并发一高，吞吐不升反降，还出现请求失败 → KV 显存耗尽（OOM）；分页管理 + 限制并发 + 量化。
**案例 3**：GPU 利用率只有 20%，ITL 却很大 → decode 每步太瘦（batch 太小 / launch 开销）；continuous batching + CUDA Graph。
:::

:::key 本章必须记住
| 概念 | 一句话 |
| --- | --- |
| Prefill | 一次算完 prompt：大 GEMM、compute-bound，决定 TTFT |
| Decode | 每步 1 token：瘦矩阵 + 读 KV，带宽受限，决定 ITL |
| Continuous batching | 批动态进出，消除 static batching 的空转 |
| KV 碎片 | 变长 + 生命周期不同 → 连续分配必碎 |
| PagedAttention | 分页化 KV：逻辑连续、物理分块，按需增长与共享 |
| Prefix Cache | 相同前缀的 KV 复用 |
| Chunked Prefill | 长 prompt 切开与 decode 交错，稳定 ITL |
| Speculative Decoding | 小模型试稿 + 大模型并行验证 |
| CUDA Graph | 录制重复的 kernel 序列，省 launch 开销 |
| vLLM / SGLang | 把上述机制工程化的 serving 系统 |
:::

:::quiz
为什么 decode 阶段通常比 prefill 更「吃带宽」？

A. decode 的计算量更大
B. decode 每步只算 1 个 token（矩阵很瘦），但要读取全部历史 KV，计算单元常闲着等数据
C. decode 不需要 GPU
D. decode 的 batch 更大

答案: B
解析: prefill 是大矩阵计算（compute-bound）；decode 每步输入只有 1 个 token，主要成本是 KV 的读取（memory-bandwidth-bound），GPU 计算单元利用率低。
:::

:::quiz
PagedAttention 主要解决什么问题？

A. 提高模型精度
B. KV Cache 的显存碎片与按需增长问题（借用 OS 分页思想）
C. 加快 tokenizer
D. 减少模型参数

答案: B
解析: 变长序列 + 不同生命周期导致连续分配产生碎片；分页化后固定大小的块可任意复用、按需分配、支持前缀共享（copy-on-write）。
:::

:::quiz
Continuous batching 相比 static batching 的核心优势是？

A. 模型变小
B. 请求完成后立即腾出槽位，新请求随时加入，GPU 空转大幅减少
C. 不需要 KV Cache
D. 不需要调度器

答案: B
解析: static batching 要等整批最慢的请求结束才释放资源；continuous batching 让批「流动」起来，每个 decode 步后检查完成/加入，显著提升吞吐。
:::

:::related
依赖 | 第 10 章 KV Cache, 第 15 章 GPU 带宽, 第 19 章 FlashAttention（prefill 加速）
用于 | 生产部署, 推理优化, 后续 advanced serving 专题
:::
