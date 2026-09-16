"""数据：JSONL 指令数据 → response-only loss 的 (input_ids, labels)。"""
from __future__ import annotations

import json
from pathlib import Path

import torch


def load_messages(path: Path | str) -> list[list[dict]]:
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line)["messages"])
    return rows


def _as_ids(encoded) -> list[int]:
    """兼容 transformers 新旧行为：tokenize=True 可能返回 list 或 BatchEncoding。"""
    if hasattr(encoded, "keys"):
        return list(encoded["input_ids"])
    return list(encoded)


def build_example(tokenizer, messages: list[dict], max_length: int = 256) -> tuple[list[int], list[int]]:
    """Response-only loss：prompt（含 system/user/assistant 头）置 -100，只学回答。"""
    input_ids = _as_ids(tokenizer.apply_chat_template(messages, tokenize=True))
    prompt_ids = _as_ids(tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True))
    labels = list(input_ids)
    n_prompt = min(len(prompt_ids), len(labels))
    labels[:n_prompt] = [-100] * n_prompt
    if len(labels) > max_length:
        input_ids, labels = input_ids[:max_length], labels[:max_length]
        if all(x == -100 for x in labels):
            labels[-1] = input_ids[-1]
    return input_ids, labels


def make_collate(tokenizer, max_length: int = 256):
    pad_id = tokenizer.pad_token_id

    def collate(samples: list[list[dict]]):
        batch_ids, batch_labels = [], []
        for messages in samples:
            ids, labels = build_example(tokenizer, messages, max_length)
            batch_ids.append(ids)
            batch_labels.append(labels)
        max_len = max(len(x) for x in batch_ids)
        input_ids, labels, attention = [], [], []
        for ids, labs in zip(batch_ids, batch_labels):
            pad_n = max_len - len(ids)
            input_ids.append(ids + [pad_id] * pad_n)
            labels.append(labs + [-100] * pad_n)
            attention.append([1] * len(ids) + [0] * pad_n)
        return {
            "input_ids": torch.tensor(input_ids),
            "labels": torch.tensor(labels),
            "attention_mask": torch.tensor(attention),
        }

    return collate
