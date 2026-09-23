# 阶段 3b-4 失败后重练入口（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** 3b-1、3b-2、3b-2 补审封面、3b-3 包；不要用本包替换它们：

- [`../phase-3b-step1-chatgpt/INDEX.md`](../phase-3b-step1-chatgpt/INDEX.md)
- [`../phase-3b-step1-fix-chatgpt/INDEX.md`](../phase-3b-step1-fix-chatgpt/INDEX.md)
- [`../phase-3b-step2-chatgpt/INDEX.md`](../phase-3b-step2-chatgpt/INDEX.md)
- [`../phase-3b-step2-confirm-chatgpt/INDEX.md`](../phase-3b-step2-confirm-chatgpt/INDEX.md)
- [`../phase-3b-step3-chatgpt/INDEX.md`](../phase-3b-step3-chatgpt/INDEX.md)

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 3b-1 封板补丁：[`7015a8e`](https://github.com/xhr0417/llm-course/commit/7015a8e) + 审核包 [`bea257f`](https://github.com/xhr0417/llm-course/commit/bea257f)
- 3b-2 实现：[`058548a`](https://github.com/xhr0417/llm-course/commit/058548a)；用户补审已通过。补审对照该提交和原包，没有用当时线上首页代替历史版本。补审封面 [`bdd603e`](https://github.com/xhr0417/llm-course/commit/bdd603e)，CI [35831271837](https://github.com/xhr0417/llm-course/actions/runs/35831271837) success
- 3b-3 已通过：实现 [`f86f86c`](https://github.com/xhr0417/llm-course/commit/f86f86c)，CI [35830406090](https://github.com/xhr0417/llm-course/actions/runs/35830406090) success
- 本轮实现：[`0b3bc30`](https://github.com/xhr0417/llm-course/commit/0b3bc30)
- 本轮：**阶段 3b-4 失败后重练入口**。3b-1 已封板。3b-2、3b-3 均已通过。不开始阶段 4。**3b 整段尚未收尾。**
- 差异：`phase-3b-step4.diff`（相对 `bdd603e`，不含第 0/24 章遗留修改）

没有为 3b-2 补审结论再单独造一轮审核包；该结论写进本轮文档。

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。本轮另有一次 `main` 更新；是否已含 `0b3bc30`，只看该提交的 Actions。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮源文件完整稿。未跑 `build-static.js`。`js/learning.js` 本步未改。

## 怎么看

1. 先读本文件。阶段 3 已完成，3b-1 已封板，3b-2、3b-3 已通过。本包只审失败后的重练入口。
2. 入口：`files/js/pages.js` 的 `retryTarget`、`retryQueue`。首页顺序是主按钮 → 到期队列 → 建议重练 → 折叠内容。
3. 点击：`files/js/app.js` 对 `data-retry-current` 打开 `#home-criteria`；更小任务按钮带 `data-week`，复用已有换周处理。
4. `files/js/learning.js` 本步未改。薄弱列表仍用已有 `weakConcepts()`。
5. 测试：`home due queue stays off the current exercise and can save a review`，以及静态首页里「建议重练」相对到期区的位置。
6. 相对 `bdd603e` 的差异：`phase-3b-step4.diff`。

---

## 本轮做了什么

复习失败后，首页出现「建议重练」：列出薄弱知识点的中文名，并给出当前或更小任务的入口。

- 当前周包含该知识点：按钮「重练当前练习」。点了打开验收折叠，不换周。
- 当前周更晚、同一主线上更早任务包含该知识点：按钮「重练更小的任务：{标题}」。点了才更换练习说明。
- 没有当前或更早的匹配任务：不显示该条，也不会打开更晚的周。
- 未点击时当前练习不变。
- 不删除或改写原实现／验证记录，不把历史 `user_reported` 改成失败，不按日历打开新的主线任务。
- 刚失败、该项已离开到期列表时，只要仍记为薄弱，重练入口仍显示。

---

## 本轮未做

- 没有把本轮说成 3b 完成。
- 没有开始阶段 4。
- 没有自动评分、LLM judge、SM-2、题库、streak、dashboard、通知。
- 没有回头改 3b-1：`recordReview` 未到期仍返回 true。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。
- 没有为 3b-2 补审再单独增加一轮审核包。

---

## 验证结果

- `node --test tools/test-course.js`：38 通过。
- 浏览器：种入到期 `attention` 后保存闭卷回忆 + 未通过；到期区消失；出现「建议重练」和「重练当前练习」；点开后验收仍是用户自报通过／「对照通过」，第 1 周仍按下。切到第 2 周后出现「重练更小的任务：手写因果多头注意力」；点了回到第 1 周，依据仍是「对照通过」。
- 3b-2 补审 CI：[35831271837](https://github.com/xhr0417/llm-course/actions/runs/35831271837)，head `bdd603e`。
- 3b-3 CI：[35830406090](https://github.com/xhr0417/llm-course/actions/runs/35830406090)，head `4fa05ee`。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮实现提交的 CI / Pages 尚未出结果。以 [`0b3bc30`](https://github.com/xhr0417/llm-course/commit/0b3bc30) 的 GitHub Actions 为准，不要用 3b-2／3b-3 的绿勾代替。
- 375／768／1280 的独立重跑。
- 3b 整段收尾。

---

## 请 ChatGPT 重点核对

1. 本轮是否只加重练入口；有没有夹带阶段 4，或把 3b 写成已收尾。
2. 失败后是否出现当前或更小任务的入口；有没有自动换周、打开更晚的周、或按日历打开新的主线任务。
3. 未点击时当前练习是否不变；点「重练当前练习」是否只打开验收，不换周。
4. 点更小任务是否只更换练习说明。
5. 保存失败复习后，任务验收、历史依据、概念四维是否不变。
6. 刚失败、到期项已出队时，薄弱知识点的重练入口是否仍在。
7. 本 diff 是否夹带第 0 / 24 章，或回头改 `recordReview` 未到期返回值。
8. 口径应记为：阶段 3 已完成，3b-1 已封板，3b-2、3b-3 已通过，本轮是 3b-4，3b 整体尚未完成；不要开始阶段 4。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/pages.js` | 修改 | `retryTarget`／`retryQueue`：当前或更小任务入口 |
| `js/app.js` | 修改 | 「重练当前练习」打开验收折叠 |
| `css/course.css` | 修改 | `.review-retry` 与到期列表共用名称样式 |
| `tools/test-course.js` | 修改 | 失败后出现重练、证据不变、更小任务需点击 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 3b-2、3b-3 已通过；本轮 3b-4 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 失败后建议重练当前或更小任务 |
| `DESIGN.md` | 修改 | 重练入口点了才换练习 |
