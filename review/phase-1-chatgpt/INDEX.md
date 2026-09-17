# Phase 1 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 审核入口：本文件
- 范围：展示「小模型学习实验室—Attention」；六个旧作业退出主导航。不做证据表单、卡点、复习队列、自动评分，不删除 `projects/`。
- 发布区分：`main` 推送会触发 **GitHub Pages** 自动部署。自有服务器只在运行 `tools/publish.sh` 时更新。不要把这两件事写成同一句「没有发布」。

审核时请对照 `files/docs/PERSONAL_LEARNING_OS.md` 第 8 节，以及 `files/DESIGN.md`。

`files/` 始终是**当前最新完整稿**。

## 怎么看

1. 先读本文件「本轮改了什么」，再读 `files/docs/PERSONAL_LEARNING_OS.md`。
2. 功能改动看 `files/js/app.js`、`files/js/pages.js`、`files/content/learning-plan.json`、`files/tools/test-course.js`、`files/tools/test-app-harness.js`。
3. 第一功能阶段相对改造前：`tracked-edits.diff`。
4. 上一轮小修（计划失败可重试、中文验收、数值 1e-5 误用 7.12 的那一版）：`small-fixes.diff`。
5. **本轮**相对上一提交的行级差异：`round-3.diff`。
6. GitHub 上同一文件：`https://github.com/xhr0417/llm-course/blob/main/<path>`

---

## 本轮改了什么（阶段 1 最后一轮修正）

不进入阶段 2，不扩功能。只修正数值验收表述、计划返回时的路由，以及行为测试。

### 1. 数值验收不再把 7.12 当因果 1e-5 标准

7.12 是**无因果掩码**的手算，结果只保留三位小数，不能直接当因果注意力的 1e-5 对照。

- 教材链接改成「无掩码理解材料，不是因果数值标准」。
- 因果数值验收：固定输入、关闭 dropout；对照必须与实现使用同一套掩码、缩放、dtype；多头还要统一拆头顺序和输出投影约定。
- 写明 atol 看接近 0 的差、rtol 看相对误差，两道门都过才算数值一致。
- 仍不提供核心算法答案，站点仍不运行 Python。

### 2. applyPlan 只在首页刷新

计划数据到达或失败后，**仅当当前页是首页**才调用 `route()`。用户已在章节、参考手册或目录时，不重绘、不重置滚动和交互。之后回到首页会显示最新计划。

### 3. 行为测试不再只靠源码正则

`tools/test-app-harness.js` 真正启动 `js/app.js`，用可控的 `fetch`：

- 计划第一次失败，目录可进，搜索「GRPO-TOKEN」有结果，点重试后首页出现 Attention。
- 计划延迟返回期间进入章节；成功或失败都不增加章节 `innerHTML` 写入次数。回到首页才看到最新计划或错误。

`node --test tools/test-course.js`：16 通过。

### 本轮未做

- 没有进入阶段 2。
- 没有删除 `projects/`。
- 没有做证据表单、卡点、复习队列、自动评分。
- 没有代写 Attention 核心算法。
- 没有运行 `tools/publish.sh`。

### 浏览器里实际看到的

本地 `http://localhost:8766/?v=phase1round3`（Cursor 内置浏览器）：

- 首页标题仍是「小模型学习实验室—Attention」；验收含 atol/rtol、无掩码说明；没有把 7.12 和 1e-5 写在一起。
- **375px 首页**：`scrollWidth == clientWidth`，无横向撑开；H1 完整；主按钮可点。
- **375px 第 7 章**：仍有约 20px 横向溢出（顶栏与教材表格），不是本轮改 CSS 引入的。
- 同会话标记已读会变成「已读完 · 点击取消」、进度 1/32。

**不能声称通过：**

- **刷新后仍保留已读。** 同一 origin 下点「标记已读」再 `location.reload()`，按钮回到「标记已读」，进度回到 0/32。`llm-course-last` 能写入；`llm-course-progress` 在此内置浏览器里写不进去。页面一直提示「当前浏览器无法保存进度」。未在系统 Chrome 复测。
- 未在真机 Safari / 系统 Chrome 做计划 JSON 失败的 Network 拦截。失败与延迟不打断章节由 Node 行为测试覆盖。
- 未声称顶栏汉堡按钮达到 44px（测得约 36px，原有尺寸）。

---

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `AGENTS.md` | 新建 | Agent 约定 |
| `DESIGN.md` | 修改 | 本轮：计划稍后返回时不得重绘已打开的章节/目录 |
| `README.md` | 修改 | 从 Attention 开始 |
| `content/learning-plan.json` | 新建 | 本轮：7.12 降为无掩码理解材料；数值验收改 atol/rtol |
| `css/course.css` | 修改 | 当前任务面板 |
| `index.html` | 修改 | 主导航「我的学习 / 全部章节」 |
| `js/app.js` | 修改 | 本轮：`applyPlan` 仅首页 `route()` |
| `js/course.js` | 修改 | 教材小节 query |
| `js/pages.js` | 修改 | 中文首页、失败/加载中状态 |
| `tools/build-static.js` | 修改 | 静态目录文案 |
| `tools/test-course.js` | 修改 | 本轮：数值条文 + 真实 fetch 行为测试 |
| `tools/test-app-harness.js` | 新建 | 本轮：启动 app.js 的测试壳 |
| `docs/PERSONAL_LEARNING_OS.md` | 新建 | 本轮更新第 4 / 8 节数值验收 |
| `docs/IMPLEMENTATION_PLAN.md` | 新建 | 本轮补充计划延迟返回的验证 |
| `docs/LEARNING_PLAN.md` | 新建 | 一年计划归档 |
| `docs/research/PROJECT_RESEARCH.md` | 新建 | 92 项调研 |

## 请 ChatGPT 重点核对

1. 7.12 是否仍被当成因果注意力的 1e-5 数值标准（不应）。是否标明无掩码、三位小数、只作理解材料。
2. 数值验收是否要求固定输入、关 dropout、对照与掩码/缩放/dtype 一致；多头是否要求拆头顺序和输出投影约定；atol/rtol 是否只说明用途、没有核心算法答案。
3. 计划 JSON 在章节页返回时，是否会 `route()` 重绘章节（不应）。回首页是否能看到最新计划。
4. 行为测试是否真的 mock fetch、点重试、检查搜索结果和章节 `innerHTML` 写入次数；是否仍只用 `js/app.js` 源码正则冒充验证（不应）。
5. 首页是否还露出内部 id 或工程阶段口号。
6. 是否误删 `projects/` 或开始做阶段 2。
7. 文档是否把 GitHub Pages 自动部署和未运行 `tools/publish.sh` 混成「没有发布」。

## 本包未收录（有意）

- `chapters/*.html`、`sitemap.xml`、`robots.txt`、`llms.txt`：构建产物。
- `projects/`：六个旧目录未改、未删。
- 教材 Markdown 正文未改，只改了计划 JSON 对 7.12 的用法说明。
