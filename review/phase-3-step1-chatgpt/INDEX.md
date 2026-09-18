# 阶段 3 第一步改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-1-chatgpt/INDEX.md`](../phase-1-chatgpt/INDEX.md)、[`../phase-2-chatgpt/INDEX.md`](../phase-2-chatgpt/INDEX.md)、[`../issue-1-p0-chatgpt/INDEX.md`](../issue-1-p0-chatgpt/INDEX.md)、[`../issue-2-chatgpt/INDEX.md`](../issue-2-chatgpt/INDEX.md)、[`../issue-3-chatgpt/INDEX.md`](../issue-3-chatgpt/INDEX.md)，不要用本包替换它们。

对应 GitHub Issue：https://github.com/xhr0417/llm-course/issues/3

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线提交：[`2c85dd7`](https://github.com/xhr0417/llm-course/commit/2c85dd7) — `docs: 阶段 3 开工前统一验收、求助与八周难度`
- 本轮：**阶段 3 第一步实现** — 前八周任务数据、真实教材小节链接、首页手动选择当前周。`evidenceSystemImplemented` 仍为 `false`。
- 审核入口：本文件
- 差异：`phase-3-step1.diff`（相对 `2c85dd7`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

本轮**会** push `main`，因此 Pages **会**随该 push 更新。写本包时 CI run 尚未结束；请打开最新 Actions，不要把未结束写成失败，也不要把 skipped 的 `integration` 写成 passed。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`，因此不要宣称自有服务器已更新。

`files/` 是本轮关键源文件的完整稿。本轮不改章节 Markdown，未跑 `build-static.js`，diff 里没有 `chapters/*.html`。

## 怎么看

1. 先读本文件和 Issue：https://github.com/xhr0417/llm-course/issues/3
2. 八周任务：`files/content/learning-plan.json`（每条含 workspace / steps / 必需／拓展 / 真实小节）。
3. 首页如何展示与选周：`files/js/pages.js`、`files/js/app.js`、`files/css/course.css`。
4. 工程范围：`files/docs/IMPLEMENTATION_PLAN.md`「本轮（阶段 3 第一步）」。
5. 回归：`files/tools/test-course.js`（八周 headings、GQA 拓展、选周不表示完成、harness 点击第 2 周）。
6. 相对 `2c85dd7` 的差异：`phase-3-step1.diff`。

---

## 本轮改了什么

只做阶段 3 实现顺序的第 1 步。不做记录表单、卡点存储、任务上下文导航。不删 `projects/`，不运行 `tools/publish.sh`，不把工作区里第 0 / 24 章遗留修改打进本包。

### 1. 前八周都是可执行任务，不是八张空卡片

`learning-plan.json` 现有 8 条 `lab.*` 任务。默认 `currentTaskId` 仍是第 1 周 Attention。每一周都写了：

- 写在哪里（本机空文件 / `~/llm-lab/...`，不进六个旧作业目录）
- 输入 / 输出
- 实现步骤（含分层求助与小变式）
- 必需验收；有拓展时 `required: false`
- `materials` 指向现有章的真实标题（测试会对照 Markdown headings）

难度对齐 issue #3 设计：第 2 周先完成 `[B, T, V]` 最小前向；第 3 周先验证参数更新，**GQA 为拓展**；不把 DDP / FlashAttention / GRPO 写进必需项。

### 2. 首页可手动选周

「我的学习」出现第 1–8 周按钮（`data-week`，不暴露 taskId）。点某一周只更换练习说明，文案写明「不会把前面的周标成完成，也不会按日期自动跳周」。选择写入 `llm-course-current-task`。重置阅读进度不清除选周。

标题仍是 `阶段名—短标题`，所以第 1 周继续显示「小模型学习实验室—Attention」。

有 `required: false` 时才出现「拓展（不挡完成）」；第 1 周没有该区块。

### 3. 记录层仍未实现

`dataBoundary.evidenceSystemImplemented` 仍为 `false`。首页没有验收表单、没有失败/通过控件、没有卡点存储。完成规则仍只存在于计划数据与文档里，本轮不按记录判断完成。

---

## 本轮未做

- 没有证据存储、失败表单、卡点、任务上下文导航、首页折叠。
- 没有实现「确认进入下一任务」按钮。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包。
- 没有把「选第 8 周」当成第 1–7 周已完成。

---

## 验证结果

本地已跑（通过）：

- `node --test tools/test-course.js`：23 通过（含八周 headings、选周渲染、harness 点击第 2 周并记住）
- 未跑 `build-static.js`（无章节 Markdown 变更）

浏览器（本地 `http://localhost:8766/?v=phase3s1#/`，视口 375×812）：

- 默认第 1 周「手写因果多头注意力」，8 个选周按钮。
- 点第 2 周：最小 decoder、`[B, T, V]`、拓展 RMSNorm/RoPE；说明写着不会把前面的周标成完成。
- 点第 3 周：loss / 参数更新为必需，GQA 在「拓展（不挡完成）」；无「自动测试通过」。
- 「打开必要教材：11.7 autograd」落到第 11 章 11.7 小节（标题距视口顶部约 76px）。
- 回到首页仍停在第 3 周；再点第 8 周出现单变量实验与 KV cache 拓展。
- `localStorage['llm-course-current-task']` 随选择变化。375 宽度无横向溢出；选中周按钮高度 44px。
- 目录 `#/catalog` 仍可用。无验收表单。

### 未测项（不宣称通过）

- 写本包时 GitHub Actions 尚未结束。
- 系统 Chrome / 768 / 1280 的完整人工走查。
- 自有服务器（未运行 `tools/publish.sh`）。
- 阶段 3 记录层行为（尚未实现）：失败后任务仍未完成、刷新保记录、保存失败提示等。不要用本轮关键词测试代替下一步功能验收。

---

## 请 ChatGPT 重点核对

1. 第 2–8 周是否都写清了「写什么、怎么检查、必需做到哪里」，而不是只把八周表复制成标题卡片。
2. 教材小节是否都真实存在；有没有链到六个旧作业目录当本周交付物。
3. 第 2 周是否仍把 RMSNorm/RoPE 当硬门槛；第 3 周 GQA 是否仍能阻挡核心任务。
4. 选第 8 周是否被文案或逻辑写成第 1–7 周已完成。
5. 是否已经做了证据表单 / 卡点 / `evidenceSystemImplemented: true`。
6. 本 diff 是否夹带了第 0 / 24 章遗留修改。
7. 是否把本轮说成阶段 3 全部完成。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `content/learning-plan.json` | 修改 | 八周任务、小节链接、必需／拓展 |
| `js/pages.js` | 修改 | 按选中周渲染；选周按钮；拓展分组 |
| `js/app.js` | 修改 | 记住当前周并重建首页 |
| `css/course.css` | 修改 | 选周按钮 |
| `tools/test-course.js` | 修改 | 八周与选周回归 |
| `tools/test-app-harness.js` | 修改 | 允许注入已保存的当前周 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 标明本轮是阶段 3 第一步 |
| `DESIGN.md` | 修改 | 手动选周不表示前面完成 |
| `README.md` | 修改 | 默认第 1 周，可改到第 2–8 周 |
