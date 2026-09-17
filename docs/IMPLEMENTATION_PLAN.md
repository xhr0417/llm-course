# 分阶段实施方案

需求见 [`PERSONAL_LEARNING_OS.md`](PERSONAL_LEARNING_OS.md)（含学习机制）。一年计划见 [`LEARNING_PLAN.md`](LEARNING_PLAN.md)。本文件只指导工程顺序。**阶段 0 已完成。阶段 1 已在仓库落地（展示当前任务并让旧项目退出主入口）。不要自动进入阶段 2，不发布。**

学习机制分三层，**不要并进阶段 1**：

学习机制分三层，**不要并进阶段 1**：

| 机制层 | 做什么 | 落在哪一工程阶段 |
|---|---|---|
| A 展示 | 当前主要任务、补基础、教材、通过条件、知识点名称 | 阶段 1 |
| B 记录 | 四档状态、证据（user_reported / auto）、卡点；知识点记录可复用，任务验收绑定 taskId+criterionId | 阶段 3（与前八周数据一起） |
| C 复习 | 解释/回忆/复写队列；默认间隔 1/3/7/21 天可调；失败记薄弱点并重练，不改写旧证据 | 阶段 3 完成之后、阶段 4 之前 |

## 生成文件（全程）

改源文件后重新生成，禁止手改：

- `tools/build-static.js` → `chapters/*.html`、`sitemap.xml`、`robots.txt`、`llms.txt`、`index.html` 中的静态目录区块
- `tools/build-dist.js` → `dist/`（gitignore）

发布脚本 `tools/publish.sh` 只在明确要求时运行。

## 阶段 0 — 文档与方案（已完成）

**范围：** 仓库约定、计划归档、学习机制设计（展示 / 记录 / 复习分层）。

**写入：** [`../AGENTS.md`](../AGENTS.md)、[`LEARNING_PLAN.md`](LEARNING_PLAN.md)、[`research/PROJECT_RESEARCH.md`](research/PROJECT_RESEARCH.md)、[`PERSONAL_LEARNING_OS.md`](PERSONAL_LEARNING_OS.md)、本文件。

**完成条件：** 上述文件在仓库中；OS 含知识点—任务、证据来源、Attention 示例与机制三层。阶段 1 开始前已纠正机制来源归属，并把 taskId+criterionId 数据边界写入约定。

## 旧项目审计（执行删除前只作记录）

不要整体搬到 `legacy/`。不要为了留代码让新主线依赖六个作业。物理删除放在阶段 5，且仅在引用清零之后。

### 逐项

| 项目 | 删除（作为作业） | 值得并入新主线的部分 | 受影响的章节、链接、测试、CI、构建 |
|---|---|---|---|
| **log-analyzer** | starter、41 测、主导航卡片、把「训练日志 CLI」当第一份作业 | CLI / pytest / parser→stats 分层，可改写成「分析自己的训练或 Agent 日志」小练习，**不是**独立项目 | `content/25-python-engineering.md` 与 `content/references/25-python-engineering.md`；`validate-guided.js`（10 步 / log-analyzer）；CI `python-unit` 与 `guided-starters` |
| **hf-mini-lab** | 平行作业卡、38 测 Guided Build 作为主线必做 | chat template、left padding、response-only mask、LoRA save/load：作为第 6–8 周 SFT/HF **参考片段**，不是项目卡 | `content/26-huggingface.md`、huggingface 参考手册；CI hf starter 红灯与 `guided-hf-full` / integration |
| **llm-eval** | 79 步作业卡、把完整 harness 当 Capstone 1 必修 | scorer、逐样本记录、异常与零分分开：服务第 7 周 C3/XCOPA **简化** evaluator | `content/27-capstone-eval.md`；`validate-jobs.js` 测试计数；算法线把评测放在 RL 之后的 `tracks.json` |
| **rag-service** | 作为第二份简历项目、22 条查询作业当主线 | 切分 / BM25 / 精排 / 引用思路留给第 3–4 月核验助手；**按同一核验任务重做**，不沿用该仓库当主线依赖 | `content/28-rag-engineering.md`、`29-capstone-rag.md`；CI `docker-build` 与 integration |
| **sft-lora** | 独立 Capstone 卡、48+12 指令作业当主线完成物 | held-out、response-only、experiment.md 协议并入第 6–8 周基础 SFT 和第 7 月专项 | `content/30-capstone-sft.md`；与 llm-eval 的交叉引用 |
| **inference-benchmark** | 独立作业与「完成推理基准」进度 | profiler / 计时口径、`NOT EXECUTED ON CUDA` 纪律留给 Infra 专项 | `content/31-capstone-infra.md`；CI `python-unit` |

### 共同波及（阶段 1–2 就会碰到，阶段 5 才删目录）

- [`../README.md`](../README.md)：六项目表、Learn/Guided/Reference 作为作业分层的表述
- [`../content/tracks.json`](../content/tracks.json) 的 `tracks` 与 `projects`
- [`../content/projects.json`](../content/projects.json)
- [`../js/pages.js`](../js/pages.js) 首页「实战项目」、`projectPage`；[`../index.html`](../index.html) 顶栏 `#/projects` 与静态目录文案
- [`../js/app.js`](../js/app.js) `path === "projects"`
- `content/00-map.md`、`content/24-job-ready.md`
- [`../tools/validate-portfolio.js`](../tools/validate-portfolio.js)、[`../tools/validate-jobs.js`](../tools/validate-jobs.js)、[`../tools/validate-guided.js`](../tools/validate-guided.js)
- [`../projects/README.md`](../projects/README.md)
- [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) 的 python-unit matrix、guided-starters、docker-build、integration、guided-hf-full

`tools/build-static.js` / `build-dist.js` 本身不绑定项目名；章节 Markdown 改完后必须重跑构建，否则 `chapters/*.html` 仍指向旧路径。

## 阶段 1 — 展示当前任务 + 旧项目退出主入口（已完成）

**目标：** 能看见当前任务「小模型学习实验室—Attention」；六个旧项目退出主要学习入口。只做机制层 A（展示）。物理目录仍留着。Attention 页必须可执行：写在哪里、输入输出、先单头后多头、如何检查，并链接到真实教材小节；不代写核心算法。

**范围：**

- 新增发布数据 `content/learning-plan.json`：同一主线的三个阶段、周预算、任务 id、知识点 id、criterion id、标题、教材链接、实现任务、明文通过条件。首条任务固定为第 1 周 Attention。计划 JSON 写入数据边界约定，本阶段不实现证据系统。
- 首页改成「我的学习」：**一个**主要任务 + 必要补基础链接；当前阶段文案是「同一主线的阶段」，不是第三条平行路线。
- 顶栏去掉「实战项目」；`#/projects` 保留为「已退出主线」说明页，避免旧书签死链。首页去掉六张项目卡和「三条路线选一条」作为唯一开始方式。
- 日历不改变当前任务。本阶段当前任务写死为 Attention。
- 继续加载旧 `llm-course-progress` 只用于已读显示。禁止把 `read: true` 写成实现/验证/解释。
- 同步更新本阶段涉及的 [`../DESIGN.md`](../DESIGN.md) 与 [`../README.md`](../README.md)。

**影响文件：** `content/learning-plan.json`、`js/pages.js`、`js/app.js`、`js/course.js`、`index.html` 顶栏、`css/course.css`、`tools/test-course.js`、`tools/build-static.js` 静态目录文案。改完后跑 `build-static.js`。

**必要验证：**

- 本地打开主入口：当前任务为 Attention / 小模型学习实验室；能看到教材、实现步骤、通过条件、知识点名称；教材链接落到真实小节。
- 主导航与主线任务区没有六个旧项目名，没有「N 个可运行项目」完成条。`#/projects` 仍可打开。
- 刷新后已读章节仍显示已读，且没有被标成已掌握。
- 不出现证据表单、复习到期列表、或「自动测试通过」文案。
- 手机与桌面布局可读。
- `node --test tools/test-course.js`；按改动范围跑现有 validator（本阶段仍留下 `projects/` 目录，不要为了过门禁把新主线接回六项目）。

**完成条件：** [`PERSONAL_LEARNING_OS.md`](PERSONAL_LEARNING_OS.md) 第 8 节验收满足。不删 `projects/`。完成后停止，不进入阶段 2，不发布。

**本阶段明确不做：** 机制层 B/C；改写 25/26/27 的全部 Guided 步骤；新 Attention 练习仓库；启用 92 项选修库 UI；拷贝 Repo-Mastery / Atlas / Study Agent / continuous-learning 的代码。未核验的 Atlas 机制按本站设计实现，不阻塞本阶段。

## 阶段 2 — 切断指向旧目录的操作指南

**范围：** 第 25 / 26 / 27 章及两份参考手册：改写、迁移或移除 `:::lab` / `:::step` 中 `cd projects/<旧目录>`。第 28–31 章去掉「配套项目 = 主线作业」的入口，保留原理。更新 `validate-guided.js`、`validate-jobs.js`、`validate-portfolio.js`、CI，使门禁不再把六个作业当必修。`projects/` 目录可暂留，避免半删导致 CI 与链接不一致。

**验证：** 全文搜索 `projects/log-analyzer` 等六路径，主线 Markdown 与生成的 `chapters/*.html` 无「按此完成作业」指令（参考实现链接若仍指向未删目录，须标明「非主线、待删除」或一并去掉）。CI 不再要求 starter 红灯矩阵。

**完成条件：** 按文档操作不会走进即将删除的作业流程。

## 阶段 3 — 前八周任务 + 状态、证据与卡点（机制层 B）

**范围：** 把 [`LEARNING_PLAN.md`](LEARNING_PLAN.md) 第 5 节八周写入计划 JSON，并链到现有章：第 7（Attention）、9–13（GPT / 现代架构 / PyTorch / 手写组件与训练）、21（SFT 概念）、23（评测）、必要时 26 的 API 说明作参考。Python / PyTorch 列为并行补充，不挡 Attention。第 6–7 周写入基础 SFT 与简化评测。第 13 章 RL 标选修。

同一知识点 id 被多周任务引用（例如 `tensor-shape` 出现在 Attention 与 decoder 任务中），**概念记录共用**。任务验收证据必须带 `taskId + criterionId`，可选 `conceptId`。过去的概念证据不得自动完成新任务的 criterion。

机制层 B：新存储键（例如 `llm-course-learning`）保存知识点四档状态、任务证据、卡点。证据字段含代码位置或 commit、检查结果、解释；每条标 `user_reported` 或 `auto`。本阶段没有自动脚本则只允许 `user_reported`。未通过验收不锁教材。建议进入下一任务的规则见 OS 第 3.3 / 4 节，只作提示。允许手动改当前阶段。

**验证：** 「我的学习」能从第 1 周走到第 8 周；未完成时当前主要任务不变、不随日历跳周；无预填；同一知识点在两个任务页看到同一套状态；自报证据不会显示成自动测试通过。

**完成条件：** 前八周每条都有教材 + 实现 + 验收；记录层可用；不指向已退出主线的六作业。

**本阶段仍不做：** 复习队列（机制层 C）。

## 阶段 3b — 复习队列（机制层 C）

排在阶段 3 之后、阶段 4 之前。到期复习：解释、回忆或复写。默认间隔 1/3/7/21 天，可改（这是本站默认，不是 study-agent 的 1→3→7→16→35）。失败则记录薄弱知识点并建议重练，**保留**原实现/验证证据。复习入口不得打开新的主线任务（对齐 Repo-Mastery README 所写 `/review` 只刷到期项——此处仅作行为参考，不引入其引擎）。

**验证：** 失败一次复习后，旧的 `user_reported` 实现记录仍在；首页主要任务不因复习失败被日历推进。

## 阶段 4 — 核验助手 / 单 Agent

**范围：** 计划数据增加第 3–6 月任务。教材用第 23 / 28 章等；Hello-Agents 作主题阅读；CHEF 作任务设计参考。最小循环本人实现后再指向 mini-swe-agent。Pydantic AI / Inspect AI 仅在任务需要时引入。不为框架做主项目卡。不为 Study Agent 等机制仓库做项目卡。

**验证：** 主线当前阶段可手动切到核验助手；92 项与四个机制参考仓库仍只在文档中出现。未核验的 Atlas 机制继续按本站设计，不引入其代码。

## 阶段 5 — 专项实验与物理删除

**范围：** 第 7 月起算法或 Infra 二选一加深。TRL 或 vLLM 按方向引入，仍不是新的主项目卡。引用清零后删除不再需要的 `projects/<六目录>` 代码、更新 README / sitemap 相关叙述、精简 CI。

**验证：** `rg` 无失效 `projects/<已删>`；`build-static` + 全部门禁；抽查章节无死链。

**完成条件：** 磁盘上只剩新主线仍在用的代码；没有为了过旧测试而复活作业项目。

```mermaid
flowchart LR
  docs[阶段0_文档] --> p1[阶段1_展示Attention]
  p1 --> p2[阶段2_切断旧作业入口]
  p2 --> p3[阶段3_前八周与记录]
  p3 --> p3b[阶段3b_复习队列]
  p3b --> p4[阶段4_核验Agent]
  p4 --> p5[阶段5_专项与物理删除]
```

## 仍需产品拍板（不阻塞阶段 1）

1. 三条旧路线（`tracks.json`）是完全隐藏，还是继续作为「全部章节」之外的查阅分组？（阶段 1 选择：路由保留，降为查阅，不进主导航。）
2. ~~`#/projects` 过渡期~~ **已定：** 说明页「已退出主线」，保留路由以免死链。
3. Attention 的「自己实现」是只在站外空文件，还是阶段 3 再给仓库内最小练习目录（不是旧 six-project 结构）？（阶段 1 选择：只说明站外空文件。）
4. 第 25 章 Python 是拆成嵌入主线的小任务，还是整章改为参考手册（与现有 `:::reference` 一致）？
