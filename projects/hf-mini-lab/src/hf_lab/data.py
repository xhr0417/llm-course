"""数据：JSONL 读取、train/eval 切分、response-only loss 的 labels 构造。"""
from __future__ import annotations

import json
import random
from pathlib import Path


def load_jsonl(path: Path | str) -> list[dict]:
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def split_dataset(rows: list[dict], eval_ratio: float = 0.25, seed: int = 0) -> tuple[list[list[dict]], list[list[dict]]]:
    """优先按数据集自带的 "split" 字段切分；否则随机切分（seed 可复现）。"""
    if rows and all("split" in row for row in rows):
        train = [row["messages"] for row in rows if row["split"] == "train"]
        eval_ = [row["messages"] for row in rows if row["split"] == "eval"]
        return train, eval_
    rng = random.Random(seed)
    shuffled = rows[:]
    rng.shuffle(shuffled)
    n_eval = max(1, int(len(shuffled) * eval_ratio))
    return [r["messages"] for r in shuffled[n_eval:]], [r["messages"] for r in shuffled[:n_eval]]


def build_labels(tokenizer, messages: list[dict]) -> tuple[list[int], list[int]]:
    """构造 response-only loss 的 input_ids 与 labels。

    - prompt 部分（system/user + assistant 头部）labels 置为 -100，不参与 loss；
    - 只有 assistant 回复内容参与 loss。
    """
    def _as_ids(encoded):
        # 兼容 transformers 新旧行为：tokenize=True 可能返回 list 或 BatchEncoding
        if hasattr(encoded, "keys"):
            return list(encoded["input_ids"])
        return list(encoded)

    input_ids = _as_ids(tokenizer.apply_chat_template(messages, tokenize=True))
    prompt_ids = _as_ids(tokenizer.apply_chat_template(
        messages[:-1], tokenize=True, add_generation_prompt=True
    ))
    labels = list(input_ids)
    n_prompt = len(prompt_ids)
    labels[:n_prompt] = [-100] * n_prompt
    return input_ids, labels


def encode_batch(tokenizer, samples: list[dict], max_length: int = 256) -> tuple[list[list[int]], list[list[int]]]:
    batch_ids, batch_labels = [], []
    for messages in samples:
        ids, labels = build_labels(tokenizer, messages)
        ids, labels = ids[:max_length], labels[:max_length]
        batch_ids.append(ids)
        batch_labels.append(labels)
    return batch_ids, batch_labels
