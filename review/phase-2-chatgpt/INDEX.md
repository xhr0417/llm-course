# Phase 2 改动索引（给 ChatGPT 审核）

把这个文件夹发给 ChatGPT 即可。不必打开整个仓库。**保留** [`../phase-1-chatgpt/INDEX.md`](../phase-1-chatgpt/INDEX.md)，不要用本包替换第一阶段审核包。

- 仓库：https://github.com/xhr0417/llm-course
- 分支：`main`
- Phase 2 实现提交：[`c7491855ecaf179723a29eae15d93893e453c642`](https://github.com/xhr0417/llm-course/commit/c7491855ecaf179723a29eae15d93893e453c642) — `feat: 切断六个旧作业的教材入口与 starter 红灯`
- 基线提交：[`fe29a48`](https://github.com/xhr0417/llm-course/commit/fe29a48) — `fix: 默认进度模块写入 localStorage，数值改用组合容差`
- CI run：[`35251825488`](https://github.com/xhr0417/llm-course/actions/runs/35251825488)（对应 `main` 的 push）
- CI：成功（conclusion = `success`）
- GitHub Pages：由该 push 自动部署成功
- 自有服务器：本轮未运行 `tools/publish.sh`，不要宣称 `llm.xhr0417.cn` 已更新
- 审核入口：本文件
- 范围：切断六个旧作业的操作指南和入口。网站继续围绕「小模型学习实验室 → 技术声明核验助手 / 单 Agent → 算法或 Infra 专项」。阅读教材时不应再被要求完成六个旧项目。

**发布区分（禁止写成笼统的「本轮没有发布」）：**

### GitHub Pages

`main` push → GitHub Actions → build dist → `actions/deploy-pages` → 自动部署。

该 push 的 job「Deploy dist to GitHub Pages」已成功。

### 自有服务器（`llm.xhr0417.cn`）

与 GitHub Pages 是两套发布路径。只有显式运行：

```bash
tools/publish.sh
```

才更新。本轮未运行 `tools/publish.sh`，因此不要宣称自有服务器已更新。

审核时请对照 `files/docs/PERSONAL_LEARNING_OS.md` 第 7 节，以及 `files/docs/IMPLEMENTATION_PLAN.md` 阶段 2。

`files/` 是**本轮关键源文件的完整稿**。生成页 `chapters/*.html` 未整包复制，请用 `phase-2.diff` 与构建说明。本文件相对收录时过期发布口径的收尾见 `phase-2-fix.diff`。

## 怎么看

1. 先读本文件「本轮改了什么」和「剩余旧引用」。
2. 教材入口：`files/content/00-map.md`、`24-job-ready.md`、`25-python-engineering.md`、`26-huggingface.md`、`27-capstone-eval.md`。
3. 第 28–31 章与两份参考手册：同目录其余 Markdown。
4. 门禁：`files/tools/validate-guided.js`、`validate-jobs.js`、`validate-portfolio.js`、`files/.github/workflows/ci.yml`。
5. 相对基线 `fe29a48` 的全部差异：`phase-2.diff`（对应已推送的 `c749185`）。
6. 本审核包口径收尾：`phase-2-fix.diff`（相对 `c749185` 收录时的 INDEX，只改提交 / CI / Pages 事实）。
7. GitHub 上同一实现：`https://github.com/xhr0417/llm-course/blob/c749185/<path>`

---

## 本轮改了什么

不进入阶段 3，不删 `projects/` 六个目录，不新增前八周任务 / 证据 / 卡点。

### 1. 教材中的旧作业流程

- 第 25 / 26 / 27 章删除 `:::lab` Guided Build（`cd projects/*/starter`、41/38/79 测从红变绿）。改为原理阅读 + 历史实测数字 + **可选参考（非当前作业）**。
- 第 0、24 章不再把 Job-Ready 六项目写成平行必修主线；岗位路线是查阅分组。
- 第 28–31 章去掉「配套项目 = 当前 Capstone / Checkpoint」入口，保留检索、服务化、SFT、推理分析原理和真实数字。
- 两份参考手册去掉「starter 全绿后再对照」。
- **保留的理论：** Python 分层 / pathlib / JSONL / dataclass / argparse / logging / pytest / 退出码；HuggingFace Tokenizer、Chat Template、left padding、response-only mask、LoRA save/load、PEFT 就地注入；评测 Adapter×Task×Runner、parser、缓存、bad case；RAG chunk/BM25/精排/指标；SFT 过拟合与三路对比；profiler / SDPA / `NOT EXECUTED ON CUDA`。
- **没有**把六个旧作业改名后重新挂上主线。

### 2. 入口和链接

- `tracks.json`：三条路线改为查阅文案；`projects` 数组标 `archived`。
- `content/projects.json` 由 `build-static.js` 写出 `status: "archived"`（该文件是构建产物，不要手改）。
- `manifest.json`：第 24–31 章分组改为「工程查阅」，去掉 `lab`/`project` 作业旗标。
- 根 `README.md`、`projects/README.md`、六个目录 README 与三个 `starter/README.md` 顶部标明已退出主线。
- `#/projects` 仍是说明页；文案改为「历史仓库链接是可选参考」。
- 路线卡片「产出」改为「查阅范围」（`js/renderer.js`）。

### 3. 验证和 CI（删除/调整原因）

| 检查 | 处理 | 为什么不再适用 / 为什么保留 |
| --- | --- | --- |
| 第 25/26/27 必须 10/13/15 步且引用 starter | **删除** | 步骤数把旧作业绑成必修 |
| starter 目录结构 / 初始红灯 README | **删除** | 不再要求学生完成 starter |
| 第 24/25 必须 Learn / Guided Build / Reference | **删除** | 旧作业三入口 |
| CI `guided-starters` | **删除** | starter 初始失败不再是教学设计 |
| CI `guided-hf-full` | **删除** | 含模型 starter 红灯同上 |
| 25–31 必须 `lab+project`、每章绑定作业目录 | **删除** | 把六项目写回主线 |
| README 必须写 `N Runnable Projects` | **删除** | 把六项目当产品卖点 |
| 第 0 章必须写 Job-Ready Track 24–31 双主线 | **删除** | 与当前动手主线冲突 |
| 渲染器 lab/step 冒烟与 renderer 共用 | **保留** | 原语仍可能给日后主线步骤用 |
| 教材若写 `projects/<slug>` 则目录必须存在 | **保留** | 防死链 |
| 残留项目 README 测试函数数 vs `def test_` | **保留** | 磁盘上代码的诚实性，直到阶段 5 |
| 数据纪律 / NOT EXECUTED | **保留** | 仍禁止伪造规模 |
| `python-unit` / `docker-build` / dispatch `integration` | **保留** | 核对残留参考代码，不是作业红灯 |
| 主线 Markdown 不得 `cd …/starter`、不得再放旧 `:::lab` | **新增** | 防止作业流程回流 |

没有为了过测试而恢复旧作业，也没有整套删除验证脚本。

---

## 验证结果

Push CI 成功。Node validators、残留 Python unit tests、RAG Docker build、GitHub Pages deploy 均成功；手动 model integration job 在普通 push 中按设计跳过，未宣称已执行。

### GitHub Actions（`c749185` 的 `main` push）

https://github.com/xhr0417/llm-course/actions/runs/35251825488 — conclusion：`success`。不得写成「所有 job 全部通过」。

| Job | 结论 |
| --- | --- |
| Node validators (gates) | success |
| Python unit tests (log-analyzer) | success |
| Python unit tests (llm-eval) | success |
| Python unit tests (rag-service) | success |
| Python unit tests (sft-lora) | success |
| Python unit tests (inference-benchmark) | success |
| Docker build (rag-service leftover) | success |
| Deploy dist to GitHub Pages | success |
| Integration tests (manual; downloads models) | **skipped**（`workflow_dispatch` 手动模型集成；普通 push 不运行） |

### 本地已跑（通过）

- `node tools/build-static.js`（32 章、`index.html` 静态目录、`llms.txt` 等由构建更新，未手改）
- `node --test tools/test-course.js`：18 通过（含本轮「25–27 不再布置六个旧 Lab」）
- `validate-static.js` / `validate-content.js` / `validate-batch2.js` / `validate-jobs.js` / `validate-portfolio.js` / `validate-guided.js`

浏览器（本地 `http://localhost:8766/?v=phase2`，Cursor 内置浏览器，375 宽）：

- 首页仍是小模型学习实验室—Attention；无六项目卡。
- 目录分组为「工程查阅」；Transformer **已读**仍在（旧 `llm-course-progress`）。
- 第 25 章无 Guided Lab；写明非当前作业。
- 第 0 / 24 章、`#/projects`、`#/track/application` 均为查阅，不布置六个作业。
- 第 25 章点「标记已读」后刷新，按钮仍是「已读完 · 点击取消」；`localStorage` 为 `{"transformer":{"read":true},"python-engineering":{"read":true}}`。未点「重置学习进度」。
- 搜索 RoPE 得到 12 条结果；主题可切换浅色。
- 计划加载失败降级：本轮未再复现（阶段 1 测试仍绿）。

静态章 `chapters/*.html` 与交互源一致（同源 `js/renderer.js` + 本轮重建）。

### 未测项（不宣称通过）

- 系统 Chrome / 768 / 1280 布局；本轮浏览器为内置 375 宽。
- 搜索结果跳进第 10 章后，URL 为 `#/modern-llm`，**未确认**是否滚到 10.3 小节（章打开了，小节定位本轮未测死）。
- 交互演示逐个点击（chunking / retrieval-metrics 文案已改为历史实测，未再拖滑块）。
- 自有服务器 `llm.xhr0417.cn`：本轮未运行 `tools/publish.sh`，不要宣称已更新。
- `projects/` 内 Python **本机**是否仍全绿（CI 上 python-unit 已 success，不替代「本机又跑过一遍」的声明）。

---

## 剩余旧引用：有效参考 / 历史记录 / 遗漏

六项目名与路径仍会出现，**不是**靠关键词清空。

| 位置 | 分类 | 理由 |
| --- | --- | --- |
| 第 24–31 章、两份手册中的 GitHub `projects/<name>` 链接 | **有效参考** | 标明可选 / 非当前作业；本地目录仍在；远程 `main` 自 `c749185` 起已带退出主线横幅 |
| 历史 loss / C3 55% / MRR 0.932 / SDPA 2.7× 等数字 | **历史记录** | 当时实测，不是当前必做实验 |
| `cd projects/log-analyzer` 等（无 `starter`）写在「仅在你明确要对照时」 | **有效参考** | 可选复现，不是必修 |
| `tracks.json` 的 `projects` 数组、`projects.json` 清单 | **历史记录** | `archived`；阶段 5 才删目录 |
| `js/demos-jobs.js`「历史检索实验」 | **历史记录** | 演示里的实测对照 |
| `learning-plan.json`「不要写进六个旧作业目录」 | **有效参考** | 防止走错目录 |
| `projects/*/README.md` 与 `starter/README.md` 正文仍描述如何跑旧测试 | **历史记录** | 顶部已加退出主线横幅；未整页改写以免冒充新作业 |
| `docs/JOB_*`、`GUIDED_TRACK_AUDIT` 等内部文档 | **历史记录** | 本轮不改内部审计文档 |
| 渲染器默认标题「Guided Build」 | **有效参考** | 无 `:::lab` 时不出现在教材页 |

**未发现**主线 Markdown 仍命令 `cd projects/*/starter` 或「完成 Checkpoint A–E」。若审核发现此类句子，视为遗漏。

---

## 本轮未做

- 没有进入阶段 3。
- 没有删除或移动 `projects/` 六个目录。
- 没有证据表单、卡点、复习队列、自动评分。
- 没有代写 Attention 核心算法。
- 本轮未运行 `tools/publish.sh`。

---

## 文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `content/00-map.md` | 修改 | 当前动手主线 + 查阅分组 |
| `content/24-job-ready.md` | 修改 | 岗位查阅，不是 Checkpoint 作业单 |
| `content/25-python-engineering.md` | 修改 | 去掉 Guided Lab，保留工程原理 |
| `content/26-huggingface.md` | 修改 | 去掉 Guided Lab，保留工作流与实测 |
| `content/27-capstone-eval.md` | 修改 | 去掉 Guided Lab，保留 harness 分层 |
| `content/28-31-*.md` | 修改 | 去掉必修配套项目入口 |
| `content/references/25*.md`、`26*.md` | 修改 | 手册不再要求 starter 全绿 |
| `content/tracks.json` / `manifest.json` | 修改 | 查阅分组；去掉作业旗标 |
| `content/projects.json` | 构建更新 | `status: archived` |
| `README.md` / `projects/README.md` | 修改 | 非当前作业 |
| `projects/*/README.md`、`starter/README.md` | 修改 | 顶部退出主线横幅 |
| `js/pages.js` / `js/renderer.js` / `js/demos-jobs.js` | 修改 | 说明页与查阅文案 |
| `tools/validate-guided.js` 等 / `ci.yml` | 修改 | 去掉 starter 红灯与作业计数 |
| `tools/build-static.js` | 修改 | 写出 archived 清单 |
| `tools/test-course.js` | 修改 | 本轮教材不再布置旧 Lab |
| `docs/IMPLEMENTATION_PLAN.md` | 修改 | 阶段 2 标为已完成 |
| `docs/PERSONAL_LEARNING_OS.md` | 修改 | 第 7 节反映 Guided 已切断 |
| `chapters/*.html`、`index.html`、`llms.txt` | 构建更新 | 勿手改 |
| `review/phase-2-chatgpt/phase-2-fix.diff` | 本包收尾 | INDEX 改为已 push 的实现提交 + CI run + Pages 成功，并分开自有服务器 |

## 请 ChatGPT 重点核对

1. 从首页、知识地图、职业查阅路线、第 25–31 章进入，是否仍被引导把六个旧项目当必修。
2. 第 25–27 章是否还残留 `:::lab` / `cd …/starter` / 「完成的定义：测试全绿」。
3. 剩余 `projects/<六目录>` 链接是否都标明可选参考或历史记录，有无死链（本地目录应存在）。
4. 门禁是否仍要求 starter 红灯、10/13/15 步、`N Runnable Projects`、`lab+project`。
5. 是否为了过测试把旧作业接回主线，或整段删掉验证脚本。
6. 是否开始做阶段 3，或删除了 `projects/` 目录。
7. 是否清空 `localStorage` 或把已读写成已掌握。
8. 是否把 GitHub Pages 自动部署与 `tools/publish.sh` 自有服务器发布混成一句「没有发布」。
9. 是否把 `integration` 的 skipped 写成 passed，或把「所有 job 全部通过」当成 CI 结论。

## 本包未收录（有意）

- 完整 `chapters/*.html`（过大；已构建，差异在 `phase-2.diff`）。
- `projects/` 下的 Python 源码与测试（未删、几乎未改，只改了 README 横幅）。
- 第一阶段审核包（仍在 `review/phase-1-chatgpt/`）。
