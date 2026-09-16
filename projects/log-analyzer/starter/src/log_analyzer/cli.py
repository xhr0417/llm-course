"""命令行入口：python -m log_analyzer.cli samples/train.log

这是 starter 的【待实现文件】：
- Step 6：实现 build_parser() / format_report() / main()（argparse + 报告输出）
- Step 7：加入 logging 与退出码语义：
    0 成功 / 1 业务失败（如空日志） / 2 参数或输入错误（如文件不存在）
"""
from __future__ import annotations

import argparse
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    """Step 6：定义 CLI 参数。

    需要支持：
      logfile           位置参数（日志路径）
      --json            以 JSON 输出（便于脚本消费）
      --warnings        打印全部 warning 行
      --verbose         DEBUG 级日志
    """
    raise NotImplementedError("Step 6：实现 build_parser")


def format_report(stats) -> str:
    """Step 6：把 TrainRunStats 渲染成人读文本报告。"""
    raise NotImplementedError("Step 6：实现 format_report")


def main(argv: "list[str] | None" = None) -> int:
    """Step 6/7：程序入口，返回退出码（不要用 sys.exit）。"""
    raise NotImplementedError("Step 6：实现 main")
