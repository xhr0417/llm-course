# 阶段 3 第二步改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-1-chatgpt/INDEX.md`](../phase-1-chatgpt/INDEX.md)、[`../phase-2-chatgpt/INDEX.md`](../phase-2-chatgpt/INDEX.md)、[`../issue-1-p0-chatgpt/INDEX.md`](../issue-1-p0-chatgpt/INDEX.md)、[`../issue-2-chatgpt/INDEX.md`](../issue-2-chatgpt/INDEX.md)、[`../issue-3-chatgpt/INDEX.md`](../issue-3-chatgpt/INDEX.md)、[`../phase-3-step1-chatgpt/INDEX.md`](../phase-3-step1-chatgpt/INDEX.md)、[`../issue-4-chatgpt/INDEX.md`](../issue-4-chatgpt/INDEX.md)，不要用本包替换它们。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线提交：[`c0296a6`](https://github.com/xhr0417/llm-course/commit/c0296a6) — `fix: 补齐第 2/3/8 周因果、对齐与真实评测`（issue #4 已通过）
- 上一版实现：[`95c2f20`](https://github.com/xhr0417/llm-course/commit/95c2f20a3e8fcd8af126bdb7c0c47e96a4e0c935) — `fix: 验收依据随结果保存，无依据不能算通过`。只覆盖「通过必须有依据、失败依据进历史」；**不是**本轮要审的实现。
- 本轮实现提交：本文件所在 commit — 每条验收显式「保存本条记录」；同结果不同依据保留旧快照；完全相同不重复追加；未保存草稿提示与保护。
- 本轮：**阶段 3 第二步**最小记录层的保存闭环。`evidenceSystemImplemented` 现为 `true`。不要把 `95c2f20` 当成已经包含保存按钮。
- 审核入口：本文件（请固定到本轮实现提交，不要用 `95c2f20` 上的旧 INDEX）
- 差异：`phase-3-step2.diff`（相对 `c0296a6`，不含第 0/24 章遗留修改；含 `95c2f20` 的依据修正 **以及** 本轮保存闭环）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

[`95c2f20`](https://github.com/xhr0417/llm-course/commit/95c2f20a3e8fcd8af126bdb7c0c47e96a4e0c935) 已 push，[当时 CI 与 Pages 部署成功](https://github.com/xhr0417/llm-course/actions/runs/35549851932)，那一版 **没有**「保存本条记录」。本轮保存补丁随 **本提交** 推 `main`；Pages 是否已含保存按钮，只看本提交的 Actions，不要用 `95c2f20` 的绿勾代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮关键源文件的完整稿。本轮不改章节 Markdown，未跑 `build-static.js`，diff 里没有 `chapters/*.html`。

## 怎么看

1. 先读本文件。Issue #4 只覆盖第 2/3/8 周任务文案，**已经通过**；本轮是记录层，不要用 issue #4 的三条文案再审一遍当本轮范围。
2. 存储与完成规则：`files/js/learning.js`。
3. 首页表单与「进入下一任务」：`files/js/pages.js`、`files/js/app.js`、`files/css/course.css`。
4. 工程范围：`files/docs/IMPLEMENTATION_PLAN.md`「本轮（阶段 3 第二步）」。
5. 行为测试：`files/tools/test-course.js`（完成规则、失败历史、拓展不挡、概念不自动完成、刷新、阅读进度隔离、保存失败、确认才跳转、保存本条、连续失败依据、空通过不破坏已有记录）。
6. 相对 `c0296a6` 的差异：`phase-3-step2.diff`。

---

## 本轮改了什么

只做阶段 3 实现顺序的第 2 步：最小验收记录。不追加学习设计，不做教材任务上下文导航，不把首页再分层/折叠。不删 `projects/`，不运行 `tools/publish.sh`，不把工作区里第 0 / 24 章遗留修改打进本包。

### 1. 完成只看当前必需项，且每条有依据

`CourseLearning.isTaskComplete`：该任务全部 `required !== false` 的验收，**当前**结果必须是 `user_passed`，且该条有非空简短依据。未检查、未通过、空依据都不算完成。来源固定为 `user_reported`，本轮不写 `auto`。

首页每条验收有三个选项：未检查 / 未通过 / 用户自报通过，「简短依据」文本框，以及「保存本条记录」。控件用 `data-check` / `data-evidence` / `data-save-check`，HTML 不出现 `taskId`、`criterionId`、`lab.attention`。勾选通过后点保存但依据为空时提示「需要写下简短依据」，已有有效记录不被改写。只改依据也必须点保存；结果没变但依据变了会把旧快照留在历史。未保存时提示「本条尚未保存」，换周或首页重绘不会悄悄丢掉草稿。

### 2. 拓展不挡；概念历史不完成新任务

拓展项同样可填，文案写明不阻挡核心任务。概念四个独立维度挂在 `conceptId` 上，第 1 周勾过的「因果掩码 / 自己实现」会出现在第 2 周，但第 2 周的 `assembled-causal` 仍从「未检查」开始。

### 3. 失败历史、刷新、阅读进度隔离

修正后追加新结果。结果没变但依据变了，旧结果与当时依据一并进 `history`；完全相同的再次提交不重复追加。页面写「曾经未通过，当时依据：…。完成只看当前结果。」刷新后已保存的 `llm-course-learning` 仍在。旧键 `llm-course-progress` 的已读不被改写；重置阅读进度不清除学习记录。

### 4. 保存失败与自报文案

保存失败时提示「学习记录无法保存到此浏览器，本次会话仍可继续填写。」会话内仍可勾选。页面写「这是自己填写的结果，不是本站跑过的自动检查。」禁止出现「自动测试通过」。

### 5. 确认后才进入下一任务

全部必需项当前自报通过后出现「进入下一任务」。不自动跳转。点按钮才把 `llm-course-current-task` 换成同阶段下一周。第 8 周没有下一任务时只提示这是本阶段最后一项。

---

## 本轮未做

- 没有教材任务上下文导航，没有首页进一步分层/折叠。
- 没有复习队列，没有自动脚本写入 `auto`。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包。
- 没有把选周当成完成。

---

## 验证结果

本地已跑（通过）：

- `node --test tools/test-course.js`：27 通过（原有回归 + 完成规则/失败历史/拓展/概念隔离/刷新/阅读进度/保存失败/确认下一任务 + 保存本条/连续失败依据/空通过不破坏已有记录）
- 未跑 `build-static.js`（无章节 Markdown 变更）

浏览器（本地 `http://127.0.0.1:8766/?v=phase3step2#/`）：

- 默认第 1 周 Attention；四条必需验收均为「未检查」；无「进入下一任务」；无「自动测试通过」。
- 第一条不填依据直接标「用户自报通过」并点保存：提示需要写下简短依据，已有记录不被改写，无「进入下一任务」。
- 第一条先标「未通过」并写失败依据后点保存：仍停在 Attention。只改依据再保存：刷新后新依据仍在，旧失败依据在历史里。
- 未保存草稿换到第 2 周再回来：依据还在，并提示尚未保存。
- 四条必需都保存为「用户自报通过」并各有依据后出现「进入下一任务」，标题仍是 Attention。点按钮后才到第 2 周；`assembled-causal` 仍是未检查；「因果掩码 / 自己实现」仍勾着。
- 第 2 周只填三条必需、拓展保持未检查：出现「进入下一任务」和「拓展未完成不阻挡」。
- 刷新后仍在第 2 周，记录仍在。回到第 1 周仍能看到「曾经未通过」。目录与第 7 章仍可打开；阅读位置不是练习完成。

### 未测项（不宣称通过）

- 写本包时本轮 CI / Pages 尚未出结果；`95c2f20` 的绿勾不能代表本层。以本提交的 GitHub Actions 为准。
- 系统 Chrome 下 375 / 768 / 1280 的完整视觉走查（本轮浏览器未改视口）。
- 自有服务器（未运行 `tools/publish.sh`）。
- 阶段 3 第三步：教材任务上下文导航、首页分层。

---

## 请 ChatGPT 重点核对

1. 未检查、未通过、空依据是否都不能让任务完成；是否必须全部必需项**当前**为用户自报通过且有简短依据。
2. 拓展未完成是否不阻挡；第 1 周概念记录是否不能自动完成第 2 周验收。
3. 只改依据并保存后刷新是否仍在；连续两次不同失败依据再通过，两次失败依据是否都保留。
4. 空依据提交通过是否被拒绝，且已有有效记录是否不被破坏。
5. 未保存内容是否有提示；换周或首页重绘是否悄悄丢掉草稿。
6. 保存失败是否有明确提示；自报结果是否被显示成自动验证通过。
7. 完成后是否自动跳到下一任务，还是必须用户确认。
8. 本 diff 是否夹带了第 0 / 24 章遗留修改，或教材任务导航 / 首页折叠。
9. 是否把本轮说成阶段 3 全部完成。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/learning.js` | 新增 | 学习记录存储与完成规则 |
| `js/pages.js` | 修改 | 验收表单、概念四维、短记录、确认下一任务 |
| `js/app.js` | 修改 | 绑定记录、保存失败提示、确认后换周 |
| `css/course.css` | 修改 | 记录控件 44px |
| `index.html` | 修改 | 引入 `js/learning.js` |
| `content/learning-plan.json` | 修改 | `evidenceSystemImplemented: true` |
| `tools/test-course.js` | 修改 | 记录层行为测试 |
| `tools/test-app-harness.js` | 修改 | radio/checkbox、保存失败、加载 learning.js |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 标明本轮是阶段 3 第二步 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 最小表单已实现 |
| `DESIGN.md` | 修改 | 记录控件与确认下一任务 |
| `README.md` | 修改 | 自报结果与确认进入下一任务 |
