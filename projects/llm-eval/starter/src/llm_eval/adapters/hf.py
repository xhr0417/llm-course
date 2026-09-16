"""HuggingFaceAdapter：本地模型（连接第 26 章）。

这是 starter 的【待实现文件】：
- Step 7：实现 __init__ / _generate_batch / generate

要求（每个都是真实踩过的坑）：
1. 用 tokenizer.apply_chat_template([{"role": "user", "content": p}],
   tokenize=False, add_generation_prompt=True) 构造输入；
2. tokenizer.padding_side = "left"（batch 生成必须左 padding，否则短序列续写会错位）；
   pad_token 为空时设为 eos_token；
3. 按 batch_size 分块，逐块 generate，只 decode 新生成的 token（skip_special_tokens=True）；
4. self.name = f"hf:{model_name}"（缓存 key 会用到；挂 LoRA 时后缀 "+peft:{path}"）。

需要额外安装：pip install transformers torch
"""
from __future__ import annotations

from llm_eval.adapters.base import ModelAdapter


class HuggingFaceAdapter(ModelAdapter):
    name = "hf"

    def __init__(self, model_name: str, max_new_tokens: int = 16, temperature: float = 0.0,
                 dtype: str = "float32", device: str = "cpu", batch_size: int = 4,
                 peft_adapter: str | None = None):
        """Step 7：加载 tokenizer 与 model，设置 name / padding_side / pad_token。"""
        raise NotImplementedError("Step 7：实现 HuggingFaceAdapter.__init__（AutoTokenizer + AutoModelForCausalLM）")

    def _generate_batch(self, prompts: list[str]) -> list[str]:
        """Step 7：单个 batch：chat template → tokenize(padding=True) → generate → decode。"""
        raise NotImplementedError("Step 7：实现 _generate_batch（chat template + 左 padding + 只 decode 新 token）")

    def generate(self, prompts: list[str]) -> list[str]:
        """Step 7：按 batch_size 分块调用 _generate_batch，拼接结果。"""
        raise NotImplementedError("Step 7：实现 generate（按 batch_size 分块）")
