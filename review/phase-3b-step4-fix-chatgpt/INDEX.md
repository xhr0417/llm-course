# 阶段 3b-4 重练匹配补丁（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** 3b-4 初版包，不要用本包替换它：

- [`../phase-3b-step4-chatgpt/INDEX.md`](../phase-3b-step4-chatgpt/INDEX.md)

也保留 3b-1、3b-2、3b-2 补审封面、3b-3 包。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 3b-4 初版实现：[`0b3bc30`](https://github.com/xhr0417/llm-course/commit/0b3bc30)
- 3b-4 初版审核包：[`a2c8166`](https://github.com/xhr0417/llm-course/commit/a2c8166)
- 初版 CI：[35832322996](https://github.com/xhr0417/llm-course/actions/runs/35832322996) / [35832376253](https://github.com/xhr0417/llm-course/actions/runs/35832376253) success
- 本轮补丁：[`fb2dacf`](https://github.com/xhr0417/llm-course/commit/fb2dacf)
- 本轮：**只修重练匹配**。初版其余定点检查已通过。3b-2、3b-3 的通过结论不变。**3b-4 暂不收尾。** 不开始阶段 4。
- 差异：`phase-3b-step4-fix.diff`（相对 `0b3bc30` / 初版包之后的 `a2c8166`，不含第 0/24 章遗留修改）

审查请固定在本补丁，不要拿未含这处修复的线上首页代替。

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。初版线上状态见 [35832376253](https://github.com/xhr0417/llm-course/actions/runs/35832376253)。本轮随 `fb2dacf` 再推 `main`；是否已含验收 `conceptId` 匹配，只看该提交的 Actions。不要用 3b-4 初版的绿勾代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是补丁后的源文件。未跑 `build-static.js`。`js/learning.js`、`js/app.js` 本步未改。

## 怎么看

1. 先读本文件。初版 Attention 重练、点了才换周、原依据保留已通过。阻断项是第 2 周拓展知识点失败后没有重练入口。
2. `files/js/pages.js` 的 `taskHasConcept` / `retryTarget`：同时检查 `conceptIds` 和 `criteria[].conceptId`；仍限同一主线、不晚于当前周。
3. `files/tools/test-course.js` 的 `week-2 extension concept retry stays on the current exercise`。
4. 相对初版实现的差异：`phase-3b-step4-fix.diff`。

---

## 本轮修了什么

第 2 周「归一化与位置」验收关联 `modern-block`，该概念不在本周 `conceptIds` 里。复习失败后，当前仍在第 2 周时应出现「建议重练」和「重练当前练习」。

- 匹配同时看 `conceptIds` 和 `criteria[].conceptId`。
- 仍不打开更晚的周，仍要点了才换练习说明。
- 点击「重练当前练习」只展开验收，依据不变。
- 拓展仍不阻挡任务完成。

没有开始阶段 4，没有把 3b-4 写成已收尾。

---

## 本轮未做

- 没有把 3b-4 或 3b 整段说成完成。
- 没有改 3b-2、3b-3 的通过结论。
- 没有开始阶段 4。
- 没有自动评分、LLM judge、SM-2、题库。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。
- 没有回头改 `recordReview` 未到期返回值。

---

## 验证结果

- `node --test tools/test-course.js`：39 通过。
- 浏览器：第 2 周种入到期 `modern-block` 与拓展依据「看过 10.4」；闭卷回忆 + 未通过后到期区消失，出现「建议重练」和「重练当前练习」；第 2 周仍按下；点开后验收仍是用户自报通过／「看过 10.4」；必需仍是 0 / 3，没有「进入下一任务」。
- 初版 CI：[35832322996](https://github.com/xhr0417/llm-course/actions/runs/35832322996)、[35832376253](https://github.com/xhr0417/llm-course/actions/runs/35832376253) success。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮补丁的 CI / Pages 尚未出结果。以 [`fb2dacf`](https://github.com/xhr0417/llm-course/commit/fb2dacf) 的 GitHub Actions 为准，不要用 3b-4 初版的绿勾代替。
- 375／768／1280 的独立重跑。
- 3b-4 收尾。

---

## 请 ChatGPT 重点核对

1. 第 2 周拓展 `modern-block` 复习失败后，当前仍在第 2 周时是否出现「重练当前练习」。
2. 点击是否只展开验收、不换周；依据「看过 10.4」是否仍在。
3. 拓展是否仍不阻挡任务完成（没有「进入下一任务」）。
4. 匹配是否仍限同一主线、不晚于当前周。
5. 有没有夹带阶段 4、第 0 / 24 章，或把 3b-4 写成已收尾。
6. 口径应记为：阶段 3 已完成，3b-1 已封板，3b-2、3b-3 已通过，本轮是 3b-4 补丁，3b-4 暂不收尾，3b 整体尚未完成；不要开始阶段 4。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/pages.js` | 修改 | `retryTarget` 同时匹配 `conceptIds` 和 `criteria[].conceptId` |
| `tools/test-course.js` | 修改 | 第 2 周拓展失败后出现「重练当前练习」 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 3b-4 暂不收尾；补上验收关联匹配 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 重练匹配含验收 `conceptId` |
| `DESIGN.md` | 修改 | 重练入口按 conceptIds 或验收 conceptId 匹配 |
