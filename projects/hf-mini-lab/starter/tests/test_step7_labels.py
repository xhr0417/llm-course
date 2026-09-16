"""Step 7 · response-only loss 掩码：哪些 token 参与 loss？

目标：让这 5 个测试变绿。先预测：assistant 回复的第一个 token 对应哪一位 label？
"""
from __future__ import annotations

import pytest
from transformers import AutoTokenizer

from conftest import RUN_MODEL_TESTS
from hf_lab.data import build_labels, encode_batch

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
MESSAGES = [
    {"role": "user", "content": "什么是过拟合？"},
    {"role": "assistant", "content": "过拟合是记住了训练噪声。"},
]

requires_models = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


@pytest.fixture(scope="module")
def tokenizer():
    return AutoTokenizer.from_pretrained(TINY_MODEL)


@requires_models
class TestBuildLabels:
    def test_lengths_and_supervision(self, tokenizer):
        ids, labels = build_labels(tokenizer, MESSAGES)
        assert len(ids) == len(labels)
        supervised = sum(1 for x in labels if x != -100)
        assert 0 < supervised < len(labels)
        assert labels[-1] != -100  # 回复的最后一个 token（<|im_end|>）参与 loss

    def test_prompt_prefix_all_masked(self, tokenizer):
        ids, labels = build_labels(tokenizer, MESSAGES)
        prompt = tokenizer.apply_chat_template(
            MESSAGES[:-1], tokenize=True, add_generation_prompt=True
        )
        prompt_ids = prompt["input_ids"] if hasattr(prompt, "keys") else prompt
        prompt_len = len(prompt_ids)
        assert labels[:prompt_len] == [-100] * prompt_len
        assert labels[prompt_len] != -100

    def test_encode_batch_truncates_to_max_length(self, tokenizer):
        batch_ids, batch_labels = encode_batch(tokenizer, [MESSAGES] * 3, max_length=8)
        assert len(batch_ids) == 3 and len(batch_labels) == 3
        assert all(len(ids) <= 8 for ids in batch_ids)
        assert all(len(labels) <= 8 for labels in batch_labels)

    def test_encode_batch_alignment(self, tokenizer):
        batch_ids, batch_labels = encode_batch(tokenizer, [MESSAGES], max_length=256)
        assert len(batch_ids[0]) == len(batch_labels[0])


class TestBuildLabelsCompat:
    def test_accepts_batchencoding(self):
        """回归：transformers 5 的 apply_chat_template(tokenize=True) 返回 BatchEncoding。

        直接 list(encoded) 会得到 key 列表而不是 token ids——真实 CI 失败过一次。
        """

        class FakeTokenizer:
            def apply_chat_template(self, messages, tokenize=True, add_generation_prompt=False):
                ids = [10, 11, 12, 20, 21]
                prompt_len = 4 if add_generation_prompt else 3
                return {"input_ids": ids[:prompt_len] if add_generation_prompt else ids}

        ids, labels = build_labels(FakeTokenizer(), MESSAGES)
        assert isinstance(ids, list) and isinstance(labels, list)
        assert sum(1 for x in labels if x != -100) == 1
