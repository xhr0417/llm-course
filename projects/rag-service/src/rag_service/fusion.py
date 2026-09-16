"""融合：把 BM25 与向量的排名合成一个排序。

- RRF（Reciprocal Rank Fusion）：score = Σ 1/(k + rank)，只看排名，鲁棒、无需调权重；
- weighted：各自分数 min-max 归一化后加权求和（需要调权重）。
"""
from __future__ import annotations

import numpy as np


def rrf_fuse(rankings: list[list[int]], k: int = 60) -> dict[int, float]:
    """rankings: 每个检索器的有序 doc 下标列表。返回 {doc_idx: rrf_score}。"""
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, doc_idx in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    return scores


def weighted_fuse(score_lists: list[list[float]], weights: list[float]) -> list[float]:
    """分数 min-max 归一化后加权求和。"""
    merged = np.zeros(len(score_lists[0]), dtype="float64")
    for scores, weight in zip(score_lists, weights):
        s = np.asarray(scores, dtype="float64")
        lo, hi = s.min(), s.max()
        norm = (s - lo) / (hi - lo) if hi > lo else np.zeros_like(s)
        merged += weight * norm
    return merged.tolist()


def top_indices(scores: list[float] | dict[int, float], k: int) -> list[int]:
    if isinstance(scores, dict):
        return [i for i, _ in sorted(scores.items(), key=lambda kv: -kv[1])[:k]]
    return list(np.argsort(-np.asarray(scores))[:k])
