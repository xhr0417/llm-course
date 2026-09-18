# Issue #4 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留**此前 `review/` 下各包，不要用本包替换它们。

对应 GitHub Issue：https://github.com/xhr0417/llm-course/issues/4

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 基线提交：[`593ebee`](https://github.com/xhr0417/llm-course/commit/593ebee) — `feat: 写入前八周可执行任务并支持手动选周`
- 本轮：**阶段 3 第一步收尾** — 补齐第 3 周 next-token 对齐、第 2 周组装后因果性、第 8 周真实 A/B 预测。记录层仍未实现。
- 审核入口：本文件
- 差异：`issue-4.diff`（相对 `593ebee`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

本轮**会** push `main`，因此 Pages **会**随该 push 更新。写本包时 CI run 尚未结束；请打开最新 Actions，不要把未结束写成失败，也不要把 skipped 的 `integration` 写成 passed。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`，因此不要宣称自有服务器已更新。

`files/` 是本轮关键源文件的完整稿。本轮不改章节 Markdown，未跑 `build-static.js`。

## 怎么看

1. 先读本文件和 Issue：https://github.com/xhr0417/llm-course/issues/4
2. 任务：`files/content/learning-plan.json` 第 2、3、7、8 周（第 4 周只同步「对齐已在第 3 周核对」）。
3. 八周表：`files/docs/LEARNING_PLAN.md` 第 5 节。
4. 工程范围：`files/docs/IMPLEMENTATION_PLAN.md`「本轮（issue #4）」。
5. 回归：`files/tools/test-course.js`。
6. 相对 `593ebee` 的差异：`issue-4.diff`。

---

## 本轮改了什么

只修任务说明与直接相关文档。不重做选周功能，不进入记录层。

### 1. 第 3 周第一次更新就要 next-token 对齐

- 用短序列写明输入、预测位置、下一 token。
- 预先错位或在 loss 中错位，只 shift 一次；不假定自写模型自动 shift。
- 一步训练：zero_grad → forward → loss → backward → step；不启用梯度累积。
- 必需验收增加 `next-token-align`；保留有限 loss、有效梯度、参数更新。
- 删除「label shift 放到下周」的说法。第 4 周改为把已核对的对齐放进完整循环。

### 2. 第 2 周检查组装后整模型因果性

- 删除「本周不用再验因果」。
- 关闭 dropout、固定参数与前缀、只改末尾 token；比较完整模型 logits，使用组合容差。
- 必需验收 `assembled-causal`。不必重写 Attention。RMSNorm/RoPE 仍为拓展。

### 3. 第 8 周用真实 A/B 权重出预测

- 第 7 周仍可用假输出测 scorer。
- 第 8 周分别加载 A、B 真实 checkpoint，同一输入、同一协议取得预测，再交给已核对的 scorer。
- 记下 checkpoint 标识和逐样本真实结果。假输出不能当作实验结果。
- 异常与真实零分仍分开；不要求分数提高或全量榜。

`evidenceSystemImplemented` 仍为 `false`。选周行为未改。

---

## 本轮未做

- 没有证据表单、卡点、任务导航、复习队列。
- 没有删除 `projects/`，没有改 CI workflow。
- 没有运行 `tools/publish.sh`。
- 没有把第 0 / 24 章遗留修改打进本包。
- 文案测试不能宣称用户的 Python 模型已经通过；本站不运行 Python，也不代写核心算法。

---

## 验证结果

本地已跑（通过）：

- `node --test tools/test-course.js`：23 通过
- 未跑 `build-static.js`（无章节 Markdown 变更）

浏览器（本地 `http://localhost:8766/?v=issue4#/`，视口 375×812）：

- 第 8 周（刷新后因上次选择而打开）：出现「真实 A/B 预测」。
- 第 2 周：步骤与验收含「组装后的整模型因果性」、dropout、atol + rtol；无「因果已在上周验」。
- 第 3 周：next-token 对齐、zero_grad、不启用梯度累积；GQA 仍在拓展。
- 「9.2 Next Token Prediction」链接落到第 9 章 9.2 小节（标题距视口顶部约 76px）。

### 未测项（不宣称通过）

- 写本包时 GitHub Actions 尚未结束。
- 系统 Chrome / 768 / 1280 完整走查。
- 自有服务器。
- 记录层行为（尚未实现）。不要把本轮文案测试说成用户实现已通过。

---

## 请 ChatGPT 重点核对

1. 第 3 周是否仍暗示可以先训练同位置 token。
2. 第 2 周因果检查是否只复跑 Attention，而不是整模型 logits。
3. 第 8 周是否仍能用假输出当作 A/B 实验结果。
4. 是否开始做记录层，或把 `evidenceSystemImplemented` 改成 true。
5. 本 diff 是否夹带第 0 / 24 章遗留修改。
6. 是否把文案测试说成 Python 实现已经通过。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `content/learning-plan.json` | 修改 | 第 2、3、7、8 周任务；第 4 周对齐口径 |
| `docs/LEARNING_PLAN.md` | 修改 | 八周表与第 2／3 周说明 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 标明本轮是 issue #4 收尾 |
| `tools/test-course.js` | 修改 | 三项收尾回归 |
