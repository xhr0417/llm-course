"""检索评测：Hit@k / Recall@k / MRR / nDCG@k（doc 级二值相关，macro average）。

定义与纪律（第 28 章 6.8 / 本轮 Correctness Pass）：
- chunk 排名必须先 collapse 成 document 排名（同 doc 的多个 chunk 只记首次 rank）；
- Recall@k 是多相关文档的分式命中（|R_k ∩ G| / |G|），不是「命中即 1」；
- Hit@k 才是「top-k 有没有命中至少一个」；
- nDCG@k 计入所有相关文档（不是只看第一条）。

用法：
    python eval/retrieval_eval.py --modes bm25 dense hybrid --k 10
    python eval/retrieval_eval.py --modes hybrid --rerank --k 10
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from rag_service.config import load_config  # noqa: E402
from rag_service.eval_metrics import collapse_to_docs, evaluate_ranking, macro_average  # noqa: E402
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
        chunk_docs = [item.chunk.doc_id for item in top]
        ranked_docs = collapse_to_docs(chunk_docs)
        metrics = evaluate_ranking(ranked_docs, row["gold_docs"], k)
        per_query.append({
            "query": row["query"],
            "gold": row["gold_docs"],
            "ranked_docs": ranked_docs[:10],
            **metrics,
        })
    avg = macro_average(per_query)
    return {"mode": mode, "k": k, "n": len(per_query), **avg, "per_query": per_query}


def main() -> int:
    p = argparse.ArgumentParser(description="检索评测：Hit@k / Recall@k / MRR / nDCG@k（doc 级）")
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
    print(f"{'mode':>18s} | {'Hit@' + str(args.k):>7s} | {'Recall@' + str(args.k):>10s} | "
          f"{'MRR':>6s} | {'nDCG@' + str(args.k):>8s}")
    print("-" * 68)
    for mode in args.modes:
        label = mode + ("+rerank" if args.rerank else "")
        result = evaluate_mode(pipeline, queries, mode, args.k, use_rerank=args.rerank)
        results.append(result)
        print(f"{label:>18s} | {result['hit@k'] * 100:6.1f}% | {result['recall@k'] * 100:9.1f}% | "
              f"{result['mrr']:.4f} | {result['ndcg@k']:.4f}")
        misses = [q for q in result["per_query"] if q["recall@k"] < 1.0]
        if misses:
            print(f"   Recall 未满分的 {len(misses)} 条：")
            for q in misses[:6]:
                found = len([d for d in q["ranked_docs"][:args.k] if d in set(q["gold"])])
                print(f"     - {q['query'][:34]}（命中 {found}/{len(q['gold'])}，top={q['ranked_docs'][:3]}）")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n结果已写入 {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
