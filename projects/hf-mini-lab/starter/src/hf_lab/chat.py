"""Chat Template 渲染与批量生成（starter：待实现）。

Step 2：render_chat / show_template
Step 4：next_token_logits
Step 5：batch_generate
"""
from __future__ import annotations

import torch

Message = dict


def render_chat(tokenizer, messages: list[Message], add_generation_prompt: bool = True) -> str:
    """Step 2：用模型自带模板把 messages 渲染成一段文本（tokenize=False）。"""
    raise NotImplementedError("Step 2：实现 render_chat（提示：apply_chat_template(tokenize=False)）")


def show_template(tokenizer, messages: list[Message]) -> None:
    """Step 2：打印 messages → 渲染后文本 → 前 40 个 token ids。"""
    raise NotImplementedError("Step 2：实现 show_template（提示：print render_chat 与 ids[:40]）")


def next_token_logits(tokenizer, model, messages: list[Message]) -> torch.Tensor:
    """Step 4：返回 shape (1, seq, vocab) 的 logits（连接第 9 章 GPT）。

    提示：apply_chat_template(tokenize=True, return_dict=True, return_tensors="pt")。
    """
    raise NotImplementedError("Step 4：实现 next_token_logits（提示：model(**enc).logits）")


def batch_generate(tokenizer, model, prompts: list[str], max_new_tokens: int = 64) -> list[str]:
    """Step 5：批量贪心生成；decoder-only 必须用 left padding，只解码新 token。"""
    raise NotImplementedError("Step 5：实现 batch_generate（提示：padding_side=left + 切片 output[:, input_len:]）")
