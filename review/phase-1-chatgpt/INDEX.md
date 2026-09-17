# Phase 1 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。

- 本包是 **第一功能阶段** 的源文件快照 + 已跟踪文件的 diff。
- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 范围：展示「小模型学习实验室—Attention」；六个旧作业退出主导航。不做证据表单、卡点、复习队列、自动评分，不删除 `projects/`，不发布。

审核时请对照 `files/docs/PERSONAL_LEARNING_OS.md` 第 8 节，以及 `files/DESIGN.md`。

## 怎么看

1. 先读本文件和 `files/docs/PERSONAL_LEARNING_OS.md`。
2. 功能改动看 `files/js/pages.js`、`files/js/app.js`、`files/content/learning-plan.json`、`files/index.html`。
3. 已有文件的行级差异看 `tracked-edits.diff`（只含 9 个已跟踪文件；新建文件没有旧版本，直接打开 `files/` 下的完整稿）。
4. GitHub 上同一文件：`https://github.com/xhr0417/llm-course/blob/main/<path>`

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `AGENTS.md` | 新建 | Agent 约定：源文件 vs 构建产物、不把已读当成掌握 |
| `DESIGN.md` | 修改 | 身份、主导航、主按钮、验证范围改成「我的学习」 |
| `README.md` | 修改 | 从 Attention 开始，而不是三条路线 / 六个作业 |
| `content/learning-plan.json` | 新建 | 发布用计划：当前任务、知识点、criterion、教材小节 |
| `css/course.css` | 修改 | 当前任务面板、步骤/验收列表 |
| `index.html` | 修改 | 主导航改为「我的学习 / 全部章节」；静态目录文案 |
| `js/app.js` | 修改 | 加载计划 JSON；小节 `?section=`；`#/projects` 说明页 |
| `js/course.js` | 修改 | `href` / `parse` 支持教材小节 |
| `js/pages.js` | 修改 | 首页当前任务；旧项目说明页；路线降为查阅 |
| `tools/build-static.js` | 修改 | 静态目录不再把六个项目当主线作品集 |
| `tools/test-course.js` | 修改 | 计划 JSON 与入口文案门禁 |
| `docs/PERSONAL_LEARNING_OS.md` | 新建 | 产品需求：机制来源纠正、数据边界、阶段 1 验收 |
| `docs/IMPLEMENTATION_PLAN.md` | 新建 | 分阶段工程；阶段 1 已完成，不要自动做阶段 2 |
| `docs/LEARNING_PLAN.md` | 新建 | 一年计划归档（第 12 节已被产品决定取代） |
| `docs/research/PROJECT_RESEARCH.md` | 新建 | 92 项调研，不是作业 |

`files/` 目录按仓库相对路径保存了上表全部完整文件。

## 请 ChatGPT 重点核对

1. 首页是否是「小模型学习实验室—Attention」，是否写出写在哪里、输入输出、先单头后多头、如何检查，且链到真实教材小节。
2. 是否代写了 Attention 核心算法（不应代写）。
3. 六个旧项目是否退出主导航和主入口；`#/projects` 是否仍可打开且不是死链。
4. 是否把 `llm-course-progress` 的「已读」显示成已掌握 / 自动测试通过。
5. 任务验收是否约定为 `taskId + criterionId`，概念旧证据是否被写成会自动完成新任务（阶段 1 只应写约定，不应实现证据系统）。
6. 机制来源是否误把 `ckorhonen` / `danielbodnar` / `HumphreySun98` 当成用户指定的三个仓库。
7. 是否误删 `projects/` 或开始做阶段 2。

## 本包未收录（有意）

- `chapters/*.html`、`sitemap.xml`、`robots.txt`、`llms.txt`：构建产物，由 `tools/build-static.js` 生成。
- `projects/`：六个旧目录未改、未删。
- 教材 Markdown 正文（第 7 / 11 章）未改，只被计划 JSON 链接。
