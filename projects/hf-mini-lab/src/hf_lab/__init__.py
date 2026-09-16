"""hf_lab —— HuggingFace for LLM Engineering 配套实验包。"""
from hf_lab.config import LabConfig, load_config
from hf_lab.loading import load_model, load_tokenizer
from hf_lab.chat import batch_generate, render_chat, show_template
from hf_lab.data import build_labels, load_jsonl, split_dataset

__all__ = [
    "LabConfig", "load_config",
    "load_model", "load_tokenizer",
    "render_chat", "batch_generate", "show_template",
    "load_jsonl", "split_dataset", "build_labels",
]
__version__ = "0.1.0"
