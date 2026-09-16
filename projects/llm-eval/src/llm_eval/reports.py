"""报告：results.json / summary.md / badcases.jsonl。"""
from __future__ import annotations

import json
from pathlib import Path

from llm_eval.config import EvalConfig
from llm_eval.runner import RunReport


def write_reports(run: RunReport, cfg: EvalConfig, out_dir: Path) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}

    results_path = out_dir / "results.json"
    results_path.write_text(json.dumps(run.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    paths["results"] = results_path

    badcases_path = out_dir / "badcases.jsonl"
    with badcases_path.open("w", encoding="utf-8") as f:
        for task_report in run.tasks:
            for case in task_report.badcases:
                f.write(json.dumps(case, ensure_ascii=False) + "\n")
    paths["badcases"] = badcases_path

    lines = [
        "# 评测报告",
        "",
        f"- 适配器：`{run.adapter}`",
        f"- 模型：`{run.model}`",
        f"- 时间：{run.started_at} → {run.finished_at}（{run.duration_s:.1f}s）",
        f"- 并发：{cfg.concurrency} | 重试：{cfg.retries} | 缓存：{'开' if cfg.use_cache else '关'}",
        "",
        "## 结果总览",
        "",
        "| 任务 | 样本数 | 指标 | 解析失败 | API错误 | 用时 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for t in run.tasks:
        metric_str = " / ".join(f"{k}={v * 100:.1f}%" for k, v in t.metrics.items())
        lines.append(f"| {t.task} | {t.n} | {metric_str} | {t.parse_failures} | {t.api_errors} | {t.duration_s:.1f}s |")
    lines += ["", "## Bad cases", ""]
    for t in run.tasks:
        if not t.badcases:
            lines.append(f"- **{t.task}**：无（全部正确）")
            continue
        lines.append(f"- **{t.task}**：{len(t.badcases)} 个 bad case（完整列表见 badcases.jsonl），示例：")
        for case in t.badcases[:5]:
            pred = case["prediction"] if case["prediction"] is not None else "解析失败"
            raw = case["raw_output"].replace("\n", " ")[:60]
            lines.append(f"  - `{case['id']}`（{case['error_type']}）gold={case['gold']} pred={pred} raw=\"{raw}\"")
    lines += [
        "",
        "## 复现实验",
        "",
        "```bash",
        f"python run_eval.py --adapter {cfg.adapter} --model {cfg.model} "
        f"--tasks {' '.join(cfg.tasks)} --limit {cfg.limit} --output {cfg.output_dir}",
        "```",
        "",
        "> 数字来自本次真实运行；如果样本量较小（如 limit=50），置信区间较宽，不要据此下强结论（见第 23 章）。",
    ]
    summary_path = out_dir / "summary.md"
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    paths["summary"] = summary_path
    return paths
