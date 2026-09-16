"""Step 3 · 加载模型：eval 模式、参数量、CPU/float32。

目标：让这 3 个测试变绿。先预测：load_model 返回的模型处于 train 还是 eval 模式？
"""
from __future__ import annotations

import pytest
import torch

from conftest import RUN_MODEL_TESTS
from hf_lab.loading import load_model

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


class TestLoadModel:
    def test_eval_mode(self):
        model = load_model(TINY_MODEL, dtype="float32", device="cpu")
        assert model.training is False

    def test_param_count_positive(self):
        model = load_model(TINY_MODEL, dtype="float32", device="cpu")
        assert sum(p.numel() for p in model.parameters()) > 0

    def test_cpu_float32(self):
        model = load_model(TINY_MODEL, dtype="float32", device="cpu")
        assert all(p.device.type == "cpu" for p in model.parameters())
        assert all(p.dtype == torch.float32 for p in model.parameters())
