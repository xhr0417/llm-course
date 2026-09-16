# log-analyzer · Starter（Guided Build）

这是 **第 25 章 · Python Engineering for AI** 的 Guided Build 起点项目。

**它现在是一个不完整的项目**：核心函数只有签名和 `NotImplementedError`。
你的任务不是「看懂」，而是**一步一步把 `src/` 里的函数写出来，让测试从红变绿**。

> 项目目标：训练日志分析 CLI —— 一次训练跑完（或崩掉）后，从 `train.log` 回答：
> final loss / best loss 出现在第几步、平均吞吐、warning、是否出现 NaN。

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
| 9 | 最终验收 | `pytest -q` | 41 passed |

> 跑全量 `pytest -q` 时，后面步骤的测试也会一起失败——这是正常的：
> 它们在等你先完成前面的步骤。

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
