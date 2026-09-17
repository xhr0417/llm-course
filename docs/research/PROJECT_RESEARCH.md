# 截图项目与老师仓库：调研及学习取舍

归档说明：调研截止 2026-09-17。**92 个截图项目是参考资料，不是待完成任务，不计入主线完成率。** 不要为这些工具分别创建主项目卡片。优先使用：SpongebobLite、CS336 部分作业（模型学习）；Hello-Agents（主题教材）；CHEF（核验任务参考）；mini-swe-agent（最小循环完成后的源码学习）；Pydantic AI、Inspect AI（按项目需要引入）；TRL 或 vLLM（后期专项工具）。网站产品需求见 [`../PERSONAL_LEARNING_OS.md`](../PERSONAL_LEARNING_OS.md)。

调研截止：2026-09-17。覆盖截图 15 类、92 个项目，以及老师 Harris-Xie 主页的 6 个仓库。额外补充的 mini-swe-agent、vLLM、SGLang、Triton 等不计入 92 项。

这是为徐鸿儒的一年学习计划做的选材：当前 Python 基础薄弱，正在学 Transformer，87M 模型项目主要跟跑；每天 3–4 小时，几千元租卡预算，约一年后准备研发实习，长期考虑大模型算法或 AI Infra。

## 结论与阅读方式

适合优先做深的是：老师 Lite 与当前 87M 项目的对应关系、评测、普通检索、单 Agent 执行、SFT，以及一套推理服务的性能实验。主项目建议采用有版本和证据的技术声明核验，CHEF 提供任务设计参考。

一阶段选择一个主要框架、一个评测框架、一个观测平台。这里的“暂缓”说明与你当前目标的优先级低，不代表项目没价值或行业没前景。星数、截图中“入门/实战”的标签以及项目方性能宣传均未作为排名依据。

**核验范围：**所有列出的项目核对了官方入口或仓库简介；优先候选与状态发生变化的项目阅读了 README 对应部分；老师 Lite/Pro 另读了部分源码。没有对全部仓库进行源码审计、安装、性能复测或训练。各表明确区分层级：A/R 为相关 README 阅读，B/H 为官方入口与简介初筛。未给单独层级的后训练表均为 README/官方文档核验。旧版本教程、依赖、数据许可和硬件需求在实际采用前还要核对。

## 15 类覆盖索引

| 类别 | 截图项数 | 你的默认安排 |
|---|---:|---|
| Agent 入门框架 | 7 | 手写循环后主选 Pydantic AI；LangGraph 按状态恢复需求选学 |
| 工具调用/MCP | 5 | 函数/API 先行；官方 SDK 做一个工具适配 |
| RAG/解析 | 8 | 普通检索基线；复杂文档需要时选一个解析器 |
| 记忆/上下文 | 5 | 自己做简单状态/摘要/检索，再决定是否用库 |
| 多智能体 | 6 | 单 Agent 基线完成后最多一个协作对照 |
| 低代码/编排 | 6 | Dify/Coze 可体验一个，不当源码主课 |
| Coding Agent | 6 | 选 mini-swe-agent 作为小源码参考，其余按问题查阅 |
| Research Agent | 4 | 检索核验项目相关时选一个比较 |
| Browser/GUI | 5 | 当前后置；不是所有 Agent 都需控制浏览器 |
| 评测/观测 | 8 | 自写 scorer/JSONL → Inspect AI/Langfuse |
| 综合应用 | 4 | 展示入口或架构参考 |
| 语音 | 7 | 后半年可选一次短实验，替换其他选修 |
| 具身/机器人 | 7 | 明确转向或导师课题后再学 |
| 后训练/RL | 8 | TRL/SFT 主线；RL 有条件地选一套 |
| 安全/护栏 | 6 | 工具边界和数据权限融入主项目，框架按需 |
| **截图合计** | **92** | **每项逐条建议见下文** |

文档先给老师仓库的评价，再按主题汇总全部截图项目；没有给每个仓库编造质量分数。链接为官方来源，主分支可能继续变化。

---

# 老师主页的六个仓库

核验日期：2026-09-17。官方 GitHub 元数据核对六项；Lite 阅读 README、model.py、pretrain.py 与目录；Pro 阅读 README、目录、配置和 evaluator；CHEF 阅读上游 README 与原论文。未安装、训练、复现指标或完整审计。以下是对你的学习适配判断。

先纠正一个理解：主页六个项目中只有三个被 GitHub 标记为 fork。`fork=false` 只是仓库关系，不证明所有代码完全原创；fork 也不能证明维护者实际采用过哪个方法。

| 仓库 | GitHub 关系 | 用途与建议 |
|---|---|---|
| [SpongebobLite](https://github.com/Harris-Xie/SpongebobLite) | 非 fork | **现在优先。** README 明确是 Pro 学习版，约 33M，集中在 model/pretrain/sft/generate 四个文件。用于对照你手写的 Transformer，再完成缩小版训练。 |
| [SpongeBob-Pro](https://github.com/Harris-Xie/SpongeBob-Pro) | 非 fork | **第 2–3 月分模块读。** 包含数据、预训练、SFT、GRPO、C3/XCOPA 评测；README 只有标题，不适合作为可自学的完整课程。不要把存在某个训练脚本等同已验证训练效果。 |
| [Harris-s-lab](https://github.com/Harris-Xie/Harris-s-lab) | 非 fork | README 信息很少，元数据语言为 JavaScript。现有证据不足以判断具体教学价值；与你近期目标关联不明确，暂不安排。 |
| [3.founds](https://github.com/Harris-Xie/3.founds) | fork 自 robbkong/3.founds | 基金定投微信小程序，偏小程序/应用开发。当前不纳入模型或 Infra 主线。 |
| [oclint](https://github.com/Harris-Xie/oclint) | fork 自 oclint/oclint | C/C++/Objective-C 静态分析工具。编译器或代码分析专项可参考；学 AI Infra 不需要先学这个项目。 |
| [CHEF](https://github.com/Harris-Xie/CHEF) | fork 自 THU-BPM/CHEF | **第 3 月选用任务与数据设计。** 中文证据事实核验，能连接检索、评测、Agent 与后训练；建议主要读上游和论文，不盲目复刻旧环境。 |

## Lite 的具体价值与边界

本次查看版本：[092ef7f 的源码](https://github.com/Harris-Xie/SpongebobLite/tree/092ef7f9a5e0580b6dd817d5965e732b749d6d1e)。模型实现含 RMSNorm、RoPE、GQA、SwiGLU、因果注意力，以及分开的 prefill/decode 和 KV cache。这让它能贯穿你最初的模型学习与后续推理实验。[model.py](https://github.com/Harris-Xie/SpongebobLite/blob/092ef7f9a5e0580b6dd817d5965e732b749d6d1e/model.py)

建议阅读顺序：配置和张量形状 → attention → FFN/残差 → forward/loss → 数据与训练 → SFT → generate → cache。先自己写一个实现，再对照；能用输入输出和测试解释差异，才算理解。

教学代码仍需要你补工程练习：预训练脚本依赖外部 bin/meta 数据，默认 CUDA 与 BF16；读取 memmap 后又转 NumPy 数组，会把数据复制进内存；看到的是 epoch 权重保存，没有完整验证循环与恢复优化器/调度器状态的训练续跑流程。目录未见完整测试套件。这些都是合理的学习任务，不是“运行就得到一个成熟训练系统”的承诺。[pretrain.py](https://github.com/Harris-Xie/SpongebobLite/blob/092ef7f9a5e0580b6dd817d5965e732b749d6d1e/pretrain.py)

具体产出：你自己的最小实现、逐模块对照说明、因果 mask 与 label shift 验证、小样本过拟合、独立验证集、完整 checkpoint、缓存与非缓存输出对照。先用更小配置调试，保留原 tokenizer 也可以，不急着训练新 tokenizer。

## Pro 的用法

本次查看版本：[5cb56cb 的目录](https://github.com/Harris-Xie/SpongeBob-Pro/tree/5cb56cbfabaa0cf3703df6c07a19e2fd100ed3a1)。把它当作第二层材料：将自己已经理解的模块映射到 model、dataset、train、benchmark。优先明确标签对齐、SFT mask、评测取分和保存/恢复；DDP、混合精度和 GRPO 随对应基础建立再读。

这个方向与你简历中的 87M 项目相符，但本次没有核验你的实际训练配置、运行日志及其与 Pro 的对应关系，不能据此证明你完成了该仓库所有功能。

## CHEF 为什么适合做个人项目的任务来源

CHEF 是 NAACL 2022 的中文事实核验数据集，研究检索证据与结论判断；论文介绍了约一万条真实声明及证据标注。年份较早，不妨碍学习证据质量、检索误差和分类评测。[原论文](https://aclanthology.org/2022.naacl-main.246/)

它有两个适合你的用途：先研究“给定证据是否支持声明”的受控任务，再研究“从固定语料找证据并作出判断”。两个任务应分别报告，不能把拿到标注证据的结果说成端到端搜索能力。你还可以另建一个技术文档声明集，例如版本变化、函数行为、模型配置等，保留文档版本和页码/段落，形成你自己能持续维护的评测。

上游提供 Joint 与 Pipeline 等实现，环境与下载方式较旧。本次未验证外部数据链接可用性、数据再分发许可或训练复现；实际使用前查看文件与标签定义。公开旧基准可能出现在模型预训练数据中，因此保留它做可比实验，同时建立按来源/时间隔离的新任务测试集，不能只凭 CHEF 分数断言泛化能力。[上游 README](https://github.com/THU-BPM/CHEF)

这里的特色来自你持续积累的任务、标注、失败分析与实验。选中 CHEF 本身不构成创新，也不保证论文结果。
# Agent 框架、MCP、记忆与多智能体筛选

核验日期：2026-09-17。截图共 23 项。A＝已读官方 README 对应段落；B＝已核官方仓库简介，细节、版本与质量未独立核验。所有学习优先级是针对你的判断；没有运行项目或审计源码。

建议：先自己实现单 Agent 循环，再选 Pydantic AI 作为唯一应用框架，结合 MCP 官方 Python SDK。LangGraph 留到确实需要持久状态和中断恢复时。记忆库、多智能体框架不同时展开。每个选学项目控制在一个实验问题内。

| 项目 | 用途与对你的学习建议 | 核验级别／来源 |
|---|---|---|
| LangChain | Agent 工程生态；按集成需要查用，不学完整框架大全。 | B／[仓库](https://github.com/langchain-ai/langchain) |
| smolagents | 支持以代码表达动作；手写循环后选读一次，理解与 JSON 工具调用的区别。 | A／[README](https://github.com/huggingface/smolagents#readme) |
| OpenAI Agents SDK | 轻量多 Agent 工作流；可替代主框架，不与其他框架同时精学。 | B／[仓库](https://github.com/openai/openai-agents-python) |
| Pydantic AI | **主线推荐**：工具参数和结构化输出类型校验；能与 Python 类型、异常和测试一起练。类型正确不保证事实正确。 | A／[README](https://github.com/pydantic/pydantic-ai#readme) |
| Agno | Agent 平台构建、运行与管理；了解定位，暂缓。 | B／[仓库](https://github.com/agno-agi/agno) |
| LangGraph | 持久执行、状态、中断与恢复；第 4–6 月按项目需求选学，不要求先学完整 LangChain。 | A／[README](https://github.com/langchain-ai/langgraph#readme) |
| Google ADK | Python Agent 构建、评测和部署；候选替代框架，当前不展开。 | B／[仓库](https://github.com/google/adk-python) |
| awesome-mcp-servers | 服务器目录；找工具时查阅，不作为逐个完成的课程。 | B／[仓库](https://github.com/punkpeye/awesome-mcp-servers) |
| 官方 MCP servers | 教育性参考实现；选一个看输入、输出和错误处理，官方明确不是生产完备方案。 | A／[README](https://github.com/modelcontextprotocol/servers#readme) |
| MCP Python SDK | **主线**：做自己的工具 server/client；当前 README 为 v2 稳定线，旧教程需注意版本与迁移。 | A／[README](https://github.com/modelcontextprotocol/python-sdk#readme) |
| Composio | 工具连接、认证、搜索和执行环境；有外部业务集成需求再学。 | B／[仓库](https://github.com/ComposioHQ/composio) |
| mcp-agent | 通过 MCP 组合工作流；官方 SDK 熟悉后选读一个流程，非必修。 | B／[仓库](https://github.com/lastmile-ai/mcp-agent) |
| Mem0 | 持久记忆层；第 4–6 月可与无记忆、摘要、检索基线比较。README 的托管平台分数不能直接视为开源 SDK 效果。 | A／[README](https://github.com/mem0ai/mem0#readme) |
| Letta | 有状态 Agent；当前源码已迁至 letta-code，旧 V1 server 在 archive 分支。看记忆思想，勿照旧安装教程。 | A／[迁移说明](https://github.com/letta-ai/letta#readme) |
| Cognee | 持久记忆与知识图谱；只有普通检索出现明确不足时再比较。 | B／[仓库](https://github.com/topoteretes/cognee) |
| MemOS | 记忆管理、混合检索与技能复用；作为后期候选，性能主张未复现。 | B／[仓库](https://github.com/MemTensor/MemOS) |
| Zep | 托管上下文服务；Graphiti 是开源时序图谱框架，两者不可等同。普通检索不足时再考虑。 | A／[Zep](https://github.com/getzep/zep)、[Graphiti 的区分说明](https://github.com/getzep/graphiti#graphiti-and-zep) |
| CrewAI | 角色分工的多 Agent；单 Agent 有可靠基线后，最多做一次双 Agent 对照。 | B／[仓库](https://github.com/crewAIInc/crewAI) |
| Swarm | 教育项目，已由 Agents SDK 替代；只作 handoff 和循环的历史阅读，不做新项目主框架。 | A／[替代说明](https://github.com/openai/swarm#readme) |
| AutoGen | 已进入维护模式，无新功能；官方建议新用户 Microsoft Agent Framework。当前暂缓。 | A／[维护说明](https://github.com/microsoft/autogen#readme) |
| CAMEL | 多 Agent 研究框架；有明确协作实验时选用，当前了解即可。 | B／[仓库](https://github.com/camel-ai/camel) |
| MetaGPT | 软件公司式多 Agent；读一条任务交接流程即可，不复刻完整产品。 | B／[仓库](https://github.com/FoundationAgents/MetaGPT) |
| ChatDev | 当前为 2.0 通用零代码编排；截图“虚拟软件公司”对应 1.0 历史分支。了解范式即可。 | A／[README](https://github.com/OpenBMB/ChatDev#readme) |

主线验收：两三个类型明确的工具；记录每步输入、输出、错误、耗时；设最大轮数；工具失败可恢复；在固定任务集上比较单次调用、固定工作流和 Agent。随后再决定是否需要记忆、图编排或多 Agent。上述基础能力比完成 23 个框架教程更有迁移价值。
# 截图项目核查：检索、评测与安全（22 项）

核查日：2026-09-17。针对 Python 较弱、正在实现 Transformer、每天 3–4 小时、约一年后申请 AI 研发实习的学习者。以下时点与优先级是学习建议，不是项目官方结论。

核验层级：A＝本次读取官方 README 正文/状态声明；B＝本次访问官方仓库确认项目入口及简述，用途细分仍主要据截图定位，未逐项审读 README；均未安装运行、未做完整源码或安全审计。链接为官方入口，可能随时间重定向；不以截图星数判断质量。

## 先纳入主线的能力

先完成普通检索：切分、元数据、BM25、向量检索、混合检索、精排与引用。能分别解释检索错、证据不足、生成错以后，再考虑图谱与多模态。基础评测应从第一份项目开始；第 3–5 月再接框架。优先掌握一个评测框架（建议 Inspect AI）和一个观测工具（建议 Langfuse），其他工具保留为备选。

## 全量取舍表

| 项目与官方入口 | 解决什么问题 | 对你的时间与深度 | 核验 |
|---|---|---|---|
| [Docling](https://github.com/docling-project/docling) | PDF、Office 等文档解析，保留结构并导出 Markdown/JSON | 第 3–4 月；与 MinerU 二选一，检查 10 份真实文档的阅读顺序、表格、页码 | A |
| [LlamaIndex](https://github.com/run-llama/llama_index) | 数据接入、检索和 Agent 应用工具集 | 第 4 月可选；先手写普通 RAG，再读检索接口；不必通读生态 | A |
| [MinerU](https://github.com/opendatalab/MinerU) | 复杂文档解析为模型可用文本/结构 | 第 3–4 月；只有当前解析器的表格/公式错误成为瓶颈才对照测试 | B |
| [LightRAG](https://github.com/HKUDS/LightRAG) | 图结构与检索结合的 RAG | 第 6 月以后选修；与普通混合检索做相同任务、相同预算对照 | A |
| [Microsoft GraphRAG](https://github.com/microsoft/graphrag) | 从文本形成结构化图信息用于问答 | 读方法即可；不作为新项目默认依赖或贡献目标，已进入维护模式 | A |
| [Haystack](https://github.com/deepset-ai/haystack) | 模块化检索、路由、生成与 Agent pipeline | 第 4–6 月备选；与 LlamaIndex 不必同时学，重在显式数据流 | B |
| [RAGFlow](https://github.com/infiniflow/ragflow) | 文档处理、RAG 与 Agent 整合产品 | 后期体验与架构参考；搭起来不等于掌握检索算法 | B |
| [RAG-Anything](https://github.com/HKUDS/RAG-Anything) | 建在 LightRAG 上的多模态文档 RAG | 后期选修；与 LightRAG 合并安排，避免重复学两套工程 | A |
| [promptfoo](https://github.com/promptfoo/promptfoo) | 声明式测试、模型/提示比较及红队测试 | 第 4–5 月备选；若偏 Python 评测实现，可先用 Inspect AI | B |
| [DeepEval](https://github.com/confident-ai/deepeval) | 用测试方式评价 LLM 应用 | 第 4–5 月备选；适合接回归测试，不必与 Inspect 全量并修 | B |
| [Langfuse](https://github.com/langfuse/langfuse) | 调用轨迹、提示版本、数据集与评估 | 第 3–5 月优先选一个；能追踪一次任务的模型/工具调用、错误与延迟 | A |
| [Ragas](https://github.com/vibrantlabsai/ragas) | LLM 应用指标、测试生成与反馈流程 | 第 4 月选学 RAG 指标；先有人工标注，核查 judge 的误判再扩量 | A |
| [Arize Phoenix](https://github.com/Arize-ai/phoenix) | LLM 调用观测与评估 | Langfuse 的备选；选定以后持续使用，不重复搭观测平台 | B |
| [AgentOps](https://github.com/AgentOps-AI/agentops) | 记录 Agent、工具与任务执行的 spans | 备选；理解 trace/span 与错误定位即可 | B |
| [Opik](https://github.com/comet-ml/opik) | LLM/Agent 观测、实验和评估 | 备选；只有现有工具不能满足需求才迁移 | B |
| [Inspect AI](https://github.com/UKGovernmentBEIS/inspect_ai) | 支持工具、多轮对话、模型评分的 Python 评测框架 | 第 3–5 月优先；写自己的任务与评分器，保留逐样本结果和执行轨迹 | A |
| [Guardrails AI](https://github.com/guardrails-ai/guardrails) | 输入输出验证与约束 | 第 4–6 月按需选学；先会结构化输出校验与工具参数验证 | B |
| [LLM Guard](https://github.com/protectai/llm-guard) | 输入输出内容扫描与数据泄露等检测 | 只作历史实现参考；已归档，不作为一年主线依赖 | A |
| [Microsoft Presidio](https://github.com/data-privacy-stack/presidio) | 敏感信息识别、脱敏与匿名化 | 数据涉及个人信息时按需使用；不是所有 Agent 的先修课 | B |
| [NVIDIA NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) | 为对话系统添加可编程约束 | 第 6 月以后按具体需求了解；先把权限和调用边界写进自己的系统 | B |
| [garak](https://github.com/NVIDIA/garak) | 探测 LLM 泄露、注入、幻觉等失败模式 | 项目可用后跑小范围专项测试；分析具体失败，不只汇报扫描总分 | A |
| [Meta PurpleLlama](https://github.com/meta-llama/PurpleLlama) | LLM 安全评估与防护工具集合 | 安全方向选修；只选与你任务相关的一个组件/评测 | B |

## 三项必须修正的截图印象

1. **LLM Guard 已归档。** 官方页面注明归档日为 2026-07-09，README 说明项目及关联 Hugging Face 模型不再开发维护。仍可研究设计，不宜作为面向未来一年的默认技术选型。[官方状态](https://github.com/protectai/llm-guard)
2. **GraphRAG 处于维护模式。** 官方 README 表示不接受新 PR、不实现新功能，按需做 bug 和依赖修复；它仍是图检索方法参考，并不因此使图检索问题失去价值。学习应先证明普通 RAG 在目标任务上的不足。[官方声明](https://github.com/microsoft/graphrag)
3. **LightRAG 与 RAG-Anything 高度相关。** RAG-Anything 明确建立在 LightRAG 上；LightRAG 的 2026.05 更新还声明合并 RagAnything，多模态解析通过 MinerU/Docling 服务完成。不要把它们当作两个独立必修项目。[LightRAG](https://github.com/HKUDS/LightRAG)、[RAG-Anything](https://github.com/HKUDS/RAG-Anything)

另一个时点变化：LlamaIndex README 当前说明公司主要重心转向 LlamaParse、LiteParse 与文档解析/抽取评测，OSS 工具集仍可用。这不代表库废弃，但“RAG 入门首选”不是无需复核的永久结论。[官方说明](https://github.com/run-llama/llama_index)

## 应写进学习计划的评测要求

以下是针对你的实验设计建议，不是从项目宣传语得出的可靠性保证：

- 先手工标注 30–50 个开发任务；任务规模随项目增长，最终报告单列冻结测试集，开发期间不据它调参。
- 检索评价看 Recall@k、MRR 等；回答评价另看事实正确、引用是否支持结论、能否在证据不足时说明不足。命中正确文档不等于回答正确。
- Agent 评价终态任务完成、工具参数、失败恢复、成本与时间；重复几次观察随机波动。不要把轨迹长度或调用次数当能力分数。
- 使用 Ragas/LLM judge 前，先与人工标注比较，检查误判样本；记录评分模型、提示和版本。指标名称里的 faithfulness 不等于事实真值。
- 对照至少包含普通脚本/单次调用、普通 RAG、增加 Agent 的版本。图谱、多轮、记忆等每次只增加一个要素，并记录多出的 token、索引和查询耗时。
- 观测平台负责展示和定位，不会替你设计有区分度的任务与评分标准。先保存 JSONL 轨迹也能开始学习。

## 一年内的最小资源组合

模型基础阶段不必学以上 22 个工具；继续当前 Transformer 与 Python。应用阶段选一个解析器、手写普通检索基线、Inspect AI、自建 JSONL 记录后接 Langfuse；Ragas 只补需要的指标。后半年用实验决定是否加入 LightRAG 或安全工具。将节省的时间用于数据清洗、Python 调试、SQL/HTTP、实验复现，以及下一阶段的后训练或推理性能分析。
# 截图中的 Agent 产品与项目：25 项筛选

调研日期：2026-09-17。对象：Python 基础较弱、正在手写 Transformer、已有 87M 模型复现经历，每天 3–4 小时，一年后准备研发实习。

核验层级：**R**＝阅读官方 README 相关段落；**H**＝访问官方仓库主页、核对项目简介，细节主要依据截图初筛。所有项目均未运行，未进行源码审计；星数、营销性能和生产成熟度不作为排名依据。以下建议是个人学习优先级，不是项目质量排名。

| 类别 | 项目与官方来源 | 层级 | 用途与适配建议 |
|---|---|---|---|
| 编排 | [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | R | 当前重心为构建、部署和运行工作流的平台，原始版本留在 classic。了解一次即可，不列为源码主线。 |
| 编排 | [Langflow](https://github.com/langflow-ai/langflow) | H | 可视化 Agent/工作流搭建。仅在需要快速演示时选用；拖拽完成不能代替 Python 实现能力。 |
| 编排 | [Flowise](https://github.com/FlowiseAI/Flowise) | H | 可视化搭建 Agent。与其他低代码工具功能重叠，一年计划不必单独学习。 |
| 编排 | [n8n](https://github.com/n8n-io/n8n) | H | 工作流自动化与外部服务连接。业务自动化选修；不作为大模型算法或 GPU 系统主课。 |
| 编排 | [Dify](https://github.com/langgenius/dify) | H | Agent 工作流、RAG 与模型/工具接入。六个编排平台中可选它做一次产品体验，之后回到代码和评测。 |
| 编排 | [Coze Studio](https://github.com/coze-dev/coze-studio) | H | 可视化 Agent 开发、调试和部署。岗位要求或业务需要时学，与 Dify 二选一即可。 |
| Coding | [Open Interpreter](https://github.com/openinterpreter/openinterpreter) | R | 旧 open-interpreter 地址已重定向；当前 README 描述为基于 Codex 的低成本模型 Coding Agent，并提到 Rust harness。截图中的旧 Python 入门定位不能照搬，暂缓精读。 |
| Coding | [Aider](https://github.com/Aider-AI/aider) | R | 终端结对编程，官方说明代码地图、Git、测试集成。第 5–8 月按问题选读 repo map 或编辑反馈流程，不要求通读。 |
| Coding | [gptme](https://github.com/gptme/gptme) | R | 终端 Agent，配本地代码、终端与浏览工具。可作备选源码案例；与 mini-swe-agent 只精读一个。 |
| Coding | [Cline](https://github.com/cline/cline) | R | 当前包含 IDE、CLI、桌面与 SDK。适合之后研究工具权限、产品状态管理；范围大，不作 Python 入门仓库。 |
| Coding | [SWE-agent](https://github.com/SWE-agent/SWE-agent) | R | 官方明确主要开发转向 [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent)，建议新使用者选后者。用户完成最小 tool loop 后，优先精读 mini 的执行循环与轨迹；官方“100 行”指核心思路，不能当整个仓库规模。 |
| Coding | [OpenHands](https://github.com/OpenHands/OpenHands) | R | 当前主仓库为 Agent Canvas；Python agent、工具、对话、工作区、事件与 Server 在 [software-agent-sdk](https://github.com/OpenHands/software-agent-sdk)。进阶时读 SDK 的任务生命周期和执行环境，勿从大前端入手。 |
| Research | [GPT Researcher](https://github.com/assafelovic/gpt-researcher) | H | 自动研究与报告生成。只有主项目选“证据检索/核验”时作为比较对象；验证引用与结论，不以报告长度衡量效果。 |
| Research | [STORM](https://github.com/stanford-oval/storm) | R | 围绕主题组织知识并生成带引用的长报告。后期学习问题分解与资料组织，适合论文方法分析；非必修开发框架。 |
| Research | [Open Deep Research](https://github.com/langchain-ai/open_deep_research) | R | LangChain 官方研究 Agent 参考实现。主项目需要研究型工作流时选一个模块对照，不和另外三个研究框架同时通读。 |
| Research | [DeerFlow](https://github.com/bytedance/deer-flow) | R | README 明确 2.0 完全重写，1.x 保留旧 Deep Research；现在是含子 Agent、记忆、沙箱和 skills 的长任务 harness。第 6 月以后按问题查上下文或恢复机制，不能照旧教程直接套当前主分支。 |
| GUI | [browser-use](https://github.com/browser-use/browser-use) | H | 浏览器 Agent。后期确有网页任务再选，先完成工具 API 和固定环境评测，避免同时引入页面变化与模型随机性。 |
| GUI | [OmniParser](https://github.com/microsoft/OmniParser) | H | 截图解析与 GUI 元素感知组件；它本身不是完整 Agent。走多模态 GUI 方向再学。 |
| GUI | [Skyvern](https://github.com/Skyvern-AI/skyvern) | H | 浏览器工作流自动化。与 browser-use 按任务选一个，当前主线后置。 |
| GUI | [OSWorld](https://github.com/xlang-ai/OSWorld) | R | 真实计算机任务评测环境与 benchmark，不是搭 Agent 的基础框架。环境/虚拟机准备有额外成本；选定 GUI 专项后使用。 |
| GUI | [OpenAdapt](https://github.com/OpenAdaptAI/OpenAdapt) | H | 当前主页描述示范 GUI 任务到可检查程序的流程，相关编译器在 openadapt-flow。截图的泛化回放定位仅作历史线索；现阶段后置。 |
| 综合产品 | [Open WebUI](https://github.com/open-webui/open-webui) | H | 模型交互界面。可用作自己模型服务的展示入口，不需为学习目标重写整个产品。 |
| 综合产品 | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) | H | 本地优先 Agent/知识应用。体验文档到问答路径即可，不把部署一次包装成算法贡献。 |
| 综合产品 | [Khoj](https://github.com/khoj-ai/khoj) | H | 文档/联网问答、自定义 Agent 与自动化。与研究和 RAG 项目重叠，暂不单列课程。 |
| 综合产品 | [Onyx](https://github.com/onyx-dot-app/onyx) | H | 企业 AI 平台。岗位涉及权限与企业检索后再选读连接器和数据访问边界，当前不通读。 |

## 对个人路线的实际影响

1. **只选一个小 Agent 精读。** 建议先独立写最小模型—工具—反馈循环，再读 mini-swe-agent；gptme 作为替换项。能画执行过程、修改终止条件、保存与回放一次失败，才算完成。
2. **大型平台按问题查阅。** Dify/Coze 体验一个；Aider、OpenHands SDK、DeerFlow 只在自己项目出现上下文、编辑、隔离或恢复问题时选模块参考。
3. **跨框架能力更值得保留一年。** 工具 schema、状态和轨迹、错误恢复、上下文预算、任务成功判定、延迟与成本，都能迁移；无需为每个名字建必修章节。
4. **不要同时做 Coding、Research、GUI 三种 Agent。** 先选一个可核验场景。若最终主项目偏训练实验分析，就以日志/配置读取和确定性计算工具为核心；若选事实核验，则以检索、证据与结论判定为核心。
5. **完成源码阅读不等于项目完成。** 先固定任务集和基线，再记录失败类型，改一个变量，比较成功率、调用次数与耗时；前端只需展示输入、执行记录、结果和依据。

## 重要核验依据

- SWE-agent README 的 Warning 段直接推荐 mini-swe-agent，属于项目方迁移建议，不是根据 star 判断。来源：https://github.com/SWE-agent/SWE-agent
- Open Interpreter 当前 README 的 Harness Emulation 段说明与 Codex 的关系；开头写明 Rust 重新实现 harness。这里只陈述仓库说明，不推断所有源码语言占比。来源：https://github.com/openinterpreter/openinterpreter
- OpenHands README 的 Repository boundaries 表明确划分 Canvas 与 Python SDK/server。来源：https://github.com/OpenHands/OpenHands
- DeerFlow README 的 2.0 Note 明确全量重写、旧实现位于 1.x、活跃开发转向 2.0。来源：https://github.com/bytedance/deer-flow

以上均为网页阅读核验，不包含安装、运行、性能复测或逐文件代码审计。H 层级项目的功能细节在实际采用前需进一步读对应版本文档。
# 语音与具身项目：14 项取舍

核验日期：2026-09-17。B＝核对官方仓库元数据/简介；A＝另读官方 README 相关段落。均未运行，未验证训练成本、效果或部署。下面判断针对当前 Python 薄弱、每天 3–4 小时、准备 LLM 研发实习的你，不是对这些方向发展前景的否定。

| 类别 | 项目与官方来源 | 核验 | 对你的建议 |
|---|---|---|---|
| 语音 | [Vocode](https://github.com/vocodedev/vocode-core) | B | 模块化语音 Agent。需要专门练 ASR/LLM/TTS 与流式交互，暂缓。 |
| 语音 | [Pipecat](https://github.com/pipecat-ai/pipecat) | A | Python 实时语音与多模态框架。若后半年对实时服务产生兴趣，可用两周做一个中断/恢复与延迟实验，替换一项选修。 |
| 语音 | [Ultravox](https://github.com/fixie-ai/ultravox) | A | 语音多模态模型与相关实时服务。走语音模型方向再研究，不能把调用 API 当语音算法训练。 |
| 语音 | [Qwen2.5-Omni](https://github.com/QwenLM/Qwen2.5-Omni) | B | 支持文本、音视频理解和语音生成的模型。作为多模态架构案例，当前不列训练必修；到选用时重查当前模型版本。 |
| 语音 | [LiveKit Agents](https://github.com/livekit/agents) | B | 实时语音 Agent 框架。与 Pipecat 二选一，研究音频传输和端到端时延时再用。 |
| 语音 | [TEN Agent／TEN Framework](https://github.com/TEN-framework/ten-framework) | A | 实时对话框架和 Agent 示例生态。组件多，按语音专项需要查阅。 |
| 语音 | [Bolna](https://github.com/bolna-ai/bolna) | A | 编排 ASR/LLM/TTS 与 WebSocket 对话；官方区分开源编排层和闭源托管 API/UI。电话场景明确后再学。 |
| 具身 | [LeRobot](https://github.com/huggingface/lerobot) | B | 机器人端到端学习生态。若进入机器人实验室，可优先从数据与一个仿真任务开始；本年默认暂缓。 |
| 具身 | [Genesis](https://github.com/Genesis-Embodied-AI/genesis-world) | B | 机器人/具身学习仿真平台，旧 Genesis 地址已重定向。仿真环境本身是新一条学习线。 |
| 具身 | [OpenVLA](https://github.com/openvla/openvla) | B | 视觉—语言—动作机器人模型。需要动作数据和机器人任务评测，后置。 |
| 具身 | [ManiSkill](https://github.com/mani-skill/ManiSkill) | B | GPU 并行机器人操作仿真与 benchmark，旧 haosulab 地址已重定向。选具身专项后使用。 |
| 具身 | [openpi](https://github.com/Physical-Intelligence/openpi) | A | Physical Intelligence 的 π 系列 VLA 模型与机器人代码；与 Coding Agent 的 pi 不能混为一谈。刘三木截图未给 pi 精确地址，本次不替它猜链接。 |
| 具身 | [NVIDIA Isaac Lab](https://github.com/isaac-sim/IsaacLab) | B | 机器人学习框架，结合仿真和训练。环境配置、物理与控制基础都需额外投入，暂缓。 |
| 具身 | [RDT-1B](https://github.com/thu-ml/RoboticsDiffusionTransformer) | B | 面向双臂操作的扩散基础模型。不是普通文本 LLM 项目升级版，需要专门数据与任务，暂缓。 |

不必买机器人来证明自己学 AI。语音可以通过 API/仿真等方式做小实验，具身也有离线数据与仿真研究；但它们仍会占用新的学习、评测和环境配置时间。默认将这 14 项放入网站的“方向探索”，而不是主线进度条。只有明确导师课题或岗位转向时，才用其中一个替换现有主项目。
# 后训练与 AI Infra 选材（2026-09-17）

对象：Python 薄弱、正在独立理解 Transformer，87M 项目主要跟跑；每日 3–4 小时，一年后求职，可承担数千元 AutoDL 费用。以下是课程适配判断，不是仓库性能背书；仅核验官方 README/文档，未运行项目或核对 AutoDL 实时报价。

建议主线：训练循环与数据 → SFT 与严格评测 → 工具调用环境与可验证反馈 → 小规模后训练实验 → 算法或 Infra 专项。先学 TRL 一个工具即可，不能把 8 个后训练框架全列必修。预算能买实验机会，不能替代调试与实验设计能力。

| 项目 | 官方定位与建议 |
|---|---|
| [TRL](https://github.com/huggingface/trl) | Transformers 生态的 SFT、DPO、GRPO 等后训练库，支持 PEFT 和单卡到多节点。首选主修：先理解数据模板、loss mask、梯度、指标，再用 SFTTrainer；不把一条 train() 当掌握。 |
| [EasyR1](https://github.com/hiyouga/EasyR1) | 官方称为基于 verl 的 clean fork，支持语言与视觉语言模型，强调可扩展 RL。可作为第 8–10 月 GRPO 选修入口，与直接学 verl 二选一；“Easy”不代表不需 RL 和 GPU 基础。 |
| [Agent Lightning](https://github.com/microsoft/agent-lightning) | 当前 v1.0 官方明确已完全重构，组成是 Trainer（verl/vLLM）、API Gateway、Rollout Controller，围绕真实 Agent harness 训练。先有能执行、有轨迹和评测的 Agent 再研究；旧教程需核对版本。 |
| [OpenRLHF](https://github.com/OpenRLHF/OpenRLHF) | Ray 与推理引擎支撑的可扩展 RL 系统。晚于单机 SFT/RL，按多卡训练或 rollout 需求选读；不与 verl 同时通读。 |
| [Search-R1](https://github.com/PeterGriffinJin/Search-R1) | 用 RL 学习推理与搜索调用交替进行，适合研究检索 Agent 的训练。论文复现候选，不宜做第一份训练项目；需要检索环境、奖励与独立测试集。 |
| [verl](https://github.com/verl-project/verl) | HybridFlow 后训练框架。算法分支学一次 rollout→reward→update；Infra 分支再追训练/推理解耦、资源布局和吞吐。 |
| [AReaL](https://github.com/areal-project/AReaL) | 当前官方定位是 LLM Agent 应用与 RL 的桥梁，支持异步 RL。后期选读异步采样与更新如何影响效率和稳定性。 |
| [ROLL](https://github.com/alibaba/ROLL) | 大模型 RL 的可扩展系统库。适合已有训练、分布式与性能基础后比较系统设计；本年非必修。 |

未来能力判断：可验证环境、数据质量、轨迹评测、训练与推理协同、成本和可靠性值得优先投入。这是基于当前工程问题的推断，不保证 2027 年某个框架仍是招聘热点。

## 资源与难度

EasyR1 README 的硬件表标注为估算：1.5B GRPO LoRA 是 1×12GB、3B 是 1×24GB；1.5B 全量 AMP 是 2×24GB，而 7B 全量 AMP 是 8×40GB。不能将模型参数量直接换算为可跑配置：序列长度、并发采样数、精度、优化器、offload 都会改变峰值显存。这个差距说明“几千元预算”适合小模型、短序列、少量有假设的实验，不能据此计划长期多卡扫参。[官方硬件估算](https://github.com/hiyouga/EasyR1#hardware-requirements)

Search-R1 快速开始包含独立检索环境、索引/语料下载和训练环境；示例采用 3B 模型，安装示例还固定较旧 PyTorch/vLLM 版本。应先锁定官方复现环境，跑小规模检索与推理，再决定是否训练。未核验各示例的确切 GPU 用量，不能承诺单卡直接完整复现。

## Infra 的补充主线

| 项目 | 学法与产出 |
|---|---|
| [vLLM](https://github.com/vllm-project/vllm) | 首选实践一个推理服务。学 KV cache、prefill/decode、连续批处理、前缀缓存；固定模型/硬件/输入输出长度与负载，测 TTFT、逐 token 延迟、吞吐、显存及失败率。部署完成只算开始；优化前后要有同口径测量。 |
| [SGLang](https://github.com/sgl-project/sglang) | 同类推理框架，官方列出 RadixAttention 前缀缓存、批处理、调度和 RL rollout 集成。先会一个，再按“重复前缀能否省计算”这个问题做比较；无需通读两个仓库。 |
| [Triton](https://triton-lang.org/main/getting-started/tutorials/index.html) | 自定义 GPU kernel 教程，官方顺序从向量加法、融合 softmax 到矩阵乘法等。先会 tensor/stride、GPU 内存与正确的计时；先实现一个有数值对照和基准的 kernel，再谈 attention 优化。 |

建议第 5–6 月开始单 GPU 服务与性能实验；第 7 月据兴趣分叉。算法方向：重点是训练数据、分布外评测、SFT/DPO/GRPO 的适用条件。Infra 方向：重点是 Linux、并发、C++、GPU 性能分析、推理服务和一个 kernel。两条方向共同保留数据、代码、实验可复现能力。

## 对九周路线的纠偏

- “九周涵盖核心知识”可以作内容地图；按此用户基础，将 Transformer、ToT、GraphRAG、记忆、DPO 和创新都做深明显过密。应保留 Transformer+训练、Agent+工具、评测三项主线。
- [ToT 论文](https://arxiv.org/abs/2305.10601)中的 24 点适合作为搜索策略练习；跑通不能直接证明真实 Agent 研发能力。练完移入一个有失败、重试、预算和独立测试集的任务。
- [GraphRAG](https://github.com/microsoft/graphrag)是图结构检索系统，放在 BM25/向量检索基线之后；只有任务需要跨文档关系或全局汇总、且基线确实不足时才增加，不把更复杂当更好。
- [DPO 原论文](https://arxiv.org/abs/2305.18290)将偏好优化写为分类损失，经典离线 DPO 使用偏好数据，不需要训练过程中不断采样在线轨迹；“做一次 DPO”不能代表掌握在线强化学习决策优化。在线 Agent RL 还需要环境、轨迹、奖励、采样、信用分配与稳定性诊断。
- 后训练验收：先固定未见测试任务与外部评分规则，对比原模型、提示/工作流优化、SFT；若继续 RL，要检查 reward 增长是否伴随真实成功率增长，不能只报告训练 reward。
