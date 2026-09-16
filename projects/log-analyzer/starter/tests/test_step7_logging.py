"""Step 7 · logging 与退出码：可恢复的错误 vs 致命的错误。

目标：让这 6 个测试变绿。核心设计问题：

    哪些情况应该「跳过、继续」（recoverable）？
    哪些情况应该「报错、退出」（fatal）？
    退出码告诉上游脚本什么信息？ 0 / 1 / 2 各代表什么？

对照实现：缺文件 → 2；空日志 → 1；坏行跳过不崩 → 0。
"""
from __future__ import annotations

import json
from pathlib import Path

from log_analyzer.cli import main

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "samples" / "train.log"
SAMPLE_NAN = ROOT / "samples" / "train_nan.log"


class TestExitCodes:
    def test_missing_file_exit_2(self, tmp_path, capsys):
        code = main([str(tmp_path / "missing.log")])
        assert code == 2
        # 不允许抛 traceback——用户要看到「缺什么、怎么办」
        captured = capsys.readouterr()
        assert "Traceback" not in captured.err + captured.out

    def test_empty_log_exit_1(self, tmp_path, capsys):
        f = tmp_path / "empty.log"
        f.write_text("", encoding="utf-8")
        assert main([str(f)]) == 1

    def test_garbage_only_log_exit_1(self, tmp_path):
        f = tmp_path / "garbage.log"
        f.write_text("no timestamps here\nstill not a log\n", encoding="utf-8")
        assert main([str(f)]) == 1

    def test_bad_lines_are_skipped_not_fatal(self, tmp_path, capsys):
        f = tmp_path / "mixed.log"
        f.write_text(
            "2025-01-10 09:00:02 INFO  step=10 loss=7.812 tokens/s=1180\n"
            "!!! corrupted line !!!\n"
            "2025-01-10 09:00:04 INFO  step=20 loss=6.401 tokens/s=2150\n",
            encoding="utf-8",
        )
        assert main([str(f), "--json"]) == 0
        payload = json.loads(capsys.readouterr().out)
        assert payload["parsed_events"] == 2
        assert payload["total_lines"] == 3

    def test_verbose_flag_accepted(self, capsys):
        assert main([str(SAMPLE), "--verbose"]) == 0

    def test_nan_log_reports_nan(self, capsys):
        code = main([str(SAMPLE_NAN)])
        assert code == 0
        captured = capsys.readouterr()
        assert "NaN" in captured.out + captured.err
