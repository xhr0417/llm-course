# Phase 1 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 审核入口：本文件
- 范围：展示「小模型学习实验室—Attention」；六个旧作业退出主导航。不做证据表单、卡点、复习队列、自动评分，不删除 `projects/`。
- 发布区分：`main` 推送会触发 **GitHub Pages** 自动部署。自有服务器只在运行 `tools/publish.sh` 时更新。不要把这两件事写成同一句「没有发布」。

审核时请对照 `files/docs/PERSONAL_LEARNING_OS.md` 第 8 节，以及 `files/DESIGN.md`。

## 怎么看

1. 先读本文件「本轮改了什么」，再读 `files/docs/PERSONAL_LEARNING_OS.md`。
2. 功能改动看 `files/js/pages.js`、`files/js/app.js`、`files/content/learning-plan.json`。
3. 第一功能阶段相对改造前的行级差异：`tracked-edits.diff`。
4. **本轮小修**相对 `38b4197` 的行级差异：`small-fixes.diff`。
5. GitHub 上同一文件：`https://github.com/xhr0417/llm-course/blob/main/<path>`

`files/` 始终是**当前最新完整稿**，不是某一旧 commit 的快照。

---

## 本轮改了什么（相对 38b4197）

作者要求：阶段 1 小修，不进入阶段 2。本轮只改展示与加载容错。

### 1. 计划 JSON 加载失败不再挡住教材

`js/app.js` 不再把 `learning-plan.json` 和教材目录三件套绑在同一个 `Promise.all` 里。

- 先加载 `manifest.json` / `tracks.json` / `references.json`，立刻启动路由和搜索。
- 再单独加载 `learning-plan.json`。
- 失败时首页出现可理解错误和「重新加载当前练习」；目录、章节、搜索仍可用。
- 加载中首页写「正在载入当前练习」，不把待加载误报成失败。

### 2. 验收补上数值正确性

`content/learning-plan.json` 增加 `numeric` 一条，中文标签「数值正确性」。

- 关闭 dropout。
- 固定小张量。
- 单头和多头分别与 7.12 手算或可信参考按容差比较（例如 1e-5）。
- 单头通过不能代替多头。
- 明确：站点不运行 Python，不提供核心算法答案。
- 形状、因果性两条保留。

### 3. 首页改成自然中文，去掉内部 ID 和工程口号

`js/pages.js`：

- 不再显示 `taskId`、`criterionId`、知识点英文 id。
- 验收用 JSON 里的中文 `label`（自己重写 / 形状 / 因果性 / 数值正确性）。
- 相关概念只显示中文名称。
- 去掉「阶段 1」「周预算」「未通过验收前首页停在这里」。
- 不暗示本页会按验收自动切换练习。

### 4. 文档与门禁同步

- `docs/PERSONAL_LEARNING_OS.md` 第 8 节按上面三条改验收。
- `docs/IMPLEMENTATION_PLAN.md`、`DESIGN.md` 区分 Pages 自动部署与 `publish.sh`，并写计划加载失败时的界面要求。
- `tools/test-course.js` 增加：数值正确性条文、首页不得出现内部 id / 阶段口号、计划失败时仍能渲染目录。

### 本轮未做

- 没有进入阶段 2。
- 没有删除 `projects/`。
- 没有做证据表单、卡点、复习队列、自动评分。
- 没有代写 Attention 核心算法。
- 没有运行 `tools/publish.sh`。本次会再推 `main`，GitHub Pages 可能随之更新；自有服务器不会因此更新。

### 本轮浏览器里实际看到的

在本地 `http://localhost:8765/?v=phase1fix#/`（Cursor 内置浏览器）核对过：

- 首页标题是「小模型学习实验室—Attention」，有「数值正确性」，没有 `taskId` / `criterionId` / 「阶段 1」。
- 点「打开必要教材：7.4」落到第 7 章 7.4 小节（标题在视口内）。
- 搜索「GRPO」约 17 条；点「22.7 GRPO 的目标函数」落到该小节。
- 「全部章节」可打开；浅色/深色可切换；1440 宽无横向撑开。
- 同会话「标记已读」会把阅读进度改成 1/32，目录里对应章显示「已读」。文案仍写「已读不是已掌握」。

未在这次浏览器里做完的：

- 没有用 Network 拦截真实验证「计划 JSON 失败 + 点重试」；这条靠 `tools/test-course.js` 门禁覆盖。
- 没有单独截 375 宽截图；654 宽时侧栏收成「目录」按钮，无横向撑开。
- Cursor 内置浏览器一直提示「当前浏览器无法保存进度」。磁盘 `localStorage` 里仍有旧的 transformer/pytorch 已读，但这个浏览器的界面没有把它们加载出来。因此**没有在用户本机 Chrome 验证旧阅读记录刷新后仍在**。

---

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `AGENTS.md` | 新建 | Agent 约定：源文件 vs 构建产物、不把已读当成掌握 |
| `DESIGN.md` | 修改 | 身份、主导航、主按钮；本轮补上计划加载失败的验证要求 |
| `README.md` | 修改 | 从 Attention 开始，而不是三条路线 / 六个作业 |
| `content/learning-plan.json` | 新建 | 发布用计划；本轮加数值正确性和中文 label |
| `css/course.css` | 修改 | 当前任务面板、步骤/验收列表 |
| `index.html` | 修改 | 主导航改为「我的学习 / 全部章节」；静态目录文案 |
| `js/app.js` | 修改 | 本轮：计划与目录分开加载；失败可重试 |
| `js/course.js` | 修改 | `href` / `parse` 支持教材小节 |
| `js/pages.js` | 修改 | 本轮：中文首页、失败/加载中状态、数值正确性展示 |
| `tools/build-static.js` | 修改 | 静态目录不再把六个项目当主线作品集 |
| `tools/test-course.js` | 修改 | 本轮：数值条文、隐藏 id、计划失败门禁 |
| `docs/PERSONAL_LEARNING_OS.md` | 新建 | 产品需求；本轮更新第 8 节验收 |
| `docs/IMPLEMENTATION_PLAN.md` | 新建 | 分阶段工程；本轮纠正 Pages vs publish.sh |
| `docs/LEARNING_PLAN.md` | 新建 | 一年计划归档（第 12 节已被产品决定取代） |
| `docs/research/PROJECT_RESEARCH.md` | 新建 | 92 项调研，不是作业 |

`files/` 目录按仓库相对路径保存了上表全部完整文件。

## 请 ChatGPT 重点核对

1. 首页是否是「小模型学习实验室—Attention」，是否写出写在哪里、输入输出、先单头后多头、如何检查，且链到真实教材小节。
2. 验收是否同时有形状、因果性、**数值正确性**；是否关闭 dropout、固定小张量、单头和多头分开比、给了容差；是否仍不代写核心算法、不在浏览器跑 Python。
3. 首页是否还露出 `taskId`、`criterionId`、英文概念 id、工程阶段口号，或暗示会自动切换练习（不应露出）。
4. `learning-plan.json` 失败时，首页是否有人能看懂的错误和重试；目录、章节路由、搜索是否仍先初始化。
5. 六个旧项目是否退出主导航和主入口；`#/projects` 是否仍可打开且不是死链。
6. 是否把 `llm-course-progress` 的「已读」显示成已掌握 / 自动测试通过。
7. 任务验收是否约定为 `taskId + criterionId`（写在计划 JSON / OS 文档里即可）；概念旧证据是否被写成会自动完成新任务（阶段 1 只应写约定，不应实现证据系统）。
8. 机制来源是否误把 `ckorhonen` / `danielbodnar` / `HumphreySun98` 当成用户指定的三个仓库。
9. 是否误删 `projects/` 或开始做阶段 2。
10. 文档是否把 GitHub Pages 自动部署和未运行 `tools/publish.sh` 混成「没有发布」。

## 本包未收录（有意）

- `chapters/*.html`、`sitemap.xml`、`robots.txt`、`llms.txt`：构建产物，由 `tools/build-static.js` 生成。
- `projects/`：六个旧目录未改、未删。
- 教材 Markdown 正文（第 7 / 11 章）未改，只被计划 JSON 链接。
