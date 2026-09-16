"""Step 4 · logits 形状：模型对每个位置都给出词表上的分数。

目标：让这 2 个测试变绿。先预测：logits 最后一维等于 tokenizer.vocab_size 吗？
（提示：模型输出维度是 config.vocab_size，可能因对齐 pad 到 >= 词表）
"""
from __future__ import annotations

import pytest
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from conftest import RUN_MODEL_TESTS
from hf_lab.chat import next_token_logits

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
MESSAGES = [{"role": "user", "content": "你好"}]

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


@pytest.fixture(scope="module")
def tokenizer():
    return AutoTokenizer.from_pretrained(TINY_MODEL)


@pytest.fixture(scope="module")
def tiny_model():
    return AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32).eval()


class TestNextTokenLogits:
    def test_shape_is_batch_seq_vocab(self, tokenizer, tiny_model):
        logits = next_token_logits(tokenizer, tiny_model, MESSAGES)
        enc = tokenizer.apply_chat_template(
            MESSAGES, tokenize=True, return_dict=True, return_tensors="pt"
        )
        assert logits.shape[0] == 1
        assert logits.shape[1] == enc["input_ids"].shape[1]
        assert logits.shape[2] > 0

    def test_vocab_at_least_tokenizer_vocab_and_float(self, tokenizer, tiny_model):
        logits = next_token_logits(tokenizer, tiny_model, MESSAGES)
        # 注意：不是 ==，而是 >=（并行/对齐会用 pad 把输出维度撑大）
        assert logits.shape[-1] >= tokenizer.vocab_size
        assert logits.dtype.is_floating_point
