"""Step 1 · 加载 tokenizer：encode/decode 往返、pad_token 兜底、词表大小。

目标：让这 3 个测试变绿。先预测：pad_token 为 None 时应该用什么兜底？
"""
from __future__ import annotations

import pytest

from conftest import RUN_MODEL_TESTS
from hf_lab.loading import load_tokenizer

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


class TestLoadTokenizer:
    def test_encode_decode_roundtrip(self):
        tokenizer = load_tokenizer(TINY_MODEL)
        ids = tokenizer("你好，世界", add_special_tokens=False)["input_ids"]
        assert tokenizer.decode(ids) == "你好，世界"

    def test_pad_token_set(self):
        tokenizer = load_tokenizer(TINY_MODEL)
        assert tokenizer.pad_token is not None
        assert tokenizer.pad_token_id is not None

    def test_vocab_size_positive(self):
        tokenizer = load_tokenizer(TINY_MODEL)
        assert tokenizer.vocab_size > 0
