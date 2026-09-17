:::intuition 一句话
第 11 章解决「怎么看懂模型代码」；这一章解决「**怎么把脚本拆成可测试的工程**」——按职责分层、用测试当规格、用退出码当接口。当前主线作业仍是小模型实验室，不是再做一个训练日志 CLI。
:::

:::note 本章在当前主线中的位置
当前主线是「小模型学习实验室 → 技术声明核验助手 / 单 Agent → 算法或 Infra 专项」。本章当教材阅读：保留 Python 工程原理。仓库里的 `projects/log-analyzer/` 是历史参考实现，**不是当前作业**；不要进入 `starter/`，不要把旧 Guided Build 当必修。目录待后续审计后再处理。
:::

## 25.1 这一章读什么

本文档假设你已经会写 Python 函数和循环。要补的是 **AI 实验里最常用的工程部分**：

- 按职责拆包，而不是一个 800 行的 `train.py`；
- `pathlib` / JSONL / dataclass / argparse / logging；
- pytest 覆盖异常路径；退出码是接口。

```
读分层与数据契约
   ↓
卡住时打开参考手册查 argparse / logging / pytest
   ↓
（可选）对照历史参考实现，看真实 CLI 输出
   ↓
回到当前主线：在空文件里写 Attention，而不是改旧作业目录
```

:::note 为什么还保留「失败的测试」这个想法
真实工程里，测试就是需求和验收标准。历史 starter 曾用 41 个失败测试当任务清单——那是旧作业流程。当前主线不要求你去把那些测试从红变绿。原理仍然成立：先有可运行的检查，再写实现。
:::

## 25.2 工程要点：解析 → 统计 → 入口

训练跑完（或崩掉）之后，日志要能回答：final / best loss、平均吞吐、warning、是否出现 NaN。把这件事做成 CLI 时，三层不要循环依赖：

```text
src/<package>/
├── parser.py    # 文本 → 结构化事件（正则、编码、坏行）
├── stats.py     # 事件序列 → 汇总指标（对齐 step 与 loss）
└── cli.py       # argparse + logging + JSON 输出 + 退出码
```

| 层 | 输入 | 输出 | 不要做的事 |
| --- | --- | --- | --- |
| parser | 文件路径 / 原始行 | `LogEvent` 列表 | 计算平均值、打印报告 |
| stats | 事件列表 | `TrainRunStats` | 读文件、解析 argv |
| cli | 命令行 | 人读报告 / JSON / 退出码 | 把正则写进 `main` |

**错位 bug（历史实验里真实出现过）**：warning 行带 `step=` 但不带 `loss=`。若 `steps` 与 `losses` 按下标对齐，best step 会对到错误的一步。修复是另建 `loss_steps`，只在同时有 step 和 loss 时追加。

**退出码是接口**：0 正常、1 日志里已有错误/发散、2 文件不存在或参数错误。调用方（脚本、CI）靠数字分支，不靠解析中文报告。

**JSONL**：一行一条记录，适合流式读训练日志和指令数据；不要为了「看起来整齐」先把整个文件 `json.load` 进内存。

历史参考实现在样例日志上的**实测输出**（课程当时跑出来的数字，不是你现在的作业目标）：

```
== 训练日志分析 ==
事件数            : 22（原始行 22）
step 范围         : 10 → 1000
final loss        : 2.2710
best  loss        : 2.2710 (step 1000)
平均吞吐          : 4936 tokens/s
warning 数        : 3
error   数        : 0
NaN 事件          : 否
```

对发散日志：`NaN 事件：是`，并带上 error/warning 计数。

:::note 可选参考（非当前作业）
若只想对照分层写法，可查阅 [projects/log-analyzer](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer)。不要 `cd` 进 `starter/`，也不要把 41 个测试全绿当作当前任务。
:::

## 25.3 参考手册

argparse、dataclass、typing、pathlib、JSONL、logging、异常、asyncio、pytest 的细则在按需查阅页。主线阅读不要被手册堵住。

:::reference python-engineering
打开 Python Engineering 参考手册
:::
