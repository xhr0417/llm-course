# 环境与工作流：从零到跑通实验（新手完整手册）

> 这份文档解决一个具体问题：**命令写出来了，但初学者不知道它该在哪台机器、哪个目录执行，文件最后去了哪里。**
> 如果你只想知道「怎么最快跑起来」，看根 [README](../README.md#第一次开始之前github你的电脑服务器到底是什么关系) 的 Quick Start 就够了；
> 如果你想真正搞清楚 GitHub / Mac / 服务器 的关系，把这份文档从头读一遍（约 20 分钟）。

---

## 目录

1. [三个「地方」的心智模型](#1-三个地方的心智模型)
2. [执行任何命令前，先问自己 6 个问题](#2-执行任何命令前先问自己-6-个问题)
3. [clone 是什么意思：Mac 场景](#3-clone-是什么意思mac-场景)
4. [服务器场景：ssh 之后你在哪](#4-服务器场景ssh-之后你在哪)
5. [推荐工作流：Mac 写代码 + GitHub 同步 + Server 跑实验](#5-推荐工作流mac-写代码--github-同步--server-跑实验)
6. [另一种模式：直接在服务器上开发](#6-另一种模式直接在服务器上开发)
7. [代码、数据集、模型、checkpoint 应该放在哪里](#7-代码数据集模型checkpoint-应该放在哪里)
8. [HuggingFace 的文件下载到哪里去了](#8-huggingface-的文件下载到哪里去了)
9. [磁盘空间：下载模型之前先看一眼](#9-磁盘空间下载模型之前先看一眼)
10. [.gitignore 与 git 提交纪律](#10-gitignore-与-git-提交纪律)
11. [「我现在到底在哪」诊断框](#11-我现在到底在哪诊断框)
12. [完整演练：Mac → GitHub → Server → 报告回到 repo](#12-完整演练mac--github--server--报告回到-repo)
13. [scp / rsync：把服务器上的小文件拿回 Mac](#13-scp--rsync把服务器上的小文件拿回-mac)
14. [秘密信息：永远不要提交这些东西](#14-秘密信息永远不要提交这些东西)
15. [术语表](#15-术语表)
16. [常见错误速查](#16-常见错误速查)
17. [长时间任务（先知道名字即可）](#17-长时间任务先知道名字即可)
18. [本课程推荐执行位置速查表](#18-本课程推荐执行位置速查表)

---

## 1. 三个「地方」的心智模型

整个课程只会涉及三个「地方」：

```text
                    🌐 GitHub（远程代码仓库 · source of truth）
                    https://github.com/xhr0417/llm-course
                             ↑                      ↓
                      push / pull               clone / pull
                           /                        \
                          /                          \
           🖥 你的 Mac（本地）                     ☁ Linux 服务器
           ~/Projects/llm-course                  ~/workspace/llm-course
           看课程 / 写代码 / Git 管理               跑模型 / 训练 / 处理数据
           （第 25、27 章测试也能跑）              （GPU、大数据、大文件在这里）
```

请把下面这几句话背下来（它们能消除 90% 的困惑）：

1. **GitHub 是一个网站上的远程仓库，不是文件夹。** 它不执行你的命令，也不跑模型。
2. **同一份仓库可以有多个副本。** Mac 上一份、服务器上一份。它们是**两块不同硬盘上的两份文件**。
3. **副本之间不会自动同步。** 最常见的同步路径是：Mac →（push）→ GitHub →（pull）→ 服务器。
4. **`cd` 永远只改变「你现在登录的这台机器」的当前目录。** 你在 Mac 终端里 `cd`，改的是 Mac；你 `ssh` 之后 `cd`，改的是服务器。
5. **路径只是示例。** 本文出现的 `~/Projects/...`、`~/workspace/...`、`/data/...` 都只是**示例**，你的真实路径可能完全不同——用 `pwd` 确认，不要照抄路径。

> 最容易搞混的一点：Mac 和服务器上可能都有叫 `llm-course` 的目录。
> 名字相同，但它们是两块不同硬盘上的两份文件。GitHub 才是它们最常用的同步中间站。

---

## 2. 执行任何命令前，先问自己 6 个问题

1. **我现在在哪台机器？**（Mac？还是 ssh 之后的服务器？）
2. **我现在在哪个目录？**（`pwd` 说话）
3. **这条命令在哪里执行？**（本机 shell？还是走网络？）
4. **执行后会生成/修改什么文件？**
5. **这些文件存在哪里？**（repo 里？还是服务器的大文件目录？）
6. **这些文件需不需要提交到 GitHub？**（源码要，数据/模型/密钥不要）

本课程之后的所有操作型 README 都按这 6 个问题组织。你看到 `# 【在哪执行】` / `# 【当前目录】`
的注释时，指的就是第 1、2 问。

---

## 3. clone 是什么意思：Mac 场景

`git clone <URL>` 的含义是：**把远程仓库完整复制到「当前这台机器」的当前目录下**，并记住远程地址，方便之后 `pull` / `push`。

### 场景 A：我想先在 Mac 上看网站

```bash
# 【在哪执行】Mac 的 Terminal（提示符类似 yourname@MacBook ~ %）
# 【当前目录】任意；第一行先切到一个固定位置
cd ~/Projects                 # 没有这个目录就先：mkdir -p ~/Projects
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
pwd
# 预期类似：/Users/你的用户名/Projects/llm-course
```

此时你拥有两份东西：

```text
GitHub： https://github.com/xhr0417/llm-course      ← 远程仓库（源）
Mac：    ~/Projects/llm-course                      ← 你本机的工作副本（一份完整拷贝）
```

打开课程网站：

```bash
# 【在哪执行】Mac【当前目录】~/Projects/llm-course
python3 -m http.server 8000
# 浏览器访问 http://127.0.0.1:8000
```

说明：这个 HTTP server 运行在 **Mac 上**，只是把当前目录当作静态网站目录。
它不是模型服务，也和服务器无关；关掉终端窗口它就停止。

---

## 4. 服务器场景：ssh 之后你在哪

先确认你**已经登录服务器**。判断方法看提示符：

```text
yourname@MacBook ~ %        ← 还在 Mac
user@ubuntu:~$              ← 已经在 Linux 服务器（ssh 成功之后）
```

> `ssh user@your-server` 之后，你的键盘输入会被送到服务器；从这一刻起，
> `cd / ls / python / git / pip` **默认全部发生在服务器上**，直到你输入 `exit` 回到 Mac。

```bash
# 【在哪执行】Linux 服务器（ssh 登录后）
# 【当前目录】登录后一般在 ~（家目录）
pwd                          # 例如 /home/user —— 先确认自己在服务器
mkdir -p ~/workspace && cd ~/workspace
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
pwd
# 预期类似：/home/user/workspace/llm-course
```

现在服务器也有一份独立的副本：

```text
GitHub： https://github.com/xhr0417/llm-course      ← 远程仓库（源）
Mac：    /Users/你的用户名/Projects/llm-course       ← Mac 的副本
Server： /home/user/workspace/llm-course            ← 服务器的副本（另一块硬盘）
```

**两份副本之间不会自动同步。** 你在 Mac 改的文件，服务器不会自动看到；反之亦然。

---

## 5. 推荐工作流：Mac 写代码 + GitHub 同步 + Server 跑实验

课程最推荐的分工：

```text
Mac                              GitHub                         Linux Server
写代码 / 看课程 / Git 管理   →   push / pull   →   跑训练 / 评测 / 大文件
```

### 第 1 步：在 Mac 修改并推送

```bash
# 【在哪执行】Mac【当前目录】~/Projects/llm-course
git status                    # 先看自己改了什么（永远不要不看就 add .）
git add projects/log-analyzer/starter/src/log_analyzer/parser.py
git diff --staged             # 再看一遍即将提交的内容
git commit -m "complete guided step 1"
git push
```

### 第 2 步：在服务器拉取

```bash
# 【在哪执行】Linux 服务器【当前目录】~/workspace/llm-course
git pull
```

`git pull` 每次的含义都取决于**你在哪台机器执行**：

- 在 Mac 执行 → 更新的是 Mac 上的副本；
- 在服务器执行 → 更新的是服务器上的副本；
- 它**不会**把服务器的文件"下载回 Mac"（那是 `scp` / `rsync` 的活，见第 13 节）。

### 什么时候需要 push / pull？

| 时机 | 动作 |
| --- | --- |
| 写完一个可运行的改动 / 完成一个 Step | `git add <文件> → commit → push` |
| 换一台机器继续工作之前 | 先 `git pull` 拿最新版本 |
| 长时间不 push | 风险：另一台机器上的 `pull` 拿不到你的改动；本地磁盘坏了就丢了 |
| 服务器上生成了小报告想进 repo | 先拷贝到 repo 内对应位置，再走第 12 节流程 |

---

## 6. 另一种模式：直接在服务器上开发

**可以不在 Mac clone，直接在服务器做。** 两种常见方式：

### 方式 1：在服务器上编辑

```bash
# 【在哪执行】Linux 服务器【当前目录】~/workspace/llm-course
vim  projects/log-analyzer/starter/src/log_analyzer/parser.py
# 或用 nano（对新手更友好）：
nano projects/log-analyzer/starter/src/log_analyzer/parser.py
```

### 方式 2：VS Code Remote SSH（推荐给习惯图形界面的人）

在 Mac 的 VS Code 里安装 `Remote - SSH` 扩展，连接 `user@your-server`，然后打开服务器上的
`~/workspace/llm-course`。

**必须理解的一点**：虽然界面显示在 Mac 屏幕上，但 VS Code 实际打开、编辑、保存的是
**服务器上的文件**。你在这里运行终端命令，也是在服务器上运行。

> 判断方法：Remote SSH 窗口左下角会显示 `SSH: your-server`。
> 打开它的集成终端，运行 `hostname` 或 `pwd` 来确认。

---

## 7. 代码、数据集、模型、checkpoint 应该放在哪里

### 7.1 一张表说清楚

| 文件类型 | 推荐位置 | 提交到 Git？ |
| --- | --- | --- |
| Python 源码 | repo（`src/`） | ✅ 提交 |
| README / 文档 | repo | ✅ 提交 |
| config / requirements | repo | ✅ 提交 |
| 小样例数据（几 KB ~ 几 MB） | repo（`data/`、`samples/`） | ✅ 提交 |
| tests | repo（`tests/`） | ✅ 提交 |
| 小型实验报告（summary.md / report.md） | repo | ✅ 提交 |
| 大型数据集 | **服务器**（如 `~/datasets/`、`/data/...`） | ❌ 不提交 |
| HuggingFace 模型缓存 | 服务器/本机缓存（`HF_HOME`） | ❌ 不提交 |
| checkpoint（训练中间产物） | 服务器（`~/checkpoints/`） | ❌ 通常不提交 |
| LoRA adapter（几 MB ~ 几十 MB） | 视情况：小 adapter 可选提交，大文件留服务器 | ⚠️ 可选 |
| logs / outputs / 图片产物 | 服务器或本地 `outputs/`（已 gitignore） | ❌ 不提交 |
| API key / `.env` / SSH 私钥 | 环境变量 / 本地文件 | ❌ **永远不提交** |
| wandb / 框架缓存 | 服务器 | ❌ 不提交 |

### 7.2 推荐的目录结构（示例，不是硬性要求）

```text
/home/user/                        ← 你的服务器家目录（示例）
├── workspace/
│   └── llm-course/                ← Git repo（代码从这里 pull / push）
│
├── datasets/                      ← 大型数据集（只在这台机器上）
│   ├── c3/
│   └── xcopa/
│
├── models/                        ← 模型缓存（可配合 HF_HOME）
│
├── checkpoints/                   ← 训练产物
│
└── outputs/                       ← 实验结果、日志
```

有些服务器会给你一块单独的数据盘（例如 `/data/$USER/...`）。**不要假定 `/data` 一定存在**——
先 `df -h` 看磁盘，再 `pwd` 确认自己有权访问的目录（见第 9 节）。

### 7.3 代码和大文件怎么连起来

程序通过 **命令行参数 / 配置文件 / 环境变量** 指向服务器上的大文件目录，而不是把数据搬进 repo：

```bash
# 【在哪执行】Linux 服务器【当前目录】~/workspace/llm-course/projects/xxx
python train.py \
  --data-dir ~/datasets/my_data \
  --output-dir ~/checkpoints/exp01
```

结论：**代码 repo 和实验数据目录不必在同一个地方。** 代码进 Git，大文件留在服务器。

---

## 8. HuggingFace 的文件下载到哪里去了

运行 `AutoModelForCausalLM.from_pretrained(...)` / `AutoTokenizer.from_pretrained(...)` 时，
模型**不是**被下载进 `projects/hf-mini-lab/`，而是进入 HuggingFace 的**缓存目录**。

查看当前缓存位置：

```bash
# 【在哪执行】你运行模型的机器（Mac 或服务器）
echo $HF_HOME        # 如果为空，说明没设置，使用默认位置
```

默认位置一般是用户缓存目录（例如 Linux 上 `~/.cache/huggingface`，macOS 上 `~/Library/Caches/huggingface`）。
不同系统、不同版本可能不同——**不要背路径，用 `echo $HF_HOME` 或 `huggingface-cli env` 确认。**

如果你想把模型放到指定位置（例如服务器大盘），启动前设置：

```bash
# 【在哪执行】Linux 服务器（示例；路径必须真实存在且有写权限）
export HF_HOME=~/models/huggingface
```

或：

```bash
# 只有你的服务器确实有 /data 且有权限时才这么写（例：/data/yourname）
export HF_HOME=/data/yourname/huggingface
```

两个提醒：

1. `HF_HOME` 只是一个环境变量：**换一个终端窗口就失效**。想永久生效需要写进 `~/.bashrc` 之类（本课程不强制）。
2. 路径必须**先存在、并且当前用户有权限**。不确定就先：
   `mkdir -p ~/models/huggingface && ls -ld ~/models/huggingface`。

---

## 9. 磁盘空间：下载模型之前先看一眼

```bash
# 【在哪执行】你准备下载模型的机器
df -h                          # 各磁盘剩余空间（人类可读）
du -sh .                       # 当前目录占多少
du -sh ~/models 2>/dev/null    # 指定目录占多少（不存在时静默）
df -h .                        # 只看当前目录所在的磁盘
```

经验值（fs fp32 权重粗算 = 参数量 × 4 字节）：

| 模型规模 | fp32 权重大致内存/磁盘 | 提醒 |
| --- | --- | --- |
| 0.5B | ~2GB | 本课程默认实验规模，CPU 可跑 |
| 1.5B | ~6GB | 服务器/大内存机器 |
| 7B | ~28GB | 服务器；缓存放大盘 |
| 13B+ | 50GB+ | 先确认磁盘与权限 |

**模型、数据集、checkpoint 不应该塞进 Git repo。** 如果 `du -sh .` 在你的 repo 里显示异常大，
先找出大文件（`du -sh * | sort -h | tail`），再决定它该不该在 repo 里。

---

## 10. .gitignore 与 git 提交纪律

### 10.1 提交前永远先看这三条

```bash
# 【在哪执行】你改代码的机器【当前目录】repo root 或子目录
git status            # 1. 我改了什么？有没有意外的大文件 / 密钥？
git add <具体文件>     # 2. 只添加你确定要提交的文件（不要习惯性 git add .）
git diff --staged     # 3. 再看一遍即将提交的内容
git commit -m "..."
```

### 10.2 哪些应该被 .gitignore 忽略

本仓库根目录 `.gitignore` 已经忽略：

```text
.DS_Store          # macOS 系统文件
__pycache__/       # Python 字节码
*.pyc
.venv/ venv/       # 虚拟环境
.pytest_cache/
.env .env.*        # 环境变量文件（.env.example 除外）
outputs/           # 实验产物
checkpoints/       # 训练产物
datasets/          # 大型数据集（root 级别）
wandb/ .cache/     # 框架缓存
*.safetensors *.ckpt *.pt *.pth *.bin   # 模型权重文件
```

**不会**被忽略、也不应该忽略的：

- `samples/`、`mini_*.jsonl` 这类小样例数据；
- `tests/`；
- 小型实验报告（`summary.md`、`report.md`）；
- 必需的测试 fixture。

### 10.3 如果不小心把大文件加入了暂存区

```bash
git restore --staged path/to/bigfile      # 取消暂存（文件还在磁盘上）
# 然后把它加进 .gitignore 或移到服务器目录
```

如果已经 commit 但还没 push，可以用 `git reset --soft HEAD~1` 撤回这次 commit 再重新提交；
已经 push 过的历史清理比较麻烦——**这就是为什么提交前必须 `git status`**。

---

## 11. 「我现在到底在哪」诊断框

任何时候迷路，运行这 5 条：

```bash
hostname          # 我在哪台机器
whoami            # 当前用户是谁
pwd               # 当前目录（最重要）
git status        # 当前目录是不是 Git repo、修改状态如何
python --version  # 当前 Python 环境
```

在服务器上还可以：

```bash
nvidia-smi        # 如果存在并显示 GPU → 当前环境可访问 NVIDIA GPU
```

注意：`nvidia-smi` 失败**不一定**代表没有 GPU——也可能是驱动未装、PATH 问题或容器权限限制。

补充技巧：如果你在 repo 深处迷路，不知道 repo root 在哪：

```bash
git rev-parse --show-toplevel    # 输出当前 Git 仓库的根目录
cd "$(git rev-parse --show-toplevel)"   # 一步回到 repo root
```

---

## 12. 完整演练：Mac → GitHub → Server → 报告回到 repo

以第 25 章 Guided Build 为例，走一遍完整闭环。

### ① Mac：clone 并打开网站

```bash
# 【在哪执行】Mac
cd ~/Projects
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
python3 -m http.server 8000       # 浏览器打开 http://127.0.0.1:8000
```

### ② Mac：完成 Step 1 并提交

```bash
# 【在哪执行】Mac【当前目录】~/Projects/llm-course
cd projects/log-analyzer/starter
pwd                                # 确认以 .../llm-course/projects/log-analyzer/starter 结尾
# ... 写代码 ...
pytest -q tests/test_step1_load.py # 5 passed
cd "$(git rev-parse --show-toplevel)"   # 回到 repo root
git status
git add projects/log-analyzer/starter/src/log_analyzer/parser.py
git commit -m "guided step 1: implement load_lines"
git push
```

### ③ Server：拉取并在真实环境跑

```bash
# 【在哪执行】Linux 服务器
ssh user@your-server
cd ~/workspace/llm-course         # 第一次需要先 clone（见第 4 节）
git pull                          # 拿到 Mac 推上来的改动
cd projects/log-analyzer/starter
pip install -r requirements.txt   # ⚠️ 依赖要在「运行测试的那台机器」上安装
pytest -q                         # 同一条命令，这次跑在服务器上
```

### ④ Server → Mac：把小型报告带回 repo

假设服务器上生成了一个小报告：

```bash
# 【在哪执行】Mac（不是服务器！）
# 【当前目录】任意；下面这条会把文件放到 Mac 的当前目录
scp user@your-server:~/workspace/llm-course/outputs/report.md .
```

然后把报告放进 repo 对应位置（例如 `projects/<project>/outputs/` 里只提交小型文本），
再 `git add → commit → push`（步骤同 ②）。

> 大文件（checkpoint、模型、大数据）**留在服务器**，不要走 Git。

---

## 13. scp / rsync：把服务器上的小文件拿回 Mac

只讲最安全的最小用法，不做运维教程。

### 偶尔拿一个小文件：scp

```bash
# 【在哪执行】Mac【当前目录】你希望文件落在的目录
scp user@your-server:~/workspace/llm-course/outputs/report.md .
```

含义：把**服务器**上的 `report.md` 复制到**Mac 当前目录**（`.`）。
反向（Mac → 服务器）：

```bash
# 【在哪执行】Mac
scp ./report.md user@your-server:~/workspace/llm-course/outputs/
```

### 目录同步：rsync（多看少动）

```bash
# 【在哪执行】Mac；先加 -n 预览，确认没有意外删除
rsync -avn user@your-server:~/workspace/llm-course/outputs/ ./server_outputs/
# 去掉 n 真正执行：
rsync -av user@your-server:~/workspace/llm-course/outputs/ ./server_outputs/
```

`-a` 保留属性，`-v` 显示详情，`-n` 是 dry-run（预览）。**不要加 `--delete`**，除非你非常确定。

---

## 14. 秘密信息：永远不要提交这些东西

绝对不要提交到 GitHub（无论是公开还是私有仓库）：

- OpenAI / Anthropic / 其他 API key；
- HuggingFace private token；
- SSH 私钥（`id_rsa`、`id_ed25519`）；
- 密码、数据库连接串；
- `.env` 文件（真实值）。

推荐做法：用环境变量。

```bash
# 【在哪执行】需要密钥的那台机器（示例占位，不要写真实 key）
export OPENAI_API_KEY="sk-...你的真实key..."
```

程序里读取：

```python
import os
api_key = os.environ.get("OPENAI_API_KEY", "")
```

不想每次手输，可以写进 `~/.bashrc`（服务器）或 `~/.zshrc`（Mac），但**这个文件本身不要进任何 repo**。

提交前自检：

```bash
git status                 # 有没有 .env / key 文件出现在列表里？
git diff --staged | grep -i "api_key\|token\|secret"   # 粗查（不保证万无一失）
```

---

## 15. 术语表

| 术语 | 一句话解释 |
| --- | --- |
| **Repo（仓库）** | 一个被 Git 管理的项目目录；同时包含全部提交历史。 |
| **Clone** | 把远程仓库完整复制到本机当前目录。 |
| **Working Directory** | 你现在 shell 所在的目录；`pwd` 告诉你它。 |
| **Repo Root** | 仓库的最顶层目录；`git rev-parse --show-toplevel` 告诉你它。 |
| **Remote** | 仓库对应的远程地址（本课程是 GitHub 上的 `origin`）。 |
| **Local** | 「本地」总是相对于当前上下文：在 Mac 上说 local 常指 Mac；在服务器 shell 里，服务器文件系统就是它的 local。 |
| **Server** | 你 ssh 登录的 Linux 机器；跑训练/评测的地方。 |
| **SSH** | 从一台机器安全登录另一台机器的协议；登录后你的命令在远端执行。 |
| **Push** | 把**当前机器**的提交上传到远程仓库。 |
| **Pull** | 把远程仓库的最新提交拉到**当前机器**。 |
| **Commit** | 一次本地存档：记录你改了哪些文件。 |
| **Cache** | 框架自动保存的下载文件（如 HuggingFace 模型），通常不进 Git。 |
| **Checkpoint** | 训练过程的权重快照；通常很大，留服务器。 |
| **Dataset** | 训练/评测数据；大文件留服务器，小样例可进 repo。 |
| **Artifact** | 实验产物（日志、报告、图），按大小决定去处。 |

---

## 16. 常见错误速查

| 报错 / 症状 | 原因 | 解决 |
| --- | --- | --- |
| `cd: no such file or directory` | 目录名拼错 / 你不在以为的那台机器或目录 | `pwd` + `ls` 先看；用 `cd "$(git rev-parse --show-toplevel)"` 回 repo root |
| `fatal: not a git repository` | 当前目录不在 repo 里（比如你在 `~`） | `cd` 到 clone 的目录；或用 `git rev-parse --show-toplevel` 找 root |
| `git pull` 出现冲突（conflict） | 两台机器改了同一文件的同一位置 | 打开冲突文件按标记手动解决 → `git add` → `git commit`；新手建议固定「只用 Mac 改代码」避免冲突 |
| `ModuleNotFoundError: No module named 'xxx'` | 依赖没装 **或装到了另一个 Python 环境** | 在**运行程序的机器**上装：`pip install -r requirements.txt`；用 `which python` / `python -m pip` 确认环境一致 |
| 装完包还是找不到 | Mac 装了、服务器没装（或反之） | 依赖是**每台机器各自安装**的，不会通过 Git 同步 |
| `pytest` 收集到 0 个测试 | 在错误的目录运行 | `pwd` 确认在 `<project>/starter`；`pytest.ini` 与 `tests/` 同级 |
| HF 模型把家目录塞满 | 默认缓存在家目录 | 设置 `HF_HOME` 到大盘（见第 8 节），清理旧缓存 |
| Git 里出现了 checkpoint / 大文件 | `git add .` 前没看 `git status` | `git restore --staged <file>`，并确认 `.gitignore` 已覆盖 |
| SSH 断开后训练进程停了 | 进程绑在 SSH 会话上 | 用 `tmux` / `screen` 保持会话（见第 17 节） |
| `~/xxx` 和自己拼的绝对路径行为不一致 | `~` 会展开为「当前用户」的家目录；服务器上不是 Mac 的家 | 统一用 `~/` 或显式 `$HOME`；脚本里优先相对路径 + 参数 |

---

## 17. 长时间任务（先知道名字即可）

如果你在服务器上跑长任务（超过几分钟），SSH 断开会导致进程被终止。业界做法：

- `tmux`（推荐）或 `screen`：让会话在服务器后台保持，断线重连后还能看到输出；
- 集群环境：通常用 `Slurm`（`sbatch` / `squeue`）提交任务。

本课程的项目在 CPU 上都能几分钟内跑完，**暂不需要**这些工具。等你开始跑真正的长训练时再学，不必现在掌握。

---

## 18. 本课程推荐执行位置速查表

| 内容 | 推荐机器 | 说明 |
| --- | --- | --- |
| 看课程网站 | 🖥 Mac 或 ☁ Server | `python3 -m http.server 8000`，纯静态 |
| 第 25 章 log-analyzer starter | 🎮 均可 | 纯标准库 + pytest，无需 GPU、无需下载模型 |
| 第 26 章 hf-mini-lab starter（tiny 测试） | 🎮 均可 | tiny 模型很小；首次需联网下载 |
| 第 26 章 真实 Qwen 实验（`run_lab.py`） | ☁ Server 优先 | Qwen2.5-0.5B CPU 也能跑；模型缓存注意 `HF_HOME` |
| 第 27 章 Eval Harness（mock） | 🎮 均可 | 不加载真实模型 |
| 第 27 章 Eval Harness（HF model） | ☁ Server 优先 | 与第 26 章同样需要模型缓存 |
| 第 27 章 Eval Harness（API） | 🎮 均可（能联网） | API key 用环境变量，绝不进 Git |
| 数据集 / checkpoint / 大模型 | ☁ Server | 不要放进 Git repo |

每个 Guided Build 的网页端「📍 执行环境与目录」块和对应 starter README 的「从零开始」
一节都会重复这些信息——**迷路时先看它们**。
