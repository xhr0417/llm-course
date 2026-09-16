"""Chat Template 渲染与批量生成（decoder-only 使用 left padding）。"""
from __future__ import annotations

import torch

Message = dict


def render_chat(tokenizer, messages: list[Message], add_generation_prompt: bool = True) -> str:
    """用模型自带模板把 messages 渲染成一段文本。"""
    return tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=add_generation_prompt
    )


def show_template(tokenizer, messages: list[Message]) -> None:
    """把模板渲染过程打印出来：messages → 文本 → token ids（前 40 个）。"""
    text = render_chat(tokenizer, messages)
    ids = tokenizer(text, add_special_tokens=False)["input_ids"]
    print("messages:")
    for m in messages:
        print(f"  {m['role']:9s} | {m['content'][:60]}")
    print("\n渲染后文本:")
    print(repr(text))
    print(f"\ntoken 数: {len(ids)} | 前 40 个 ids: {ids[:40]}")


def batch_generate(tokenizer, model, prompts: list[str], max_new_tokens: int = 64) -> list[str]:
    """批量生成：左侧 padding（decoder-only 推理惯例）。"""
    tokenizer.padding_side = "left"
    chats = [render_chat(tokenizer, [{"role": "user", "content": p}]) for p in prompts]
    batch = tokenizer(chats, return_tensors="pt", padding=True, truncation=True, max_length=512)
    batch = {k: v.to(model.device) for k, v in batch.items()}
    with torch.no_grad():
        output = model.generate(
            **batch,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id,
        )
    generated = output[:, batch["input_ids"].shape[1]:]
    return tokenizer.batch_decode(generated, skip_special_tokens=True)
