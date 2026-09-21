# 阶段 3 第三步整体终审（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留**已封板的专项包，不要用本包替换它们：

- [`../phase-3-step3-chatgpt/INDEX.md`](../phase-3-step3-chatgpt/INDEX.md)（初版）
- [`../phase-3-step3-navfix-chatgpt/INDEX.md`](../phase-3-step3-navfix-chatgpt/INDEX.md)（章内任务条 + 吸顶留白）
- [`../phase-3-step3-search-chatgpt/INDEX.md`](../phase-3-step3-search-chatgpt/INDEX.md)（跨章搜索，**已封板**）

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线：[`67ec866`](https://github.com/xhr0417/llm-course/commit/67ec866) — 第二步审核包钉死（记录层已通过）
- 第三步初版实现：[`2d6f60e`](https://github.com/xhr0417/llm-course/commit/2d6f60e850ccfb52eda689660552b83a9fda5af4)
- 章内任务条 + 吸顶留白：[`02afd1b`](https://github.com/xhr0417/llm-course/commit/02afd1b)
- 跨章搜索：[`74500e3`](https://github.com/xhr0417/llm-course/commit/74500e3) + 链接带小节 [`705d592`](https://github.com/xhr0417/llm-course/commit/705d592)
- 跨章搜索专项：**已封板 PASS**（审核包 [`198e6af`](https://github.com/xhr0417/llm-course/commit/198e6af)；CI [35555487673](https://github.com/xhr0417/llm-course/actions/runs/35555487673) head `198e6af`）
- 本轮：第三步**整体终审**。不把跨章搜索专项封板写成第三步完成，也不把第三步写成阶段 3 完成。不开始 3b。
- 差异：`phase-3-step3-close.diff`（相对 `67ec866`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。跨章搜索封板时的线上状态见 [35555487673](https://github.com/xhr0417/llm-course/actions/runs/35555487673)（head `198e6af`）。本终审包另有一次 `main` push；是否已含本 INDEX，只看该新提交的 Actions。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是第三步当前源文件完整稿。`files/js/learning.js` **第三步未改**，只作记录规则对照。未跑 `build-static.js`（无章节 Markdown 变更）。

## 怎么看

1. 先读本文件。阶段 3 前两步已通过；跨章搜索专项已封板。本包请审**第三步整体**能否收尾。
2. 任务条与下一小节：`files/js/pages.js` 的 `taskContext` / `nextRelated` / `home` 折叠。
3. 章内定位与高度：`files/js/reader-ui.js`、`files/js/app.js`、`files/css/course.css`。
4. 搜索：`files/js/search.js` + `app.js` 的 `onNavigate`。
5. 记录规则对照：`files/js/learning.js`（未改）。
6. 相对 `67ec866` 的差异：`phase-3-step3-close.diff`。

---

## 第三步已经落地、且已分项通过的内容

1. **教材任务导航：** 从练习进入教材后有当前练习、「返回当前练习」、属于本周材料时的位置与「下一相关小节」；全书翻页仍在，改称全书上一课 / 下一课。
2. **首页分层：** 目标、选周、主按钮始终可见；详细验收、历史与参考在 `<details class="home-fold">` 里，关闭时 `display: none`，DOM 仍保留记录控件。
3. **章内目录 / 同章搜索：** 7.4 → 目录 7.14 为必要教材 6/6、下一小节 7.12；跳到 7.6 不显示错误下一步。Pages 已实测。
4. **吸顶留白：** 按实测 `--task-context-h`，不再用固定 12rem。桌面实测标题与条间隙约 13px。
5. **跨章搜索专项：已封板。** 普通左键改路由后定位；`href` 带 `?section=`，Cmd/Ctrl/中键也能落到目标小节。不要再审一遍搜索当新问题。

记录规则沿用第二步，本步未改 `learning.js`。

---

## 本轮未做

- 没有复习队列（3b）、自动评分或新项目。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包。
- 没有把跨章搜索专项封板写成第三步完成。
- 没有把第三步写成阶段 3 全部完成。

---

## 验证结果（摘录已通过项，不是本包新测）

- `node --test tools/test-course.js`：33 通过（含首页折叠、任务条、章内目录/搜索、跨章搜索、href 含 section、记录层回归）。
- 跨章搜索封板 CI：[35555487673](https://github.com/xhr0417/llm-course/actions/runs/35555487673)，head `198e6af`。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时终审包提交的 CI / Pages 尚未出结果。以本包提交后的 GitHub Actions 为准。
- 375／768／1280 的独立重跑（吸顶留白曾以本地测试写入审核包；桌面 Pages 已确认约 13px 间隙）。
- 阶段 3b 复习队列。

---

## 请 ChatGPT 重点核对

1. 第三步是否只做了教材任务导航 + 首页分层，以及后来的导航小修；有没有夹带复习队列、自动评分或新项目。
2. 从练习进入 7.4，任务条是否显示当前练习、返回、下一相关 7.5；7.14 是否 6/6 且下一小节 7.12。
3. 首页是否先展示目标与主按钮，详细验收/历史/参考是否按需展开且关闭时看不见，同时 DOM 仍有「保存本条记录」。
4. 记录规则是否仍是第二步那套（空依据不能通过、保存本条、历史成对保留）。
5. 本 diff 是否夹带第 0 / 24 章遗留修改。
6. 跨章搜索专项是否已被本包误写成「还没过」。应记为：该专项已封板，本包只问第三步整体能不能收尾。
7. 是否把本包写成阶段 3 全部完成，或自动进入 3b。应记为：前两步已通过，跨章搜索专项已封板，第三步整体待终审；阶段 3 在第三步终审通过前尚未完成；不要开始 3b。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/pages.js` | 修改 | 任务上下文、下一相关小节、首页折叠 |
| `js/app.js` | 修改 | 小节参数、任务条同步、跨章改 hash、实测高度 |
| `js/reader-ui.js` | 修改 | 定位前通知当前标题 |
| `js/search.js` | 修改 | 同章原地；href 带 section |
| `js/learning.js` | 未改 | 记录规则对照 |
| `css/course.css` | 修改 | 吸顶条、`--task-context-h`、首页折叠隐藏 |
| `tools/test-course.js` | 修改 | 第三步行为与搜索回归 |
| `tools/test-app-harness.js` | 修改 | 章内点击、hashchange、10.4  stub |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 本轮改为第三步整体终审 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 导航与分层已写入 DESIGN |
| `DESIGN.md` | 修改 | 任务条、折叠、实测留白 |
| `README.md` | 修改 | 从练习进教材能看到当前任务 |
