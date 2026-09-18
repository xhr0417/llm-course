# Issue #3 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-1-chatgpt/INDEX.md`](../phase-1-chatgpt/INDEX.md)、[`../phase-2-chatgpt/INDEX.md`](../phase-2-chatgpt/INDEX.md)、[`../issue-1-p0-chatgpt/INDEX.md`](../issue-1-p0-chatgpt/INDEX.md)、[`../issue-2-chatgpt/INDEX.md`](../issue-2-chatgpt/INDEX.md)，不要用本包替换它们。

对应 GitHub Issue：https://github.com/xhr0417/llm-course/issues/3

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线提交：[`3216afd`](https://github.com/xhr0417/llm-course/commit/3216afd) — `fix: 7.6 不再把共享 Q/K 投影写成无法计算`
- 本轮：Issue #3 **阶段 3 计划设计**（验收／失败、求助、必需／拓展、八周难度）。**没有实现阶段 3 功能。** `learning-plan.json` 仍只有 Attention 一条任务。
- 审核入口：本文件
- 差异：`issue-3.diff`（相对 `3216afd`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

本轮**会** push `main`，因此 Pages **会**随该 push 更新（首页任务文案来自 `learning-plan.json`）。写本包时 CI run 尚未结束；请打开最新 Actions，不要把未结束写成失败，也不要把 skipped 的 `integration` 写成 passed。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`，因此不要宣称自有服务器已更新。

`files/` 是本轮关键源文件的完整稿。本轮不改章节 Markdown，未跑 `build-static.js`，diff 里没有 `chapters/*.html`。

## 怎么看

1. 先读本文件和 Issue：https://github.com/xhr0417/llm-course/issues/3
2. 产品规则：`files/docs/PERSONAL_LEARNING_OS.md` 第 3.2–3.7、第 4、第 5 节。
3. 八周表：`files/docs/LEARNING_PLAN.md` 第 5 节。
4. 工程顺序：`files/docs/IMPLEMENTATION_PLAN.md` 阶段 3（开工三步仍是计划，本轮未做）。
5. 现有 Attention 任务：`files/content/learning-plan.json`（`required: true`、求助与小变式步骤、数值先查 NaN/Inf）。
6. 首页如何展示：`files/js/pages.js`（必需项；若有 `required: false` 才出现「拓展（不挡完成）」）。
7. 回归：`files/tools/test-course.js` 里 `phase 3 design docs agree...` 与 Attention 任务测试。
8. 相对 `3216afd` 的差异：`issue-3.diff`。

---

## 本轮改了什么

不扩前八周 JSON、不做证据表单／卡点存储／任务导航／复习队列，不删 `projects/`，不运行 `tools/publish.sh`，不把工作区里第 0 / 24 章遗留修改打进本包。

### 1. 任务完成只看必需验收，概念不再设第二套门槛

- 完成 = 该任务定义里的**全部必需验收项**（从数据读取，不硬编码三条或四条）。
- 四个独立维度（读过／自己实现／验证通过／能解释）挂在知识点上，用于薄弱点、历史和复习；不要求每个概念填满四项。
- 历史概念记录不能自动完成新任务。

### 2. 证据来源与检查结果分开

- 结果：未检查／未通过／用户自报通过。
- `user_reported` 是来源，不表示成功。
- 失败保留，修好可追加；完成看**当前**结果。
- 满足后提示用户确认进入下一任务，日历不自动推进。
- Attention 示例改为四条必需项，去掉「三条 criterion + 概念勾选」才能推进。

### 3. 求助规范与小变式写入任务文案

建议流程写入 OS 第 3.7 节和 Attention 步骤：尝试 → 检查 → 分层求助 → 合上参考重写 → 换输入验证。「独立实现」是最终能脱离答案完成。每个任务一个小变式，不建题库。自动复习队列仍留阶段 3b。

### 4. 八周必需／拓展

- 第 1 周仍是 causal 单头 → 多头。
- 第 2 周核心是简单固定结构的最小 LM forward `[B,T,V]`。
- 第 3 周先打通 loss／backward／参数更新，再逐个换现代组件。
- **GQA 为拓展**，未完成不阻挡核心任务。
- 第 4 周保留训练／验证与小样本过拟合；第 6–7 周基础 SFT 与简化评测保持。
- 不把前八周扩到 DDP、FlashAttention、GRPO。

### 5. Attention JSON 与首页

现有四条验收均 `required: true`。步骤增加求助与小变式；数值先查 NaN/Inf。`evidenceSystemImplemented` 仍为 `false`。首页仍无证据表单。

阶段 3 实现仍按三步：八周数据与手动选任务 → 最小记录与本地保存 → 任务上下文导航与首页分层。本轮只把规则写进文档。

---

## 本轮未做

- 没有把第 2–8 周写入 `learning-plan.json`。
- 没有做证据存储、失败表单、卡点、任务上下文导航、首页折叠。
- 没有实现「确认进入下一任务」按钮。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包。

---

## 验证结果

本地已跑（通过）：

- `node --test tools/test-course.js`：21 通过（含本轮 `phase 3 design docs agree...`）
- 未跑 `build-static.js`（无章节 Markdown 变更）

浏览器（本地 `http://localhost:8766/?v=issue3#/`）：

- 当前练习仍是「手写因果多头注意力」。
- 步骤可见「分层求助」「小变式」；数值检查含 NaN/Inf。
- 无「拓展（不挡完成）」区块（本任务没有 `required: false` 项）。
- 无验收表单、无「用户自报通过」控件。

### 未测项（不宣称通过）

- 写本包时 GitHub Actions 尚未结束。
- 系统 Chrome / 768 / 1280。
- 自有服务器（未运行 `tools/publish.sh`）。
- 阶段 3 记录层行为（尚未实现）：失败后任务仍未完成、刷新保记录、保存失败提示等。

---

## 请 ChatGPT 重点核对

1. 三份计划中的完成规则、四个独立维度、必需／拓展是否一致。
2. Attention 是否仍把概念勾选当作推进门槛，或仍写「三条 criterion」。
3. `user_reported` 是否又被写成「通过」。
4. GQA 是否仍能阻挡第 3 周核心任务。
5. 是否开始实现八周 JSON、证据表单、复习队列，或删除了 `projects/`。
6. 本 diff 是否夹带了第 0 / 24 章遗留修改。
7. 是否把本轮文档修改说成阶段 3 已上线。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 完成规则、失败记录、求助、四个独立维度 |
| `docs/LEARNING_PLAN.md` | 修改 | 八周必需／拓展与难度 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 阶段 3 开工顺序与本轮范围锁 |
| `content/learning-plan.json` | 修改 | Attention 文案、`required`、数据边界 |
| `js/pages.js` | 修改 | 首页展示求助文案；预留拓展区块 |
| `tools/test-course.js` | 修改 | 设计一致性与任务文案回归 |
| `AGENTS.md` | 修改 | 记录层约定与文档对齐 |
