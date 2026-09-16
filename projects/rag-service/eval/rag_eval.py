"""RAG 评测：把「检索对不对」与「回答对不对」拆开，并对失败分类。

失败分类（第 28 章 6.10）：
    retrieval_miss    没检索到正确文档
    ignored_context   检索到了，但模型没有使用（回答「无法回答」）
    uncited_answer    回答了但没有标注引用
    ok                检索命中 + 有引用

用法：
    python eval/rag_eval.py --limit 6 --out eval/rag_results.jsonl
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from rag_service.config import load_config  # noqa: E402
from rag_service.pipeline import RAGPipeline  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="RAG 回答侧评测 + 失败分类")
    p.add_argument("--queries", type=Path, default=PROJECT_ROOT / "data" / "eval_queries.jsonl")
    p.add_argument("--limit", type=int, default=6)
    p.add_argument("--out", type=Path, default=PROJECT_ROOT / "eval" / "rag_results.jsonl")
    args = p.parse_args()

    cfg = load_config(PROJECT_ROOT / "configs" / "default.json")
    pipeline = RAGPipeline(cfg)
    pipeline.ingest()

    rows = [json.loads(l) for l in args.queries.read_text(encoding="utf-8").splitlines() if l.strip()]
    rows = rows[: args.limit]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    with out_path.open("w", encoding="utf-8") as f:
        for row in rows:
            result = pipeline.answer(row["query"])
            retrieved_docs = [c.chunk.doc_id for c in result.contexts]
            retrieval_hit = any(doc in row["gold_docs"] for doc in retrieved_docs)
            answer_stripped = re.sub(r"\[\d+\]", "", result.answer).strip()

            if not retrieval_hit and "无法回答" in result.answer:
                failure = "correct_refusal"
            elif not retrieval_hit:
                failure = "retrieval_miss"
            elif "无法回答" in result.answer:
                failure = "ignored_context"
            elif len(answer_stripped) < 15:
                failure = "citation_only"      # 只输出引用编号、没有实质回答
            elif not result.citations:
                failure = "uncited_answer"
            else:
                failure = "ok"
            counts[failure] = counts.get(failure, 0) + 1

            record = {
                "query": row["query"],
                "gold_docs": row["gold_docs"],
                "retrieval_hit": retrieval_hit,
                "retrieved_docs": retrieved_docs,
                "citations": result.citations,
                "answer": result.answer,
                "answer_len": len(answer_stripped),
                "latency_ms": {k: round(v, 1) for k, v in result.timings_ms.items()},
                "failure_type": failure,
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

            status = "✅" if failure == "ok" else ("➖" if failure == "correct_refusal" else "❌")
            print(f"{status} [{failure}] {row['query'][:30]}")
            print(f"    检索命中={retrieval_hit} 引用={result.citations} 用时={result.timings_ms['total']:.0f}ms")
            print(f"    回答：{result.answer[:100].replace(chr(10), ' ')}")

    print("\n失败分类统计：", json.dumps(counts, ensure_ascii=False))
    print(f"明细：{out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
