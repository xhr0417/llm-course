"""Step 10 · adapter 存取：保存产物可用、重新加载、干净模型未被污染。

目标：让这 3 个测试变绿。先预测：load_adapter 会不会改造传进去的 base model？
"""
from __future__ import annotations

import pytest
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM

from conftest import RUN_MODEL_TESTS
from hf_lab.config import load_config
from hf_lab.loading import load_adapter, load_model
from hf_lab.train import make_lora_model, save_adapter

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


def n_lora_params(model) -> int:
    """LoRA 可训练参数：名字含 lora_ 且 requires_grad——用于区分「注入过」与「干净」的模型。"""
    return sum(p.numel() for n, p in model.named_parameters() if p.requires_grad and "lora_" in n)


def lora_cfg():
    return load_config(None, lora_r=4, target_modules=["q_proj", "v_proj"])


def make_and_save(tmp_path) -> None:
    base = AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32)
    save_adapter(make_lora_model(base, lora_cfg()), tmp_path, lora_cfg())


class TestSaveAdapter:
    def test_writes_adapter_and_config_files(self, tmp_path):
        make_and_save(tmp_path)
        assert (tmp_path / "adapter_config.json").exists()
        assert (tmp_path / "adapter_model.safetensors").exists()
        assert (tmp_path / "config.json").exists()


class TestLoadAdapter:
    def test_returns_peft_model_with_lora_modules(self, tmp_path):
        make_and_save(tmp_path)
        base = load_model(TINY_MODEL, dtype="float32", device="cpu")
        reloaded = load_adapter(base, tmp_path)
        assert isinstance(reloaded, PeftModel)
        # from_pretrained 默认以推理模式加载（LoRA 参数 requires_grad=False），
        # 所以这里按名字检查 LoRA 模块是否真的装上了
        assert any("lora_" in name for name, _ in reloaded.named_parameters())

    def test_fresh_model_is_clean_before_loading(self):
        fresh = load_model(TINY_MODEL, dtype="float32", device="cpu")
        assert n_lora_params(fresh) == 0
