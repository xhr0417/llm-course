# 阶段 3 第三步跨章搜索补丁索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-3-step3-chatgpt/INDEX.md`](../phase-3-step3-chatgpt/INDEX.md) 与 [`../phase-3-step3-navfix-chatgpt/INDEX.md`](../phase-3-step3-navfix-chatgpt/INDEX.md)，不要用本包替换它们。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- 第三步初版：[`2d6f60e`](https://github.com/xhr0417/llm-course/commit/2d6f60e850ccfb52eda689660552b83a9fda5af4)
- 任务条同步 + 实测留白：[`02afd1b`](https://github.com/xhr0417/llm-course/commit/02afd1b)
- 跨章搜索实现：[`74500e3`](https://github.com/xhr0417/llm-course/commit/74500e3) — `fix: 跨章搜索改为切到目标章后再定位小节`
- 上一版审核包：[`23dc6d1`](https://github.com/xhr0417/llm-course/commit/23dc6d1)（只加 review 文件）
- 上一版 [CI 与 Pages 已成功](https://github.com/xhr0417/llm-course/actions/runs/35554271988)；**head SHA 是 `23dc6d1`，不是 `74500e3`**。`23dc6d1` 是 `74500e3` 的后继且只增加审核材料，所以那次 Pages 部署包含跨章搜索修复。
- 本轮封板实现：[`705d592`](https://github.com/xhr0417/llm-course/commit/705d592) — `fix: 搜索结果链接带上目标小节`
- 本轮：封板补丁。修正上一版 INDEX 写反的第 4 条和过期的 CI 口径；搜索结果 `<a href>` 带上 `?section=`，让 Cmd/Ctrl/中键与普通左键语义一致。不重做同章定位、任务条、吸顶留白。前两步结论不变。阶段 3 整体尚未完成。
- 审核入口：本文件
- 差异：`phase-3-step3-search.diff`（相对 `88ed442`，不含第 0/24 章遗留修改）

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

跨章搜索实现已随 [`23dc6d1`](https://github.com/xhr0417/llm-course/commit/23dc6d1) 的 [run 35554271988](https://github.com/xhr0417/llm-course/actions/runs/35554271988) 部署：Node validators、Python unit、Docker build、GitHub Pages deploy 均 success；手动 integration 按设计 skipped。不要把该 run 的 head 写成 `74500e3`。

本轮封板补丁随 [`705d592`](https://github.com/xhr0417/llm-course/commit/705d592) 再推 `main`；是否已含 `?section=` 链接，只看该新提交的 Actions，不要用 `35554271988` 代替。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行 `tools/publish.sh` 才更新。本轮未运行 `tools/publish.sh`。

`files/` 是本轮关键源文件的完整稿。未跑 `build-static.js`。

## 怎么看

1. 先读本文件。前两步已通过；任务条同步与标题留白已通过 Pages 实测；跨章普通左键搜索已通过专项复审。本轮只审 INDEX 口径与搜索结果链接带小节。
2. 路由切换：`files/js/app.js` 的 `onNavigate`。同章 `focusSection`；跨章写入 `pendingSection` **并**设置 `location.hash`。
3. 点击拦截：`files/js/search.js` 对普通左键仍 `preventDefault`，再走 `onNavigate`。修饰键 / 中键放行默认链接，因此 `<a href>` 必须自带 `?section=`。
4. 行为测试：`files/tools/test-course.js`（首页搜索、章 A 搜到章 B、同章 7.14；搜索结果 href 含目标小节）。
5. 相对 `88ed442` 的差异：`phase-3-step3-search.diff`。

---

## 本轮改了什么

跨章搜索实现本身已在 [`74500e3`](https://github.com/xhr0417/llm-course/commit/74500e3) 通过专项复审。本轮只封板：

- 修正上一版 INDEX 第 4 条（曾写成「跨章是否只靠 pendingSection、没有改 location.hash」，与实现相反）。
- 把 CI / Pages 写成 [run 35554271988](https://github.com/xhr0417/llm-course/actions/runs/35554271988) 的实际结果，并标明 head 是 `23dc6d1`。
- 搜索结果 `href` 带目标小节（章节走 `routes.href(..., section)`，参考页同样加 `?section=`）。普通左键仍 `preventDefault` + `onNavigate`；新标签打开默认链接时也能落到目标小节。

跨章普通左键路径不变：

- 当前页就是目标章：原地 `focusSection`，不改 hash。
- 当前页不是目标章：记下 `pendingSection`，**必须**改 `location.hash`；`route()` 加载后按 URL 的 `section`（或 pending fallback）定位。

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

- `node --test tools/test-course.js`：跨章 / 同章搜索回归仍在；搜索结果 href 含 `section=`
- 未跑 `build-static.js`

上一轮浏览器（本地 `http://127.0.0.1:8772/#/`）：

- 首页搜索 `RMSNorm` → `#/modern-llm?section=…`，定位 10.4
- Transformer 7.4 搜索 `RMSNorm` → 进入第 10 章并定位 10.4
- Transformer 内搜索 `7.14 Multi-Head`：hash 仍是 7.4 入口，正文定位 7.14，任务条 6/6、下一小节 7.12

上一轮 CI / Pages（[run 35554271988](https://github.com/xhr0417/llm-course/actions/runs/35554271988)，head `23dc6d1`）：

- Node validators：success
- Python unit tests：success
- Docker build：success
- Deploy dist to GitHub Pages：success
- 手动 integration：skipped（按设计）

### 未测项（不宣称通过）

- 写本包时本轮封板补丁的 CI / Pages 尚未出结果。以本包提交后的 GitHub Actions 为准，不要用 `35554271988` 代替 `?section=` 链接是否已上线。
- 自有服务器（未运行 `tools/publish.sh`）。
- 阶段 3b 复习队列。

---

## 请 ChatGPT 重点核对

1. 在 Transformer 搜索 `RMSNorm` 并点击「现代 LLM 架构 · 10.4 RMSNorm」后，是否进入第 10 章并落到 10.4，而不是仍停在 Transformer。
2. 从首页搜索进入某一章，是否同样切路由并定位目标小节。
3. 同章搜索 7.14 是否仍原地定位，且任务条仍为 6/6、下一小节 7.12。
4. `preventDefault` 是否仍在普通左键上；跨章不能只靠 `pendingSection`，必须改 `location.hash` / 路由，并在目标章加载后定位小节。
5. 搜索结果 `<a>` 的真实 `href` 是否带目标 `?section=`，以便 Cmd/Ctrl/中键新标签与普通左键语义一致。
6. 是否改动了记录规则、首页分层、八周任务，或夹带第 0 / 24 章遗留修改。
7. 是否把本轮说成第三步已经收尾。应记为：前两步已通过，任务条与留白已通过，跨章普通左键已通过，本轮只封板 INDEX 口径与搜索链接带小节，阶段 3 整体尚未完成。
8. 是否仍把 run `35554271988` 的 head SHA 写成 `74500e3`。正确是 `23dc6d1`，该构建包含 `74500e3` 的搜索修复。

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `js/app.js` | 修改 | 跨章搜索改 hash；`chapterHref` / `referenceHref` 可带 section |
| `js/search.js` | 修改 | 结果链接带 `?section=`；普通左键仍 preventDefault |
| `tools/test-course.js` | 修改 | 首页搜索、跨章搜索、href 含小节 |
| `tools/test-app-harness.js` | 修改 | 赋值 location.hash 触发 hashchange；现代架构章含 10.4 |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 第三步验收补上跨章搜索与链接带小节 |
