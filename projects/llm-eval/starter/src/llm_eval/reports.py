"""报告：results.json / summary.md / badcases.jsonl。

这是 starter 的【待实现文件】：
- Step 12：实现 write_reports()

输出契约：
- results.json   —— run.to_dict()，ensure_ascii=False, indent=2（机读）；
- badcases.jsonl —— 所有任务的 badcase 逐行 dump（每行一个 JSON 对象）；
- summary.md     —— 任务指标表格（百分比，如 accuracy=60.0%）+ badcase 示例 + 复现命令（人读）。

返回 {"results": Path, "badcases": Path, "summary": Path}。
"""
from __future__ import annotations

from pathlib import Path

from llm_eval.config import EvalConfig
from llm_eval.runner import RunReport


def write_reports(run: RunReport, cfg: EvalConfig, out_dir: Path) -> dict[str, Path]:
    """Step 12：写出三个报告文件，返回 {results, badcases, summary} → Path。"""
    raise NotImplementedError("Step 12：实现 write_reports（results.json / summary.md / badcases.jsonl）")
