# 阶段 3b-2 到期队列展示（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** 3b-1 已封板的包，不要用本包替换它们：

- [`../phase-3b-step1-chatgpt/INDEX.md`](../phase-3b-step1-chatgpt/INDEX.md)
- [`../phase-3b-step1-fix-chatgpt/INDEX.md`](../phase-3b-step1-fix-chatgpt/INDEX.md)

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 3b-1 封板补丁：[`7015a8e`](https://github.com/xhr0417/llm-course/commit/7015a8e) + 审核包 [`bea257f`](https://github.com/xhr0417/llm-course/commit/bea257f)
- 3b-1 封板 CI：[35557874221](https://github.com/xhr0417/llm-course/actions/runs/35557874221) success，head `bea257f`
- 本轮实现：[`058548a`](https://github.com/xhr0417/llm-course/commit/058548a)
- 本轮：**阶段 3b-2 到期队列展示**。3b-1 已封板。不开始 3b-3 记录表单，不开始 3b-4 重练入口，不开始阶段 4。
- 差异：`phase-3b-step2.diff`（相对 `bea257f`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。3b-1 封板线上状态见 [35557874221](https://github.com/xhr0417/llm-course/actions/runs/35557874221)。本轮另有一次 `main` push；是否已含 `058548a`，只看该提交的 Actions。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮源文件完整稿。`files/js/learning.js` **本轮未改**，只作 3b-1 对照。未跑 `build-static.js`。

## 怎么看

1. 先读本文件。阶段 3 已完成，3b-1 已封板。本包只审到期队列展示。
2. 列表：`files/js/pages.js` 的 `dueQueue`。
3. 进入队列：`files/js/app.js` 在验收「用户自报通过」保存成功后 `armReview`。
4. 测试：`home lists due review concepts...`、`home due queue stays off...`、`saving a passed check arms a review that is not due yet`。
5. 相对 `bea257f` 的差异：`phase-3b-step2.diff`。

---

## 本轮做了什么

「我的学习」在当前练习主按钮之后、详细折叠之前，列出**已经到期**的知识点中文名。

- 无到期项时不出现该区域。
- 未到期概念不进列表。
- 文案写明不会更换当前练习；本页还不记录通过或失败。
- 上次未通过只显示文字，没有重练按钮。
- 相关验收用户自报通过并保存后，才安排第一次到期（一天后），首页打开不会预填全部概念。

没有通过／失败提交，没有重练入口。未改 `recordReview` 的未到期返回值。

---

## 本轮未做

- 没有 3b-3 通过／失败记录界面。
- 没有 3b-4 重练入口。
- 没有自动评分、LLM judge、SM-2、题库、streak、dashboard、通知。
- 没有开始阶段 4。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。
- 没有把本轮说成 3b 完成。

---

## 验证结果

- `node --test tools/test-course.js`：38 通过。
- 3b-1 封板 CI：[35557874221](https://github.com/xhr0417/llm-course/actions/runs/35557874221)，head `bea257f`。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮实现提交的 CI / Pages 尚未出结果。以 [`058548a`](https://github.com/xhr0417/llm-course/commit/058548a) 的 GitHub Actions 为准，不要用 3b-1 的绿勾代替。
- 375／768／1280 的独立重跑。
- 3b-3 记录 UI。

---

## 请 ChatGPT 重点核对

1. 本轮是否只做到期列表；有没有夹带通过／失败表单或重练入口。
2. 无到期项时首页是否不出现「到期复习」。
3. 到期项是否只显示中文名；未到期概念是否不进该列表。
4. 列表是否在「打开必要教材」之后、`.home-fold` 之前；当前练习文案是否仍在。
5. 手动改周后，到期列表是否仍在，且当前任务只随周选择变化、不因复习而变。
6. 保存「用户自报通过」后是否只是 arm、当天不出现到期区。
7. 本 diff 是否夹带第 0 / 24 章，或改动 `recordReview`。
8. 是否把本轮说成 3b 已收尾。应记为：阶段 3 已完成，3b-1 已封板，本轮是 3b-2，3b 整体尚未完成；不要开始 3b-3 或阶段 4。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/pages.js` | 修改 | 到期队列展示 |
| `js/app.js` | 修改 | 验收通过后 arm 第一次到期 |
| `js/learning.js` | 未改 | 3b-1 对照 |
| `css/course.css` | 修改 | 到期列表排版 |
| `tools/test-course.js` | 修改 | 到期列表、未到期不出现、无表单 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 3b-1 已封板；本轮 3b-2 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 3b-2 只展示 |
| `DESIGN.md` | 修改 | 到期列表不记录、不换练习 |
