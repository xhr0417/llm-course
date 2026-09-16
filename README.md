# LLM Course

**从 Transformer 原理，到训练、推理系统，再到真实 AI 工程项目。**

🌐 在线课程：**https://llm.xhr0417.cn/**（镜像：https://xhr0417.github.io/llm-course/）
📚 **32 Chapters** — Knowledge Track（0-23）+ Job-Ready Track（24-31）
🧭 **3 Guided Build Starters** — 不完整的 starter + 分步测试，让你亲手把项目做出来
🧪 **6 Runnable Projects** — 每个都含 README / requirements / src / tests，CPU 可复现
🎯 **3 Tracks** — AI Application · LLM Algorithm · AI Infra

> 一套中文交互式课程（每章配交互演示 + 测验 + 面试题），加一组**真实可运行**的求职项目。
> 所有实验数字来自真实运行；没有 GPU 的部分明确标注 `NOT EXECUTED`——纪律本身就是课程内容。

---

## 第一次开始之前：GitHub、你的电脑、服务器到底是什么关系？

> 这一节解决几乎所有新手都会卡住的问题：**命令到底在哪台机器、哪个目录执行？文件存在哪里？要不要提交到 GitHub？**
> 完整版（clone 细节、VS Code Remote SSH、HF 缓存与磁盘、scp/rsync、常见报错、术语表、完整演练）见
> 👉 **[docs/ENVIRONMENT_AND_WORKFLOW.md](docs/ENVIRONMENT_AND_WORKFLOW.md)**

整个课程只需要三个「地方」：

```text
                 🌐 GitHub（远程仓库 · source of truth）
                 https://github.com/xhr0417/llm-course
                          ↑                      ↓
                   push / pull               clone / pull
                        /                        \
                       /                          \
        🖥 你的 Mac（本地）                    ☁ Linux 服务器
        ~/Projects/llm-course                 ~/workspace/llm-course
        看课程 / 写代码 / Git 管理              跑模型 / 训练 / 放数据
        （纯 Python 项目也能跑）               （GPU、大文件主要在这里）
```

三条铁律（读完再动手）：

1. **GitHub 上的 `xhr0417/llm-course` 不是文件夹**——它是远程仓库。任何机器都必须先 `git clone`，本地才真正有一份工作目录。
2. **同一个仓库可以同时存在多份副本**：Mac 一份、服务器一份。它们是两块硬盘上的两份文件，**不会自动同步**——通过 GitHub（`push` / `pull`）同步。
3. **`cd` 永远只作用于你当前登录的那台机器的当前目录**。在 Mac 终端 `cd llm-course` 进的是 Mac 的目录；`ssh` 进服务器后再 `cd llm-course`，进的是服务器的目录（名字可以相同，但是另一份文件）。

### 🖥 场景 A：先在 Mac 上看网站（有 Python 就行，无需任何依赖）

```bash
# 【在哪执行】Mac 的 Terminal（提示符类似 yourname@MacBook ~ %）
# 【当前目录】任意；第一行先切到一个固定位置
cd ~/Projects              # 若没有这个目录，先 mkdir -p ~/Projects
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
pwd                        # 应显示 /Users/你的用户名/Projects/llm-course
python3 -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000 —— 这个 HTTP server 运行在你的 Mac 上
```

路径只是示例。唯一重要的是 `pwd` 的输出——它告诉你「你现在在哪里」。

### ☁ 场景 B：在 Linux 服务器上跑实验

先确认你确实**已经在服务器上**：运行过 `ssh user@your-server` 之后，提示符会从 `yourname@MacBook ~ %`
变成类似 `user@ubuntu:~$`。从这一刻起，下面的 `cd / ls / python / git` 默认都发生在服务器上。

```bash
# 【在哪执行】Linux 服务器（先 ssh 登录）
# 【当前目录】登录后一般在 ~（家目录）
pwd                        # 例如 /home/user —— 先确认自己在服务器
mkdir -p ~/workspace && cd ~/workspace
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
pwd                        # 例如 /home/user/workspace/llm-course
```

Mac 的 `llm-course` 和服务器的 `llm-course` **不是同一个物理文件夹**；改一边不会自动同步到另一边，通常以 GitHub 为中间站。

### 推荐工作流：Mac 写代码 + GitHub 同步 + Server 跑实验

```bash
# ① 在 Mac 上完成 / 修改代码（例如完成 Guided Build 的 Step 1）
# 【在哪执行】Mac【当前目录】~/Projects/llm-course
cd ~/Projects/llm-course
git status                 # 先看自己改了什么（永远不要不看就 add .）
git add projects/log-analyzer/starter/src/log_analyzer/parser.py    # 只加你要提交的文件
git diff --staged          # 再看一遍即将提交的内容
git commit -m "complete guided step 1"
git push                   # 把 Mac 的提交推到 GitHub

# ② 去服务器同步（新开一个终端或先 exit 回到 Mac 再登录）
ssh user@your-server
# 【在哪执行】Linux 服务器【当前目录】~/workspace/llm-course
cd ~/workspace/llm-course
git pull                   # ⚠️ 更新的是「服务器上的这一份」，不是把文件下载回 Mac
```

`git pull` 的含义永远取决于**你在哪台机器执行**：在 Mac 执行 = 更新 Mac；在服务器执行 = 更新服务器。

### 不知道自己现在在哪？先运行这 5 条

```bash
hostname          # 我在哪台机器
whoami            # 当前用户
pwd               # 我在哪个目录（最重要的一条）
git status        # 当前目录是不是 Git 仓库、有没有未提交修改
python --version  # 当前用的是哪个 Python
```

如果在服务器，还可以运行 `nvidia-smi` 看 GPU 是否可访问。
提示：`nvidia-smi` 失败不一定等于「没有 GPU」，也可能是驱动 / PATH / 容器权限问题。

### 文件应该放在哪里？（GitHub 不是网盘）

| 文件类型 | 放哪里 | 提交到 Git？ |
| --- | --- | --- |
| Python 源码 / tests / config / README | repo（Mac 与 Server 各一份 clone） | ✅ 提交 |
| 小样例数据 / 小型实验报告 | repo | ✅ 提交 |
| 大型数据集 | **服务器**（如 `~/datasets/`、`/data/...`） | ❌ 不提交 |
| HuggingFace 模型缓存 | 服务器/本机缓存目录（`HF_HOME`） | ❌ 不提交 |
| checkpoint / 大 adapter / logs / outputs | 服务器（或本地 `outputs/`，已 gitignore） | ❌ 不提交 |
| API key / `.env` / SSH 私钥 | 环境变量 / 本地文件 | ❌ **永远不提交** |

一句话：**代码进 Git；大文件留在服务器；两者用命令行参数 / 配置文件 / 环境变量连接起来。**

---

## 这个仓库是什么

| | Knowledge Track（懂） | Job-Ready Track（能做） |
| --- | --- | --- |
| 章节 | 0-23：深度学习 → Transformer → 训练/数据/GPU/分布式 → 推理系统 → SFT/GRPO → 评测 | 24-31：Python 工程 → HuggingFace → Eval Harness → RAG → RAG Service → SFT/LoRA → Profiling |
| 产出 | 能推导、能解释、能做失败分析 | 6 个可运行项目 + 实验报告 + 面试复盘清单 |
| 阅读方式 | https://llm.xhr0417.cn/ 从第 0 章开始 | 直接进 `projects/`（见下方 Quick Start） |

## Guided Build：亲手做出来，而不是看懂

每个 Guided Build 项目有三层：

| 层级 | 内容 | 位置 |
| --- | --- | --- |
| **Learn** | 章节正文 + 参考手册（原理与工程细节） | 第 25 / 26 / 27 章 |
| **Guided Build** | 不完整的 starter：核心函数是 TODO，分步测试初始为红，按章节 Step 逐组变绿 | `<project>/starter/` |
| **Reference Solution** | 完整可运行工程（做完之后再对照） | `projects/<project>/` |

| Starter | 章节 | 初始状态 | 完成状态 |
| --- | --- | --- | --- |
| [log-analyzer/starter](projects/log-analyzer/starter/) | 第 25 章 Python 工程 | 41 failed | 41 passed（10 步）※ |
| [hf-mini-lab/starter](projects/hf-mini-lab/starter/) | 第 26 章 HuggingFace | 38 failed | 38 passed（13 步） |
| [llm-eval/starter](projects/llm-eval/starter/) | 第 27 章 Capstone 1 · Eval Harness | 77 failed / 2 passed | 79 passed（15 步） |

※ log-analyzer 的 41 = 课程提供的 38 个 + **你在 Step 8 自己写的 3 个 edge-case 测试**；
只完成源码、不写 Step 8 的 3 个测试，会停在 `38 passed, 3 failed`——这是设计的一部分。

课程页面的 Guided Build 进度面板记录每个 Step 的状态与 Learned / Implemented / Ran / Explained 四态自检
（存本地浏览器，不上传；打开 Solution 不会自动算完成）。CI 有一个专门的 job 验证「starter 初始必须是红的」——
如果哪天 starter 全绿了，说明教学设计失效。

## 三条岗位路线

### Track A · AI 应用 / 大模型应用开发
```
Python Engineering(25) → PyTorch(11) → Transformer(07) → HuggingFace(26)
→ LLM Evaluation(23) → Eval Harness(27) → RAG 工程(28) → RAG Service(29) → 开始投递
```
对应岗位：大模型应用开发 / AI 应用研发 / 大模型评测 / AI 平台研发 / LLM Engineer Intern

### Track B · 大模型算法
```
Transformer(07) → Build Small LLM(12-13) → Data Pipeline(18) → Pretraining(21)
→ HuggingFace(26) → SFT/LoRA(30) → DPO/GRPO(22) → Evaluation(23) → Experiment Design
```
对应岗位：大模型算法 / 机器学习算法 / 模型训练与后训练实习

### Track C · AI Infra / ML Systems
```
PyTorch(11) → GPU(15) → FlashAttention/Triton(19) → Distributed(16)
→ Inference Systems(20) → Profiling Lab(31) → vLLM Benchmark（需 CUDA）
```
对应岗位：AI Infra / ML Systems / 大模型推理框架 / 性能工程实习

## Featured Projects（4 个核心）

| 项目 | 证明什么 | 真实运行记录 |
| --- | --- | --- |
| **[llm-eval](projects/llm-eval/)** · Eval Harness | adapters × tasks × parsers × metrics；asyncio 并发 + 重试 + SQLite 缓存；bad case 分类与自动报告 | 真实 C3/XCOPA 切片 128 题 32.3s；二次运行缓存命中 0.0s |
| **[rag-service](projects/rag-service/)** · RAG Service | BM25（从零实现）+ 向量 + RRF 混合 + cross-encoder 精排；FastAPI/SSE；**retrieval 与 generation 分开评测** | 22 条标注查询：hybrid+rerank MRR **0.9318**；检索 6/6 命中 |
| **[sft-lora](projects/sft-lora/)** · SFT/LoRA | response-only loss、best/final checkpoint、Base–Best–Final 三路公平评测、自动实验报告 | train loss 3.89→1.46；best@60 val 2.73；QA F1 20.2%→**24.4%** |
| **[inference-benchmark](projects/inference-benchmark/)** · Profiling Lab | torch.profiler 算子表、device-aware 计时、naive vs SDPA、torch.compile 反例、serving TTFT/TPOT 压测 | SDPA 快 2.7×；compile 反例 0.76×；vLLM 部分 `NOT EXECUTED ON CUDA` |

其余两个项目见 **[projects/README.md](projects/README.md)**（log-analyzer · hf-mini-lab）。

## Quick Start（3 分钟：clone → 打开网站 → 跑第一条 pytest）

> 每一步都标了「在哪台机器 / 当前目录」。对「在哪台机器」没有概念的话，先读上一节。

```bash
# ① 在 Mac 或 Linux Server 上（任选一台；第 25/27 章的测试都不需要 GPU）
# 【当前目录】你要把 repo clone 到这里
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
pwd                        # 记下它：这是 repo root，后面所有相对路径从它出发

# ② 打开课程网站（再开一个终端窗口执行；浏览器访问 http://127.0.0.1:8000）
python3 -m http.server 8000

# ③ 跑第一个 Guided Build 的第一条测试
# 【当前目录】仍然是 repo root；以下命令在「你 clone 的那台机器」上执行
cd projects/log-analyzer/starter
pwd                        # 应以 .../llm-course/projects/log-analyzer/starter 结尾；不是的话先别继续
pip install -r requirements.txt
pytest -q                  # 看到 41 failed —— 这是设计好的起点
```

然后打开浏览器里的第 25 章，按 Step 0-9 把测试一组一组变绿。

参考实现与其它项目（可选）：

```bash
# 【当前目录】repo root
cd projects/llm-eval
pip install -r requirements.txt
python run_eval.py --adapter mock --tasks c3 --limit 12   # 评测 harness 冒烟（不需要模型）
pytest -q

# SFT 实验（CPU 约 8 分钟，含 Base/Best/Final 三路评测）
cd ../sft-lora && pip install -r requirements.txt
python scripts/run_experiment.py --steps 150 --run-harness
```

每一步的项目 README 都写明了「在哪台机器 / 进哪个目录 / 哪些文件要改 / 哪些不要提交」——
不确定时先看对应 `projects/<name>/starter/README.md` 的「从零开始」一节。

## 可复现性与诚实纪律

- **所有实验数字来自真实运行**（CPU 环境快照见 [docs/environment.txt](docs/environment.txt)）；
- **CUDA / vLLM / Triton 实验未执行**：无 GPU 环境，代码与 runbook 齐全，逐处标注 `NOT EXECUTED ON CUDA`；
- **Docker**：本机无 Docker；`rag-service` 的镜像构建由 CI 的 `docker-build` job 验证（见 [.github/workflows/ci.yml](.github/workflows/ci.yml)）；
- **HTTP 路径使用 mock 服务端验证协议**（OpenAI-compatible / SSE），不伪造真实 API 结果；
- 评测指标按标准定义实现（Hit@k ≠ Recall@k、doc 级去重、nDCG 计入全部相关文档）。

## 仓库结构

```
├── content/            # 32 章源文件（markdown）
├── chapters/           # 构建产物：静态阅读页
├── js/                 # 交互演示与站点逻辑（含 Guided Lab 组件与进度）
├── projects/           # 6 个真实工程项目（见 projects/README.md）
│   ├── log-analyzer/       # Python 工程 CLI（14 test functions）+ starter（41 测试）
│   ├── hf-mini-lab/        # HuggingFace + LoRA 全流程（11 test functions）+ starter（38 测试）
│   ├── llm-eval/           # Evaluation Harness（21 test functions / 32 cases）+ starter（79 测试）
│   ├── rag-service/        # RAG Service（39 test functions）
│   ├── sft-lora/           # SFT/LoRA 实验（15 test functions）
│   └── inference-benchmark # Profiling Lab（15 test functions）
├── tools/              # 构建与校验（发布门禁见下）
├── docs/               # 审计文档与实验环境快照
└── .github/workflows/  # CI：校验 + 单测 + starter 红灯断言 + docker build
```

## 发布门禁（每次发布必须全绿）

```
build-static → validate-static → validate-content → validate-batch2
→ validate-jobs → validate-portfolio → validate-guided → 发布（服务器 + GitHub）
```

`validate-guided` 校验 Guided Build 的完整链路：渲染器一致性（app.js ↔ build-static.js）、
三个 Lab 的 step 结构与教学设计（每步有目标/你来写/运行/验收/解释、Solution 默认折叠）、
starter 结构与 README 的初始红灯声明、Reference Solution 未被削弱。

CI（`.github/workflows/ci.yml`）在每次 push 自动运行 Node 校验器、轻量 Python 单测与 RAG 镜像构建；
重模型集成测试（0.5B 下载）通过 `workflow_dispatch` 手动触发。

## 数据来源

- 课程内评测数据切片：XCOPA（cambridgeltl/xcopa，zh）· C3（dataset-org/c3，dialog）——仅保留小切片用于教学；
- 模型：Qwen2.5-0.5B-Instruct（生成/微调实验）· bge-small-zh-v1.5（向量）· mmarco-mMiniLMv2 cross-encoder（精排）· tiny 模型（单元测试）。
