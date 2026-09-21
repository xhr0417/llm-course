# 阶段 3b-1 到期判定补丁（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-3b-step1-chatgpt/INDEX.md`](../phase-3b-step1-chatgpt/INDEX.md) 作为 3b-1 初版；本包只审跨轮相同形式被误判为重复提交那一处。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 3b-1 初版实现：[`d89f62b`](https://github.com/xhr0417/llm-course/commit/d89f62b)
- 3b-1 初版审核包：[`ff2b7ff`](https://github.com/xhr0417/llm-course/commit/ff2b7ff)
- 初版 CI：[35557249298](https://github.com/xhr0417/llm-course/actions/runs/35557249298) success，head `ff2b7ff`
- 本轮补丁：[`7015a8e`](https://github.com/xhr0417/llm-course/commit/7015a8e)
- 本轮：只修 `recordReview` 的跨轮去重。阶段 3 已完成。3b-1 仍待本补丁封板。不开始 3b-2，不开始阶段 4。
- 差异：`phase-3b-step1-fix.diff`（相对 `d89f62b` 的 `learning.js` / 测试 / 本轮口径）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。初版线上状态见 [35557249298](https://github.com/xhr0417/llm-course/actions/runs/35557249298)。本轮随 `7015a8e` 再推 `main`；是否已含这处去重修复，只看该提交的 Actions。不要用 3b-1 初版的绿勾代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是补丁后的源文件。没有队列 UI。未跑 `build-static.js`。

## 怎么看

1. 先读本文件。初版其余边界已通过；阻断项是相同 `form + result` 跨轮被当成重复提交。
2. `files/js/learning.js` 的 `recordReview`：必须先 `arm`；`now < dueAt` 不推进；`now >= dueAt` 即使仍是 `recall + passed` 也写入并推进。
3. `files/tools/test-course.js` 的 `the same review form still advances when a later round is due`。
4. 相对初版实现的差异：`phase-3b-step1-fix.diff`。

---

## 本轮修了什么

删掉按 `result + form` 判断「同一次提交」的逻辑。

- 未 `arm`：不记录。
- `now < dueAt`：不写入、不推进（覆盖未到期与刚提交后的立即再调用）。
- `now >= dueAt`：这是新一轮；`recall + passed` 连续多次也要进 history，并把间隔 1→3→7→21。

没有做队列界面，没有开始 3b-2。

---

## 本轮未做

- 没有 3b-2 / 3b-3 / 3b-4。
- 没有自动评分、LLM judge、SM-2、题库。
- 没有开始阶段 4。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。
- 没有把本轮说成 3b 完成。

---

## 验证结果

- `node --test tools/test-course.js`：35 通过（含相同形式连续通过：day1/4/11/32 的 `recall + passed` → 3/7/21/21；第一次通过后立即再调用仍停在 3 天）。
- 初版 CI：[35557249298](https://github.com/xhr0417/llm-course/actions/runs/35557249298)，head `ff2b7ff`。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮补丁的 CI / Pages 尚未出结果。以 [`7015a8e`](https://github.com/xhr0417/llm-course/commit/7015a8e) 的 GitHub Actions 为准。
- 队列 UI。

---

## 请 ChatGPT 重点核对

1. `recall + passed` 在 day 1 / 4 / 11 / 32 是否分别推进到 3 / 7 / 21 / 21 天，history 是否增长。
2. 第一次通过后立即再调用，间隔是否仍是 3 天。
3. 第二次跨轮提交后，`criteria`、概念四维、`llm-course-current-task` 是否不变。
4. 未 `arm` 是否不能记录。
5. 有没有夹带 3b-2 UI、阶段 4 或第 0 / 24 章。
6. 是否把本轮说成 3b 已收尾。应记为：阶段 3 已完成，3b-1 这一处待封板，3b 整体尚未完成，不要开始 3b-2 或阶段 4。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/learning.js` | 修改 | 用 `dueAt` 判断新一轮，不再用形式+结果去重 |
| `tools/test-course.js` | 修改 | 相同形式跨轮推进与立即双击 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 3b-1 验收补上跨轮相同形式 |
