# 阶段 3b-3 通过／失败记录（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** 3b-1 已封板的包，以及 3b-2 包；不要用本包替换它们：

- [`../phase-3b-step1-chatgpt/INDEX.md`](../phase-3b-step1-chatgpt/INDEX.md)
- [`../phase-3b-step1-fix-chatgpt/INDEX.md`](../phase-3b-step1-fix-chatgpt/INDEX.md)
- [`../phase-3b-step2-chatgpt/INDEX.md`](../phase-3b-step2-chatgpt/INDEX.md)

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 3b-1 封板补丁：[`7015a8e`](https://github.com/xhr0417/llm-course/commit/7015a8e) + 审核包 [`bea257f`](https://github.com/xhr0417/llm-course/commit/bea257f)
- 3b-1 封板 CI：[35557874221](https://github.com/xhr0417/llm-course/actions/runs/35557874221) success，head `bea257f`
- 3b-2 实现：[`058548a`](https://github.com/xhr0417/llm-course/commit/058548a) + 审核包 [`926c7a0`](https://github.com/xhr0417/llm-course/commit/926c7a0)
- 3b-2 CI：[35559544194](https://github.com/xhr0417/llm-course/actions/runs/35559544194) success，head `926c7a0`。**3b-2 已落地，用户尚未正式封板。**
- 本轮实现：[`f86f86c`](https://github.com/xhr0417/llm-course/commit/f86f86c)
- 本轮：**阶段 3b-3 通过／失败记录**。3b-1 已封板。3b-2 已落地未封板。不开始 3b-4 重练入口，不开始阶段 4。
- 差异：`phase-3b-step3.diff`（相对 `926c7a0`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。3b-2 线上状态见 [35559544194](https://github.com/xhr0417/llm-course/actions/runs/35559544194)。本轮另有一次 `main` 更新；是否已含 `f86f86c`，只看该提交的 Actions。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮源文件完整稿。未跑 `build-static.js`。

## 怎么看

1. 先读本文件。阶段 3 已完成，3b-1 已封板，3b-2 已落地。本包只审通过／失败记录。
2. 表单：`files/js/pages.js` 的 `dueQueue`。
3. 保存：`files/js/app.js` 的 `saveReview`。未到期用 `canRecordReview`，不把 `recordReview` 的 true 当成写入成功。
4. 门闩：`files/js/learning.js` 的 `canRecordReview`。`recordReview` 未到期仍返回 true，本轮不回头改。
5. 测试：`home due queue stays off the current exercise and can save a review`。
6. 相对 `926c7a0` 的差异：`phase-3b-step3.diff`。

---

## 本轮做了什么

到期列表里的每一项可以选复习形式（解释／闭卷回忆／复写）和这次结果（通过／未通过），点「保存本次复习」才写入。

- 没选形式或结果：提示「先选择复习形式和这次结果，再保存。」，不写入。
- 未到期：提示「还没到期，这次没有写入。」，不把 `recordReview(...) === true` 显示成保存成功。
- 写入成功后该项离开到期列表。
- 失败记下薄弱点；不删除或改写原实现／验证记录，不把历史 `user_reported` 改成失败，不改首页当前任务。
- 没有重练按钮或入口。

---

## 本轮未做

- 没有 3b-4 重练入口。
- 没有回头改 3b-1：`recordReview` 未到期仍返回 true。
- 没有把 3b-2 写成已封板。
- 没有自动评分、LLM judge、SM-2、题库、streak、dashboard、通知。
- 没有开始阶段 4。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。
- 没有把本轮说成 3b 完成。

---

## 验证结果

- `node --test tools/test-course.js`：38 通过。
- 浏览器：首页空队列不出现到期区；种入到期 `attention` 后出现「缩放点积注意力」表单；空保存提示未写入；闭卷回忆 + 未通过后队列消失；验收仍是 `user_passed`／「对照通过」；当前练习仍是第 1 周。
- 3b-2 CI：[35559544194](https://github.com/xhr0417/llm-course/actions/runs/35559544194)，head `926c7a0`。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮实现提交的 CI / Pages 尚未出结果。以 [`f86f86c`](https://github.com/xhr0417/llm-course/commit/f86f86c) 的 GitHub Actions 为准，不要用 3b-2 的绿勾代替。
- 375／768／1280 的独立重跑。
- 3b-4 重练入口。

---

## 请 ChatGPT 重点核对

1. 本轮是否只加通过／失败记录；有没有夹带重练入口或阶段 4。
2. 没选形式／结果时是否只提示、不写入。
3. 未到期时界面是否明确「没有写入」，而不是把 `recordReview` 的 true 当成保存成功。
4. 保存成功后该项是否离开到期列表。
5. 保存复习后，任务验收、历史依据、概念四维和当前任务是否不变。
6. 失败是否只记薄弱点，不改写历史 `user_reported`。
7. 本 diff 是否夹带第 0 / 24 章，或回头改 `recordReview` 未到期返回值。
8. 是否把本轮说成 3b 已收尾，或把 3b-2 写成已封板。应记为：阶段 3 已完成，3b-1 已封板，3b-2 已落地未封板，本轮是 3b-3，3b 整体尚未完成；不要开始 3b-4 或阶段 4。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/pages.js` | 修改 | 到期项表单：形式、通过／未通过、保存 |
| `js/app.js` | 修改 | `saveReview`：区分写入成功与未到期／未选全 |
| `js/learning.js` | 修改 | 增加 `canRecordReview`，不改 `recordReview` 返回值 |
| `css/course.css` | 修改 | 到期项表单排版 |
| `tools/test-course.js` | 修改 | 保存后出队、证据不变、未到期门闩 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 3b-2 已落地；本轮 3b-3 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 3b-3 记录通过或失败，无重练入口 |
| `DESIGN.md` | 修改 | 到期项可记录；未到期不得显示成已保存 |
