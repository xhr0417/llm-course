# log-analyzer · Starter（历史残留）

> **已退出教学流程（非当前作业）。** 不要从这里开始练习。当前动手任务在网站「我的学习」。下面是旧 Guided Build 的说明，仅供对照残留代码。

这是 **第 25 章 · Python Engineering for AI** 曾经使用的 Guided Build 起点。

**它现在是一个不完整的项目**：核心函数只有签名和 `NotImplementedError`。
你的任务不是「看懂」，而是**一步一步把 `src/` 里的函数写出来，让测试从红变绿**。

> 项目目标：训练日志分析 CLI —— 一次训练跑完（或崩掉）后，从 `train.log` 回答：
> final loss / best loss 出现在第几步、平均吞吐、warning、是否出现 NaN。

## 从零开始：我要在哪里开始、怎么开始

**推荐执行位置**：🖥 Mac 或 ☁ Linux Server **都可以**（本项目只用标准库 + pytest，不需要 GPU，不需要下载模型）。
在哪台机器执行，`pip install` 和 `pytest` 就必须都在**同一台**机器上。

### 1. 先分清三个「地址」（很多新手卡在这里）

| 东西 | 是什么 | 示例（只是示例，别照抄路径） |
| --- | --- | --- |
| GitHub 仓库 | 远程仓库（代码的源头，不是文件夹） | `https://github.com/xhr0417/llm-course` |
| 你的 clone | 这份仓库在你机器上的**工作副本** | Mac：`~/Projects/llm-course` · Server：`~/workspace/llm-course` |
| 本 starter | repo 里的一个子目录 | `<你的 clone>/projects/log-analyzer/starter` |

Mac 上一份 clone、服务器上一份 clone 是**两块硬盘上的两份文件**，通过 GitHub（push/pull）同步。
详见 [docs/ENVIRONMENT_AND_WORKFLOW.md](../../../docs/ENVIRONMENT_AND_WORKFLOW.md)。

### 2. 五条命令：从零到第一次 pytest

```bash
# ① 【在哪执行】Mac 或 Linux Server（任选一台）
# 【当前目录】你想把 repo 放在哪，就先 cd 到哪
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
pwd        # 记下它 = 你的 repo root；以后所有相对路径都从这出发
# （已经有 clone：cd 到你的 repo root；忘了在哪：git rev-parse --show-toplevel）

# ② 进入 starter（本项目的起点）
# 【当前目录】repo root
cd projects/log-analyzer/starter
pwd        # 应看到 .../llm-course/projects/log-analyzer/starter；不是的话先别继续

# ③ 安装依赖（在哪台机器跑 pytest，就在哪台机器装）
pip install -r requirements.txt

# ④ 第一次运行：应该满屏红色
pytest -q
```

补充命令（任何时候迷路时用）：

```bash
hostname   # 我在哪台机器（Mac 还是服务器）
pwd        # 我在哪个目录
```

### 3. starter 和 reference 是什么关系？

- **starter**（你现在这里，`projects/log-analyzer/starter/`）：刻意**不完整**的版本，核心函数是 TODO；
- **reference**（上一级目录 `projects/log-analyzer/`）：完整参考实现。**做完本 starter 再看**，否则项目不算你做的。

### 4. 哪些文件要改？哪些不要改？

| 文件 | 动它吗 |
| --- | --- |
| `src/log_analyzer/*.py` | ✅ 要实现的代码全在这里 |
| `tests/test_step1-7*.py` | ❌ 不要改（它们是验收标准） |
| `tests/test_step8_edge_cases.py` | ✅ 唯一例外：Step 8 要你把 3 个占位测试改成自己的边界用例 |
| `samples/` | 🔧 只读；想加样例可以另建文件 |
| `README.md` | 🔧 可以补充你的笔记 |
| `../`（reference 实现） | ⚠️ 只做对照；不要改 reference 来让 starter 变绿 |

### 5. 做完之后：代码放哪里？

- **方式 A · 学习模式（推荐先这样）**：就在这份 clone 里完成，用 `git add / commit` 记录每一步进展；
- **方式 B · 作品集模式（准备放进简历时）**：把 starter 复制成**你自己的独立仓库**（安全做法，不删除任何东西）：

```bash
# 【在哪执行】做项目的机器【当前目录】repo root
mkdir -p ~/Projects/my-log-analyzer
cp -R projects/log-analyzer/starter/. ~/Projects/my-log-analyzer/
cd ~/Projects/my-log-analyzer
git init
git add .
git commit -m "my log-analyzer implementation"
pytest -q                  # 确认它仍然可运行
```

⚠️ 不要把整个课程 repo 伪装成你自己独立写的作品；简历里的仓库应该是你完成并整理过的项目。

## Quick Start

```bash
cd projects/log-analyzer/starter
pip install -r requirements.txt

pytest -q          # ✅ 现在就应该失败（这是设计的一部分）
```

**初始状态（真实记录）**：`41 failed in 0.15s` —— 因为 `src/` 还没有实现。
失败不是错误，而是给你看的任务清单。请对照课程第 25 章的 Step 0-9 逐组变绿。

## Step → 测试 对应表

| Step | 主题 | 运行（只看本步） | 变绿意味着 |
| --- | --- | --- | --- |
| 1 | 读取日志文件（pathlib / encoding） | `pytest -q tests/test_step1_load.py` | 5 passed |
| 2 | 解析一条日志（dataclass / typing） | `pytest -q tests/test_step2_parse.py` | 8 passed |
| 3 | 现实日志没有这么干净（脏行 / 未知字段） | `pytest -q tests/test_step3_messy.py` | 6 passed |
| 4 | 统计训练结果（聚合指标） | `pytest -q tests/test_step4_stats.py` | 6 passed |
| 5 | step/loss 错位 bug（先预测，再修复） | `pytest -q tests/test_step5_alignment.py` | 3 passed |
| 6 | 变成 CLI（argparse / --json / --warnings） | `pytest -q tests/test_step6_cli.py` | 4 passed |
| 7 | logging 与退出码（可恢复 vs 致命） | `pytest -q tests/test_step7_logging.py` | 6 passed |
| 8 | 写你自己的 3 个边界测试 | `pytest -q tests/test_step8_edge_cases.py` | 3 passed（你自己写） |
| 9 | 最终验收 | `pytest -q` | 41 passed ※ |

> 跑全量 `pytest -q` 时，后面步骤的测试也会一起失败——这是正常的：
> 它们在等你先完成前面的步骤。

※ **41 passed 的准确口径**：41 = 课程提供的 38 个测试 + **Step 8 里你自己写的 3 个测试**。
只完成 `src/` 而不写 Step 8 的 3 个边界测试，会停在 `38 passed, 3 failed`——
这不是 bug，是设计的一部分（Step 8 的验收就是「你来写测试」）。

## 目录结构

```text
starter/
├── README.md
├── requirements.txt        # 只需要 pytest
├── pytest.ini              # testpaths = tests
├── conftest.py             # 把 src/ 加进 import 路径
├── samples/
│   ├── train.log           # 健康训练日志（22 行，含 3 条 warning）
│   └── train_nan.log       # 发散日志（NaN）
├── src/log_analyzer/
│   ├── parser.py           # Step 1-3：文本 → LogEvent
│   ├── stats.py            # Step 4-5：LogEvent → TrainRunStats
│   └── cli.py              # Step 6-7：argparse + logging + 退出码
└── tests/
    ├── test_step1_load.py … test_step7_logging.py   # 课程提供的测试（不要改）
    └── test_step8_edge_cases.py                     # Step 8：你来写 3 个测试
```

## 三条纪律

1. **不要先看参考实现**：完整实现就在上一级目录（`../src/`）。卡住时先看课程里的 Hint 1 / Hint 2；
   只有两次 Hint 都用完、仍然卡住时才打开 `[查看参考实现]`。抄一遍 ≠ 学会。
2. **先预测，再运行**：每一步的 `pytest` 之前，先写下你预期看到几个 failed / passed。
   预测和实际不一致的地方，才是你真正需要理解的地方。
3. **self-check 诚实**：课程页面上的进度条需要你**在本地真实跑通测试后**才点「我已在本地通过」。
   网站无法验证你的本地环境——自己骗自己没有意义。

## 完成之后

- `pytest -q` 全部通过 + `python -m log_analyzer.cli samples/train.log` 输出报告；
- 对照上一级的完整工程（`../README.md` / `../src/`），看看你的实现和它差在哪里；
- 回到课程页面回答 Step 9 的复盘问题——能不看代码回答，才算完成 Checkpoint A。
