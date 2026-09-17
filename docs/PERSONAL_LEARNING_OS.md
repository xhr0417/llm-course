# 个人学习 OS

本文件是网站改造的产品需求与验收标准。一年计划正文见 [`LEARNING_PLAN.md`](LEARNING_PLAN.md)。调研见 [`research/PROJECT_RESEARCH.md`](research/PROJECT_RESEARCH.md)。分阶段工程见 [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)。视觉与无障碍底线见根目录 [`DESIGN.md`](../DESIGN.md)；第一功能阶段同步更新第 10 节列出的条目。

一年计划决定**学什么**。第 3 节的学习机制决定**怎么记、怎么过、怎么复习**。`jhammant/continuous-learning`、`DieselZhang/repo-mastery`、`George-Brothers/Atlas`、`astroboy1183/study-agent` 只作机制参考，**不是新增学习项目，不引入其代码或 UI**。同名或相近仓库不得当作同一来源。

## 1. 产品决定

网站围绕**一条**个人学习主线组织，不再用三条平行求职路线加六个作业项目作为入口。同一主线按能力推进，分成三个阶段：

1. 小模型学习实验室
2. 技术声明核验助手 / 单 Agent
3. 算法或 Infra 专项实验

去掉现有六个平行项目作为作业：`log-analyzer`、`hf-mini-lab`、`llm-eval`、`rag-service`、`sft-lora`、`inference-benchmark`。它们不再出现在主导航、主线任务和项目完成进度里。最终可以删除不再需要的代码，但必须先审计引用和可复用部分；不要直接删整个 `projects/`，也不要把目录整体搬到 `legacy/` 就算完成。新主线不为了保留旧代码而依赖这六个项目。

原有理论教材、交互演示和有用的参考内容继续保留。涉及旧项目的 Guided Build 必须逐项改写、迁移或移除，不能留下指向已删除目录的操作指南。

前八周以一年计划为准，从 Attention 和小模型实现开始。Python / PyTorch 基础并行补充。基础 SFT 和评测仍在前八周，不推迟到专项阶段。

调研中的 92 个项目是参考资料，不是待完成任务。不为这些工具分别创建新的主项目卡片。优先使用：SpongebobLite、CS336 部分作业；Hello-Agents；CHEF；mini-swe-agent（最小循环完成后再读）；Pydantic AI、Inspect AI 按项目需要；TRL 或 vLLM 作为后期专项工具。

## 2. 「我的学习」

需要一个明确入口（名称可以是「我的学习」或等价主入口），显示：

- 当前阶段（**同一主线的三个阶段之一**）
- 本周目标（周数是预算，不是按日历强制解锁）
- **一个**主要任务，以及完成它所需的补基础内容（并行、不挡主任务）

每项任务必须关联：

- 知识点（可多个；见第 3 节）
- 已有教材（章节、参考手册、外部阅读）
- 实现任务（空文件 / 小仓库里本人要写的内容）
- 验收标准（能检查、能解释，而不是“看完就算”）

阶段按能力推进：未通过当前验收时缩小任务或继续当前任务，不随日历自动跳周。允许手动把当前阶段改到主线上的另一阶段。未通过验收**不硬锁**教材、答案和后续内容。日期、出国、考试可以推迟周预算，不改能力门槛。

## 3. 学习机制设计

下列条目是**本站的设计决定**。引用外部仓库时只写已核验的公开说明；未读源码或不属于该仓库文档的部分不宣称是对方功能。这些仓库都不进入主线任务列表。

### 3.1 参考了什么（已核验）

| 名称 | 核验入口 | 采用的机制想法 | 明确不采用 |
|---|---|---|---|
| continuous-learning | [jhammant/continuous-learning](https://github.com/jhammant/continuous-learning) README（核验日 2026-09-18） | 进度按**概念**分别记录，而不是一个总分；间隔复习；数据是本地可读 JSON；mentor 可关闭、不挡真实工作 | 不安装其 Claude Code plugin；不引入 0–5 评分、SM-2 卡片、session 抽取或 dashboard |
| Repo-Mastery | [DieselZhang/repo-mastery](https://github.com/DieselZhang/repo-mastery) README / [npm `@dieselzhang/repo-mastery` 3.2.0](https://www.npmjs.com/package/@dieselzhang/repo-mastery)（核验日 2026-09-18） | 课程地图是**模块 + 知识点**；进度、笔记与学习记录分开持久化；讲解与「能否进阶」分开；练习要有真实证据才算 procedure 掌握；`/review` 只刷到期项、不打开新内容 | 不引入 `.learning/` 目录、Python `learning_engine.py`、定量准确率闸门或 HTML 课程生成；不把 SpongebobLite 等做成 Repo-Mastery 课程 |
| Atlas | 用户指定 [George-Brothers/Atlas](https://github.com/George-Brothers/Atlas)。2026-09-18 打开仓库页与 README 均 404，未能核验正文。GitHub 用户页仅列出简介（gates progress on proven mastery、spaced repetition） | **不宣称采用了 Atlas 的具体机制。** 首页突出一条当前任务、验收绑定任务、不按日历跳任务，均为**本站设计决定** | 不引入 Next.js / Drizzle 应用、盲评 grader 或 RAG tutor；不得把 `danielbodnar/repo-learning-builder` 或其他同名 Atlas 当作该来源 |
| Study Agent | [astroboy1183/study-agent](https://github.com/astroboy1183/study-agent) README（核验日 2026-09-18） | **一次只推进一个当前作业**；进度是指针，不是按日历解锁；完成后安排间隔回忆 | 不引入 Slack bot、Cloudflare Worker、公开打卡板；**不抄它的 1→3→7→16→35 天**。不得把 `HumphreySun98/Smart-Study-Agent` 当作该来源 |

间隔 1 / 3 / 7 / 21 天是**本站可调整的默认阶梯**，不是从上述 README 逐日抄来的数字。Repo-Mastery 只写明「每种类型独立间隔序列」，未在本次核验中打开 `learning_engine.py` 核对具体天数。未核验到的机制一律按本站设计记录，不写进「对方已有功能」。

### 3.2 知识点与任务

- **任务**是主线上一次要完成的工作（例如「手写因果多头注意力」）。
- **知识点**是可复用概念，有稳定 id，例如 `attention`、`causal-mask`、`tensor-shape`。
- 一个任务关联**多个**知识点。同一知识点可被后续任务再次使用。
- **知识点记录可以复用**：四档状态挂在 conceptId 上，后续任务看到的是同一套概念记录。
- **任务验收记录不可因概念历史自动完成。** 每条验收证据绑定 `taskId + criterionId`，可以额外关联 `conceptId`。某个知识点过去已有「自己实现」或其它证据，不得把引用它的新任务或其 criterion 标成已通过。
- 计划定义（发布数据）列出任务、知识点 id、criterion id。个人存储只写这些 id 上的状态与证据。
- **第一功能阶段只把这条边界写进约定和计划 JSON，不实现证据存储或表单。**

### 3.3 验收与证据

每个任务写清**通过条件**（可观察、可复述）。证据字段至少支持：

- 代码位置或 commit（路径、行号或 hash，手工粘贴即可）
- 实际测试或检查结果（例如「改未来 token，过去位置输出不变」）
- 自己的解释（口述 shape / mask / 失败原因）

每条证据必须带 **来源**：

| source | 含义 |
|---|---|
| `user_reported` | 用户自己填写或勾选 |
| `auto` | 本站或本地脚本实际跑过并写入 |

初期全部允许 `user_reported`。界面必须能看出自报与自动的区别。没有自动检查时**不得**生成 `auto` 记录，不得把勾选显示成「测试已通过」。

建议进入下一任务的条件（建议，不是硬锁）：该任务声明的通过条件都有**针对该 taskId + criterionId** 的证据；关联知识点至少有「自己实现」或「能解释」之一为用户记录。概念层记录只用于补基础提示和日后复习，**不能**单独把新任务勾成完成。未满足时首页仍停在当前主要任务，但教材与后续章仍可打开。

### 3.4 当前任务与推进

- 首页只突出**一个**主要任务 + 必要补基础（例如卡在 `reshape` 时显示第 11 章对应小节）。
- 任务未完成就继续该任务；**不按日历把第 1 周自动换成第 2 周**。
- 用户可手动选择当前阶段（仍是同一条主线上的实验室 / 核验助手 / 专项）。
- 未通过验收不隐藏教材、参考答案或后面章节。

### 3.5 主动复习（后做）

复习形式：解释、闭卷回忆、或复写核心函数。默认间隔 1 / 3 / 7 / 21 天，可改。复习失败：记下薄弱知识点，安排重练**当前或更小的任务**；**不删除、不改写**此前真实的实现和验证记录。复习队列不得在第一功能阶段实现。

### 3.6 机制落地节奏（禁止一次做完）

1. **展示：** 当前任务、教材、验收条件、关联知识点名称。
2. **记录：** 四档状态、证据、卡点。
3. **复习：** 到期队列与失败后的重练。

对应工程阶段见 [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)。不因本节把证据表单和复习队列塞进第一阶段。

## 4. 完整示例：小模型学习实验室 — Attention

对应一年计划第 1 周。任务 id：`lab.attention.causal-mha`。发布数据在 [`../content/learning-plan.json`](../content/learning-plan.json)。

**知识点（计划数据，多对多）**

| id | 名称 |
|---|---|
| `attention` | 缩放点积注意力 |
| `causal-mask` | 因果掩码 |
| `tensor-shape` | Q/K/V 与多头拆分的 shape |
| `python-index` | 函数、索引、调试（补基础，不挡主任务） |

**页面必须可执行（第一阶段就要写清，不代写核心算法）**

- 阶段：小模型学习实验室（同一主线的阶段 1）
- 主要任务：不看参考代码重写 attention；说清每一步 shape；改变未来 token 不改变之前位置输出
- **写在哪里：** 本机空文件（例如 `~/llm-lab/attn.py`），不要写进 `projects/` 六个旧目录
- **输入：** 单头为 Q/K/V，形状 `[B, T, D]`；多头再按 H 拆成 `[B, H, T, Dh]`，`Dh = D / H`；位置 t 只能看 0…t
- **输出：** 与 Q 同形状的上下文向量 `[B, T, D]`
- **步骤：** 先读 7.4 / 7.5 / 7.9 / 7.10 / 7.17 → 写单头 → 自检 → 读 7.14 扩多头 → 再自检。7.12 / 7.13 只在写完后对照，不要先抄完整实现
- **检查：** 打印每步 shape；改未来 token，过去位置输出不变
- **教材链接：** 必须指向第 7、11 章中实际存在的小节标题（由计划 JSON 的 `section` 字段与 Markdown `##` 对齐）
- 补基础：class / reshape / broadcasting 链到第 11 章对应小节
- SpongebobLite 仅作对照入口，标「对照用，不是本周作业仓库」

**验收条件绑定（阶段 1 只展示条文，不收集证据）**

| criterionId | 关联 conceptId | 条文 |
|---|---|---|
| `rewrite` | `attention` | 空文件中重写核心计算（先单头后多头） |
| `shapes` | `tensor-shape` | 能讲清每一步 shape |
| `causal` | `causal-mask` | 未来不影响过去 |

这三条是 `lab.attention.causal-mha` 的验收，不因为 `causal-mask` 曾经有过阅读记录就自动完成。

**用户之后可记录（第二机制层）**

- 任务：实现 / 验证 / 解释 分开勾选，均为 `user_reported`，除非将来接上自动脚本
- 证据键：`taskId + criterionId`，可选 `conceptId`
- 知识点 `causal-mask` 的四档状态可被第 2 周 decoder 任务看到；但第 2 周任务仍要自己的 criterion 证据

**建议进入下一任务（例如 embedding + 最小 decoder）当且仅当**

- 本任务三条 criterion 都有对应证据；且
- `attention`、`causal-mask`、`tensor-shape` 上至少有「自己实现」或「能解释」的用户记录。

未满足时仍显示本任务为当前主要任务。用户仍可打开第 9 章或第 2 周教材。日历到了第 2 周也不自动切换当前任务。

## 5. 学习状态

四种状态分开记录，互不自动推导。状态挂在**知识点**上；任务完成是「该任务各 criterion 是否已有对应证据」的汇总，不是第四套平行掌握度，也不是把概念状态复制成任务完成。

| 状态 | 含义 | 不是 |
|---|---|---|
| 读过 | 打开过或标记过对应教材 | 不是已掌握 |
| 自己实现 | 本人写过核心代码或数据步骤 | 不是测试已绿、不是能讲解 |
| 验证通过 | 按任务声明做过检查（shape、因果 mask、手算 scorer、小样本过拟合等） | 不能把手动勾选写成「自动测试通过」 |
| 能解释 | 能口述输入输出、失败原因或对照差异 | 不能由「已读」或 starter 全绿自动勾上 |

现有 `localStorage` 键 `llm-course-progress` 的 `read` / `lab` / `project` / `guided` **继续保留、可读**。不得把「已读」迁移或自动转换成「已掌握」「自己实现」「验证通过」或「能解释」。

计划定义放在发布可用的数据中（`content/` 下的 JSON 或等价文件），内含任务、知识点 id、通过条件。个人完成记录与计划定义分开，存在本机存储。不预填任何完成状态。

卡点（后做）：用户可写「卡在 broadcasting」；只影响首页补基础提示，不锁内容。

## 6. 工程约束

- 保持现有静态 HTML / CSS / JS 架构，无新的前端打包步骤。
- 识别生成文件与生成区块：`chapters/*.html`、`sitemap.xml`、`robots.txt`、`llms.txt`、`dist/`，以及 `tools/build-static.js` 写入 `index.html` 的静态目录。改源文件后重新生成，禁止手改产物。
- 存储失败时会话仍可用，并给出诚实提示（沿用现有进度模块行为）。
- 不为 92 个调研项目各做一张主项目卡。
- 不为 continuous-learning / Repo-Mastery / Atlas / Study Agent 做主项目卡或 vendor 拷贝。

## 7. 教材与 Guided Build

- 第 0–23 章及交互演示默认保留；RNN / BERT 等历史章作为参考入口，不作为现代 decoder 实践的强制闸门。
- 第 13 章 DPO/GRPO 为后续选修，完成小模型入门不依赖 RL。
- 第 25 / 26 / 27 章当前 Guided Build 指向六个旧项目目录。功能阶段必须逐项决定改写、迁移或移除；物理删除旧代码之前，页面上不得继续把 `cd projects/<旧目录>` 当作主线操作。
- 第 28–31 章理论与实验纪律（含 `NOT EXECUTED ON CUDA`）保留；配套作业项目退出主线。

## 8. 第一功能阶段验收

打开站点主入口必须同时满足：

1. 能看到当前任务属于 **小模型学习实验室—Attention**（缩放点积注意力、causal mask、多头；完成标准与一年计划第 1 周一致）。页面列出当前目标、必要教材、实现步骤（含写在哪里、输入输出、先单头后多头）、验收条件和关联知识点。教材链接指向实际存在的小节。
2. 六个旧项目不出现在主导航、主线任务列表和项目完成进度里。`#/projects` 改为说明页，旧书签不产生死链。
3. 目录与搜索仍可打开原理论章节；不物理删除 `projects/`。
4. 已有「已读」记录仍在；界面不把它们显示成已掌握。
5. **本阶段不做：** 证据表单、卡点、复习队列、自动测试写入、引入参考仓库的代码。

## 9. 文档轮次验收

文档轮次已完成：[`../AGENTS.md`](../AGENTS.md)、本文件、[`LEARNING_PLAN.md`](LEARNING_PLAN.md)、[`research/PROJECT_RESEARCH.md`](research/PROJECT_RESEARCH.md)、[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)。

## 10. DESIGN.md 随第一功能阶段更新的条目

功能实施时改下列条目；未列出的视觉与无障碍约定全部保留。第 6 节四种状态与证据来源仍留给记录层，本阶段不宣称已经实现。

**本阶段要改（并已在 DESIGN.md 更新）**

| 节 | 改成 |
|---|---|
| 1 Identity | 主读者沿一条个人主线推进；下一动作来自「我的学习」的当前主要任务 |
| 5 Route list | 主入口不再用三条路线当主选择；若全书目录仍展示路线，降为查阅 |
| 5 Lesson list | 主线任务来自计划定义数据；已读只表示读过，不得单独充当主线完成 |
| 5 Secondary navigation | 「我的学习」与「全部章节」；「实战项目」退出主导航 |
| 5 Primary action | 首页主按钮对准当前任务的必要教材，补基础为次要链接 |
| 8 Accessibility and verification | 验证「我的学习」、目录、教材章、搜索、主题与存储失败；`#/projects` 说明页可键盘访问 |

**明确保留**

- 第 2 节配色变量与语义色（教学图）。
- 第 3 节字体栈、字号 token、单 H1、不用新 webfont。
- 第 4 节间距、圆角、侧栏/TOC 宽度、文档滚动、375 / 768 / 1280 无横向撑开。
- 浅色 / 深色主题、`prefers-reduced-motion`、`:focus-visible`、原生 `details/summary`。
- 现有交互演示样式；不借这次改造重做示意图。
- Guided 原语（`.guided-lab` 等）可复用于新主线步骤；打开 solution 仍不算完成。
- 不宣称未测量的性能分数。
