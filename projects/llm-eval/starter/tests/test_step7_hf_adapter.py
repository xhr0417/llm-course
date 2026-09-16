"""Step 7 · HuggingFaceAdapter：本地真实模型（连接第 26 章）。

目标：让这 2 个测试变绿。

前置条件：
    pip install transformers torch
用 tiny 随机模型，CPU 几秒跑完；模型依赖缺失时自动 skip。

RUN_MODEL_TESTS=0 可整体关闭模型相关测试（CI 用）。
"""
from __future__ import annotations

import pytest

from conftest import RUN_MODEL_TESTS

pytestmark = pytest.mark.skipif(not RUN_MODEL_TESTS, reason="模型依赖测试（设置 RUN_MODEL_TESTS=1 运行）")

pytest.importorskip("transformers")

from llm_eval.adapters.hf import HuggingFaceAdapter  # noqa: E402

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"


class TestHuggingFaceAdapter:
    def test_name_and_single_generate(self):
        adapter = HuggingFaceAdapter(TINY_MODEL, max_new_tokens=4)
        assert adapter.name.startswith("hf:")
        out = adapter.generate(["你好"])
        assert len(out) == 1
        assert isinstance(out[0], str)
        assert out[0].strip() != ""

    def test_batch_with_left_padding(self):
        adapter = HuggingFaceAdapter(TINY_MODEL, max_new_tokens=4, batch_size=2)
        assert adapter.tokenizer.padding_side == "left"
        out = adapter.generate(["你好", "请用一句话介绍你自己，尽量具体一些"])
        assert len(out) == 2
        assert all(isinstance(s, str) for s in out)
