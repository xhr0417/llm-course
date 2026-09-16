"""模型与 Tokenizer 加载（starter：待实现）。

Step 1：load_tokenizer
Step 3：load_model
Step 10：load_adapter
"""
from __future__ import annotations

import logging

import torch

logger = logging.getLogger(__name__)

_DTYPES = {"float32": torch.float32, "float16": torch.float16, "bfloat16": torch.bfloat16}


def load_tokenizer(model_name: str):
    """Step 1：加载 tokenizer；没有 pad_token 时用 eos_token 兜底，并打印 vocab/pad。"""
    raise NotImplementedError("Step 1：实现 load_tokenizer（提示：AutoTokenizer + pad_token 兜底）")


def load_model(model_name: str, dtype: str = "float32", device: str = "cpu"):
    """Step 3：按 dtype/device 加载模型，切到 eval()，并打印参数量。"""
    raise NotImplementedError("Step 3：实现 load_model（提示：_DTYPES 映射 + model.to(device) + eval）")


def load_adapter(base_model, adapter_dir):
    """Step 10：在 base_model 上加载 LoRA adapter，返回 PeftModel。

    注意：PEFT 是就地注入——PeftModel.from_pretrained 会改造传入的 base_model。
    """
    raise NotImplementedError("Step 10：实现 load_adapter（提示：PeftModel.from_pretrained）")
