# 阶段 3 第三步跨章搜索补丁索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-3-step3-chatgpt/INDEX.md`](../phase-3-step3-chatgpt/INDEX.md) 与 [`../phase-3-step3-navfix-chatgpt/INDEX.md`](../phase-3-step3-navfix-chatgpt/INDEX.md)，不要用本包替换它们。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 第三步初版：[`2d6f60e`](https://github.com/xhr0417/llm-course/commit/2d6f60e850ccfb52eda689660552b83a9fda5af4)
- 上一版小修（任务条同步 + 实测留白）：[`02afd1b`](https://github.com/xhr0417/llm-course/commit/02afd1b) / 审核包 [`88ed442`](https://github.com/xhr0417/llm-course/commit/88ed442)
- 上一版 [CI 与 Pages 已成功](https://github.com/xhr0417/llm-course/actions/runs/35553423931)；Pages 实测确认那两处已修好，但跨章搜索点了不跳转。
- 本轮实现提交：[`74500e3`](https://github.com/xhr0417/llm-course/commit/74500e3) — `fix: 跨章搜索改为切到目标章后再定位小节`
- 本轮：**只修**跨章搜索回归。同章原地定位、任务条更新、吸顶留白不重做。前两步结论不变。阶段 3 整体尚未完成。
- 审核入口：本文件
- 差异：`phase-3-step3-search.diff`（相对 `88ed442`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。本轮随 `74500e3` 推 `main`；Pages 是否已含跨章搜索修复，只看该提交的 Actions。不要用上一版小修的绿勾代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮关键源文件的完整稿。`files/js/search.js` **本轮未改**（仍对搜索结果 `preventDefault`），只作点击路径对照。未跑 `build-static.js`。

## 怎么看

1. 先读本文件。前两步已通过；任务条同步与标题留白已通过 Pages 实测。本轮只审跨章搜索。
2. 路由切换：`files/js/app.js` 的 `onNavigate`。同章 `focusSection`；跨章写入 `pendingSection` 并设置 `location.hash`。
3. 点击拦截：`files/js/search.js` 仍 `preventDefault`，所以必须由 `onNavigate` 改 hash，不能指望默认链接跳转。
4. 行为测试：`files/tools/test-course.js`（首页搜索进章节、章 A 搜索进章 B；原同章 7.14 测试保留）。
5. 相对 `88ed442` 的差异：`phase-3-step3-search.diff`。

---

## 本轮改了什么

只修 [`02afd1b`](https://github.com/xhr0417/llm-course/commit/02afd1b) 引入的回归：搜索结果一律 `preventDefault` 后，跨章只记下 `pendingSection`、没有改路由。

- 当前页就是目标章：继续原地定位，不改 hash（同章 7.4 → 7.14 任务条更新仍在）。
- 当前页不是目标章（首页或另一章）：记下目标小节，把 `location.hash` 设成目标章（可带 `?section=`）；`route()` 加载后用 `pendingSection` / `section` 定位。

---

## 本轮未做

- 没有改任务条同步、吸顶留白、首页分层或记录规则。
- 没有复习队列、自动评分或新项目。
- 没有运行 `tools/publish.sh`。
- 没有把工作区里第 0 / 24 章的遗留修改打进本包。
- 没有把本轮说成第三步或阶段 3 已经收尾。

---

## 验证结果

本地已跑（通过）：

- `node --test tools/test-course.js`：33 通过（原 32 条 + 首页/跨章搜索进入目标小节）
- 未跑 `build-static.js`

浏览器（本地 `http://127.0.0.1:8772/#/`，无缓存脚本）：

- 首页搜索 `RMSNorm`，点「10.4 RMSNorm」：地址变为 `#/modern-llm?section=…`，标题为现代 LLM 架构，焦点在 10.4。
- Transformer 7.4 搜索 `RMSNorm` 再点 10.4：同样进入现代 LLM 架构并定位 10.4，正文不再停在 Transformer。
- Transformer 内搜索 `7.14 Multi-Head`：hash 仍是 7.4 入口，正文定位 7.14，任务条 6/6、下一小节 7.12。

### 未测项（不宣称通过）

- 写本包时本轮 CI / Pages 尚未出结果。以 [`74500e3`](https://github.com/xhr0417/llm-course/commit/74500e3) 的 GitHub Actions 为准。
- 自有服务器（未运行 `tools/publish.sh`）。
- 阶段 3b 复习队列。

---

## 请 ChatGPT 重点核对

1. 在 Transformer 搜索 `RMSNorm` 并点击「现代 LLM 架构 · 10.4 RMSNorm」后，是否进入第 10 章并落到 10.4，而不是仍停在 Transformer。
2. 从首页搜索进入某一章，是否同样切路由并定位目标小节。
3. 同章搜索 7.14 是否仍原地定位，且任务条仍为 6/6、下一小节 7.12。
4. `preventDefault` 是否仍在；跨章是否只靠 `pendingSection`、没有改 `location.hash`。
5. 是否改动了记录规则、首页分层、八周任务，或夹带第 0 / 24 章遗留修改。
6. 是否把本轮说成第三步已经收尾。应记为：前两步已通过，任务条与留白已通过，跨章搜索这一处待审，阶段 3 整体尚未完成。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/app.js` | 修改 | 跨章搜索改 hash 并保留 pendingSection |
| `js/search.js` | 未改 | 收录对照：结果点击仍 preventDefault |
| `tools/test-course.js` | 修改 | 首页搜索、跨章搜索回归 |
| `tools/test-app-harness.js` | 修改 | 赋值 location.hash 触发 hashchange；现代架构章含 10.4 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 第三步验收补上跨章搜索 |
