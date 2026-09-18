# Issue #2 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-1-chatgpt/INDEX.md`](../phase-1-chatgpt/INDEX.md)、[`../phase-2-chatgpt/INDEX.md`](../phase-2-chatgpt/INDEX.md)、[`../issue-1-p0-chatgpt/INDEX.md`](../issue-1-p0-chatgpt/INDEX.md)，不要用本包替换它们。

对应 GitHub Issue：https://github.com/xhr0417/llm-course/issues/2

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线提交：[`9b05b2f`](https://github.com/xhr0417/llm-course/commit/9b05b2fcdf509eea0907e66de30a2d452fcac6b2) — `fix: 7.6 分开 raw score 与 softmax 对称性，README 改以 Pages 为入口`
- 本轮：Issue #2 教材小修（7.6 不再把共享 Q/K 投影写成数学上不允许）。**没有进入 Phase 3。**
- 审核入口：本文件
- 差异：`issue-2.diff`（相对 `9b05b2f`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

本轮**会** push `main`，因此 Pages **会**随该 push 更新。写本包时 CI run 尚未结束；请打开最新 Actions，不要把未结束写成失败，也不要把 skipped 的 `integration` 写成 passed。

Issue #1 提交的 [CI run 35308748743](https://github.com/xhr0417/llm-course/actions/runs/35308748743) 是 **9b05b2f** 的结果，不代替本轮验证。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`，因此不要宣称自有服务器已更新。

`files/` 是本轮关键源文件的完整稿。生成页只在 diff 里出现 `chapters/transformer.html` 与 `sitemap.xml`（后者仅为构建产生的 `lastmod` 日期）。

## 怎么看

1. 先读本文件和 Issue：https://github.com/xhr0417/llm-course/issues/2
2. 7.6：`files/content/07-transformer.md` 中「7.6」一节、常见误区、面试题、章末测验、Q3 答案、总结表「为什么 Q≠K 投影」。
3. 回归：`files/tools/test-course.js` 里 `7.6 does not equate XX^T...`（数值 softmax + 禁止旧绝对化标题/误区条）。
4. 相对 `9b05b2f` 的差异：`issue-2.diff`。

---

## 本轮改了什么

不进入阶段 3，不删 `projects/`，不扩前八周 JSON / 证据表单 / 任务导航 / 复习队列，不运行 `tools/publish.sh`，不把工作区里第 0 / 24 章遗留修改打进本包。

### 1. 7.6 标题与教学口径

旧标题把共享/直接匹配写成「不能 X·Xᵀ」。现标题：

`## 7.6 为什么标准 Transformer 使用独立的 Q/K 投影？★`

现口径：

- 可以共享 Q/K 投影，也可以直接用 \(X\) 做匹配，这些都**算得出来**。受限的是匹配形式，不是能不能运行。
- 同一输入、无 mask、没有额外位置变换时，若 \(Q=K=XW\)，则 \(S=XWW^\top X^\top\)，**raw score** 被约束为对称；除以统一的 \(\sqrt{d_k}\) 不改变这一点。
- 逐行 softmax 后 \(A\) 一般仍不对称。保留反例：\(S_{13}=S_{31}=1\)，但 \(A_{13}\approx 0.422\neq A_{31}\approx 0.212\)。
- 独立 \(W_Q/W_K\) 是架构选择：允许更灵活的匹配并区分 Query / Key，**不保证** \(S\) 一定非对称，也不等于「共享无法计算」。

### 2. 误区、面试、测验、同章一致表述

- 常见误区把「不能用同一个矩阵投影 Q 和 K」改成**说得太绝对**，并解释共享可运行、约束的是 raw score。
- 面试题改为「为什么标准 Transformer 使用独立的 Q/K 投影？共享投影或直接用 X·Xᵀ 会怎样？」
- 章末测验题干不再问「为什么不能直接用 X·Xᵀ」；错误选项 A 是「数学上无法计算」；正确答案 B；解析写「共享投影可以运行」。
- Q3（三套投影）与总结表「为什么 Q≠K 投影」同步为：共享可算、raw score 受对称约束、独立投影允许但不保证非对称。

### 3. 测试定位

`tools/test-course.js` 原先用旧题干 `为什么 Q 和 K 不能直接用 X·Xᵀ` 切测验。现改为用新题干切片，并断言 7.6 出现「可以计算/可以共享/可以运行」与「不保证」，禁止标题残留「不能 X·X」，禁止误区条写成独立主张「不能用同一个矩阵投影 Q 和 K」（引用后加「说得太绝对」的写法仍允许）。**保留**同一组对称 logits 的 row-wise softmax 数值：`A13≈0.422`、`A31≈0.212`。

---

## 本轮未做

- 没有把前八周写入 `learning-plan.json`。
- 没有做证据存储、卡点、任务上下文导航、首页折叠。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包（那些不是 Issue #2）。

---

## 验证结果

本地已跑（通过）：

- `node tools/build-static.js`（`chapters/transformer.html` 由构建更新，未手改）
- `node --test tools/test-course.js`：20 通过
- `validate-content.js` / `validate-static.js` / `validate-portfolio.js` / `validate-jobs.js` / `validate-guided.js`

浏览器（本地 `http://localhost:8766/?v=issue2#/transformer?section=7.6 …独立的 Q/K 投影？★`）：

- 滚动落到 7.6；标题已无「不能 X·Xᵀ」；直觉段写「算得出来」。
- 仅一个 7.6、一个 7.7。
- 误区条写「说得太绝对」；数字反例 `0.422` / `0.212` 仍在。
- 章末测验选 B：状态「✓ 回答正确」；解析含「共享投影可以运行」。

静态页 `http://localhost:8766/chapters/transformer.html` 标题与测验题干与源文件一致。

### 未测项（不宣称通过）

- 写本包时 GitHub Actions 尚未结束。
- 系统 Chrome / 768 / 1280。
- 自有服务器（未运行 `tools/publish.sh`）。

---

## 请 ChatGPT 重点核对

1. 标题、误区、面试、测验是否仍把共享投影描述为数学上不允许（误区里**引用**旧说法并标明「太绝对」不算回退）。
2. 是否区分「可以计算」与「表达能力受约束」。
3. 数值反例是否仍是 \(S_{13}=S_{31}\) 但 \(A_{13}\neq A_{31}\)；测试是否仍计算 softmax，而不只做字符串匹配。
4. 「独立投影允许非对称，但不保证一定非对称」是否还在。
5. 是否开始做 Phase 3，或删除了 `projects/`。
6. 本 diff 是否夹带了第 0 / 24 章遗留修改。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `content/07-transformer.md` | 修改 | 7.6、误区、面试、测验、Q3、总结表 |
| `chapters/transformer.html` | 构建更新 | 勿手改 |
| `sitemap.xml` | 构建更新 | 仅 `lastmod` 日期 |
| `tools/test-course.js` | 修改 | 测验定位 + 禁止绝对化口径 |
