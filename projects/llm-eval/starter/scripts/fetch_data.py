"""从 HuggingFace 拉取真实评测数据切片（C3 / XCOPA / C-Eval）。

用法：
    python scripts/fetch_data.py --task xcopa --n 100 --out data/xcopa_zh_100.jsonl
    python scripts/fetch_data.py --task c3 --n 100 --out data/c3_dialog_100.jsonl

数据来源（公开数据集，仅取小切片用于教学评测）：
    - xcopa (cambridgeltl/xcopa, zh 配置)
    - dataset-org/c3 (dialog 配置)
"""
from __future__ import annotations

import argparse
import ast
import itertools
import json
import random
from pathlib import Path

from datasets import load_dataset


def fetch_xcopa(n: int, seed: int = 0) -> list[dict]:
    ds = load_dataset("xcopa", "zh", split="test", streaming=True)
    rows = []
    for i, row in enumerate(itertools.islice(ds, n * 2)):
        gold = "A" if str(row["label"]) == "0" else "B"
        rows.append({
            "id": f"xcopa-zh-{row['idx']}",
            "premise": row["premise"],
            "question": row["question"],
            "choice1": row["choice1"],
            "choice2": row["choice2"],
            "answer": gold,
        })
        if len(rows) >= n * 2:
            break
    rng = random.Random(seed)
    rng.shuffle(rows)
    return rows[:n]


def fetch_c3(n: int, seed: int = 0) -> list[dict]:
    ds = load_dataset("dataset-org/c3", "dialog", split="test", streaming=True)
    rows = []
    for row in itertools.islice(ds, n * 3):
        try:
            questions = ast.literal_eval(row["questions"]) if isinstance(row["questions"], str) else row["questions"]
            documents = ast.literal_eval(row["documents"]) if isinstance(row["documents"], str) else row["documents"]
        except (ValueError, SyntaxError):
            continue
        context = " ".join(documents) if isinstance(documents, list) else str(documents)
        q_texts = questions.get("question", [])
        answers = questions.get("answer", [])
        choices = questions.get("choice", [])
        for qi, (q, a, ch) in enumerate(zip(q_texts, answers, choices)):
            if not isinstance(ch, list) or len(ch) != 4:
                continue
            letter = None
            for i, opt in enumerate(ch):
                if str(opt).strip() == str(a).strip():
                    letter = "ABCD"[i]
                    break
            if letter is None:
                continue
            rows.append({
                "id": f"c3-dialog-{row['document_id']}-{qi}",
                "context": context,
                "question": q,
                "options": [str(x) for x in ch],
                "answer": letter,
            })
        if len(rows) >= n * 3:
            break
    rng = random.Random(seed)
    rng.shuffle(rows)
    return rows[:n]


def main() -> int:
    p = argparse.ArgumentParser(description="拉取真实评测数据切片")
    p.add_argument("--task", choices=["xcopa", "c3"], required=True)
    p.add_argument("--n", type=int, default=100)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--seed", type=int, default=0)
    args = p.parse_args()

    rows = fetch_xcopa(args.n, args.seed) if args.task == "xcopa" else fetch_c3(args.n, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"✅ {args.task}: {len(rows)} 行 → {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
