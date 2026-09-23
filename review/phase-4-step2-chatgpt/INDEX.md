# 阶段 4-2 固定语料检索 + 检索—阅读—判定（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** 3b 各包和 4-1 包，不要用本包替换它们：

- [`../phase-3b-step1-chatgpt/INDEX.md`](../phase-3b-step1-chatgpt/INDEX.md)
- [`../phase-3b-step1-fix-chatgpt/INDEX.md`](../phase-3b-step1-fix-chatgpt/INDEX.md)
- [`../phase-3b-step2-chatgpt/INDEX.md`](../phase-3b-step2-chatgpt/INDEX.md)
- [`../phase-3b-step2-confirm-chatgpt/INDEX.md`](../phase-3b-step2-confirm-chatgpt/INDEX.md)
- [`../phase-3b-step3-chatgpt/INDEX.md`](../phase-3b-step3-chatgpt/INDEX.md)
- [`../phase-3b-step4-chatgpt/INDEX.md`](../phase-3b-step4-chatgpt/INDEX.md)
- [`../phase-3b-step4-fix-chatgpt/INDEX.md`](../phase-3b-step4-fix-chatgpt/INDEX.md)
- [`../phase-4-step1-chatgpt/INDEX.md`](../phase-4-step1-chatgpt/INDEX.md)

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 阶段 4-1 通过后的文档：[`b6e7264`](https://github.com/xhr0417/llm-course/commit/b6e7264)，CI [35837154576](https://github.com/xhr0417/llm-course/actions/runs/35837154576) success
- 本轮实现：[`13a7a70`](https://github.com/xhr0417/llm-course/commit/13a7a70)
- 本轮：**阶段 4-2 固定语料检索 + 检索—阅读—判定**。阶段 4-1 已通过。默认当前练习仍是实验室 Attention。**阶段 4 整段尚未完成。** 不开始阶段 5。
- 差异：`phase-4-step2.diff`（相对 GitHub `b6e7264` / 本地 `545028e` 的对应 4-1 收尾提交，不含第 0/24 章遗留修改）

审查请固定在本轮实现，不要拿未含第 2、3 周的线上首页代替。

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。本轮另有一次 `main` 更新；是否已含「在冻结语料里检索证据，对照两种方法」和「按固定顺序做检索、阅读和判定」，只看 [`13a7a70`](https://github.com/xhr0417/llm-course/commit/13a7a70) 的 Actions。不要用 4-1 的绿勾代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮源文件完整稿。未跑 `build-static.js`。`js/app.js`、`js/learning.js`、`DESIGN.md` 本步未改。

## 怎么看

1. 先读本文件。阶段 4-1 已通过。本包只审核验助手第 2、3 周练习。
2. 计划：`files/content/learning-plan.json` 仍 `currentStageId: lab`、`currentTaskId: lab.attention.causal-mha`。新增任务 `claim.retrieve.fixed-corpus`、`claim.workflow.retrieve-read-judge`。
3. 完成第 3 周：`files/js/pages.js` 的最后一项文案是「目前计划里这一阶段还没有下一项已写入的练习。不会自动打开 Agent 或新阶段。」`nextTask` 仍只在同一阶段内前进，因此不会打开 Agent。
4. 点击：已有 `data-week` 按当前阶段过滤。核验助手现在有三周按钮；点第 2、3 周只更换练习说明。
5. 测试：`home can open claim-agent retrieval and the fixed workflow`，以及 harness `claim-agent week picker opens retrieval then the fixed workflow`。
6. 相对 4-1 收尾的差异：`phase-4-step2.diff`。

---

## 本轮做了什么

核验助手写入第 2 周「在冻结语料里检索证据，对照两种方法」，以及第 3 周「按固定顺序做检索、阅读和判定」。

- 默认仍是实验室 Attention，不按日历打开核验助手。
- 点某一周只更换练习说明，不把前面的周标成完成，也不打开新阶段。
- 第 2 周指向第 28 章真实小节；两种检索对照与指标人工核对是必需项；精排是拓展。检索命中不是结论正确。不要求 FAISS，不走进 rag-service。
- 第 3 周固定检索 → 阅读 → 判定；沿用第 1 周准则；引用可定位；过期或冲突分开记。服务化是拓展。不写 Agent 循环、MCP 或 FastAPI 服务作业。
- 不把自写样本混进 CHEF 冒充官方分数。
- 完成第 3 周不出现「进入下一任务」，也不自动打开 Agent。
- 沿用已有验收记录与复习规则。

---

## 本轮未做

- 没有把阶段 4 整段说成完成。
- 没有开始阶段 5。
- 没有一次写完第 3–6 月全部周任务。
- 没有 Agent 循环、MCP、FastAPI 服务作业、92 项选修库 UI。
- 没有拷贝 Hello-Agents / mini-swe-agent / CHEF / rag-service 代码进主线。
- 没有为框架或机制仓库做主项目卡。
- 没有自动评分、LLM judge、SM-2、题库、streak、dashboard、通知。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。

---

## 验证结果

- `node --test tools/test-course.js`：43 通过。
- 浏览器：刷新计划后点「技术声明核验助手 / 单 Agent」仍是「给定声明和证据，只做判定」，并出现第 2、3 周按钮。点第 2 周出现「在冻结语料里检索证据，对照两种方法」；打开 28.5 后任务条仍是该练习，下一相关小节是 28.3。点第 3 周出现「按固定顺序做检索、阅读和判定」；打开 28.8 后任务条仍是该练习，下一相关小节是 28.10。没有「进入下一任务」，没有 mini-swe-agent / Pydantic AI。点回实验室落到第 1 周 Attention；再点第 2 周，拓展依据仍是「看过 10.4」，重练入口仍在。专项实验不出现。
- 阶段 4-1 文档 CI：[35837154576](https://github.com/xhr0417/llm-course/actions/runs/35837154576)，head `b6e7264`。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮实现提交的 CI / Pages 尚未出结果。以 [`13a7a70`](https://github.com/xhr0417/llm-course/commit/13a7a70) 的 GitHub Actions 为准，不要用 4-1 的绿勾代替。
- 375／768／1280 的独立重跑。
- 阶段 4 其余周任务（Agent 循环及之后）。

---

## 请 ChatGPT 重点核对

1. 本轮是否只做固定语料检索与检索—阅读—判定；有没有夹带 Agent、阶段 5，或把阶段 4 写成已完成。
2. 默认首页是否仍是 Attention；点周是否只更换练习说明，不把实验室标成完成。
3. 周选择是否仍按当前阶段过滤；点核验助手第 2 周会不会误开实验室第 2 周。
4. 第 2 周是否把检索与判定拆开评，检索命中不是结论正确；是否不用实时网页搜索、不把自写样本混进 CHEF。
5. 第 3 周是否固定三步、沿用第 1 周准则、引用可定位、过期或冲突分开处理；是否不写 Agent / MCP / FastAPI 作业。
6. 完成第 3 周后是否不出现「进入下一任务」，也不自动打开 Agent。
7. 保存或切换核验助手周次后，实验室第 2 周的旧依据是否仍在。
8. `currentStageId` / `currentTaskId` 是否仍指向实验室 Attention。
9. 本 diff 是否夹带第 0 / 24 章，或引入 92 项 UI / 框架项目卡。
10. 口径应记为：阶段 4-1 已通过，本轮是 4-2，阶段 4 整段尚未完成；不要开始阶段 5。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `content/learning-plan.json` | 修改 | 新增检索与工作流两周任务及五个概念；默认当前练习不变 |
| `js/pages.js` | 修改 | 阶段内没有下一项时，不写成整个阶段已结束、也不打开 Agent |
| `tools/test-course.js` | 修改 | 第 2、3 周静态页与 harness；周查找按阶段；文档口径 4-2 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 阶段 4-2 已写入；整段尚未完成 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | DESIGN 条目记下 4-2 |
