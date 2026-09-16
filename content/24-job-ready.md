# 第 24 章 · Job-Ready Track：从「会解释」到「能做出来」

:::intuition 这一章是给谁写的
如果你已经能用中文讲清楚 Attention、LoRA、KV Cache，但**没有跑过一条真正完整的工程链路**、没有 GitHub 上的可运行项目、面试官问「你做过什么」时只能回答「我学过课程」——这一章为你而写。
:::

前 23 章的 Knowledge Track 解决的是「**懂**」：Understand → Build → Scale → Serve → Train & Align → Evaluate。

从本章开始的 Job-Ready Track 解决的是「**能做**」：

```
懂一个概念  →  写成代码  →  跑起来  →  测出来  →  debug  →  写报告  →  放进 GitHub  →  面试讲清楚
```

:::warning 这不是又一批「知识章」
Job-Ready Track 不新增理论主题（不写 MoE 大章、不写 Agent 大章）。它的每一章都绑定：
- 一个**真实可运行的项目**（`projects/` 目录，含 tests）；
- 一份**真实运行记录**（跑出来的 loss / 通过数 / 报错与修复）；
- 一组**面试复盘问题**（你必须能回答，而不是背过）。
:::

## 24.1 目标岗位与三条路线

不同岗位要的能力不同、优先级不同。先选路线，再补能力，不要平均用力。

:::unfold Track A · AI 应用 / 大模型应用开发（实习岗最多）
**目标岗位**：大模型应用开发实习生、AI 应用研发实习生、LLM Engineer Intern、AI 平台研发、大模型评测实习生。

```
Python Engineering（第 25 章）
   ↓
PyTorch（第 11 章）
   ↓
HuggingFace（第 26 章）
   ↓
Transformer（第 7 章）
   ↓
LLM Evaluation（第 23 章）
   ↓
Retrieval / RAG（第 28 章 ✅）
   ↓
SFT / LoRA（第 17 + 26 章）
   ↓
FastAPI / Docker（第 29 章 ✅）
   ↓
Capstone 1：Eval Harness ← 第 27 章 ✅
   ↓
Capstone 2：RAG Service  ← 第 29 章 ✅
   ↓
开始投递
```
:::

:::unfold Track B · 大模型算法实习
**目标岗位**：大模型算法实习生、机器学习算法实习生、模型训练 / 后训练实习。

```
Transformer（第 7 章）
   ↓
Build Small LLM（第 12-13 章）
   ↓
Data Pipeline（第 18 章）
   ↓
Pretraining（第 21 章）
   ↓
HuggingFace（第 26 章）
   ↓
SFT / LoRA（第 30 章 ✅）
   ↓
DPO / GRPO（第 22 章）
   ↓
Evaluation（第 23 章 + Capstone 1）
   ↓
Experiment Design（Capstone 3 报告）
```
:::

:::unfold Track C · AI Infra / ML Systems
**目标岗位**：AI Infra 实习生、ML Systems 实习生、大模型推理框架实习生、性能工程。

```
PyTorch（第 11 章）
   ↓
GPU Fundamentals（第 15 章）
   ↓
Profiling（第 31 章 ✅）
   ↓
FlashAttention / Triton（第 19 章）
   ↓
Distributed Training（第 16 章）
   ↓
Inference Systems（第 20 章）
   ↓
vLLM / SGLang Benchmark（第 31 章，需 CUDA）
   ↓
C++ / CUDA（后续专题）
```

⚠️ Infra Lab（profiler、benchmark）需要 CUDA 环境。**没有 GPU 时如实写 `NOT EXECUTED ON CUDA`**——招聘方见过太多造假，如实标注反而是加分项。
:::

## 24.2 岗位能力矩阵

先看「哪些是必须」，再决定这个月学什么：

| 能力 | 应用研发 | 算法 | 评测 | AI 平台 | AI Infra |
| --- | --- | --- | --- | --- | --- |
| Python 工程 | **必须** | **必须** | **必须** | **必须** | **必须** |
| PyTorch | 重要 | **必须** | 重要 | 重要 | **必须** |
| HuggingFace | **必须** | **必须** | **必须** | 重要 | 重要 |
| RAG | **必须** | 加分 | 加分 | 重要 | 了解 |
| Evaluation | 重要 | **必须** | **必须** | 重要 | 重要 |
| SFT / LoRA | 加分 | **必须** | 加分 | 了解 | 了解 |
| FastAPI / Docker | **必须** | 加分 | 加分 | **必须** | 重要 |
| GPU Profiling | 了解 | 加分 | 了解 | 加分 | **必须** |
| Distributed | 了解 | 加分 | 了解 | 加分 | **必须** |
| CUDA / C++ | 非必须 | 加分 | 非必须 | 加分 | 后期必须 |

这是**技能矩阵**，不是对任何人的评价：它只回答「这个岗位要什么」，不回答「你适合什么」——那取决于你想做什么。

## 24.3 第一次找 AI 实习：推荐顺序

面对 30+ 章节不知道从哪开始？如果你还没有实习经历，按这条线走：

```
Python Engineering（25）
  Learn → Guided Lab（log-analyzer starter · 10 步）→ Checkpoint A
   ↓
PyTorch（11）· Transformer（07）
   ↓
HuggingFace（26）
  Learn → Guided Lab（hf-mini-lab starter · 13 步）→ Checkpoint B
   ↓
LLM Evaluation（23）
   ↓
Eval Harness（27）
  Guided Capstone（llm-eval starter · 15 步）→ Checkpoint C
   ↓
Retrieval / RAG（28）+ FastAPI / Docker（29）
  Guided Capstone（starter 迁移中：先做现有 Lab + 参考实现）→ Checkpoint D
   ↓
开始投递
```

之后再按方向分叉：

- **算法方向**：SFT / LoRA（30）→ Data Pipeline（18）→ 后训练 DPO/GRPO（22）→ 实验设计；
- **Infra 方向**：GPU（15）→ FlashAttention（19）→ Distributed（16）→ Inference（20）→ Profiling（31）。

:::note 为什么是这个顺序
Python 工程与 HuggingFace 是所有岗位的**公共分母**：不会其中之一，后面的 RAG / SFT / 评测项目都做不出来。而 RAG 与 FastAPI 是应用类岗位面试中出现频率最高、又最容易在两周内做出作品的方向。

注意看每段路线里的两种动词：**Learn**（读课程、建立理解）与 **Guided Lab**（下载 starter、亲手写代码、跑测试、过 Checkpoint）。
「读完」和「做出来」是两件不同的事——本 Track 用两个独立进度条分别记录。
:::

## 24.4 四级学习标准（本 Track 的验收方式）

以后不要说「我看完了」。每章/每个项目用四级标准自评：

| 级别 | 含义 | 验证方式 |
| --- | --- | --- |
| **Learned** | 读懂 | 能不看材料讲清直觉与关键公式 |
| **Implemented** | 自己实现 | 从空白文件写出可运行代码 |
| **Ran** | 实际跑过 | 有运行输出的截图/日志（含失败与修复） |
| **Explained** | 不查资料讲清楚 | 能回答本章「面试复盘」全部问题 |

示例（FlashAttention，本课程当前状态）：

```
Learned      ✅ （第 19 章）
Implemented  ✅ （第 19 章 Lab：分块 + online softmax）
Ran on CUDA  ❌ （无 GPU 环境 → NOT EXECUTED ON CUDA）
Explained    ✅ （能在白板上推导 online softmax 修正因子）
```

网站侧边栏的进度已升级为 **阅读 / Lab / 项目** 三个独立状态——「读完 Markdown」只点亮第一个。不要因为看完了就以为自己掌握了。

**Guided Build 章节（25 / 26 / 27）的四级标准怎么记录**：

| 级别 | 对应动作 | 网站如何记录 |
| --- | --- | --- |
| **Learned** | 读完章节正文 | 点亮「已读完」 |
| **Implemented** | starter 的测试全部从红变绿 | Guided Build 进度面板自动计算（0 步 / 部分 / 全部） |
| **Ran** | 在本地真实运行过（CLI / 实验） | 手动 self-check 按钮（网站无法验证你的本地环境） |
| **Explained** | 不看资料回答每步复盘问题 | 手动 self-check 按钮 |

进度保存在你自己浏览器的 localStorage 里，不上传。**打开 Solution 不会自动算完成**——只有你真的在本地跑通，才有资格点「我已在本地通过」。

## 24.5 Checkpoint 体系

每一段路线结束后都有一个**检查点**。检查点不是选择题，而是一个可以给别人演示的最小产物：

| Checkpoint | 任务 | 通过标准 | Guided Build（starter） | 归属 |
| --- | --- | --- | --- | --- |
| **A** | 写一个 Python CLI：解析日志、统计指标、正确处理中断 | 能跑 + 测试全绿 + 异常路径不崩 | ✅ `log-analyzer/starter`（10 步 / 41 测试） | 第 25 章 |
| **B** | 加载 Qwen、批量 generate、算 logits/loss、做一个 LoRA | 有 base vs tuned 的对比数据 | ✅ `hf-mini-lab/starter`（13 步 / 38 测试） | 第 26 章 |
| **C** | 写 Eval Harness（adapter/task/parser/metric/report） | 能对两个模型产出可比较的报告 | ✅ `llm-eval/starter`（15 步 / 79 测试） | 第 27 章 |
| **D** | 做 RAG + 评测（Recall@k / MRR / faithfulness） | retrieval 与 generation 指标分开报告 | 🔄 迁移中（先做现有 Lab + 参考实现） | 第 28-29 章 |
| **E** | 用 profiler 找瓶颈并写出 benchmark 报告 | 有 latency/memory 曲线与解释 | 🔄 迁移中（先做现有 Lab + 参考实现） | 第 31 章 |

「✅」只代表 starter 已随课程交付并被真实运行验证；「🔄 迁移中」是诚实标注——RAG / SFT / Infra 三套 Guided Build 会在下一轮用同一套模板迁移，当前版本请先用现有 Lab + Reference Solution 完成 Checkpoint。

## 24.6 每个项目的三个入口：Learn / Guided Build / Reference

从这一版开始，每个 Job-Ready 项目都有**三层产物**。它们不是三个重复的链接，而是三种不同的学习动作：

| 项目 | Learn（建立理解） | Guided Build（亲手做） | Reference（对照完整工程） |
| --- | --- | --- | --- |
| **log-analyzer** · Python 工程 | [第 25 章 · Python Engineering](#/python-engineering) | [Guided Build · starter（10 步 / 41 测试）](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer/starter) | [projects/log-analyzer](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer) |
| **hf-mini-lab** · HuggingFace | [第 26 章 · HuggingFace](#/huggingface) | [Guided Build · starter（13 步 / 38 测试）](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab/starter) | [projects/hf-mini-lab](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab) |
| **llm-eval** · Eval Harness | [第 27 章 · Capstone 1](#/capstone-eval) | [Guided Build · starter（15 步 / 79 测试）](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval/starter) | [projects/llm-eval](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval) |
| **rag-service** · RAG 服务 | [第 28 章](#/rag-engineering) + [第 29 章](#/capstone-rag) | 🔄 迁移中（先用现有 Lab） | [projects/rag-service](https://github.com/xhr0417/llm-course/tree/main/projects/rag-service) |
| **sft-lora** · SFT 实验 | [第 30 章](#/capstone-sft) | 🔄 迁移中（先用现有 Lab） | [projects/sft-lora](https://github.com/xhr0417/llm-course/tree/main/projects/sft-lora) |
| **inference-benchmark** · Profiling | [第 31 章](#/capstone-infra) | 🔄 迁移中（先用现有 Lab） | [projects/inference-benchmark](https://github.com/xhr0417/llm-course/tree/main/projects/inference-benchmark) |

**怎么用这三个入口**（顺序不能反）：

```
先读 Learn 章节（或边做边查参考手册）
   ↓
下载 starter，运行 pytest —— 看到满屏 failed
   ↓
按章节里的 Step 一步一步实现，测试逐组变绿
   ↓
（失败 → 看 Hint → 定位 → 修复 → 再跑）
   ↓
全绿 + 真实运行一次 → 课程页面的 Guided Build 进度条
   ↓
最后才打开 Reference Solution，对照设计差异
```

:::warning 不要打开 Reference 再回头做 starter
抄一遍参考实现会让「Implemented」和「Ran」变成假的。评测/面试时这类「做过」会在追问下原形毕露。
Reference Solution 的正确用法是：**做完之后对照**，回答「我的实现和它差在哪、为什么」。
:::

## 24.7 交付状态总览（真实状态，逐项标注）

| 章节 | 真实项目 | Guided Build | 已验证内容 |
| --- | --- | --- | --- |
| **25 Python Engineering** | [`projects/log-analyzer/`](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer) | ✅ starter（初始 41 failed → 全绿 41 passed） | 14 个 pytest 通过；对健康/发散日志的真实输出 |
| **26 HuggingFace** | [`projects/hf-mini-lab/`](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab) | ✅ starter（初始 38 failed → 全绿 38 passed） | Qwen2.5-0.5B-Instruct CPU 全程跑通：训练 loss 2.6364→1.3052；held-out loss 3.8168→3.6102；11 个测试通过 |
| **27 Capstone 1 · Eval Harness** | [`projects/llm-eval/`](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval) | ✅ starter（初始 77 failed → 全绿 79 passed） | 128 题真实评测（C3 55.0% / XCOPA 55.0% / QA F1 21.9%）；缓存二次运行 32.3s→0.0s；32 个测试用例通过 |
| **28-29 Retrieval/RAG + Capstone 2** | [`projects/rag-service/`](https://github.com/xhr0417/llm-course/tree/main/projects/rag-service) | 🔄 下一轮迁移 | 841 chunks 课程语料；22 条标注查询：BM25 100%、dense 86.4%、hybrid+rerank MRR 0.932；RAG 6 题检索 6/6 命中；39 个测试用例通过 |
| **30 Capstone 3 · SFT/LoRA** | [`projects/sft-lora/`](https://github.com/xhr0417/llm-course/tree/main/projects/sft-lora) | 🔄 下一轮迁移 | 真实 SFT：train loss 3.89→1.46；val loss 过拟合曲线（best@60）；harness QA F1 20.2%→24.0%；15 个测试 |
| **31 Capstone 4 · Profiling Lab** | [`projects/inference-benchmark/`](https://github.com/xhr0417/llm-course/tree/main/projects/inference-benchmark) | 🔄 下一轮迁移 | CPU 实测：SDPA 快 2.7×、理论中间张量 128MB→0、子进程 RSS 差值≈125MB；compile 反例 0.76×；算子表 bmm 72%；15 个测试；CUDA NOT EXECUTED |

:::warning 数据纪律（对你自己的项目同样适用）
只把**真实运行得到**的 loss / accuracy / latency / 显存写成「实验结果」。
- 没有 GPU：写 `NOT EXECUTED ON CUDA`；
- 没有 API key：写「接口已实现，未实测」；
- 教学模拟：标注 Teaching Simulation。

面试官见过太多「复现了 LLaMA 训练」但一问细节就露馅的简历。真实、可复现的小项目 > 夸张的大项目。
:::

:::quiz
一道判断题：你已经读完了第 19 章 FlashAttention 的全部内容，但对「这个能力到底算不算会」拿不准。用本课程的评估口径，最严谨的自我描述是？

A. 我掌握了 FlashAttention
B. Learned + Implemented + Explained，但 Ran 未完成（无 CUDA 环境），已在项目里标注 NOT EXECUTED ON CUDA
C. 我没学过 FlashAttention
D. 等我有 GPU 再说，现在不写进简历

答案: B
解析: 四级标准的意义就是让「会」变得可验证、可诚实描述：读过（Learned）、写过（Implemented）、能讲清（Explained）都是真实能力，缺哪级就如实标注。A 夸大了「Ran」维度；C、D 又低估了已完成的 3/4。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 定位 | Knowledge Track 让你「懂」，Job-Ready Track 让你「能做」 |
| 路线 | A 应用 / B 算法 / C Infra——先选路线，再补能力 |
| 顺序 | 无实习经历：Python → PyTorch → Transformer → HF → 评测 → RAG → 上线 |
| 标准 | Learned / Implemented / Ran / Explained，缺哪级标哪级 |
| 纪律 | 不伪造实验数据；没跑过就写 NOT EXECUTED |
:::

:::related
依赖 | 第 25 章 Python 工程, 第 26 章 HuggingFace, 第 23 章 Evaluation
用于 | 简历项目, 实习面试, 后续 Capstone 1-4
:::
