"""LLM：RAG 生成器（Qwen2.5-0.5B-Instruct，CPU 可跑）。

Prompt 设计要点：
- 强制「只根据资料回答」+「句末标注引用编号」+「资料不足就说不知道」；
- 引用编号与上下文一一对应（[1]..[k]），便于服务端做 citation 校验。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "你是一个严谨的问答助手，根据给定资料回答问题。"
    "回答必须是一段完整的陈述文字，不允许只输出编号。"
    "在关键句的末尾用 [编号] 标注来源。"
    "若资料不足，回答：根据已有资料无法回答。"
)


def build_rag_prompt(question: str, contexts: list[str]) -> str:
    blocks = [f"[{i + 1}] {ctx}" for i, ctx in enumerate(contexts)]
    return (f"【资料】\n" + "\n\n".join(blocks) +
            f"\n\n【问题】{question}\n"
            f"\n按照格式回答（必须在『回答：』后面写出完整内容）：\n"
            f"回答：<完整回答内容，关键句末尾带 [编号]>\n"
            f"引用：[编号列表]")


@dataclass
class GenerationResult:
    text: str
    latency_ms: float


class QwenGenerator:
    def __init__(self, model_name: str = "Qwen/Qwen2.5-0.5B-Instruct", device: str = "cpu",
                 max_new_tokens: int = 256, dtype: str = "float32"):
        torch_dtype = {"float32": torch.float32, "bfloat16": torch.bfloat16}.get(dtype, torch.float32)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(model_name, dtype=torch_dtype).to(device).eval()
        self.max_new_tokens = max_new_tokens
        logger.info("LLM 就绪：%s", model_name)

    def _chat_text(self, question: str, contexts: list[str]) -> str:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_rag_prompt(question, contexts)},
        ]
        return self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    def generate(self, question: str, contexts: list[str]) -> str:
        import time
        t0 = time.time()
        enc = self.tokenizer(self._chat_text(question, contexts), return_tensors="pt").to(self.model.device)
        with torch.no_grad():
            out = self.model.generate(**enc, max_new_tokens=self.max_new_tokens,
                                      do_sample=False, pad_token_id=self.tokenizer.pad_token_id)
        text = self.tokenizer.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True)
        logger.info("生成完成：%.0f ms", (time.time() - t0) * 1000)
        return text.strip()

    def stream(self, question: str, contexts: list[str]):
        """token 级流式生成（SSE 服务用）。"""
        import threading
        enc = self.tokenizer(self._chat_text(question, contexts), return_tensors="pt").to(self.model.device)
        streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
        kwargs = dict(**enc, max_new_tokens=self.max_new_tokens, do_sample=False,
                      pad_token_id=self.tokenizer.pad_token_id, streamer=streamer)
        thread = threading.Thread(target=self.model.generate, kwargs=kwargs)
        thread.start()
        for token in streamer:
            yield token
        thread.join()
