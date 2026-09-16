"""Capstone 3 端到端实验：Base → LoRA 训练 → adapter → 评测对比 → 报告。

用法：
    python scripts/run_experiment.py --steps 150 --output outputs/sft_run --run-harness
"""
from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from sft_lora.config import load_config  # noqa: E402
from sft_lora.data import load_messages  # noqa: E402
from sft_lora.evaluate import classify_badcase, eval_loss, export_badcases, generate_answers  # noqa: E402
from sft_lora.model import apply_lora, load_base_model, load_tokenizer, merge_adapter  # noqa: E402
from sft_lora.report import build_experiment_md, write_losses_csv  # noqa: E402
from sft_lora.train import train  # noqa: E402

logger = logging.getLogger("run_experiment")


def run_harness(model: str, data_path: Path, out_dir: Path, peft_adapter: str | None) -> dict | None:
    """调用 Capstone 1（llm-eval）的 harness 做 QA 评测，返回 results.json。"""
    harness = PROJECT_ROOT.parent / "llm-eval" / "run_eval.py"
    if not harness.exists():
        logger.warning("未找到 llm-eval harness：%s", harness)
        return None
    cmd = [sys.executable, str(harness), "--adapter", "hf", "--model", model,
           "--tasks", "qa", "--data", f"qa={data_path}", "--limit", "20",
           "--max-new-tokens", "96", "--output", str(out_dir)]
    if peft_adapter:
        cmd += ["--peft-adapter", peft_adapter]
    logger.info("运行 harness：%s", " ".join(cmd[-8:]))
    subprocess.run(cmd, cwd=harness.parent, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    results_path = out_dir / "results.json"
    return json.loads(results_path.read_text(encoding="utf-8")) if results_path.exists() else None


def main() -> int:
    p = argparse.ArgumentParser(description="Capstone 3：真实 SFT / LoRA 实验")
    p.add_argument("--config", type=Path, default=PROJECT_ROOT / "configs" / "sft_lora.json")
    p.add_argument("--train", type=Path, default=PROJECT_ROOT / "data" / "train.jsonl")
    p.add_argument("--val", type=Path, default=PROJECT_ROOT / "data" / "val.jsonl")
    p.add_argument("--eval-qa", type=Path, default=PROJECT_ROOT / "data" / "eval_qa.jsonl")
    p.add_argument("--steps", type=int, default=None)
    p.add_argument("--output", default=None)
    p.add_argument("--run-harness", action="store_true", help="调用 llm-eval 做 base/tuned QA 对比")
    p.add_argument("--merge", action="store_true", help="额外导出合并权重（体积大）")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = load_config(args.config, max_steps=args.steps, output_dir=args.output, merge=args.merge)
    out_dir = Path(cfg.output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    cfg.save(out_dir / "config.json")
    t_start = time.time()

    train_samples = load_messages(args.train)
    val_samples = load_messages(args.val)
    eval_rows = [json.loads(l) for l in args.eval_qa.read_text(encoding="utf-8").splitlines() if l.strip()]
    logger.info("数据：train=%d val=%d eval_qa=%d", len(train_samples), len(val_samples), len(eval_rows))

    tokenizer = load_tokenizer(cfg.base_model)

    # 干净 base（对照）——注意：PEFT 是就地注入，对照模型必须单独加载
    base_cmp = load_base_model(cfg)
    base_val = eval_loss(base_cmp, tokenizer, val_samples, cfg.max_length)
    logger.info("base held-out loss：%.4f", base_val)

    # 训练
    model = apply_lora(load_base_model(cfg), cfg)
    log = train(tokenizer, model, train_samples, val_samples, cfg)
    adapter_dir = out_dir / "adapter"
    model.save_pretrained(adapter_dir)
    cfg.save(adapter_dir / "config.json")
    logger.info("adapter 已保存：%s", adapter_dir)

    if cfg.merge:
        merge_adapter(cfg.base_model, str(adapter_dir), str(out_dir / "merged"), dtype="float16")

    # tuned 评测
    from peft import PeftModel
    tuned = PeftModel.from_pretrained(load_base_model(cfg), adapter_dir)
    tuned_val = eval_loss(tuned, tokenizer, val_samples, cfg.max_length)
    logger.info("tuned held-out loss：%.4f（Δ=%+.4f）", tuned_val, tuned_val - base_val)

    # 生成对比 + bad case
    questions = [r["question"] for r in eval_rows]
    base_answers = generate_answers(base_cmp, tokenizer, questions)
    tuned_answers = generate_answers(tuned, tokenizer, questions)
    badcases = []
    for row, ba, ta in zip(eval_rows, base_answers, tuned_answers):
        err = classify_badcase(row["answers"], ta)
        if err != "ok":
            badcases.append({"id": row["id"], "question": row["question"], "gold": row["answers"],
                             "base": ba, "tuned": ta, "error_type": err})
    export_badcases(badcases, out_dir / "badcases.jsonl")

    # harness（可选）
    eval_table = None
    if args.run_harness:
        base_res = run_harness(cfg.base_model, args.eval_qa.resolve(), out_dir / "eval_base", None)
        tuned_res = run_harness(cfg.base_model, args.eval_qa.resolve(), out_dir / "eval_tuned", str(adapter_dir.resolve()))
        if base_res and tuned_res:
            bm = base_res["tasks"][0]["metrics"]
            tm = tuned_res["tasks"][0]["metrics"]
            eval_table = [
                {"metric": "QA EM", "base": f"{bm['em'] * 100:.1f}%", "tuned": f"{tm['em'] * 100:.1f}%",
                 "delta": f"{(tm['em'] - bm['em']) * 100:+.1f}pt"},
                {"metric": "QA F1", "base": f"{bm['f1'] * 100:.1f}%", "tuned": f"{tm['f1'] * 100:.1f}%",
                 "delta": f"{(tm['f1'] - bm['f1']) * 100:+.1f}pt"},
            ]
            (out_dir / "harness_results.json").write_text(json.dumps(
                {"base": base_res, "tuned": tuned_res}, ensure_ascii=False, indent=2), encoding="utf-8")

    write_losses_csv(log, out_dir / "losses.csv")
    report = build_experiment_md(cfg, log, base_val, tuned_val, len(train_samples), len(val_samples),
                                 badcases, eval_table, time.time() - t_start, adapter_dir)
    (out_dir / "experiment.md").write_text(report, encoding="utf-8")
    print(report)
    print(f"产物：{out_dir}/adapter/、losses.csv、badcases.jsonl、experiment.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
