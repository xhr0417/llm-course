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
Retrieval / RAG         ← 下一批
   ↓
SFT / LoRA（第 17 + 26 章）
   ↓
FastAPI / Docker         ← 下一批
   ↓
Capstone 1：Eval Harness ← 第 27 章 ✅
   ↓
Capstone 2：RAG Service  ← 下一批
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
SFT / LoRA（Capstone 3） ← 下一批
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
Profiling（Capstone 4）   ← 下一批
   ↓
FlashAttention / Triton（第 19 章）
   ↓
Distributed Training（第 16 章）
   ↓
Inference Systems（第 20 章）
   ↓
vLLM / SGLang Benchmark（Capstone 4） ← 下一批
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

面对 26+ 章节不知道从哪开始？如果你还没有实习经历，按这条线走：

```
Python Engineering（25）
   ↓
PyTorch（11）
   ↓
Transformer（07）
   ↓
HuggingFace（26）
   ↓
LLM Evaluation（23）
   ↓
Retrieval / RAG（下一批）
   ↓
FastAPI / Docker（下一批）
   ↓
Capstone 1（第 27 章 ✅）/ Capstone 2（下一批）
   ↓
开始投递
```

之后再按方向分叉：

- **算法方向**：SFT / LoRA → Data Pipeline → 后训练（DPO/GRPO）→ 实验设计；
- **Infra 方向**：GPU → FlashAttention → Distributed → Inference → Profiling。

:::note 为什么是这个顺序
Python 工程与 HuggingFace 是所有岗位的**公共分母**：不会其中之一，后面的 RAG / SFT / 评测项目都做不出来。而 RAG 与 FastAPI 是应用类岗位面试中出现频率最高、又最容易在两周内做出作品的方向。
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

## 24.5 Checkpoint 体系

每一段路线结束后都有一个**检查点**。检查点不是选择题，而是一个可以给别人演示的最小产物：

| Checkpoint | 任务 | 通过标准 | 归属 |
| --- | --- | --- | --- |
| **A** | 写一个 Python CLI：读 JSONL、批量请求模型、保存结果、正确处理中断 | 能跑 + 有测试 + 异常路径不崩 | 第 25 章 ✅ 本批 |
| **B** | 加载 Qwen、批量 generate、算 logits/loss、做一个 LoRA | 有 base vs tuned 的对比数据 | 第 26 章 ✅ 本批 |
| **C** | 写 Eval Harness（adapter/task/parser/metric/report） | 能对两个模型产出可比较的报告 | 第 27 章 ✅ 本批 |
| **D** | 做 RAG + 评测（Recall@k / MRR / faithfulness） | retrieval 与 generation 指标分开报告 | Capstone 2 · 下一批 |
| **E** | 用 profiler 找瓶颈并写出 benchmark 报告 | 有 latency/memory 曲线与解释 | Capstone 4 · 下一批 |

## 24.6 本批已经交付的内容

| 章节 | 真实项目 | 已验证内容 |
| --- | --- | --- |
| **25 Python Engineering** | [`projects/log-analyzer/`](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer) | 14 个 pytest 通过；`analyze_logs` 对健康/发散日志的真实输出 |
| **26 HuggingFace** | [`projects/hf-mini-lab/`](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab) | Qwen2.5-0.5B-Instruct CPU 全程跑通：训练 loss 2.6364→1.3052；held-out loss 3.8168→3.6102；10 个测试通过 |
| **27 Capstone 1 · Eval Harness** | [`projects/llm-eval/`](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval) | 128 题真实评测（C3 55.0% / XCOPA 55.0% / QA F1 21.9%）；缓存二次运行 32.3s→0.0s；29 个测试用例通过 |

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
