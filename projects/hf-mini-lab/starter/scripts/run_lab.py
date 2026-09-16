"""端到端实验：加载 → Chat Template → logits → 批量生成 → LoRA SFT → 保存 → 重载 → 评测 → 报告。

用法：
    python scripts/run_lab.py
    python scripts/run_lab.py --model Qwen/Qwen2.5-0.5B-Instruct --steps 60

本文件已写好：它负责把 hf_lab 的函数串成 8 步实验。在 Step 1-12 全部实现之前，
运行会停在某个 NotImplementedError——这正是你的进度指示器。
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import torch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from hf_lab.chat import batch_generate, next_token_logits, show_template  # noqa: E402
from hf_lab.config import load_config  # noqa: E402
from hf_lab.data import encode_batch, load_jsonl, split_dataset  # noqa: E402
from hf_lab.evaluate import build_report, compare_generation, eval_loss  # noqa: E402
from hf_lab.loading import load_adapter, load_model, load_tokenizer  # noqa: E402
from hf_lab.train import make_lora_model, save_adapter, train_lora  # noqa: E402

logger = logging.getLogger("run_lab")

EVAL_PROMPTS = ["用一句话解释什么是 LayerNorm。", "用一句话解释什么是数据去重。"]


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="HuggingFace mini lab：从加载到 LoRA SFT 的端到端实验")
    p.add_argument("--model", default=None, help="模型名称（默认用 configs/lora_sft.json）")
    p.add_argument("--config", type=Path, default=PROJECT_ROOT / "configs" / "lora_sft.json")
    p.add_argument("--data", type=Path, default=PROJECT_ROOT / "data" / "sft_mini.jsonl")
    p.add_argument("--steps", type=int, default=None, help="覆盖 max_steps")
    p.add_argument("--output", default=None, help="覆盖输出目录")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    cfg = load_config(
        args.config if args.config.exists() else None,
        model_name=args.model,
        max_steps=args.steps,
        output_dir=args.output,
    )
    t_start = time.time()

    print("=" * 68)
    print(f"[1/8] 加载 tokenizer 与模型：{cfg.model_name}")
    tokenizer = load_tokenizer(cfg.model_name)
    base_model = load_model(cfg.model_name, dtype=cfg.dtype, device=cfg.device)

    print("=" * 68)
    print("[2/8] Chat Template：messages → 文本 → ids")
    show_template(tokenizer, [{"role": "user", "content": "什么是过拟合？"}])

    print("=" * 68)
    print("[3/8] logits 形状检查（连接第 9 章 GPT）")
    logits = next_token_logits(tokenizer, base_model, [{"role": "user", "content": "你好"}])
    print(f"logits: {tuple(logits.shape)}")
    print(f"最后一位置 top-5 token id: {torch.topk(logits[0, -1], 5).indices.tolist()}")

    print("=" * 68)
    print("[4/8] 批量生成（left padding）")
    prompts = ["什么是学习率？", "什么是 KV Cache？"]
    base_batch = batch_generate(tokenizer, base_model, prompts, max_new_tokens=48)
    for p, a in zip(prompts, base_batch):
        print(f"  Q: {p}\n  A: {a}\n")

    print("=" * 68)
    print("[5/8] 数据与 response-only loss 掩码")
    rows = load_jsonl(args.data)
    train_samples, eval_samples = split_dataset(rows, seed=cfg.seed)
    ids, labels = encode_batch(tokenizer, train_samples[:1], max_length=cfg.max_length)
    supervised = sum(1 for x in labels[0] if x != -100)
    print(f"train={len(train_samples)} eval={len(eval_samples)} | 首条序列 {len(ids[0])} token，其中参与 loss 的 assistant token = {supervised}")

    print("=" * 68)
    print(f"[6/8] LoRA SFT：r={cfg.lora_r} target={cfg.target_modules} steps={cfg.max_steps} bs={cfg.batch_size} lr={cfg.learning_rate}")
    lora_model = make_lora_model(base_model, cfg)
    result = train_lora(tokenizer, lora_model, train_samples, cfg)
    save_adapter(lora_model, cfg.output_dir, cfg)

    print("=" * 68)
    print("[7/8] 重新加载 adapter（验证保存产物可用）")
    # 注意：PEFT 是【就地注入】——get_peft_model / PeftModel.from_pretrained 都会改造传入的模型。
    # 因此基线评测必须用【另一次干净加载】的模型，否则会把 adapter 当成 base。
    tuned_base = load_model(cfg.model_name, dtype=cfg.dtype, device=cfg.device)
    tuned_model = load_adapter(tuned_base, cfg.output_dir)
    clean_base = load_model(cfg.model_name, dtype=cfg.dtype, device=cfg.device)

    base_eval = eval_loss(clean_base, tokenizer, eval_samples, cfg.max_length)
    tuned_eval = eval_loss(tuned_model, tokenizer, eval_samples, cfg.max_length)
    print(f"held-out response-only loss：base={base_eval:.4f} → tuned={tuned_eval:.4f}（Δ={tuned_eval - base_eval:+.4f}）")

    print("=" * 68)
    print("[8/8] 生成对比与报告")
    comparisons = compare_generation(
        tokenizer, clean_base, tuned_model, EVAL_PROMPTS, max_new_tokens=48
    )
    out_dir = Path(cfg.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "losses.json").write_text(json.dumps(result.losses, indent=2), encoding="utf-8")
    report = build_report(
        cfg, result, base_eval, tuned_eval, comparisons, time.time() - t_start,
        n_train=len(train_samples), n_eval=len(eval_samples),
    )
    (out_dir / "report.md").write_text(report, encoding="utf-8")
    print(report)
    print(f"\n产物：{out_dir}/adapter_config.json、adapter_model.safetensors、config.json、losses.json、report.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
