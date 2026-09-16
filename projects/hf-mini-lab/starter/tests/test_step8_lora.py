"""Step 8 · LoRA 注入：只训练极少量参数。

目标：让这 2 个测试变绿。先预测：q_proj/v_proj 上 r=4 的 LoRA 参数占比是多少？
"""
from __future__ import annotations

import pytest
import torch
from transformers import AutoModelForCausalLM

from conftest import RUN_MODEL_TESTS
from hf_lab.config import load_config
from hf_lab.train import make_lora_model

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


@pytest.fixture
def tiny_model():
    # 函数级 fixture：make_lora_model 会【就地】改造模型对象，测试之间不能共享
    return AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32).eval()


def lora_cfg():
    return load_config(None, lora_r=4, target_modules=["q_proj", "v_proj"])


class TestMakeLoraModel:
    def test_trainable_fraction_below_ten_percent(self, tiny_model):
        peft_model = make_lora_model(tiny_model, lora_cfg())
        trainable = sum(p.numel() for p in peft_model.parameters() if p.requires_grad)
        total = sum(p.numel() for p in peft_model.parameters())
        assert 0 < trainable < total * 0.10

    def test_lora_layers_injected(self, tiny_model):
        peft_model = make_lora_model(tiny_model, lora_cfg())
        names = [name for name, _ in peft_model.named_modules()]
        assert any("lora_A" in name for name in names)
        assert any("lora_B" in name for name in names)
