"""Step 13 · CLI 收口：`python run_eval.py --adapter mock ...` 一条命令跑通。

目标：让这 2 个测试变绿。
需要 build_adapter 的 mock 分支先能工作（Step 4 之后就能补上），
真实模型（hf / openai）分支在 Step 7 / 9 完成。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _run_cli(tmp_path, *extra: str):
    out_dir = tmp_path / "out"
    proc = subprocess.run(
        [sys.executable, "run_eval.py", "--adapter", "mock", "--tasks", "c3",
         "--limit", "4", "--output", str(out_dir), "--no-cache", *extra],
        cwd=ROOT, capture_output=True, text=True, timeout=180,
    )
    return proc, out_dir


class TestCLI:
    def test_mock_run_exits_zero_and_writes_reports(self, tmp_path):
        proc, out_dir = _run_cli(tmp_path)
        assert proc.returncode == 0, proc.stderr
        assert (out_dir / "results.json").exists()
        assert (out_dir / "summary.md").exists()
        payload = json.loads((out_dir / "results.json").read_text(encoding="utf-8"))
        assert payload["adapter"] == "mock"
        assert payload["tasks"][0]["n"] == 4

    def test_cli_prints_report_path(self, tmp_path):
        proc, out_dir = _run_cli(tmp_path)
        assert proc.returncode == 0, proc.stderr
        assert "results.json" in proc.stdout
        assert "c3" in proc.stdout
