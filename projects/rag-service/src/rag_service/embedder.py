"""Embedding：BGE 中文向量（transformers 实现，无需 sentence-transformers）。

细节：
- BGE 检索模型建议给【查询】加指令前缀，文档侧不加；
- mean pooling 时用 attention_mask 加权；
- L2 归一化后，内积 = 余弦相似度。
"""
from __future__ import annotations

import logging

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

logger = logging.getLogger(__name__)

QUERY_INSTRUCTION = "为这个句子生成表示以用于检索相关文章："


class Embedder:
    def __init__(self, model_name: str = "BAAI/bge-small-zh-v1.5", device: str = "cpu", batch_size: int = 32):
        self.model_name = model_name
        self.device = device
        self.batch_size = batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(device).eval()
        self.dim = self.model.config.hidden_size
        logger.info("Embedder 就绪：%s（%d 维）", model_name, self.dim)

    @torch.no_grad()
    def _encode_batch(self, texts: list[str]) -> np.ndarray:
        batch = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=512)
        batch = {k: v.to(self.device) for k, v in batch.items()}
        out = self.model(**batch)
        mask = batch["attention_mask"].unsqueeze(-1).float()
        pooled = (out.last_hidden_state * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
        pooled = torch.nn.functional.normalize(pooled, p=2, dim=1)
        return pooled.cpu().numpy().astype("float32")

    def encode(self, texts: list[str], is_query: bool = False) -> np.ndarray:
        if is_query:
            texts = [QUERY_INSTRUCTION + t for t in texts]
        vectors = []
        for i in range(0, len(texts), self.batch_size):
            vectors.append(self._encode_batch(texts[i:i + self.batch_size]))
            if len(texts) > self.batch_size and (i // self.batch_size) % 10 == 0:
                logger.info("embedding 进度：%d/%d", min(i + self.batch_size, len(texts)), len(texts))
        return np.vstack(vectors) if vectors else np.zeros((0, self.dim), dtype="float32")

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
