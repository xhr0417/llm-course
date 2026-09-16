"""Step 11 · PEFT 就地注入陷阱（项目历史真实 bug）。

get_peft_model(model) 会【就地】改造传入的 model 对象：调用之后，原来的
model 变量内部已经装上 LoRA 层了。如果再用它当「基线」去评测，测到的
并不是干净模型——本项目在早期就踩过这个坑（见 ../README.md「三个容易踩的坑」）。
正确姿势：基线必须是【另一次干净加载】的模型。

目标：让这 2 个测试变绿，并记住正确姿势。
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


def n_lora_params(model) -> int:
    """LoRA 可训练参数：名字含 lora_ 且 requires_grad。"""
    return sum(p.numel() for n, p in model.named_parameters() if p.requires_grad and "lora_" in n)


def lora_cfg():
    return load_config(None, lora_r=4, target_modules=["q_proj", "v_proj"])


class TestPeftInPlaceTrap:
    def test_injection_mutates_the_original_object(self):
        base = AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32)
        assert n_lora_params(base) == 0
        make_lora_model(base, lora_cfg())
        # 陷阱：base 不是 PeftModel，但它的内部模块已经被换成了 LoRA 层
        assert n_lora_params(base) > 0

    def test_correct_pattern_uses_two_fresh_loads(self):
        adapter_base = AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32)
        baseline = AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32)
        adapter = make_lora_model(adapter_base, lora_cfg())
        assert n_lora_params(baseline) == 0  # 干净基线：从头到尾没被注入
        assert n_lora_params(adapter) > 0
