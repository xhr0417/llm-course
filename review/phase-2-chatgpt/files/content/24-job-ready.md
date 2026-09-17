# 第 24 章 · 岗位查阅：从「会解释」到「能做」仍然要分级

:::intuition 这一章是给谁写的
如果你已经能用中文讲清楚 Attention、LoRA、KV Cache，但还分不清「读过 / 自己写过 / 跑过 / 能讲清」，这一章给一个**查阅用的能力地图**。它不是当前主线的作业清单。
:::

:::note 本章在当前主线中的位置
当前主线是「小模型学习实验室 → 技术声明核验助手 / 单 Agent → 算法或 Infra 专项」，入口在「我的学习」。本章以及下面的三条岗位路线只是**查阅分组**：帮你按应用 / 算法 / Infra 去翻教材。不要从这里走进六个旧项目目录，也不要把旧 Capstone 当必修。
:::

前 23 章解决「**懂**」：Understand → Build → Scale → Serve → Train & Align → Evaluate。第 25–31 章继续讲工程、HuggingFace、评测、检索、SFT 和推理原理，并保留当时的真实运行记录。那些记录不是现在要交的作业。

## 24.1 三条查阅路线

不同岗位要的能力不同。路线顺序、章节标题和岗位描述来自 `content/tracks.json`。卡片上的章节是推荐阅读顺序，不是「做完六个旧项目」。

本章的三条路线是 **Track A · AI 应用**、**Track B · 模型训练与算法**、**Track C · AI Infra**。

:::routes full
:::

:::note 路线阅读规则
路线卡片是查阅分组。点击某条路线后，「下一课」沿该分组前进；从「全部章节」进入时，按教材顺序翻页。当前主线任务始终以首页「我的学习」为准，不随路线切换。
:::

## 24.2 岗位能力矩阵

先看「哪些是必须」，再决定这个月读什么。这是技能地图，不是对你的评价，也不是旧作业打卡表。

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

## 24.3 第一次找 AI 实习：阅读顺序（不是旧项目顺序）

还没有实习经历时，可以从 **Track A · AI 应用开发** 的章节卡片往下读：Python 工程与 HuggingFace 是公共分母，评测与检索是应用岗高频话题。算法与 Infra 分叉也从同一份路线配置进入。

当前**动手任务**不在这条查阅线上：回到首页做 Attention 空文件练习。第 25–31 章里若仍出现历史仓库链接，一律当作可选对照，标注了「非当前作业」的才去打开。

## 24.4 四级标准（描述能力，不绑定旧 starter）

以后不要说「我看完了」。用四级标准自评——这是诚实描述，不是网站自动打分：

| 级别 | 含义 | 验证方式 |
| --- | --- | --- |
| **读过** | 读懂 | 能不看材料讲清直觉与关键公式 |
| **自己实现** | 本人写过核心代码 | 从空白文件写出可运行代码 |
| **验证通过** | 按声明做过检查 | 有运行输出或书面核对（含失败） |
| **能解释** | 不查资料讲清楚 | 能回答关键「为什么」 |

示例（FlashAttention，本课程当前状态）：

```
读过        ✅ （第 19 章）
自己实现    ✅ （第 19 章 Lab：分块 + online softmax）
在 CUDA 上跑过  ❌ （无 GPU 环境 → NOT EXECUTED ON CUDA）
能解释      ✅ （能在白板上推导 online softmax 修正因子）
```

网站目前只显示「阅读进度」和「继续上次位置」。已读不是已掌握。旧的 Guided Build 进度若还在浏览器里，含义不变，但那套步骤已经退出教学流程。

## 24.5 历史实验记录（不是 Checkpoint 作业）

第 25–31 章保留过一组真实运行数字。它们证明「当时在什么机器上跑出过什么」，**不是现在要交的旧检查点作业**。

| 章节 | 当时验证过什么 | 目录（可选参考，非当前作业） |
| --- | --- | --- |
| 25 Python 工程 | 日志 CLI 的实测输出；parser / stats / cli 分层 | [log-analyzer](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer) |
| 26 HuggingFace | Qwen2.5-0.5B CPU：train loss 2.6364→1.3052；held-out 3.8168→3.6102 | [hf-mini-lab](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab) |
| 27 评测系统 | 128 题：C3 55.0% / XCOPA 55.0% / QA F1 21.9%；缓存 32.3s→0.0s | [llm-eval](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval) |
| 28–29 检索与服务 | 841 chunks；22 查询 hybrid+rerank MRR 0.932；RAG 6 题检索 6/6 | [rag-service](https://github.com/xhr0417/llm-course/tree/main/projects/rag-service) |
| 30 SFT / LoRA | train 3.89→1.46；val 过拟合 best@60；QA F1 20.2%→24.0% | [sft-lora](https://github.com/xhr0417/llm-course/tree/main/projects/sft-lora) |
| 31 推理分析 | CPU：SDPA 快 2.7×；compile 反例；CUDA NOT EXECUTED | [inference-benchmark](https://github.com/xhr0417/llm-course/tree/main/projects/inference-benchmark) |

:::warning 数据纪律（对自己的实验同样适用）
只把**真实运行得到**的 loss / accuracy / latency / 显存写成「实验结果」。
- 没有 GPU：写 `NOT EXECUTED ON CUDA`；
- 没有 API key：写「接口已实现，未实测」；
- 教学模拟：标注 Teaching Simulation。

面试官见过太多「复现了 LLaMA 训练」但一问细节就露馅的简历。真实、可复现的小实验 > 夸张的大项目。
:::

:::quiz
一道判断题：你已经读完了第 19 章 FlashAttention 的全部内容，但对「这个能力到底算不算会」拿不准。用本课程的评估口径，最严谨的自我描述是？

A. 我掌握了 FlashAttention
B. 读过 + 自己实现 + 能解释，但 CUDA 上未跑过，已标注 NOT EXECUTED ON CUDA
C. 我没学过 FlashAttention
D. 等我有 GPU 再说，现在不写进简历

答案: B
解析: 四级标准的意义就是让「会」变得可验证、可诚实描述。A 夸大了「跑过」；C、D 又低估了已完成的部分。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 定位 | 第 0–23 章让你「懂」；第 25–31 章是工程教材与历史记录，不是旧作业清单 |
| 路线 | A 应用 / B 算法 / C Infra 是查阅分组，不是当前主线 |
| 当前动手 | 回到「我的学习」做 Attention；不要进六个旧项目 starter |
| 标准 | 读过 / 自己实现 / 验证通过 / 能解释，缺哪级标哪级 |
| 纪律 | 不伪造实验数据；没跑过就写 NOT EXECUTED |
:::

:::related
依赖 | 第 25 章 Python 工程, 第 26 章 HuggingFace, 第 23 章 Evaluation
用于 | 查阅岗位能力；当前主线仍从首页进入
:::
