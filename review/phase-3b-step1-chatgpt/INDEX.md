# 阶段 3b-1 数据模型（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留**阶段 3 已封板的审核包，不要用本包替换它们。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 阶段 3 封板口径：[`a93668c`](https://github.com/xhr0417/llm-course/commit/a93668c)（第三步终审证据仍是 [`ff7fe4b`](https://github.com/xhr0417/llm-course/commit/ff7fe4b) / [35555990168](https://github.com/xhr0417/llm-course/actions/runs/35555990168)）
- 阶段 3 封板 CI：[35556509855](https://github.com/xhr0417/llm-course/actions/runs/35556509855) 已 success，head `a93668c`
- 本轮实现：[`d89f62b`](https://github.com/xhr0417/llm-course/commit/d89f62b)
- 本轮：**阶段 3b-1 数据模型**。阶段 3 已完成。不开始阶段 4。不做队列界面或重练入口。
- 差异：`phase-3b-step1.diff`（相对 `a93668c`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。阶段 3 封板线上状态见 [35556509855](https://github.com/xhr0417/llm-course/actions/runs/35556509855)。本轮另有一次 `main` push；是否已含 `d89f62b`，只看该提交的 Actions。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮源文件完整稿。未改 `js/pages.js` / `js/app.js`，没有队列 UI。未跑 `build-static.js`（无章节 Markdown 变更）。

## 怎么看

1. 先读本文件。阶段 3 前三步已通过并记为完成。本包只审 3b-1。
2. 数据模型：`files/js/learning.js` 的 `reviews` / `armReview` / `recordReview` / `dueReviews`。
3. 边界测试：`files/tools/test-course.js` 的 `review state is separate from task evidence and only lists due concepts`。
4. 口径：`files/docs/IMPLEMENTATION_PLAN.md`「本轮（阶段 3b-1 数据模型）」；阶段 3 改为已完成。
5. 相对 `a93668c` 的差异：`phase-3b-step1.diff`。

---

## 本轮做了什么

复习状态写进同一个 `llm-course-learning` 里的 **`reviews`** 对象，按 **conceptId** 索引，不复制 task。

- 默认间隔 `1 / 3 / 7 / 21` 天，可在构造时覆盖，没有设置界面。
- `armReview` 后先等第一个间隔，未到期不进 `dueReviews`。
- 三种形式：`explain` / `recall` / `rewrite`。
- 结果只有 `passed` / `failed`，不用任务层的 `user_passed`。
- 通过则间隔前进并停在 21 天；失败回到 1 天并记 `weak`。
- `recordReview` 不得改 `criteria`、概念四维、或 `llm-course-current-task`。

没有首页到期列表，没有复习表单，没有失败后的重练入口。

---

## 本轮未做

- 没有 3b-2 队列展示、3b-3 记录界面、3b-4 重练入口。
- 没有自动评分、LLM judge、SM-2、题库、streak、dashboard、通知。
- 没有开始阶段 4。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。
- 没有把本轮说成 3b 完成。

---

## 验证结果

- `node --test tools/test-course.js`：34 通过（原 33 条回归 + 复习状态与任务证据分离）。
- 阶段 3 封板 CI：[35556509855](https://github.com/xhr0417/llm-course/actions/runs/35556509855)，head `a93668c`，success。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮实现提交的 CI / Pages 尚未出结果。以 [`d89f62b`](https://github.com/xhr0417/llm-course/commit/d89f62b) 的 GitHub Actions 为准，不要用阶段 3 封板的绿勾代替。
- 队列 UI、375／768／1280 复习界面（本轮无界面）。

---

## 请 ChatGPT 重点核对

1. 本轮是否只做 3b-1 数据模型与到期计算；有没有夹带队列 UI、自动评分或阶段 4。
2. `reviews` 是否按 concept 存储；失败后 `criteria` 的 `user_reported` 当前结果、依据和失败历史是否原样保留。
3. 概念四维和 `llm-course-current-task` 是否也不被复习改写。
4. 未到期是否不进队列；通过后间隔是否 1→3→7→21 并停在 21；失败是否回到 1 天并记薄弱点。
5. 旧存储没有 `reviews` 时能否加载。
6. 本 diff 是否夹带第 0 / 24 章遗留修改。
7. 是否把本轮说成阶段 3 未完成、或 3b 已经收尾、或自动进入阶段 4。应记为：阶段 3 已完成，本轮是 3b-1，3b 整体尚未完成，不要开始阶段 4。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/learning.js` | 修改 | `reviews`、到期计算、通过/失败调度 |
| `tools/test-course.js` | 修改 | 分离边界、间隔、到期队列 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 阶段 3 已完成；本轮 3b-1 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 任务证据与复习状态分开 |
| `DESIGN.md` | 修改 | 复习不得改写任务证据；3b-1 无界面 |
