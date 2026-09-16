"""数据：JSONL 读取、train/eval 切分、response-only loss 的 labels（starter：待实现）。

Step 6：load_jsonl / split_dataset
Step 7：build_labels / encode_batch
"""
from __future__ import annotations

import json
import random
from pathlib import Path


def _as_ids(encoded):
    """把 apply_chat_template 的返回统一成 list[int]。

    回归（真实 CI 失败过）：transformers 新版在 tokenize=True 时返回
    BatchEncoding（dict），旧版返回 list。直接 list(encoded) 会拿到 key
    列表而不是 token ids——build_labels 必须兼容两种形态。
    """
    if hasattr(encoded, "keys"):
        return list(encoded["input_ids"])
    return list(encoded)


def load_jsonl(path: Path | str) -> list[dict]:
    """Step 6：逐行读取 JSONL（每行一个 dict），空行跳过。"""
    raise NotImplementedError("Step 6：实现 load_jsonl（提示：read_text + splitlines + json.loads）")


def split_dataset(rows: list[dict], eval_ratio: float = 0.25, seed: int = 0) -> tuple[list[list[dict]], list[list[dict]]]:
    """Step 6：优先按行的 "split" 字段切分；否则按 eval_ratio 随机切分（seed 可复现）。

    返回 (train_messages, eval_messages)，元素是 messages 列表（不是整行）。
    """
    raise NotImplementedError("Step 6：实现 split_dataset（提示：all(\"split\" in row) + random.Random(seed)）")


def build_labels(tokenizer, messages: list[dict]) -> tuple[list[int], list[int]]:
    """Step 7：构造 response-only loss 的 input_ids 与 labels。

    - 只有 assistant 回复参与 loss：prompt 前缀（messages[:-1] +
      add_generation_prompt 的 assistant 头部）的 labels 置 -100；
    - 用 _as_ids 兼容 list 与 BatchEncoding 两种返回值。
    """
    raise NotImplementedError("Step 7：实现 build_labels（提示：_as_ids + 前缀置 -100）")


def encode_batch(tokenizer, samples: list[dict], max_length: int = 256) -> tuple[list[list[int]], list[list[int]]]:
    """Step 7：批量构造 ids/labels，并截断到 max_length。"""
    raise NotImplementedError("Step 7：实现 encode_batch（提示：逐条 build_labels 后切片）")
