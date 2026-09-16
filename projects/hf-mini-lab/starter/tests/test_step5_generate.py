"""Step 5 · 批量生成：left padding + 只解码新 token。

目标：让这 3 个测试变绿。先预测：两条长度不同的 prompt 如何放进同一个 batch？
"""
from __future__ import annotations

import pytest
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from conftest import RUN_MODEL_TESTS
from hf_lab.chat import batch_generate

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
PROMPTS = ["你好", "什么是学习率？"]

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


@pytest.fixture(scope="module")
def tokenizer():
    return AutoTokenizer.from_pretrained(TINY_MODEL)


@pytest.fixture(scope="module")
def tiny_model():
    return AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32).eval()


class TestBatchGenerate:
    def test_two_prompts_return_two_nonempty_strings(self, tokenizer, tiny_model):
        answers = batch_generate(tokenizer, tiny_model, PROMPTS, max_new_tokens=4)
        assert len(answers) == 2
        assert all(isinstance(a, str) and a.strip() for a in answers)

    def test_padding_side_is_left(self, tokenizer, tiny_model):
        tokenizer.padding_side = "right"
        batch_generate(tokenizer, tiny_model, PROMPTS, max_new_tokens=2)
        assert tokenizer.padding_side == "left"

    def test_only_new_tokens_are_decoded(self, tokenizer, tiny_model):
        # 假模型把输入原样接上固定续写：答案里绝不应出现 prompt 文本
        cont_ids = tokenizer("OK", add_special_tokens=False)["input_ids"]
        expected = tokenizer.decode(cont_ids, skip_special_tokens=True)

        class FakeModel:
            device = torch.device("cpu")

            def generate(self, **kwargs):
                input_ids = kwargs["input_ids"]
                cont = torch.tensor([cont_ids], dtype=input_ids.dtype).repeat(input_ids.shape[0], 1)
                return torch.cat([input_ids, cont], dim=1)

        answers = batch_generate(tokenizer, FakeModel(), PROMPTS, max_new_tokens=3)
        assert answers == [expected, expected]
        assert all("你好" not in a for a in answers)
