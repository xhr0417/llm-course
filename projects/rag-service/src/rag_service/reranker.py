"""Reranker：cross-encoder 精排（bi-encoder vs cross-encoder 的区别见第 28 章 6.7）。

Bi-encoder（embedding）：query/doc 分别编码 → 内积；快，但交互弱。
Cross-encoder（reranker）：把 (query, doc) 拼接后一起过模型；慢但准，用于精排 top-50 → top-5。
"""
from __future__ import annotations

import logging

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

logger = logging.getLogger(__name__)


class CrossEncoderReranker:
    def __init__(self, model_name: str = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1",
                 device: str = "cpu", batch_size: int = 8, max_length: int = 512):
        self.device = device
        self.batch_size = batch_size
        self.max_length = max_length
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name).to(device).eval()
        logger.info("Reranker 就绪：%s", model_name)

    @torch.no_grad()
    def score(self, query: str, passages: list[str]) -> list[float]:
        scores: list[float] = []
        for i in range(0, len(passages), self.batch_size):
            batch = passages[i:i + self.batch_size]
            enc = self.tokenizer([(query, p) for p in batch], return_tensors="pt",
                                 padding=True, truncation=True, max_length=self.max_length)
            enc = {k: v.to(self.device) for k, v in enc.items()}
            logits = self.model(**enc).logits.squeeze(-1)
            scores.extend(torch.sigmoid(logits).tolist())
        return scores

    def rerank(self, query: str, candidates: list[tuple[int, str]], top_n: int) -> list[tuple[int, float]]:
        """candidates: [(doc_idx, text)]；返回 [(doc_idx, score)] 取前 top_n。"""
        if not candidates:
            return []
        scores = self.score(query, [text for _, text in candidates])
        ranked = sorted(zip([idx for idx, _ in candidates], scores), key=lambda x: -x[1])
        return ranked[:top_n]
