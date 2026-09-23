# 阶段 3b-2 补审（给 ChatGPT 正式确认）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**不要改、不要替换**原来的 3b-2 包；本包只是补审封面：

- 原包：[`../phase-3b-step2-chatgpt/INDEX.md`](../phase-3b-step2-chatgpt/INDEX.md)
- 源码快照：[`../phase-3b-step2-chatgpt/files/`](../phase-3b-step2-chatgpt/files/)
- 差异：[`../phase-3b-step2-chatgpt/phase-3b-step2.diff`](../phase-3b-step2-chatgpt/phase-3b-step2.diff)

也保留 3b-1 与 3b-3 包，不要用本包替换它们。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 3b-2 实现：[`058548a`](https://github.com/xhr0417/llm-course/commit/058548a)
- 3b-2 原审核包：[`926c7a0`](https://github.com/xhr0417/llm-course/commit/926c7a0)
- 3b-2 CI：[35559544194](https://github.com/xhr0417/llm-course/actions/runs/35559544194) success，head `926c7a0`
- 3b-3 已通过：实现 [`f86f86c`](https://github.com/xhr0417/llm-course/commit/f86f86c)，口径 [`1416ee9`](https://github.com/xhr0417/llm-course/commit/1416ee9)；CI [35830406090](https://github.com/xhr0417/llm-course/actions/runs/35830406090) / [35830984457](https://github.com/xhr0417/llm-course/actions/runs/35830984457) success
- 本轮：**只补审 3b-2**。3b-3 已通过的结论不变。3b-2 仍待正式确认。确认前不开始 3b-4，不开始阶段 4。

**看哪份代码：** 只看 `058548a`、`926c7a0` 和原包 `files/`。**不要拿当前 `main` 首页当 3b-2 对照**——后面的 3b-3 已经在到期项上加了通过／失败表单。

原包 INDEX 第 8 条写「不要开始 3b-3」是当时口径。补审时只问：`058548a` 当时有没有夹带 3b-3。不要因为后来做了 3b-3 就判 3b-2 FAIL。

不要为了改原包「写本包时 CI 尚未出结果」再造提交。3b-2 的 CI 结果以 [35559544194](https://github.com/xhr0417/llm-course/actions/runs/35559544194) 为准。

**发布区分：** 本轮若另有 `main` 更新，只增加这份封面。未运行 `tools/publish.sh`。自有服务器不在结论内。第 0／24 章遗留修改不在范围。

## 怎么看

1. 先读本文件，再读原包 INDEX。
2. 列表：原包 `files/js/pages.js` 的 `dueQueue`（只有中文名和「上次未通过」文字）。
3. 进入队列：原包 `files/js/app.js` 在验收「用户自报通过」保存成功后 `armReview`。
4. `files/js/learning.js` 本步未改。
5. 测试：`home lists due review concepts...`、`home due queue stays off the current exercise and has no review form`、`saving a passed check arms a review that is not due yet`。
6. 差异：`phase-3b-step2.diff`（相对 `bea257f`）。

---

## 补审要确认什么

3b-2 只做到期队列展示：

- 无到期项时不出现「到期复习」。
- 到期项显示知识点中文名；未到期概念不进列表。
- 列表在「打开必要教材」之后、`.home-fold` 之前；当前练习文案仍在。
- 手动改周后，到期列表仍在，当前任务只随周选择变化。
- 保存「用户自报通过」后只是 arm，当天不出现到期区。
- `058548a` 没有通过／失败提交，没有重练入口，没有改 `recordReview` 未到期返回值。
- 没有夹带第 0／24 章。

---

## 实现侧预核（不是封板）

对照原包 `files/` 和 `058548a`，未发现阻挡 3b-2 正式确认的问题：

1. `dueQueue` 无 `<input>`、无保存按钮、无重练入口；文案写「还不记录通过或失败」。
2. 空队列返回空字符串，测试要求首页不出现「到期复习」。
3. 到期 `attention` 显示「缩放点积注意力」；未到期 `causal-mask` 不出现。
4. 位置测试：`打开必要教材` < `review-queue` < `.home-fold`。
5. 改到第 2 周后队列仍在，`llm-course-current-task` 换成 decoder 任务。
6. 验收通过后 `armReview`，`dueAt` 在未来，当天首页无到期区。
7. feat 未改 `js/learning.js`，未含第 0／24 章。

未独立重跑浏览器和 375／768／1280。这与 3b-3 终审口径相同，不自动当成 3b-2 阻断项。

---

## 请 ChatGPT 重点核对

1. 是否只根据 `058548a` / 原包判断 3b-2，而不是根据当前 `main`。
2. 当时是否只有到期列表，没有通过／失败表单或重练入口。
3. 无到期、未到期、位置、改周、arm 当天不出现，是否成立。
4. 原包 INDEX「CI 尚未出结果」已过期，以 [35559544194](https://github.com/xhr0417/llm-course/actions/runs/35559544194) 为准；不要为此再改原包。
5. 是否把后来的 3b-3 当成 3b-2 夹带。应记为：3b-1 已封板，3b-3 已通过，本包只确认 3b-2；确认前不开始 3b-4 或阶段 4；3b 整段尚未收尾。

## 文件清单

本包只有这份封面。源码、测试和 diff 仍用原包。
