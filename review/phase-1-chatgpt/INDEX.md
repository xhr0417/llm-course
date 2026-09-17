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
2. 本轮代码：`files/js/progress.js`、`files/content/learning-plan.json`、`files/tools/test-course.js`。
3. 第一功能阶段相对改造前：`tracked-edits.diff`。
4. 计划失败可重试 / 中文验收：`small-fixes.diff`。
5. 7.12 与 applyPlan：`round-3.diff`。
6. **本轮**相对上一提交：`round-4.diff`。
7. GitHub 上同一文件：`https://github.com/xhr0417/llm-course/blob/main/<path>`

---

## 本轮改了什么（阶段 1 结束前的审核修复）

不进入阶段 2，不扩功能。

### 1. 默认 create() 现在能用全局 localStorage

**原因是代码，不能只归因于内置浏览器。**

`js/progress.js` 的 factory 是传给外层 IIFE 的**参数**，并不在 `root` 的词法作用域里。默认 `create()` 读 `root.localStorage` 会在严格模式下抛 `ReferenceError`，被 `catch` 吞掉后 `storage = null`。于是：

- 页面提示「当前浏览器无法保存进度」；
- `llm-course-progress` 写不进去；
- `app.js` 的 `remember()` 直接用全局 `localStorage`，所以 `llm-course-last` 仍能保存。

上一轮审核包把刷新丢已读写成「内置浏览器限制」，**不准确**。同一套内置浏览器在修好作用域之后，标记已读再刷新仍然保留。

修复：UMD 改为 `factory(root)`，默认仍 `try` 取 `root.localStorage`；取不到或读写失败时降级为内存会话，**不写空对象、不清空已有键**。

回归测试：不传 `options.storage`，把可用的全局 `localStorage` 挂上，验证默认 `create()` 能读旧记录、保存已读，再 `create()` 一个新实例后恢复。已有显式注入 `storage` 的测试不能替代这条。

### 2. 组合容差，不是「两道门」

有限数值逐元素：

`abs(实际值 - 参考值) <= atol + rtol * abs(参考值)`

这是一条组合容差。计划 JSON、首页和 OS 文档已改掉「atol/rtol 两道门都通过」。不改 Attention 核心算法，不提供答案。

`node --test tools/test-course.js`：17 通过。

### 本轮未做

- 没有进入阶段 2。
- 没有删除 `projects/`。
- 没有做证据表单、卡点、复习队列、自动评分。
- 没有代写 Attention 核心算法。
- 没有运行 `tools/publish.sh`。

### 浏览器里实际看到的

本地 `http://localhost:8766/?v=progressfix`（同一 Cursor 内置浏览器、同一 origin）：

- 存储失败提示**不再出现**。
- 第 7 章点「标记已读」后，`localStorage.llm-course-progress` 为 `{"transformer":{"read":true}}`，进度 1/32。
- `location.reload()` 后按钮仍是「已读完 · 点击取消」，进度仍 1/32，侧栏 Transformer 仍为已读。文案仍写已读不是已掌握。
- 首页数值条文含 `abs(实际值 - 参考值) <= atol + rtol * abs(参考值)`，无「两道门」；7.12 仍标无掩码理解材料。

**仍须分开写的：**

- 第 7 章 375px 顶栏/表格约 20px 横向溢出，不是本轮改动。
- 未在系统 Chrome 再测一遍；本次内置浏览器已能保存，说明前次失败有代码原因。

---

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `AGENTS.md` | 新建 | Agent 约定 |
| `DESIGN.md` | 修改 | 计划稍后返回时不得重绘已打开的章节/目录 |
| `README.md` | 修改 | 从 Attention 开始 |
| `content/learning-plan.json` | 新建 | 本轮：组合容差公式 |
| `css/course.css` | 修改 | 当前任务面板 |
| `index.html` | 修改 | 主导航「我的学习 / 全部章节」 |
| `js/app.js` | 修改 | 计划与目录分开加载；`applyPlan` 仅首页刷新 |
| `js/progress.js` | 修改 | **本轮：factory 接收 root，默认 create 能持久化** |
| `js/course.js` | 修改 | 教材小节 query |
| `js/pages.js` | 修改 | 中文首页、失败/加载中状态 |
| `tools/build-static.js` | 修改 | 静态目录文案 |
| `tools/test-course.js` | 修改 | 本轮：默认 localStorage 回归 + 组合容差 |
| `tools/test-app-harness.js` | 新建 | 启动 app.js 的测试壳 |
| `docs/PERSONAL_LEARNING_OS.md` | 新建 | 本轮更新数值验收公式 |
| `docs/IMPLEMENTATION_PLAN.md` | 新建 | 分阶段工程 |
| `docs/LEARNING_PLAN.md` | 新建 | 一年计划归档 |
| `docs/research/PROJECT_RESEARCH.md` | 新建 | 92 项调研 |

## 请 ChatGPT 重点核对

1. 默认 `CourseProgress.create()`（不传 `storage`）是否还能读到未定义的 `root`。应能通过 `factory(root)` 拿到全局 `localStorage`。
2. 存储失败时是否仍降级、是否清空 `llm-course-progress` 旧数据（不应清空）。
3. 是否有「不传 options.storage、用全局 localStorage、新实例能恢复」的回归测试；显式注入 storage 的旧测试不能顶替。
4. 数值验收是否写成组合容差 `abs(actual - expected) <= atol + rtol * abs(expected)`，是否还留「两道门都通过」。
5. 是否代写 Attention 核心算法，或开始做阶段 2、删除 `projects/`。

## 本包未收录（有意）

- `chapters/*.html`、`sitemap.xml`、`robots.txt`、`llms.txt`：构建产物。
- `projects/`：六个旧目录未改、未删。
- 教材 Markdown 正文未改。
