"""log_analyzer —— 训练日志分析 CLI（Python 工程化范例）。

用法：
    python -m log_analyzer.cli samples/train.log
    python -m log_analyzer.cli samples/train.log --json
"""
from log_analyzer.parser import parse_log_file, parse_line
from log_analyzer.stats import TrainRunStats, analyze

__all__ = ["parse_log_file", "parse_line", "analyze", "TrainRunStats"]
__version__ = "0.1.0"
