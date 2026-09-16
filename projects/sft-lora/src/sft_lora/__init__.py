"""sft_lora —— Capstone 3：真实 SFT / LoRA 实验。"""
from sft_lora.config import SFTConfig, load_config
from sft_lora.data import build_example, load_messages, make_collate
from sft_lora.model import apply_lora, load_base_model, merge_adapter
from sft_lora.train import train
from sft_lora.evaluate import eval_loss, generate_answers
from sft_lora.report import build_experiment_md, write_losses_csv

__all__ = [
    "SFTConfig", "load_config",
    "load_messages", "build_example", "make_collate",
    "load_base_model", "apply_lora", "merge_adapter",
    "train", "eval_loss", "generate_answers",
    "build_experiment_md", "write_losses_csv",
]
__version__ = "0.1.0"
