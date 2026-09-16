# README / 工作流审计：把 Guided Build 升级为「零迷路」工程实践指南

> 本轮范围：**不改课程理论、不改算法答案**，只升级 README / 网页操作教学 / CI / 环境说明，
> 让完全不了解「GitHub、本地电脑、服务器」关系的新手也能一步一步照着做。
> 纪律：所有验证真实执行；无法真机验证的逐项标注。

---

## 一、这轮改了哪些 README / 文档

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `README.md`（根） | 新增「第一次开始之前：GitHub、你的电脑、服务器到底是什么关系？」核心新手章节（三地模型图 + 三条铁律 + 场景 A/B + 推荐工作流 + 5 条定位诊断 + 文件去留表）；Quick Start 重写为带「【在哪执行】【当前目录】」标注的 3 分钟版本；Step 8 口径修正 | ✅ |
| `docs/ENVIRONMENT_AND_WORKFLOW.md` | **新增**：完整新手手册（18 节：三地模型 / 6 个必答问题 / clone 场景 / ssh 判定 / 工作流 / VS Code Remote SSH / 文件放置 / HF 缓存与 HF_HOME / 磁盘 / .gitignore 纪律 / 定位诊断 / Mac→GitHub→Server 全流程演练 / scp-rsync / 密钥 / 术语表 / 常见错误 / tmux-Slurm 提示 / 执行位置速查表） | ✅ |
| `projects/log-analyzer/starter/README.md` | 置顶新增「从零开始：我要在哪里开始、怎么开始」（三地址表 + 五条命令 + starter/reference 关系 + 改哪些文件 + 作品集模式）；Step 表增加 41 = 38+3 口径 | ✅ |
| `projects/hf-mini-lab/starter/README.md` | 同上，额外说明：tiny 测试任意机器 / 真实 Qwen 优先服务器 / 模型进 HF 缓存不进 repo / HF_HOME | ✅ |
| `projects/llm-eval/starter/README.md` | 同上，额外说明：mock 任意 / HF 优先服务器 / API key 环境变量与绝不提交 / 产出目录去留 | ✅ |
| `docs/README_WORKFLOW_AUDIT.md` | **新增**：本文档 | ✅ |

**没有动**：任何章节的理论内容、Hint 1 → Hint 2 → 折叠 Solution 的答案结构、参考实现代码、原有测试。

---

## 二、新增的环境说明（网页端）

新增轻量渲染组件 **`:::where`（📍 执行环境与目录）** 与 **`:::run <位置标签>`**：

- 渲染器双端同步：`js/app.js`（交互版）与 `tools/build-static.js`（静态版），并由 `validate-guided.js`
  以「渲染器一致性 + 真实渲染冒烟」双重校验（新增 7 项断言）；
- `:::run` 盒子的标题会显示为 `▶️ 运行 · 🖥 Mac / ☁ Server`（第一次在 Step 0 详细解释，后续只用标签，
  避免页面臃肿）；
- 三个 Guided Lab 开头均插入 `:::where` 块，逐项写清：
  **机器（推荐执行位置）/ 执行纪律 / Repo Root / Starter / Reference / 大文件与模型缓存 / GitHub 提交建议**；
- 第 25 / 26 / 27 章的 Step 0 全部升级为带目录检查的操作流：
  `hostname → pwd → cd "$(git rev-parse --show-toplevel)" → cd <starter> → pwd 校验 → pip install → pytest`；
- 第 26 章 Step 0 增加「模型文件下载到哪里（HF 缓存 / HF_HOME / df -h）」知识盒；
  第 27 章 Step 13 增加「真实数据 / HF 模型 / API 三种跑法分别在哪种机器」说明盒。

---

## 三、Mac / Server / GitHub 如何在文档里区分

统一采用同一个心智模型（根 README 与完整手册一致）：

```text
        🌐 GitHub（远程仓库 · source of truth）      ← 不执行命令、不跑模型
                 ↑ push / pull      ↓ clone / pull
        🖥 Mac（本地）                ☁ Linux Server
        ~/Projects/llm-course       ~/workspace/llm-course
```

- **提示符判定**：`yourname@MacBook ~ %` = 还在 Mac；`user@ubuntu:~$` = 已 ssh 到服务器；
- **`cd` 作用域**：只改变「当前登录机器」的当前目录；两台机器同名目录是两份文件；
- **同步方向**：git push / pull 只影响「执行命令的那台机器」；
- **定位五连**：`hostname / whoami / pwd / git status / python --version`（服务器加 `nvidia-smi`）；
- **repo root 通用技巧**：`git rev-parse --show-toplevel`（写进了手册与三个 Step 0）。

**哪些路径只是示例**（文档中已显式声明，不硬编码）：`~/Projects/llm-course`、`~/workspace/llm-course`、
`/data/...`、`~/datasets`、`~/models` 等全部标注为示例；唯一权威是 `pwd` 的实际输出；
`/data` 更是明确提醒「不要假定存在，先 `df -h` + 确认权限」。

---

## 四、大文件策略（代码进 Git，大文件留服务器）

| 文件类型 | 去处 | Git |
| --- | --- | --- |
| 源码 / tests / config / README / 小样例数据 / 小报告 | repo | ✅ |
| 数据集 / 模型缓存 / checkpoint / logs / wandb | 服务器（`~/datasets`、`HF_HOME`、`~/checkpoints`、`outputs/`） | ❌ |
| API key / `.env` / SSH 私钥 | 环境变量 / 本地文件 | ❌ 永不 |
| LoRA adapter（几 MB） | 视情况 | ⚠️ 可选 |

配套教学：HF 缓存与 `HF_HOME` 设置（含「先 mkdir 再 export、`df -h` 检查磁盘、模型下载不进 repo」）、
`df -h` / `du -sh` 磁盘检查、`.gitignore` 提交纪律（`git status → add 具体文件 → diff --staged`）。

---

## 五、.gitignore 修改（根目录）

从仅 `.DS_Store` 升级为带注释的分组规则（已验证**没有任何已跟踪文件**会因此被误伤）：

```text
macOS: .DS_Store
Python: __pycache__/ *.pyc .pytest_cache/ .venv/ venv/
密钥: .env .env.*（保留 !.env.example）
实验产物: outputs/ checkpoints/ datasets/ wandb/ .cache/
模型权重: *.safetensors *.ckpt *.pt *.pth *.bin（需要提交小 adapter 时用 git add -f）
```

教科书的 `samples/`、`mini_*.jsonl`、`tests/`、小型报告**不**在忽略范围内，仍然正常提交。

---

## 六、CI 修改

| Job | 改动 | 目的 |
| --- | --- | --- |
| `guided-starters` | matrix 增加 `hf-mini-lab`；仅为其安装 **CPU-only torch**（官方 cpu index，避免 CUDA 大轮子）；统一 `RUN_MODEL_TESTS=0` 运行；新增「hf 非模型测试必须恰好 `7 failed`」断言 | 普通 push 下验证 hf starter 的**结构与不依赖大模型的红灯状态**，不下载任何模型 |
| `guided-hf-full`（新增，仅 `workflow_dispatch`） | 安装依赖后以 `RUN_MODEL_TESTS=1` 跑 hf starter，断言仍为红 | 需要下载 tiny 模型（几 MB，**不是** 0.5B）的完整红灯验证留给手动触发 |
| `validators` | 已包含 `validate-guided.js`（本轮扩展 7 项 where/run 断言） | 渲染器与教学内容一致性门禁 |

成本说明：`hf-mini-lab` 的普通 push 任务只安装 CPU torch + transformers（与现有 `llm-eval`/`sft-lora`
的 python-unit 任务同量级），不下载 0.5B 模型；重模型测试沿用 workflow_dispatch。

---

## 七、manifest 修改（sidebar / SEO / 静态页同步）

| 章节 | 旧标题 | 新标题 |
| --- | --- | --- |
| 25 | Python Engineering for AI：写出能跑的项目 | **Python Engineering for AI：从 0 亲手构建第一个真实项目** |
| 26 | HuggingFace for LLM Engineering：用工业生态跑模型 | **HuggingFace for LLM Engineering：从 0 跑通一个真正的 LLM Workflow** |
| 27 | Capstone 1 · Mini LLM Evaluation Harness | **Capstone 1 · Build Your Own Mini LLM Evaluation Harness** |

description 同步更新为 Guided Build 口径（含 starter 步数与测试数）。
`build-static` 已重新生成：sidebar / 静态页 header / `llms.txt` / `sitemap.xml` / 首页静态目录全部与正文一致，
不再出现「正文说从 0、导航说旧描述」。

**Step 8 口径修正**（避免误导）：
- 第 25 章 Step 9、项目目标块、根 README 的 starter 表、starter README 的 Step 表全部写明：
  **41 = 课程提供的 38 个 + 你在 Step 8 自己写的 3 个**；只完成源码会停在 `38 passed, 3 failed`。

---

## 八、实际运行的验证

### 8.1 Node 门禁（全部通过）

```
build-static        32 页构建成功
validate-static     ✅ 32 个静态页无容器残留 / 无 fence 错位 / 正文完整
validate-content    ✅ 32 章 / 84 demos
validate-batch2     ✅ 45 项
validate-jobs       ✅ 213 项
validate-portfolio  ✅ 50 项
validate-guided     ✅ 138 项（含 where/run 新断言与渲染冒烟）
```

### 8.2 Python 测试（本轮实测）

```
projects/log-analyzer/starter          → 41 failed（初始红灯，符合设计）
projects/llm-eval/starter              → 77 failed, 2 passed（初始红灯）
projects/hf-mini-lab/starter           → RUN_MODEL_TESTS=0：7 failed, 31 skipped（= CI 断言值）
projects/log-analyzer（参考实现）       → 14 passed
projects/llm-eval（参考实现）           → 32 passed
projects/hf-mini-lab（参考实现）        → 11 passed
```

### 8.3 真实 Chrome UX 审计（CDP，35/35 通过）

审计方式：真实 Chrome 152 + DevTools Protocol，**禁用缓存**，桌面 1280×900 / 移动 390×844（DPR 3）双视口、
浅色 + 深色双主题；页面来自本地 HTTP 服务（与线上同为静态文件）。

| 检查项 | Desktop Light | Desktop Dark | Mobile 390 |
| --- | --- | --- | --- |
| Guided Lab 渲染（10/13/15 步） | ✅ | ✅（步数保留） | ✅ |
| 📍 where 执行环境块（行数 / 关键行 / 长路径不溢出） | ✅ | ✅ | ✅（行堆叠） |
| `运行 · 位置标签` | ✅ | — | — |
| Hint 默认折叠 / 可展开 | ✅ | — | — |
| Solution 默认折叠 / 可展开 / 打开不改完成状态 | ✅ | — | — |
| Step 状态切换 + 进度条 + localStorage 持久化 | ✅ | ✅（刷新保留） | — |
| 四态徽章（Learned/Implemented/Ran/Explained） | ✅ | — | — |
| 代码块 `pre` 内部横向滚动 | ✅ | — | ✅ |
| shell 命令块结构（`pre > code`） | ✅ | — | — |
| 表格不超出内容列 / 窄屏改为表格内滚动 | ✅ | — | ✅ |
| 页面无横向滚动 | ✅（overflow=0） | ✅ | ✅（overflow=0） |
| 首页三入口卡片 | ✅ | — | ✅ |
| 控制台运行时错误 | **0** | 0 | 0 |

**本轮审计抓出的真问题（已修复）**：
390px 窄屏下，带 `white-space: nowrap` 表头的宽表格会把布局视口撑到 406px（innerWidth > 390），
表格贴着屏幕边缘。修复：`@media (max-width: 640px) { .md table { display: block; overflow-x: auto; } }`
（宽表格改为表格内部横向滚动）。修复后 innerWidth=390、`overflow=0`、表格检查通过。

**诚实标注**：
- Mobile 行为通过 **Chrome DevTools 设备模拟（390×844, DPR 3）** 验证，**NOT MANUALLY VERIFIED on a physical phone**；
- 深色模式在桌面视口验证；移动端深色为同一套 CSS 变量，未单独截图复核（标注 NOT SEPARATELY VERIFIED）；
- 截图（不进仓库，存于验证脚本临时目录）：`25-desktop-light.png`、`25-desktop-dark.png`、
  `25-mobile-light.png`、`25-where-block.png`、`25-step0.png`、`home-mobile-light.png`。

### 8.4 新手路径实测（post-publish 补记）

发布后从 GitHub 全新 clone → 按根 README 的 Quick Start 执行：`clone → cd → pwd → http.server →
cd starter → pwd → pip install → pytest`，结果见 §十一 发布记录。

---

## 九、尚未人工验证 / 明确标注

| 项目 | 状态 |
| --- | --- |
| 手机真机（iOS/Android 实体设备） | **NOT MANUALLY VERIFIED**（仅 Chrome 设备模拟 390×844） |
| 移动端深色主题单独截图 | **NOT SEPARATELY VERIFIED**（同一 CSS 变量体系） |
| Linux 服务器上的首次 clone / 全流程演练 | 文档化并给出命令；本机为 macOS，服务器路径仅示例，未在真实远端服务器复跑 |
| `scp` / `rsync` 示例 | 未实际执行（命令为标准最小用法；未跨机验证） |
| `HF_HOME=/data/...` 示例 | 未验证（文档已声明「不要假定 /data 存在，先 df -h」） |
| Windows / WSL | 未覆盖（目标读者为 macOS + Linux 服务器） |

---

## 十、设计原则（供后续章节沿用）

1. 每条操作命令必须能回答 6 个问题：哪台机器 / 哪个目录 / 在哪执行 / 生成什么 / 存在哪里 / 要不要提交；
2. 第一次出现详细解释，之后只用位置标签（🖥 / ☁ / 🎮），避免页面臃肿；
3. 路径一律示例 + `pwd` 校验，不硬编码 `/home/xxx`、`/Users/xxx`；
4. 代码进 Git、大文件留服务器、密钥只进环境变量——三个原则贯穿所有 README；
5. Guided Build 的 scaffolding 不因「写详细 README」而增加：Hint 1 → Hint 2 → 折叠 Solution 的结构保持不变，
   本轮只增加环境与操作信息，**没有**透露任何算法/实现答案。

---

## 十一、发布记录与发布后验证（实测）

- 发布方式：`bash tools/publish.sh "<commit message>"`（门禁 → rsync 自有服务器 → GitHub push；
  publish.sh 已同步纳入 `validate-guided.js` 门禁）；
- 发布 commit：`aedbf2f`（24 files changed, 1734 insertions, 145 deletions）。

**发布后实测（真实执行）**：

```text
① 从 GitHub 全新 clone：
   git clone https://github.com/xhr0417/llm-course.git  → 成功
② clone 内包含：README.md / docs/ENVIRONMENT_AND_WORKFLOW.md / starter 全部文件 → OK
③ 按 README Quick Start 进入 starter 并运行：
   cd projects/log-analyzer/starter && pytest -q  →  41 failed in 0.17s（= 设计起点）✅
④ 线上静态页：https://llm.xhr0417.cn/chapters/python-engineering.html → 含 box-where ✅
⑤ 线上手册：https://llm.xhr0417.cn/docs/ENVIRONMENT_AND_WORKFLOW.md → HTTP 200 ✅
⑥ CI（run 35081488111）全部 job 绿，含新增的：
   - Guided starter must fail (hf-mini-lab) 58s —— 普通 push 验证结构 + 非模型红灯，0 模型下载
   - Guided starter must fail (log-analyzer / llm-eval)
   - Node validators（含 validate-guided 138 项）
   - Python unit tests ×5 / Docker build
   仅 workflow_dispatch 专属 job（Integration、guided-hf-full）按设计跳过
```

> 新用户路径结论：一个完全不知道项目在哪的人，按根 README 可以独立完成
> GitHub → clone → cd → pwd → 打开网站 → 进入 starter → pytest（看到设计好的 41 failed），
> 并理解 Mac repo ≠ Server repo ≠ GitHub repo。
