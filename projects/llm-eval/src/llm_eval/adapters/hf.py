"""HuggingFaceAdapter：本地模型（连接第 26 章）。"""
from __future__ import annotations

import logging

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from llm_eval.adapters.base import ModelAdapter

logger = logging.getLogger(__name__)


class HuggingFaceAdapter(ModelAdapter):
    def __init__(self, model_name: str, max_new_tokens: int = 16, temperature: float = 0.0,
                 dtype: str = "float32", device: str = "cpu", batch_size: int = 4,
                 peft_adapter: str | None = None):
        self.name = f"hf:{model_name}" + (f"+peft:{peft_adapter}" if peft_adapter else "")
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        self.batch_size = batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "left"
        torch_dtype = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}.get(dtype, torch.float32)
        self.model = AutoModelForCausalLM.from_pretrained(model_name, dtype=torch_dtype).to(device)
        if peft_adapter:
            from peft import PeftModel
            self.model = PeftModel.from_pretrained(self.model, peft_adapter)
            logger.info("已加载 LoRA adapter：%s", peft_adapter)
        self.model.eval()
        n_params = sum(p.numel() for p in self.model.parameters())
        n_trainable = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        logger.info("HF adapter 就绪：%s（%.1fM 参数，可训练 %.3fM）",
                    model_name, n_params / 1e6, n_trainable / 1e6)

    def _generate_batch(self, prompts: list[str]) -> list[str]:
        chats = [
            self.tokenizer.apply_chat_template([{"role": "user", "content": p}],
                                               tokenize=False, add_generation_prompt=True)
            for p in prompts
        ]
        batch = self.tokenizer(chats, return_tensors="pt", padding=True, truncation=True, max_length=1024)
        batch = {k: v.to(self.model.device) for k, v in batch.items()}
        gen_kwargs = dict(max_new_tokens=self.max_new_tokens, pad_token_id=self.tokenizer.pad_token_id)
        if self.temperature and self.temperature > 0:
            gen_kwargs.update(do_sample=True, temperature=self.temperature)
        else:
            gen_kwargs.update(do_sample=False)
        with torch.no_grad():
            out = self.model.generate(**batch, **gen_kwargs)
        new_tokens = out[:, batch["input_ids"].shape[1]:]
        return self.tokenizer.batch_decode(new_tokens, skip_special_tokens=True)

    def generate(self, prompts: list[str]) -> list[str]:
        results: list[str] = []
        for i in range(0, len(prompts), self.batch_size):
            chunk = prompts[i:i + self.batch_size]
            results.extend(self._generate_batch(chunk))
            logger.info("HF 生成进度：%d/%d", min(i + self.batch_size, len(prompts)), len(prompts))
        return results
