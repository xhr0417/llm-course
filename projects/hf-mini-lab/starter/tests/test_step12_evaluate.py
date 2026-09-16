"""Step 12 · 评测：held-out response-only loss、生成对比、实验报告。

目标：让这 3 个测试变绿。先预测：eval_loss 要不要把样本 padding 拼成一个 batch？
"""
from __future__ import annotations

import math
from pathlib import Path

import pytest
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from conftest import RUN_MODEL_TESTS
from hf_lab.config import load_config
from hf_lab.data import load_jsonl, split_dataset
from hf_lab.evaluate import build_report, compare_generation, eval_loss
from hf_lab.train import TrainResult

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "sft_mini.jsonl"

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


@pytest.fixture(scope="module")
def tokenizer():
    return AutoTokenizer.from_pretrained(TINY_MODEL)


@pytest.fixture(scope="module")
def tiny_model():
    return AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32).eval()


class TestEvalLoss:
    def test_finite_on_held_out_samples(self, tokenizer, tiny_model):
        _, eval_samples = split_dataset(load_jsonl(DATA))
        loss = eval_loss(tiny_model, tokenizer, eval_samples[:2], max_length=128)
        assert math.isfinite(float(loss))


class TestCompareGeneration:
    def test_two_rows_with_base_and_tuned_strings(self, tokenizer, tiny_model):
        tuned = AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32).eval()
        rows = compare_generation(
            tokenizer, tiny_model, tuned, ["你好", "什么是学习率？"], max_new_tokens=4
        )
        assert len(rows) == 2
        for row in rows:
            assert {"prompt", "base", "tuned"} <= set(row)
            assert isinstance(row["base"], str)
            assert isinstance(row["tuned"], str)


class TestBuildReport:
    def test_contains_model_loss_and_comparison_sections(self):
        cfg = load_config(None, model_name=TINY_MODEL, max_steps=2, batch_size=2)
        result = TrainResult(losses=[2.0, 1.5], trainable_params=224, total_params=2_435_016)
        report = build_report(
            cfg,
            result,
            base_eval=2.5,
            tuned_eval=2.0,
            comparisons=[{"prompt": "你好", "base": "a", "tuned": "b"}],
            elapsed=1.0,
            n_train=4,
            n_eval=2,
        )
        assert cfg.model_name in report
        assert "loss" in report
        assert "base" in report
        assert "tuned" in report
