"""检索评测指标（doc 级二值相关）——定义严格遵守信息检索标准。

- Hit@k      ：top-k 中是否命中至少一个相关文档        （Success@k）
- Recall@k   ：top-k 命中相关文档数 / 相关文档总数      （macro average）
- MRR        ：第一个相关文档排名的倒数（只看 first relevant）
- nDCG@k     ：DCG@k / IDCG@k，二值增益，计入【所有】相关文档

纪律：所有指标都在【document ranking】上计算——chunk 级结果必须先按 doc_id
去重（保留首次出现的 rank），否则同一文档的多个 chunk 会污染排名。
"""
from __future__ import annotations

import math
from typing import Iterable, Sequence


def collapse_to_docs(doc_ids: Sequence[str]) -> list[str]:
    """chunk 排名 → document 排名：按 doc_id 去重，保留第一次出现的顺序。"""
    seen: set[str] = set()
    docs: list[str] = []
    for doc_id in doc_ids:
        if doc_id in seen:
            continue
        seen.add(doc_id)
        docs.append(doc_id)
    return docs


def hit_at_k(ranked_docs: Sequence[str], gold: Iterable[str], k: int) -> float:
    gold_set = set(gold)
    return 1.0 if any(doc in gold_set for doc in ranked_docs[:k]) else 0.0


def recall_at_k(ranked_docs: Sequence[str], gold: Iterable[str], k: int) -> float:
    gold_set = set(gold)
    if not gold_set:
        return 0.0
    hits = len({doc for doc in ranked_docs[:k] if doc in gold_set})
    return hits / len(gold_set)


def reciprocal_rank(ranked_docs: Sequence[str], gold: Iterable[str]) -> float:
    gold_set = set(gold)
    for rank, doc in enumerate(ranked_docs, start=1):
        if doc in gold_set:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(ranked_docs: Sequence[str], gold: Iterable[str], k: int) -> float:
    """二值相关 nDCG@k：DCG 计入 top-k 中所有相关文档；IDCG 按 |gold| 理想排序。"""
    gold_set = set(gold)
    if not gold_set:
        return 0.0
    dcg = 0.0
    for rank, doc in enumerate(ranked_docs[:k], start=1):
        if doc in gold_set:
            dcg += 1.0 / math.log2(rank + 1)
    ideal_hits = min(k, len(gold_set))
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0


def evaluate_ranking(ranked_docs: Sequence[str], gold: Iterable[str], k: int) -> dict:
    return {
        "hit@k": hit_at_k(ranked_docs, gold, k),
        "recall@k": recall_at_k(ranked_docs, gold, k),
        "mrr": reciprocal_rank(ranked_docs, gold),
        "ndcg@k": ndcg_at_k(ranked_docs, gold, k),
    }


def macro_average(per_query: list[dict]) -> dict:
    """对 query 级指标取算术平均（仅统计数值字段）。"""
    if not per_query:
        return {"hit@k": 0.0, "recall@k": 0.0, "mrr": 0.0, "ndcg@k": 0.0}
    keys = [key for key, value in per_query[0].items() if isinstance(value, (int, float))]
    return {key: sum(row[key] for row in per_query) / len(per_query) for key in keys}
