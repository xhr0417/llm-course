"""RAGPipeline：检索 → 融合 → 精排 → 生成（带引用与耗时统计）。"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterator, Optional

import numpy as np

from rag_service.bm25 import BM25
from rag_service.chunking import Chunk, build_chunks, load_documents
from rag_service.config import RAGConfig
from rag_service.embedder import Embedder
from rag_service.fusion import rrf_fuse, top_indices, weighted_fuse
from rag_service.reranker import CrossEncoderReranker
from rag_service.vector_index import VectorIndex

logger = logging.getLogger(__name__)

GeneratorFn = Callable[[str, list[str]], str]
CITATION_RE = re.compile(r"\[(\d+)\]")


@dataclass
class ScoredChunk:
    chunk: Chunk
    score: float
    stage: str
    bm25_score: float = 0.0
    dense_score: float = 0.0
    rerank_score: float = 0.0

    def to_dict(self, snippet_len: int = 160) -> dict:
        return {
            "chunk_id": self.chunk.id,
            "doc_id": self.chunk.doc_id,
            "score": round(self.score, 4),
            "stage": self.stage,
            "bm25_score": round(self.bm25_score, 4),
            "dense_score": round(self.dense_score, 4),
            "rerank_score": round(self.rerank_score, 4),
            "snippet": self.chunk.text[:snippet_len].replace("\n", " "),
        }


@dataclass
class RAGAnswer:
    question: str
    answer: str
    contexts: list[ScoredChunk] = field(default_factory=list)
    citations: list[int] = field(default_factory=list)
    timings_ms: dict[str, float] = field(default_factory=dict)
    retrieval_scores: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "question": self.question,
            "answer": self.answer,
            "citations": self.citations,
            "sources": [c.to_dict() for c in self.contexts],
            "latency_ms": {k: round(v, 1) for k, v in self.timings_ms.items()},
        }


class RAGPipeline:
    def __init__(self, cfg: RAGConfig, generator: Optional[GeneratorFn] = None,
                 embedder: Optional[Embedder] = None, reranker: Optional[CrossEncoderReranker] = None):
        self.cfg = cfg
        self.chunks: list[Chunk] = []
        self.bm25 = BM25()
        self.index: Optional[VectorIndex] = None
        self.embedder = embedder
        self.reranker = reranker
        self._generator = generator
        self._doc_count = 0

    # ---------------- 索引 ----------------
    def ingest(self, force: bool = False) -> dict:
        cfg = self.cfg
        index_dir = Path(cfg.index_dir)
        meta_path = index_dir / "meta.json"
        fingerprint = {
            "corpus_dir": str(Path(cfg.corpus_dir).resolve()),
            "strategy": cfg.chunk_strategy, "size": cfg.chunk_size, "overlap": cfg.chunk_overlap,
            "embed_model": cfg.embed_model,
        }
        if not force and meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta.get("fingerprint") == fingerprint:
                self._load_index(index_dir)
                logger.info("索引缓存命中：%d docs / %d chunks", self._doc_count, len(self.chunks))
                return {"docs": self._doc_count, "chunks": len(self.chunks), "cached": True}

        docs = load_documents(Path(cfg.corpus_dir))
        self.chunks = build_chunks(docs, cfg.chunk_strategy, cfg.chunk_size, cfg.chunk_overlap)
        self._doc_count = len(docs)
        logger.info("载入 %d 篇文档 → %d 个 chunk", self._doc_count, len(self.chunks))

        self.bm25.fit([c.text for c in self.chunks])

        if self.embedder is None:
            self.embedder = Embedder(cfg.embed_model)
        vectors = self.embedder.encode([c.text for c in self.chunks])
        self.index = VectorIndex(vectors.shape[1])
        self.index.add(vectors)

        index_dir.mkdir(parents=True, exist_ok=True)
        with (index_dir / "chunks.jsonl").open("w", encoding="utf-8") as f:
            for c in self.chunks:
                f.write(json.dumps({"id": c.id, "doc_id": c.doc_id, "text": c.text,
                                    "start": c.start, "end": c.end}, ensure_ascii=False) + "\n")
        np.save(index_dir / "embeddings.npy", vectors)
        meta_path.write_text(json.dumps({"fingerprint": fingerprint, "docs": self._doc_count,
                                         "chunks": len(self.chunks)}, ensure_ascii=False, indent=2),
                             encoding="utf-8")
        logger.info("索引已缓存到 %s", index_dir)
        return {"docs": self._doc_count, "chunks": len(self.chunks), "cached": False}

    def _load_index(self, index_dir: Path) -> None:
        self.chunks = []
        with (index_dir / "chunks.jsonl").open(encoding="utf-8") as f:
            for line in f:
                row = json.loads(line)
                self.chunks.append(Chunk(**row))
        self.bm25.fit([c.text for c in self.chunks])
        if self.embedder is None:
            self.embedder = Embedder(self.cfg.embed_model)
        vectors = np.load(index_dir / "embeddings.npy")
        self.index = VectorIndex(vectors.shape[1])
        self.index.add(vectors)

    # ---------------- 检索 ----------------
    def retrieve(self, query: str, k: Optional[int] = None, mode: str = "hybrid") -> list[ScoredChunk]:
        k = k or self.cfg.retrieve_k
        bm25_scores = self.bm25.score(query)
        bm25_top = top_indices(bm25_scores, k)

        dense_scores: list[float] = []
        dense_top: list[int] = []
        if mode in ("dense", "hybrid"):
            qv = self.embedder.encode([query], is_query=True)[0]
            sims, idxs = self.index.search(qv, min(k, len(self.chunks)))
            dense_scores = np.zeros(len(self.chunks), dtype="float32")
            for s, i in zip(sims, idxs):
                dense_scores[i] = s
            dense_top = list(idxs)

        order: list[int]
        if mode == "bm25":
            order = bm25_top
            score_map = {i: float(bm25_scores[i]) for i in order}
        elif mode == "dense":
            order = dense_top
            score_map = {i: float(dense_scores[i]) for i in order}
        elif mode == "hybrid":
            if self.cfg.fusion == "weighted":
                fused = weighted_fuse([list(bm25_scores), list(dense_scores)],
                                      [self.cfg.bm25_weight, 1 - self.cfg.bm25_weight])
                order = top_indices(fused, k)
                score_map = {i: float(fused[i]) for i in order}
            else:
                fused = rrf_fuse([bm25_top, dense_top])
                order = top_indices(fused, k)
                score_map = fused
        else:
            raise ValueError(f"未知检索模式：{mode}")

        chunks = []
        for i in order:
            chunks.append(ScoredChunk(chunk=self.chunks[i], score=score_map.get(i, 0.0),
                                      stage=mode, bm25_score=float(bm25_scores[i]),
                                      dense_score=float(dense_scores[i]) if len(dense_scores) else 0.0))
        return chunks

    def rerank(self, query: str, candidates: list[ScoredChunk], top_n: int) -> list[ScoredChunk]:
        if self.reranker is None:
            self.reranker = CrossEncoderReranker(self.cfg.rerank_model)
        reranked = self.reranker.rerank(query, [(i, c.chunk.text) for i, c in enumerate(candidates)], top_n)
        out = []
        for i, score in reranked:
            c = candidates[i]
            c.rerank_score = score
            c.score = score
            c.stage = "rerank"
            out.append(c)
        return out

    # ---------------- 生成 ----------------
    def _get_generator(self) -> GeneratorFn:
        if self._generator is None:
            gen = self._ensure_qwen()
            self._generator = lambda q, ctx: gen.generate(q, ctx)
        return self._generator

    def _ensure_qwen(self):
        if getattr(self, "_qwen", None) is None:
            from rag_service.llm import QwenGenerator
            self._qwen = QwenGenerator(self.cfg.llm_model, max_new_tokens=self.cfg.max_new_tokens)
        return self._qwen

    def answer(self, question: str, mode: str = "hybrid", top_k: Optional[int] = None,
               top_n: Optional[int] = None, use_rerank: bool = True) -> RAGAnswer:
        t0 = time.time()
        top_k = top_k or self.cfg.retrieve_k
        top_n = top_n or self.cfg.final_k

        t = time.time()
        candidates = self.retrieve(question, k=top_k, mode=mode)
        retrieve_ms = (time.time() - t) * 1000

        rerank_ms = 0.0
        if use_rerank and candidates:
            t = time.time()
            contexts = self.rerank(question, candidates, top_n)
            rerank_ms = (time.time() - t) * 1000
        else:
            contexts = candidates[:top_n]

        t = time.time()
        answer_text = self._get_generator()(question, [c.chunk.text for c in contexts])
        generate_ms = (time.time() - t) * 1000

        citations = sorted({int(m) for m in CITATION_RE.findall(answer_text)})
        citations = [c for c in citations if 1 <= c <= len(contexts)]
        return RAGAnswer(
            question=question, answer=answer_text, contexts=contexts, citations=citations,
            timings_ms={"retrieve": retrieve_ms, "rerank": rerank_ms, "generate": generate_ms,
                        "total": (time.time() - t0) * 1000},
            retrieval_scores=[c.to_dict() for c in candidates[:10]],
        )

    def prepare_contexts(self, question: str, mode: str = "hybrid", top_k: Optional[int] = None,
                         top_n: Optional[int] = None, use_rerank: bool = True) -> list[ScoredChunk]:
        """检索 + 精排，返回最终注入 prompt 的段落（供流式接口复用）。"""
        top_k = top_k or self.cfg.retrieve_k
        top_n = top_n or self.cfg.final_k
        candidates = self.retrieve(question, k=top_k, mode=mode)
        if use_rerank and candidates:
            return self.rerank(question, candidates, top_n)
        return candidates[:top_n]

    def answer_stream(self, question: str, mode: str = "hybrid", top_k: Optional[int] = None,
                      top_n: Optional[int] = None, use_rerank: bool = True):
        """生成器：先 yield ("sources", [...])，再逐段 yield ("token", text)。"""
        contexts = self.prepare_contexts(question, mode=mode, top_k=top_k, top_n=top_n, use_rerank=use_rerank)
        yield ("sources", [c.to_dict() for c in contexts])
        if self._generator is not None:
            yield ("token", self._generator(question, [c.chunk.text for c in contexts]) + "\n")
            return
        qwen = self._ensure_qwen()
        for token in qwen.stream(question, [c.chunk.text for c in contexts]):
            yield ("token", token)
