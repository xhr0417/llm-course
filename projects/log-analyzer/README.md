# log-analyzer

训练日志分析 CLI —— 本课程 **Python Engineering for AI** 的配套工程范例。

回答一个真实场景问题：一次训练跑完（或崩掉）之后，从 `train.log` 里快速回答：

- final loss / best loss 是多少、出现在哪一步？
- 平均吞吐（tokens/s）是多少？
- 有没有 warning（grad norm 超阈值、val loss 上升）？
- 有没有出现 NaN、训练是否发散？

## Quick Start

```bash
cd projects/log-analyzer
pip install -r requirements.txt

python -m log_analyzer.cli samples/train.log
python -m log_analyzer.cli samples/train.log --json
python -m log_analyzer.cli samples/train_nan.log --warnings

pytest -q
```

## 项目结构

```
log-analyzer/
├── README.md
├── requirements.txt
├── samples/
│   ├── train.log          # 健康训练日志（1000 步收敛，3 条 warning）
│   └── train_nan.log      # 发散日志（grad norm 爆炸 → NaN）
├── src/log_analyzer/
│   ├── __init__.py
│   ├── parser.py          # 文本行 → LogEvent（dataclass + 正则）
│   ├── stats.py           # LogEvent 序列 → TrainRunStats（dataclass）
│   └── cli.py             # argparse + logging + JSON 输出
└── tests/
    └── test_analyzer.py   # pytest：解析 / 统计 / CLI / 子进程入口
```

## 设计要点（对应课程）

| 课程概念 | 项目中的位置 |
| --- | --- |
| 项目结构解耦 | `parser` / `stats` / `cli` 三层，互不依赖 |
| dataclass | `LogEvent`、`TrainRunStats` |
| typing | 全模块 type hints（`Optional`、属性封装指标） |
| pathlib | 文件输入一律 `Path` |
| logging | `cli.py` 中 `logger.info/error`，不用 print 调试 |
| argparse | `--json / --warnings / --verbose` |
| pytest | 14 个测试覆盖正常与失败路径 |
| 异常处理 | 文件不存在返回退出码 2；空日志返回 1 |

## 环境

- Python 3.9+（推荐 3.11+）
- 无第三方运行时依赖（标准库即可运行）
- 测试依赖：pytest
