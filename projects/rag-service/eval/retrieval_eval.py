"""检索评测：Recall@k / MRR / nDCG@k（doc 级二值相关）。

把 retrieval quality 与 generation quality 拆开评估（第 28 章 6.8）——
这是 RAG 评测里最重要的一步：回答不好，先看检索对不对。

用法：
    python eval/retrieval_eval.py --modes bm25 dense hybrid --k 10
    python eval/retrieval_eval.py --rerank --out eval/retrieval_results_rerank.json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from rag_service.config import load_config  # noqa: E402
from rag_service.pipeline import RAGPipeline  # noqa: E402


def load_queries(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def evaluate_mode(pipeline: RAGPipeline, queries: list[dict], mode: str, k: int,
                  use_rerank: bool = False) -> dict:
    per_query = []
    for row in queries:
        if use_rerank:
            candidates = pipeline.retrieve(row["query"], k=pipeline.cfg.retrieve_k, mode=mode)
            top = pipeline.rerank(row["query"], candidates, k)
        else:
            top = pipeline.retrieve(row["query"], k=k, mode=mode)
        doc_rank = None
        for rank, item in enumerate(top, start=1):
            if item.chunk.doc_id in row["gold_docs"]:
                doc_rank = rank
                break
        per_query.append({
            "query": row["query"],
            "gold": row["gold_docs"],
            "hit_rank": doc_rank,
            "top_docs": [item.chunk.doc_id for item in top[:5]],
        })
    n = len(per_query)
    recall = sum(1 for q in per_query if q["hit_rank"] is not None) / n if n else 0.0
    mrr = sum(1.0 / q["hit_rank"] for q in per_query if q["hit_rank"]) / n if n else 0.0
    ndcg = 0.0
    for q in per_query:
        if q["hit_rank"]:
            ndcg += 1.0 / math.log2(q["hit_rank"] + 1)
    ndcg = ndcg / n if n else 0.0
    return {"mode": mode, "k": k, "n": n, "recall@k": recall, "mrr": mrr, "ndcg@k": ndcg,
            "per_query": per_query}


def main() -> int:
    p = argparse.ArgumentParser(description="检索评测：Recall@k / MRR / nDCG@k")
    p.add_argument("--queries", type=Path, default=PROJECT_ROOT / "data" / "eval_queries.jsonl")
    p.add_argument("--modes", nargs="+", default=["bm25", "dense", "hybrid"])
    p.add_argument("--k", type=int, default=10)
    p.add_argument("--rerank", action="store_true", help="在 hybrid 检索后加 cross-encoder 精排")
    p.add_argument("--out", type=Path, default=PROJECT_ROOT / "eval" / "retrieval_results.json")
    args = p.parse_args()

    cfg = load_config(PROJECT_ROOT / "configs" / "default.json")
    pipeline = RAGPipeline(cfg)
    pipeline.ingest()
    queries = load_queries(args.queries)

    results = []
    print(f"{'mode':>18s} | {'Recall@' + str(args.k):>10s} | {'MRR':>6s} | {'nDCG@' + str(args.k):>8s}")
    print("-" * 56)
    for mode in args.modes:
        label = mode + ("+rerank" if args.rerank else "")
        result = evaluate_mode(pipeline, queries, mode, args.k, use_rerank=args.rerank)
        results.append(result)
        print(f"{label:>18s} | {result['recall@k'] * 100:9.1f}% | {result['mrr']:.4f} | {result['ndcg@k']:.4f}")
        misses = [q for q in result["per_query"] if q["hit_rank"] is None]
        if misses:
            print(f"   未命中 {len(misses)} 条：")
            for q in misses[:5]:
                print(f"     - {q['query'][:36]}（gold={','.join(q['gold'])}，top={q['top_docs'][:3]}）")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n结果已写入 {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
