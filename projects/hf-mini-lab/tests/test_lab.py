"""pytest：tokenizer / chat template / response-only mask / LoRA / adapter 往返。

说明：需要能访问 HuggingFace（首次运行会下载 tiny 模型；之后走本地缓存）。
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from hf_lab.chat import batch_generate, render_chat  # noqa: E402
from hf_lab.config import load_config  # noqa: E402
from hf_lab.data import build_labels, load_jsonl, split_dataset  # noqa: E402
from hf_lab.loading import load_model, load_tokenizer  # noqa: E402
from hf_lab.train import make_lora_model  # noqa: E402

TINY_MODEL = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
DATA = PROJECT_ROOT / "data" / "sft_mini.jsonl"


@pytest.fixture(scope="module")
def tokenizer():
    return load_tokenizer(TINY_MODEL)


@pytest.fixture(scope="module")
def tiny_model():
    return load_model(TINY_MODEL, dtype="float32", device="cpu")


class TestTokenizerAndTemplate:
    def test_encode_decode_roundtrip(self, tokenizer):
        ids = tokenizer("你好，世界", add_special_tokens=False)["input_ids"]
        assert tokenizer.decode(ids) == "你好，世界"

    def test_chat_template_structure(self, tokenizer):
        text = render_chat(tokenizer, [{"role": "user", "content": "你好"}])
        assert "<|im_start|>user" in text
        assert text.rstrip().endswith("<|im_start|>assistant")

    def test_padding_side_left_for_generation(self, tokenizer):
        tokenizer.padding_side = "left"
        batch = tokenizer(["你好", "这是一个更长的句子"], return_tensors="pt", padding=True)
        assert batch["input_ids"][0][0].item() == tokenizer.pad_token_id


class TestData:
    def test_jsonl_has_split_field(self):
        rows = load_jsonl(DATA)
        assert len(rows) == 20
        assert {r["split"] for r in rows} == {"train", "eval"}

    def test_split_respects_field(self):
        train, eval_ = split_dataset(load_jsonl(DATA))
        assert len(train) == 16
        assert len(eval_) == 4

    def test_response_only_mask(self, tokenizer):
        messages = [
            {"role": "user", "content": "什么是过拟合？"},
            {"role": "assistant", "content": "过拟合是记住了训练噪声。"},
        ]
        ids, labels = build_labels(tokenizer, messages)
        assert len(ids) == len(labels)
        supervised = sum(1 for x in labels if x != -100)
        assert 0 < supervised < len(labels)
        assert labels[-1] != -100


class TestModelAndLora:
    def test_logits_shape(self, tokenizer, tiny_model):
        import torch

        enc = tokenizer.apply_chat_template(
            [{"role": "user", "content": "你好"}],
            tokenize=True, return_dict=True, return_tensors="pt",
        )
        with torch.no_grad():
            out = tiny_model(**enc)
        batch, seq, vocab = out.logits.shape
        assert batch == 1
        assert seq == enc["input_ids"].shape[1]
        # 模型输出维度是 config.vocab_size，可能因对齐被 pad 到 >= tokenizer 词表
        assert vocab >= tokenizer.vocab_size

    def test_batch_generate_returns_strings(self, tokenizer, tiny_model):
        answers = batch_generate(tokenizer, tiny_model, ["你好", "什么是学习率？"], max_new_tokens=4)
        assert len(answers) == 2
        assert all(isinstance(a, str) for a in answers)

    def test_lora_trainable_fraction(self, tiny_model):
        cfg = load_config(None, lora_r=4, target_modules=["q_proj", "v_proj"])
        peft_model = make_lora_model(tiny_model, cfg)
        trainable = sum(p.numel() for p in peft_model.parameters() if p.requires_grad)
        total = sum(p.numel() for p in peft_model.parameters())
        assert 0 < trainable < total * 0.10

    def test_adapter_save_reload_roundtrip(self, tiny_model, tmp_path):
        from peft import PeftModel

        cfg = load_config(None, lora_r=4, target_modules=["q_proj", "v_proj"])
        peft_model = make_lora_model(tiny_model, cfg)
        peft_model.save_pretrained(tmp_path)
        assert (tmp_path / "adapter_config.json").exists()
        fresh = load_model(TINY_MODEL, dtype="float32", device="cpu")
        reloaded = PeftModel.from_pretrained(fresh, tmp_path)
        assert isinstance(reloaded, PeftModel)
