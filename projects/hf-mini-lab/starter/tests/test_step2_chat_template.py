"""Step 2 · Chat Template：messages 如何被渲染成带特殊 token 的文本。

目标：让这 5 个测试变绿。先预测：add_generation_prompt=True 时，文本末尾多了什么？
"""
from __future__ import annotations

import pytest
from transformers import AutoTokenizer

from conftest import RUN_MODEL_TESTS
from hf_lab.chat import render_chat, show_template

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
MESSAGES = [{"role": "user", "content": "你好"}]

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="RUN_MODEL_TESTS=0")


@pytest.fixture(scope="module")
def tokenizer():
    return AutoTokenizer.from_pretrained(TINY_MODEL)


class TestRenderChat:
    def test_contains_user_marker_and_assistant_prompt(self, tokenizer):
        text = render_chat(tokenizer, MESSAGES)
        assert "<|im_start|>user" in text
        assert text.rstrip().endswith("<|im_start|>assistant")

    def test_without_generation_prompt_drops_assistant_marker(self, tokenizer):
        with_prompt = render_chat(tokenizer, MESSAGES, add_generation_prompt=True)
        without_prompt = render_chat(tokenizer, MESSAGES, add_generation_prompt=False)
        assert not without_prompt.rstrip().endswith("<|im_start|>assistant")
        assert len(without_prompt) < len(with_prompt)

    def test_template_wraps_special_tokens(self, tokenizer):
        # 模板渲染 ≠ 裸 tokenizer：它包上了 system/user/assistant 等特殊 token
        text = render_chat(tokenizer, MESSAGES)
        raw = tokenizer.decode(tokenizer("你好", add_special_tokens=False)["input_ids"])
        assert text != raw
        assert "<|im_start|>system" in text
        assert "你好" in text

    def test_template_token_count_larger_than_plain_text(self, tokenizer):
        text = render_chat(tokenizer, MESSAGES)
        n_template = len(tokenizer(text, add_special_tokens=False)["input_ids"])
        n_plain = len(tokenizer("你好", add_special_tokens=False)["input_ids"])
        assert n_template > n_plain


class TestShowTemplate:
    def test_prints_messages_and_token_ids(self, tokenizer, capsys):
        show_template(tokenizer, MESSAGES)
        out = capsys.readouterr().out
        assert "<|im_start|>user" in out
        assert "你好" in out
        assert any(ch.isdigit() for ch in out)
