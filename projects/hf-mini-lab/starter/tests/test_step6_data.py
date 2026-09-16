"""Step 6 · 数据：JSONL 读取与 train/eval 切分。

目标：让这 4 个测试变绿。先预测：行里没有 "split" 字段时会怎么切？
"""
from __future__ import annotations

from pathlib import Path

from hf_lab.data import load_jsonl, split_dataset

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "sft_mini.jsonl"


class TestLoadJsonl:
    def test_reads_twenty_rows(self):
        rows = load_jsonl(DATA)
        assert len(rows) == 20
        assert all(isinstance(r, dict) for r in rows)


class TestSplitDataset:
    def test_respects_split_field(self):
        train, eval_ = split_dataset(load_jsonl(DATA))
        assert len(train) == 16
        assert len(eval_) == 4

    def test_returns_message_lists(self):
        train, eval_ = split_dataset(load_jsonl(DATA))
        for sample in train + eval_:
            assert isinstance(sample, list)
            assert sample, "每个样本至少有一条 message"
            assert all("role" in m and "content" in m for m in sample)

    def test_random_fallback_when_no_split_field(self):
        # 合成数据：没有 "split" 字段 → 按 eval_ratio 随机切分，seed 可复现
        rows = [{"messages": [{"role": "user", "content": f"q{i}"}]} for i in range(12)]
        train, eval_ = split_dataset(rows, eval_ratio=0.25, seed=0)
        assert len(eval_) == 3
        assert len(train) == 9

        train_again, eval_again = split_dataset(rows, eval_ratio=0.25, seed=0)
        assert train_again == train and eval_again == eval_

        contents = sorted(m[0]["content"] for m in train + eval_)
        assert contents == sorted(f"q{i}" for i in range(12))
