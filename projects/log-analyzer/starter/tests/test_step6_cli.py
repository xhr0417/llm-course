"""Step 6 · 从脚本到 CLI：argparse / --json / --warnings。

目标：让这 4 个测试变绿。关键协作要求：
- 默认值必须能跑通（`python -m log_analyzer.cli samples/train.log`）；
- `--json` 是给脚本消费的接口——字段名一旦发布就不能随便改。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from log_analyzer.cli import main

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "samples" / "train.log"


class TestCLI:
    def test_text_report(self, capsys):
        code = main([str(SAMPLE)])
        assert code == 0
        out = capsys.readouterr().out
        for key in ["final loss", "best", "平均吞吐", "warning", "NaN"]:
            assert key in out

    def test_json_output_contract(self, capsys):
        code = main([str(SAMPLE), "--json"])
        assert code == 0
        payload = json.loads(capsys.readouterr().out)
        # 字段契约：上层脚本依赖这些名字
        assert payload["final_loss"] == pytest.approx(2.271)
        assert payload["has_nan"] is False
        assert payload["num_warnings"] == 3
        assert payload["steps"]["last"] == 1000

    def test_warnings_flag_prints_lines(self, capsys):
        code = main([str(SAMPLE), "--warnings"])
        assert code == 0
        out = capsys.readouterr().out
        assert out.count("grad_norm") + out.count("val_loss") >= 3

    def test_module_entrypoint(self):
        env = dict(os.environ)
        env["PYTHONPATH"] = str(ROOT / "src")
        result = subprocess.run(
            [sys.executable, "-m", "log_analyzer.cli", str(SAMPLE), "--json"],
            cwd=ROOT, env=env, capture_output=True, text=True,
        )
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout)["best_loss"] == pytest.approx(2.271)
