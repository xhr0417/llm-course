# 阶段 4-1 手动切阶段 + 第一条判定任务（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** 3b 各包，不要用本包替换它们：

- [`../phase-3b-step1-chatgpt/INDEX.md`](../phase-3b-step1-chatgpt/INDEX.md)
- [`../phase-3b-step1-fix-chatgpt/INDEX.md`](../phase-3b-step1-fix-chatgpt/INDEX.md)
- [`../phase-3b-step2-chatgpt/INDEX.md`](../phase-3b-step2-chatgpt/INDEX.md)
- [`../phase-3b-step2-confirm-chatgpt/INDEX.md`](../phase-3b-step2-confirm-chatgpt/INDEX.md)
- [`../phase-3b-step3-chatgpt/INDEX.md`](../phase-3b-step3-chatgpt/INDEX.md)
- [`../phase-3b-step4-chatgpt/INDEX.md`](../phase-3b-step4-chatgpt/INDEX.md)
- [`../phase-3b-step4-fix-chatgpt/INDEX.md`](../phase-3b-step4-fix-chatgpt/INDEX.md)

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 阶段 3b 收尾：[`6877262`](https://github.com/xhr0417/llm-course/commit/6877262)，CI [35833575124](https://github.com/xhr0417/llm-course/actions/runs/35833575124) success
- 本轮实现：[`521dfcd`](https://github.com/xhr0417/llm-course/commit/521dfcd)
- 本轮：**阶段 4-1 手动切阶段 + 第一条判定任务**。阶段 3b 已完成。默认当前练习仍是实验室 Attention。**阶段 4 整段尚未完成。** 不开始阶段 5。
- 差异：`phase-4-step1.diff`（相对 `6877262` / 本地 `abf3285` 的对应收尾提交，不含第 0/24 章遗留修改）

审查请固定在本轮实现，不要拿未含阶段切换的线上首页代替。

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。本轮另有一次 `main` 更新；是否已含手动切阶段与「给定声明和证据，只做判定」，只看 [`521dfcd`](https://github.com/xhr0417/llm-course/commit/521dfcd) 的 Actions。不要用 3b 收尾的绿勾代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮源文件完整稿。未跑 `build-static.js`。`js/learning.js` 本步未改。

## 怎么看

1. 先读本文件。阶段 3b 已完成。本包只审阶段切换与第一条判定练习。
2. 计划：`files/content/learning-plan.json` 仍 `currentStageId: lab`、`currentTaskId: lab.attention.causal-mha`。新增任务 `claim.judge.given-evidence`。
3. 入口：`files/js/pages.js` 的 `resolveStage`、`stageButtons`。只列出已有任务的阶段；专项实验没有任务，不出现。
4. 点击：`files/js/app.js` 对 `data-stage` 取该阶段 `weekBudget` 最小的任务；`data-week` 必须同时匹配当前阶段。
5. 测试：`home can switch to the claim-agent stage without advancing the lab`，以及 harness `home stage picker opens the claim-agent exercise and can return to lab`。
6. 相对 3b 收尾的差异：`phase-4-step1.diff`。

---

## 本轮做了什么

首页可以手动切到「技术声明核验助手 / 单 Agent」，并给出第一条可执行练习「给定声明和证据，只做判定」。

- 默认仍是实验室 Attention，不按日历打开核验助手。
- 点某一阶段只更换练习说明，不把实验室标成完成，也不打开新阶段。
- 周选择按当前阶段过滤 `weekBudget`，避免核验助手第 1 周盖过实验室第 1 周。
- 判定任务指向第 23 章真实小节；CHEF / Hello-Agents 只作对照入口。
- 本周不做检索、不写 Agent 循环、不用 LLM 裁判当金标准、不把自写样本混进 CHEF 冒充官方分数。
- 沿用已有验收记录与复习规则。`nextTask` 仍只在同一阶段内前进。

---

## 本轮未做

- 没有把阶段 4 整段说成完成。
- 没有开始阶段 5。
- 没有一次写完第 3–6 月全部周任务。
- 没有检索作业、Agent 循环、MCP、92 项选修库 UI。
- 没有拷贝 Hello-Agents / mini-swe-agent / CHEF 代码进主线。
- 没有为框架或机制仓库做主项目卡。
- 没有自动评分、LLM judge、SM-2、题库、streak、dashboard、通知。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章遗留修改打进本包。

---

## 验证结果

- `node --test tools/test-course.js`：41 通过。
- 浏览器：刷新计划后首页可看到阶段按钮。点「技术声明核验助手 / 单 Agent」出现「给定声明和证据，只做判定」，周选择隐藏，专项实验不出现。打开 23.17 后任务条仍是该练习，下一相关小节是 23.11。保存「标注准则」用户自报通过后，必需为 1 / 3。点回实验室落到第 1 周 Attention；再点第 2 周，拓展依据仍是「看过 10.4」，重练入口仍在。没有 mini-swe-agent / Pydantic AI，没有「进入下一任务」。
- 阶段 3b 收尾 CI：[35833575124](https://github.com/xhr0417/llm-course/actions/runs/35833575124)，head `6877262`。
- 自有服务器不在结论内。

### 未测项（不宣称通过）

- 写本包时本轮实现提交的 CI / Pages 尚未出结果。以 [`521dfcd`](https://github.com/xhr0417/llm-course/commit/521dfcd) 的 GitHub Actions 为准，不要用 3b 收尾的绿勾代替。
- 375／768／1280 的独立重跑。
- 阶段 4 其余周任务。

---

## 请 ChatGPT 重点核对

1. 本轮是否只做手动切阶段与第一条判定练习；有没有夹带阶段 5，或把阶段 4 写成已完成。
2. 默认首页是否仍是 Attention；点阶段是否只更换练习说明，不把实验室标成完成。
3. 周选择是否按当前阶段过滤；两个阶段都有 weekBudget 1 时，会不会点错练习。
4. 判定任务是否不做检索、不写 Agent 循环、不用 LLM 裁判当金标准、不把自写样本混进 CHEF。
5. 保存核验助手的一条验收后，实验室第 2 周的旧依据是否仍在。
6. `currentStageId` / `currentTaskId` 是否仍指向实验室 Attention。
7. 本 diff 是否夹带第 0 / 24 章，或引入 92 项 UI / 框架项目卡。
8. 口径应记为：阶段 3b 已完成，本轮是 4-1，阶段 4 整段尚未完成；不要开始阶段 5。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `content/learning-plan.json` | 修改 | 新增判定任务与三个概念；默认当前练习不变 |
| `js/pages.js` | 修改 | 阶段按钮；显示阶段随所选任务 |
| `js/app.js` | 修改 | 点阶段取该阶段最早一周；换周按当前阶段过滤 |
| `tools/test-course.js` | 修改 | 阶段切换静态页与 harness；文档口径 4-1 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 阶段 4 已开始第一步；整段尚未完成 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | DESIGN 条目记下 4-1 |
| `DESIGN.md` | 修改 | 可手动选阶段或当前阶段的周 |
