# 阶段 3 第三步改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-1-chatgpt/INDEX.md`](../phase-1-chatgpt/INDEX.md)、[`../phase-2-chatgpt/INDEX.md`](../phase-2-chatgpt/INDEX.md)、[`../issue-1-p0-chatgpt/INDEX.md`](../issue-1-p0-chatgpt/INDEX.md)、[`../issue-2-chatgpt/INDEX.md`](../issue-2-chatgpt/INDEX.md)、[`../issue-3-chatgpt/INDEX.md`](../issue-3-chatgpt/INDEX.md)、[`../phase-3-step1-chatgpt/INDEX.md`](../phase-3-step1-chatgpt/INDEX.md)、[`../issue-4-chatgpt/INDEX.md`](../issue-4-chatgpt/INDEX.md)、[`../phase-3-step2-chatgpt/INDEX.md`](../phase-3-step2-chatgpt/INDEX.md)，不要用本包替换它们。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线提交：[`67ec866`](https://github.com/xhr0417/llm-course/commit/67ec866) — `docs: 审核包指向保存补丁 6a4d812`（第二步审核包钉死；实现本身在 [`6a4d812`](https://github.com/xhr0417/llm-course/commit/6a4d8126283b803cdc5d39b88260e0f4b3ad44cb)）
- 上一版实现：[`6a4d812`](https://github.com/xhr0417/llm-course/commit/6a4d8126283b803cdc5d39b88260e0f4b3ad44cb) — `fix: 验收改为显式保存，避免未写入的依据丢失`。**阶段 3 第二步已通过**，不要再审一遍保存闭环当本轮范围。
- 本轮实现提交：[`2d6f60e`](https://github.com/xhr0417/llm-course/commit/2d6f60e850ccfb52eda689660552b83a9fda5af4) — `feat: 教材页显示当前练习导航并分层首页`。
- 本轮：**阶段 3 第三步**教材任务上下文导航与首页信息分层。前两步已通过。阶段 3 整体尚未完成。
- 审核入口：本文件（固定到 [`2d6f60e` 之后的审核包提交](https://github.com/xhr0417/llm-course/blob/main/review/phase-3-step3-chatgpt/INDEX.md)；实现以 `2d6f60e` 为准）
- 差异：`phase-3-step3.diff`（相对 `67ec866`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

第二步的 [CI 与 Pages 成功](https://github.com/xhr0417/llm-course/actions/runs/35550582078) 只覆盖 [`67ec866`](https://github.com/xhr0417/llm-course/commit/67ec866) / [`6a4d812`](https://github.com/xhr0417/llm-course/commit/6a4d8126283b803cdc5d39b88260e0f4b3ad44cb)，**不能**代表本轮导航是否已上 Pages。本轮随 `2d6f60e` 推 `main`；Pages 是否已含任务导航，只看该提交的 Actions。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮关键源文件的完整稿。`files/js/learning.js` **本轮未改**，只作记录规则对照。本轮不改章节 Markdown，未跑 `build-static.js`，diff 里没有 `chapters/*.html`。

## 怎么看

1. 先读本文件。阶段 3 第一步（八周任务 + 选周）和第二步（最小记录层）**已经通过**；本轮只审导航与首页分层。
2. 教材任务条：`files/js/pages.js` 的 `taskContext` / `nextRelated` / `lesson` / `footer`。
3. 首页折叠：同一文件的 `fold` 与 `home()`；未保存草稿时验收折叠会打开。
4. 小节参数：`files/js/app.js` 把 `locationRoute.section` 传给 `pages.lesson`。
5. 样式：`files/css/course.css`（`.task-context` 吸顶、`.home-fold` 关闭时 `display: none`）。
6. 工程范围：`files/docs/IMPLEMENTATION_PLAN.md`「本轮（阶段 3 第三步）」。
7. 行为测试：`files/tools/test-course.js`（首页折叠顺序、7.4 下一小节、7.14→7.12、无关章无下一小节、换周后 7.4 不再当本周材料、从首页打开教材仍有任务条；原有 27 条记录层回归仍在）。
8. 相对 `67ec866` 的差异：`phase-3-step3.diff`。

---

## 本轮改了什么

只做阶段 3 实现顺序的第 3 步：教材任务上下文导航，以及首页信息分层。沿用已验收记录规则。不增加复习队列、自动评分或新项目。不删 `projects/`，不运行 `tools/publish.sh`，不把工作区里第 0 / 24 章遗留修改打进本包。

### 1. 从练习进入教材后能看见当前任务

学习计划加载成功后，教材章顶部有 `aside.task-context`：当前练习标题、「返回当前练习」（回 `#/`）。该小节属于当前任务材料时，再显示它在同角色材料中的位置（例如「必要教材 · 1 / 6 · 7.4 …」），以及「写完后对照」第一条（当前已是对照小节则不再重复提示）。

吸顶在顶栏下方，滚到小节后仍能看见。全书翻页仍在，有任务条时改称「全书上一课 / 全书下一课」。

HTML 不出现 `taskId`、`criterionId`、`lab.attention`，也不写「自动测试通过」。

### 2. 下一相关小节

只在当前任务、当前章、当前小节匹配到计划材料时给出：

- 同一 `role` 的下一条内部教材（有 `chapterId`、非外链）。
- 若当前是最后一条 `required`，下一条改为第一条 `check-after`。
- 不跳到并行补基础或外链对照。最后一条对照没有「下一相关小节」，回练习即可。
- 带了 `?section=` 但该标题不是本周材料（例如第 2 周打开 7.4）：只保留当前练习 + 返回，不把另一条材料冒充当前位置，也没有下一小节。

### 3. 首页目标和主操作在前，细节按需展开

首页始终可见：当前练习标题、目标、选周、主按钮「打开必要教材：…」。全部必需项已通过时，「进入下一任务」也在折叠块外面。

其余用原生 `<details class="home-fold">`：必要教材、写在哪里、实现步骤、如何检查、验收与记录、相关概念、短记录、并行补基础、对照入口。关闭时 CSS 明确 `display: none`，内容仍留在 DOM，记录层测试不必先点开。有未保存草稿或空依据被拒时，验收折叠默认打开，以免看不见提示。

### 4. 记录规则未改

完成仍只看全部必需项当前「用户自报通过」且有简短依据。「保存本条记录」、相同快照不重复、空依据不能通过、拓展不挡、概念不自动完成新任务、确认后才换周。`js/learning.js` 本轮未改。

---

## 本轮未做

- 没有复习队列，没有自动脚本写入 `auto`，没有新练习项目。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包。
- 没有把本轮说成阶段 3 全部完成。

---

## 验证结果

本地已跑（通过）：

- `node --test tools/test-course.js`：30 通过（原 27 条记录层回归 + 首页折叠顺序 + 教材任务条/下一小节 + 从首页打开教材）
- 未跑 `build-static.js`（无章节 Markdown 变更）

浏览器（本地 `http://127.0.0.1:8767/?v=step3-sticky#/`）：

- 首页目标、选周、主按钮可见；详细块默认收起；点开「验收与记录」仍能看到「保存本条记录」、失败历史「失败 C / 失败 D」和当前「通过 E」。
- 点「打开必要教材」进入 7.4：任务条显示手写因果多头注意力、返回当前练习、下一相关小节 7.5、写完后对照 7.12；页脚为全书上一课/下一课。
- 下一相关小节到 7.5 后，位置为必要教材 2 / 6，下一小节为 7.9。
- 打开 7.14：必要教材 6 / 6，下一相关小节为 7.12。
- 打开第 0 章知识地图：只有当前练习和返回，没有下一相关小节。
- 返回首页后折叠与主按钮仍在。

### 未测项（不宣称通过）

- 写本包时本轮 CI / Pages 尚未出结果。以 [`2d6f60e`](https://github.com/xhr0417/llm-course/commit/2d6f60e850ccfb52eda689660552b83a9fda5af4) 的 GitHub Actions 为准，不要用第二步的绿勾代替。
- 系统 Chrome 下 375 / 768 / 1280 的完整视觉走查（本轮浏览器未改视口）。
- 自有服务器（未运行 `tools/publish.sh`）。
- 阶段 3b 复习队列。

---

## 请 ChatGPT 重点核对

1. 从练习进入教材后，是否能看到当前任务、返回当前练习，以及（仅当该小节属于当前任务时）下一相关小节。
2. 7.4 的下一相关是否是 7.5；最后一条必要教材 7.14 是否接到 7.12；最后一条对照是否没有下一小节。
3. 当前周材料之外的章节，是否仍能返回练习，且不会编造下一小节。
4. 首页是否先展示当前目标和主操作；详细验收、历史与参考是否按需展开，而不是删掉。
5. 关闭的折叠块是否把内容藏起来，同时 DOM 里仍保留「保存本条记录」等已验收控件。
6. 记录规则是否被改动：空依据通过、失败历史、未保存草稿、拓展不挡、确认才换周。
7. 本 diff 是否夹带了第 0 / 24 章遗留修改，或复习队列 / 自动评分。
8. 是否把本轮说成阶段 3 全部完成。应记为：前两步已通过，第三步待审，阶段 3 整体尚未完成。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/pages.js` | 修改 | 任务上下文、下一相关小节、首页折叠、全书翻页文案 |
| `js/app.js` | 修改 | 把当前小节标题传给教材页 |
| `js/learning.js` | 未改 | 收录对照：记录规则沿用第二步 |
| `css/course.css` | 修改 | 任务条吸顶、首页折叠关闭时隐藏 |
| `tools/test-course.js` | 修改 | 导航与分层行为测试 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 标明本轮是阶段 3 第三步 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 导航与分层已写入 DESIGN |
| `DESIGN.md` | 修改 | 任务条、首页折叠、吸顶 |
| `README.md` | 修改 | 从练习进教材能看到当前任务 |
