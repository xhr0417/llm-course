# 阶段 3 第三步小修索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-3-step3-chatgpt/INDEX.md`](../phase-3-step3-chatgpt/INDEX.md) 作为第三步初版；本包只审初版上 Pages 后发现的两处小修。不要用本包替换前两步或第三步初版的审核包。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 第三步初版实现：[`2d6f60e`](https://github.com/xhr0417/llm-course/commit/2d6f60e850ccfb52eda689660552b83a9fda5af4)
- 第三步初版审核包：[`1c3de6d`](https://github.com/xhr0417/llm-course/commit/1c3de6d71bda7bac6a3aaed6314cb13fd80b1ae5)
- 初版 [CI 与 Pages 已成功](https://github.com/xhr0417/llm-course/actions/runs/35552156291)，审核在 Pages 上操作后指出两处问题，**第三步暂不收尾**。
- 本轮实现提交：[`02afd1b`](https://github.com/xhr0417/llm-course/commit/02afd1b) — `fix: 章内跳转同步任务条，并按实测高度给标题留白`
- 本轮：**只修**章内跳转后任务条更新，以及吸顶条挡住目标标题。前两步验收结论不变。阶段 3 整体尚未完成。
- 审核入口：本文件（固定到本审核包提交后的 GitHub 路径）
- 差异：`phase-3-step3-navfix.diff`（相对 `1c3de6d`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。本轮随 `02afd1b` 推 `main`；Pages 是否已含这两处小修，只看该提交的 Actions。不要用第三步初版的绿勾代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮关键源文件的完整稿。本轮不改章节 Markdown，未跑 `build-static.js`，diff 里没有 `chapters/*.html`。

## 怎么看

1. 先读本文件。阶段 3 前两步**已经通过**；第三步初版方向可保留，本轮只审下面两处。
2. 章内定位回调：`files/js/reader-ui.js` 的 `reveal` 在滚动前调用 `onSection`。
3. 任务条就地更新与高度实测：`files/js/app.js` 的 `syncTaskContext` / `measureTaskContext`。
4. 搜索同章点击：`files/js/search.js` 对搜索结果 `preventDefault`，再 `focusSection`，避免 hash 丢掉当前小节。
5. 样式：`files/css/course.css` 用 `--task-context-h`，不再用固定 `12rem`。
6. 行为测试：`files/tools/test-course.js`（目录 7.4→7.14 为 6/6 且下一小节 7.12；7.6 无错误下一步；滚动留白用实测高度）。
7. 相对 `1c3de6d` 的差异：`phase-3-step3-navfix.diff`。

---

## 本轮改了什么

只修第三步初版在 Pages 上的两处问题。不改学习设计，不扩功能。首页分层与记录规则保持初版。不删 `projects/`，不运行 `tools/publish.sh`，不把工作区里第 0 / 24 章遗留修改打进本包。

### 1. 章内跳转后任务条跟着当前标题

目录点击和搜索定位只滚动正文，不改路由。滚动前用当前标题调用 `pages.taskContext`，替换已有 `.task-context`。没有任务条的参考页不会凭空插入。

- 首页进 7.4 再点目录 **7.14 Multi-Head Attention**：必要教材 **6 / 6**，下一相关小节 **7.12**。
- 跳到非任务小节（如 **7.6**）：仍显示当前练习和返回，不显示错误的「下一相关小节」。

### 2. 目标标题不被吸顶条挡住

任务条略收紧。打开教材、目录或搜索定位后，把 `.task-context` 的实际高度写入 `--task-context-h`；标题 `scroll-margin-top` 为顶栏 + 该高度 + 间距。窗口改宽会重测。不再使用固定 `12rem`。

---

## 本轮未做

- 没有改记录规则，没有复习队列、自动评分或新项目。
- 没有重做首页分层，没有改八周任务文案。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包。
- 没有把本轮说成阶段 3 或第三步已经收尾。

---

## 验证结果

本地已跑（通过）：

- `node --test tools/test-course.js`：32 通过（含目录 7.4→7.14、7.6 无下一步、搜索回 7.14、滚动留白不再用 12rem）
- 未跑 `build-static.js`（无章节 Markdown 变更）

浏览器（本地 `http://127.0.0.1:8770/#/`，无缓存脚本）：

- 1280：首页进 7.4，标题完整可见，间隙约 13px；目录到 7.14 为 6/6、下一小节 7.12；目录到 7.6 无下一步；搜索 7.14 回到 6/6。
- 768：首页进 7.4 同样 1/6、下一小节 7.5，标题不被挡住；目录 / 搜索行为同上。
- 375：任务条换行后高度约 239–257px，7.4 / 7.14 / 7.6 目标标题仍在条下方，间隙为正。

### 未测项（不宣称通过）

- 写本包时本轮 CI / Pages 尚未出结果。以 [`02afd1b`](https://github.com/xhr0417/llm-course/commit/02afd1b) 的 GitHub Actions 为准，不要用第三步初版的绿勾代替。
- 自有服务器（未运行 `tools/publish.sh`）。
- 阶段 3b 复习队列。

---

## 请 ChatGPT 重点核对

1. 从 7.4 点目录到 7.14 后，任务条是否为必要教材 6/6，下一相关小节是否为 7.12。
2. 跳到 7.6 这类非任务小节时，是否不再显示错误的下一步。
3. 首页入口、目录、搜索定位后，目标标题是否完整可见；375 / 768 / 1280 下吸顶条换行后是否仍挡住标题。
4. 是否仍用首次路由参数生成任务条，或仍用固定 `12rem` 留白。
5. 记录规则、首页分层、八周任务是否被改动。
6. 本 diff 是否夹带了第 0 / 24 章遗留修改。
7. 是否把本轮说成第三步或阶段 3 已经收尾。应记为：前两步已通过，第三步这两处小修待审，阶段 3 整体尚未完成。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/reader-ui.js` | 修改 | 定位前通知当前标题；标题 id 用 `setAttribute` |
| `js/app.js` | 修改 | 就地替换任务条，实测吸顶高度 |
| `js/search.js` | 修改 | 同章搜索结果 `preventDefault` 后定位 |
| `js/pages.js` | 修改 | 导出 `taskContext`；任务条文案略收紧 |
| `css/course.css` | 修改 | `--task-context-h` 留白，去掉 12rem |
| `tools/test-course.js` | 修改 | 目录 / 搜索 / 留白回归 |
| `tools/test-app-harness.js` | 修改 | 章内点击、替换节点、测量高度 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 第三步验收补上这两处 |
| `DESIGN.md` | 修改 | 章内同步任务条；实测留白 |
