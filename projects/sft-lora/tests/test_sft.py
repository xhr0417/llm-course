"""pytest：数据 / 配置 / 调度 / 训练冒烟 / 评测 / merge / 报告。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from sft_lora.config import load_config  # noqa: E402
from sft_lora.data import build_example, load_messages, make_collate  # noqa: E402
from sft_lora.evaluate import classify_badcase, eval_loss, generate_answers  # noqa: E402
from sft_lora.model import apply_lora, load_base_model, load_tokenizer, merge_adapter  # noqa: E402
from sft_lora.report import build_experiment_md, write_losses_csv  # noqa: E402
from sft_lora.train import lr_at, train  # noqa: E402

TINY = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"
TRAIN = PROJECT_ROOT / "data" / "train.jsonl"
VAL = PROJECT_ROOT / "data" / "val.jsonl"
EVAL_QA = PROJECT_ROOT / "data" / "eval_qa.jsonl"


@pytest.fixture(scope="module")
def tokenizer():
    return load_tokenizer(TINY)


@pytest.fixture(scope="module")
def tiny_cfg():
    return load_config(None, base_model=TINY, max_steps=6, warmup_steps=2, val_every=3,
                       batch_size=2, grad_accum=1, max_length=128)


class TestData:
    def test_train_val_counts(self):
        assert len(load_messages(TRAIN)) == 48
        assert len(load_messages(VAL)) == 12

    def test_eval_qa_counts(self):
        rows = [json.loads(l) for l in EVAL_QA.read_text(encoding="utf-8").splitlines() if l.strip()]
        assert len(rows) == 20

    def test_eval_qa_format(self):
        rows = [json.loads(l) for l in EVAL_QA.read_text(encoding="utf-8").splitlines()]
        assert all(r["id"] and r["question"] and len(r["answers"]) >= 1 for r in rows)

    def test_response_only_mask(self, tokenizer):
        messages = [{"role": "user", "content": "什么是过拟合？"},
                    {"role": "assistant", "content": "过拟合是记住了训练噪声。"}]
        ids, labels = build_example(tokenizer, messages)
        assert len(ids) == len(labels)
        n_supervised = sum(1 for x in labels if x != -100)
        assert 0 < n_supervised < len(labels)
        assert labels[0] == -100 and labels[-1] != -100

    def test_build_example_accepts_batchencoding(self):
        """回归：新版 transformers 的 apply_chat_template(tokenize=True) 返回 BatchEncoding，
        旧代码会把它当 list 使用（CI 曾真实失败）。这里用假 tokenizer 模拟该行为。"""
        class FakeTokenizer:
            def apply_chat_template(self, messages, tokenize=True, add_generation_prompt=False):
                ids = [10, 11, 12, 20, 21, 22]
                prompt_len = 4 if add_generation_prompt else 3
                return {"input_ids": ids[:prompt_len] if add_generation_prompt else ids}

        ids, labels = build_example(FakeTokenizer(), [{"role": "user", "content": "x"},
                                                      {"role": "assistant", "content": "y"}])
        assert isinstance(ids, list) and isinstance(labels, list)
        assert len(ids) == len(labels) == 6
        assert sum(1 for x in labels if x != -100) == 2   # 只学回答（6-4）

    def test_collate_padding(self, tokenizer):
        collate = make_collate(tokenizer, max_length=64)
        samples = load_messages(TRAIN)[:2]
        batch = collate(samples)
        assert batch["input_ids"].shape == batch["labels"].shape == batch["attention_mask"].shape
        assert batch["input_ids"].shape[0] == 2
        assert (batch["attention_mask"] == 0).any() or batch["input_ids"].shape[1] == max(
            len(x) for x in [batch["input_ids"][0], batch["input_ids"][1]]
        )


class TestConfigAndSchedule:
    def test_effective_batch(self):
        cfg = load_config(None, batch_size=2, grad_accum=4)
        assert cfg.effective_batch == 8

    def test_json_roundtrip(self, tmp_path):
        cfg = load_config(None, max_steps=42)
        path = tmp_path / "cfg.json"
        cfg.save(path)
        assert load_config(path).max_steps == 42

    def test_lr_schedule_warmup_then_decay(self):
        cfg = load_config(None, learning_rate=1e-3, warmup_steps=10, max_steps=100)
        assert lr_at(0, cfg) == pytest.approx(1e-4)
        assert lr_at(9, cfg) == pytest.approx(1e-3)
        assert lr_at(50, cfg) < lr_at(30, cfg) < lr_at(10, cfg)
        assert lr_at(99, cfg) < 1e-4


class TestTrainSmoke:
    def test_train_records_logs_and_best_checkpoint(self, tokenizer, tiny_cfg, tmp_path):
        model = apply_lora(load_base_model(tiny_cfg), tiny_cfg)
        samples = load_messages(TRAIN)[:8]
        val = load_messages(VAL)[:3]
        log = train(tokenizer, model, samples, val, tiny_cfg, checkpoint_dir=tmp_path)
        assert len(log.steps) == tiny_cfg.max_steps
        assert all(row["grad_norm"] >= 0 for row in log.steps)
        assert len(log.val_losses) >= 1
        assert all(isinstance(row["val_loss"], float) for row in log.val_losses)
        assert log.best_step is not None
        assert log.best_val_loss == min(row["val_loss"] for row in log.val_losses)
        assert (tmp_path / "adapter_best" / "adapter_config.json").exists()


class TestEvaluateAndReport:
    def test_eval_loss_finite(self, tokenizer, tiny_cfg):
        model = load_base_model(tiny_cfg)
        value = eval_loss(model, tokenizer, load_messages(VAL)[:2], max_length=128)
        assert value > 0

    def test_generate_answers(self, tokenizer, tiny_cfg):
        model = load_base_model(tiny_cfg)
        answers = generate_answers(model, tokenizer, ["你好"], max_new_tokens=4)
        assert len(answers) == 1 and isinstance(answers[0], str)

    def test_classify_badcase(self):
        gold = ["过拟合是模型记住了训练噪声"]
        assert classify_badcase(gold, "过拟合是模型记住了训练噪声，泛化变差") == "ok"
        assert classify_badcase(gold, "根据已有资料无法回答") == "refusal"
        assert classify_badcase(gold, "今天天气不错") == "wrong"
        assert classify_badcase(gold, "") == "empty"
        assert classify_badcase(gold, "过拟合是") == "partial"

    def test_merge_adapter_tiny(self, tokenizer, tiny_cfg, tmp_path):
        model = apply_lora(load_base_model(tiny_cfg), tiny_cfg)
        adapter_dir = tmp_path / "adapter"
        model.save_pretrained(adapter_dir)
        assert (adapter_dir / "adapter_config.json").exists()
        merged_dir = merge_adapter(TINY, str(adapter_dir), str(tmp_path / "merged"), dtype="float32")
        assert (merged_dir / "config.json").exists()

    def test_report_sections(self, tokenizer, tiny_cfg, tmp_path):
        model = apply_lora(load_base_model(tiny_cfg), tiny_cfg)
        log = train(tokenizer, model, load_messages(TRAIN)[:4], load_messages(VAL)[:2], tiny_cfg)
        write_losses_csv(log, tmp_path / "losses.csv")
        assert (tmp_path / "losses.csv").exists()
        md = build_experiment_md(tiny_cfg, log, 5.0, 4.6, 4.5, 48, 12, [], None, 12.3, tmp_path / "adapter")
        for section in ["实验设置", "训练曲线", "评测对比", "Bad cases", "Limitations"]:
            assert section in md
        assert "Base / Best / Final" in md
        assert "best" in md
