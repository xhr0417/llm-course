"""Step 9 · LoRA 训练循环：手工 collate 与 2 步 SFT。

目标：让这 3 个测试变绿。先预测：padding 位置的 label 应该置成多少？
"""
from __future__ import annotations

import math
from pathlib import Path

import pytest
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from conftest import RUN_MODEL_TESTS
from hf_lab.config import load_config
from hf_lab.data import load_jsonl
from hf_lab.train import _collate, make_lora_model, train_lora

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "sft_mini.jsonl"

requires_models = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


@pytest.fixture(scope="module")
def tokenizer():
    return AutoTokenizer.from_pretrained(TINY_MODEL)


@pytest.fixture(scope="module")
def tiny_model():
    return AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32).eval()


class TestCollate:
    def test_pads_ids_labels_and_attention(self):
        input_ids, labels, attention = _collate(
            [[1, 2, 3], [4, 5]], [[-100, -100, 3], [-100, 5]], pad_id=0
        )
        assert input_ids.tolist() == [[1, 2, 3], [4, 5, 0]]
        assert labels.tolist() == [[-100, -100, 3], [-100, 5, -100]]
        assert attention.tolist() == [[1, 1, 1], [1, 1, 0]]

    def test_returns_tensors(self):
        input_ids, labels, attention = _collate([[1], [2, 3]], [[1], [2, 3]], pad_id=0)
        assert isinstance(input_ids, torch.Tensor)
        assert isinstance(labels, torch.Tensor)
        assert isinstance(attention, torch.Tensor)
        assert input_ids.shape == labels.shape == attention.shape == (2, 2)


@requires_models
class TestTrainLora:
    def test_two_steps_on_four_samples(self, tokenizer, tiny_model):
        rows = load_jsonl(DATA)
        train_samples = [r["messages"] for r in rows if r["split"] == "train"][:4]
        cfg = load_config(
            None, max_steps=2, batch_size=2, max_length=64, lora_r=4,
            target_modules=["q_proj", "v_proj"],
        )
        model = make_lora_model(tiny_model, cfg)
        result = train_lora(tokenizer, model, train_samples, cfg)
        assert len(result.losses) == 2
        assert all(math.isfinite(x) for x in result.losses)
        assert 0 < result.trainable_params < result.total_params
