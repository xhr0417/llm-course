# Issue #1 P0 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-1-chatgpt/INDEX.md`](../phase-1-chatgpt/INDEX.md) 与 [`../phase-2-chatgpt/INDEX.md`](../phase-2-chatgpt/INDEX.md)，不要用本包替换它们。

对应 GitHub Issue：https://github.com/xhr0417/llm-course/issues/1

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线提交：[`5a4f328`](https://github.com/xhr0417/llm-course/commit/5a4f3288d6e156cac03b532501ed100996c97910) — `docs: finalize phase 2 review package`
- Phase 2 实现仍是：[`c749185`](https://github.com/xhr0417/llm-course/commit/c7491855ecaf179723a29eae15d93893e453c642)
- 本轮：Issue #1 的 **P0 前置修正** + 计划文档对齐。**没有进入 Phase 3。**
- 审核入口：本文件
- 差异：`issue-1-p0.diff`（相对 `5a4f328`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

本轮**会** push `main`，因此 Pages **会**随该 push 更新。写本包时 CI run 尚未结束；请打开最新 Actions，不要把未结束写成失败，也不要把 skipped 的 `integration` 写成 passed。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`，因此不要宣称自有服务器已更新。这正是 README 把 Pages 设为当前正式入口、自有域名标「待同步」的原因。

`files/` 是本轮关键源文件的完整稿。生成页只在 diff 里出现 `chapters/transformer.html`。

## 怎么看

1. 先读本文件和 Issue：https://github.com/xhr0417/llm-course/issues/1
2. 7.6：`files/content/07-transformer.md` 中「7.6」一节、同章测验与面试题。
3. 回归：`files/tools/test-course.js` 里 `7.6 does not equate XX^T...` 与 `README treats GitHub Pages...`。
4. 入口：`files/README.md`。
5. 第 1 周硬门槛：`files/docs/LEARNING_PLAN.md` 第 5 节；OS 第 4 节；`files/docs/IMPLEMENTATION_PLAN.md` 阶段 3 前置说明。
6. 相对 `5a4f328` 的差异：`issue-1-p0.diff`。

---

## 本轮改了什么

不进入阶段 3，不删 `projects/`，不扩前八周 JSON / 证据表单 / 任务导航 / 复习队列，不运行 `tools/publish.sh`。

### 1. 修正 Transformer 7.6（Issue P0-1）

旧文把 **raw score/logits** 和 **softmax 后 attention weights** 混在一起，写成「注意力矩阵对称：A 关注 B 多强，B 就关注 A 多强」，并写了未核验的「论文实验表明」。

现口径：

- 若 `Q = K = X` 且无 mask，`S = XXᵀ` 的 raw score 确实 `S_ij = S_ji`。
- 逐行 softmax 后 `A` **一般不对称**（两行归一化分母不同）。同一张 `XXᵀ` 上 `A_{13}≈0.422 ≠ A_{31}≈0.212`。
- causal mask 后权重更不会保持对称。
- 分开 `W_Q` / `W_K` 是为了让 raw compatibility 也可以非对称，并把 Query / Key 角色分开。这是架构表达力，不是本课引用的论文消融。

同章面试题、总结表、章末测验已同步。`tools/test-course.js` 用同一组对称 logits 做 row-wise softmax 数值回归，并禁止旧句子与「论文实验表明」回流。

### 2. README 当前正式入口改为 GitHub Pages（Issue P0-2 策略 A）

- 当前入口：https://xhr0417.github.io/llm-course/
- `llm.xhr0417.cn` 标为**待同步**，可能仍是旧「三条路线 + 实战项目」。
- 未执行策略 B（不运行 `publish.sh`）。

### 3. 计划文档对齐（Issue 验收清单，不是实现 Phase 3）

- 第 1 周硬门槛只覆盖 causal 单头 → 多头；最小 decoder block 移到第 2 周。
- 阶段 3 范围锁在：前八周任务写入 plan JSON、最小状态/证据/卡点、任务阅读上下文。本轮**没有实现**这些功能。

---

## 本轮未做

- 没有把前八周写入 `learning-plan.json`（仍只有 `lab.attention.causal-mha`）。
- 没有做证据存储、卡点、任务上下文导航、首页折叠。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包（那些不是 Issue #1 P0）。

---

## 验证结果

本地已跑（通过）：

- `node tools/build-static.js`（`chapters/transformer.html` 由构建更新，未手改）
- `node --test tools/test-course.js`：20 通过（含本轮两条新测试）
- `validate-content.js` / `validate-static.js` / `validate-portfolio.js`

浏览器（本地 `http://localhost:8766/?v=issue1#/transformer`）：7.6 可见 raw score / softmax 区分与 `0.422` / `0.212` 反例。

### 未测项（不宣称通过）

- 写本包时 GitHub Actions 尚未结束。
- 系统 Chrome / 768 / 1280。
- 自有服务器（未运行 `tools/publish.sh`）。

---

## 请 ChatGPT 重点核对

1. 7.6 是否仍把 `XXᵀ` 的 raw-score 对称性说成 softmax 权重对称，或仍出现「A 关注 B 多强，B 就关注 A 多强」作为正确结论。
2. 数值反例是否与 `S_{13}=S_{31}` 但 `A_{13}≠A_{31}` 一致；回归测试是否真的计算 softmax，而不是只做字符串匹配。
3. 「论文实验表明」是否还被写成已核验结论。
4. README 默认链接是否把访问者带到 `llm.xhr0417.cn` 旧结构；Pages 与 `publish.sh` 是否又被混成一句「没有发布」。
5. 是否开始做 Phase 3（八周 JSON、证据表单、任务导航），或删除了 `projects/`。
6. 本 diff 是否夹带了第 0 / 24 章遗留修改。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `content/07-transformer.md` | 修改 | 7.6、测验、面试题 |
| `chapters/transformer.html` | 构建更新 | 勿手改 |
| `README.md` | 修改 | Pages 为当前入口 |
| `tools/test-course.js` | 修改 | 7.6 数值回归 + README 入口 |
| `docs/LEARNING_PLAN.md` | 修改 | 第 1 周 attention-only |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 第 1 周不含 decoder block |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 阶段 3 前置与范围锁 |
