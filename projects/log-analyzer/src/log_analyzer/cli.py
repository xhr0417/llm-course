"""命令行入口：python -m log_analyzer.cli samples/train.log"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from log_analyzer.parser import parse_log_file
from log_analyzer.stats import analyze

logger = logging.getLogger("log_analyzer")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="log_analyzer",
        description="分析训练日志：loss 曲线端点、最佳 loss、吞吐、warning 与 NaN。",
    )
    parser.add_argument("logfile", type=Path, help="日志文件路径（如 samples/train.log）")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出（便于脚本消费）")
    parser.add_argument("--warnings", action="store_true", help="打印全部 warning 行")
    parser.add_argument("--verbose", action="store_true", help="输出 DEBUG 级日志")
    return parser


def format_report(stats) -> str:
    lines = [
        "== 训练日志分析 ==",
        f"事件数            : {stats.parsed_events}（原始行 {stats.total_lines}）",
        f"step 范围         : {stats.steps[0] if stats.steps else '-'} → {stats.steps[-1] if stats.steps else '-'}",
        f"final loss        : {stats.final_loss:.4f}" if stats.final_loss is not None else "final loss        : -",
        f"best  loss        : {stats.best_loss:.4f} (step {stats.best_step})" if stats.best_loss is not None else "best  loss        : -",
        f"平均吞吐          : {stats.avg_tokens_per_sec:.0f} tokens/s" if stats.avg_tokens_per_sec else "平均吞吐          : -",
        f"warning 数        : {len(stats.warnings)}",
        f"error   数        : {len(stats.errors)}",
        f"NaN 事件          : {'是（训练可能已发散！）' if stats.has_nan else '否'}",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )

    if not args.logfile.exists():
        logger.error("日志文件不存在：%s", args.logfile)
        return 2

    raw_lines = args.logfile.read_text(encoding="utf-8").splitlines()
    events = parse_log_file(args.logfile)
    if not events:
        logger.error("没有解析到任何合法日志行：%s", args.logfile)
        return 1

    stats = analyze(events, total_lines=len(raw_lines))
    logger.debug("解析 %d / %d 行", stats.parsed_events, stats.total_lines)

    if args.json:
        print(json.dumps(stats.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(format_report(stats))
        if args.warnings:
            print("\n-- warnings --")
            for event in stats.warnings:
                print(f"[{event.timestamp}] {event.message}")
        if stats.nan_events:
            print("\n-- NaN 事件 --", file=sys.stderr)
            for event in stats.nan_events:
                print(f"[{event.timestamp}] {event.message}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
