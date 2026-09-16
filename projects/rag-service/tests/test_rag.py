"""pytest：chunking / BM25 / 向量索引 / 融合 / 真实模型 / pipeline / FastAPI。"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from rag_service.bm25 import BM25, tokenize  # noqa: E402
from rag_service.chunking import (build_chunks, chunk_fixed, chunk_recursive,  # noqa: E402
                                  chunk_sentences, load_documents)
from rag_service.config import load_config  # noqa: E402
from rag_service.embedder import Embedder  # noqa: E402
from rag_service.fusion import rrf_fuse, weighted_fuse  # noqa: E402
from rag_service.pipeline import RAGPipeline  # noqa: E402
from rag_service.reranker import CrossEncoderReranker  # noqa: E402
from rag_service.vector_index import VectorIndex  # noqa: E402

SAMPLE_DOCS = PROJECT_ROOT / "data" / "sample_docs"


class TestChunking:
    def test_fixed_sizes_and_overlap(self):
        text = "".join(f"{i:04d}" for i in range(50))  # 200 字符
        chunks = chunk_fixed(text, size=50, overlap=10)
        assert all(len(c) <= 50 for c, _, _ in chunks)
        assert chunks[0][0] == text[:50]
        assert chunks[1][0].startswith(text[40:50])  # overlap 保留前一块尾部

    def test_fixed_invalid_overlap(self):
        with pytest.raises(ValueError):
            chunk_fixed("abc", size=10, overlap=10)

    def test_sentence_keeps_sentences_whole(self):
        text = "第一句话。第二句话！第三句话？" * 20
        chunks = chunk_sentences(text, size=60)
        for seg, _, _ in chunks:
            assert seg.endswith(("。", "！", "？")) or seg == chunks[-1][0]

    def test_recursive_nonempty_and_covers(self):
        text = "# 标题\n\n第一段内容。\n\n第二段内容，包含更多细节。" * 30
        chunks = chunk_recursive(text, size=80, overlap=0)
        assert all(seg.strip() for seg, _, _ in chunks)
        assert sum(len(seg) for seg, _, _ in chunks) >= len(text) * 0.9

    def test_load_sample_docs(self):
        docs = load_documents(SAMPLE_DOCS)
        assert len(docs) == 3
        assert {d[0] for d in docs} == {"attention.md", "lora.md", "rag.md"}

    def test_build_chunks_ids_stable(self):
        docs = load_documents(SAMPLE_DOCS)
        chunks_a = build_chunks(docs, "recursive", 256, 32)
        chunks_b = build_chunks(docs, "recursive", 256, 32)
        assert [c.id for c in chunks_a] == [c.id for c in chunks_b]
        assert len({c.id for c in chunks_a}) == len(chunks_a)


class TestTokenizer:
    def test_chinese_word_tokens(self):
        tokens = tokenize("Multi-Head Attention 是多头注意力机制")
        assert "注意力" in tokens or "注意" in tokens
        assert any("attention" in t for t in tokens)


class TestBM25:
    CORPUS = ["注意力机制让模型关注上下文", "LoRA 只训练低秩矩阵", "BM25 是关键词检索算法"]

    def test_exact_term_ranking(self):
        bm = BM25().fit(self.CORPUS)
        scores = bm.score("低秩矩阵")
        assert scores[1] == max(scores)
        assert scores[0] == 0.0 and scores[2] == 0.0

    def test_no_match_returns_zeros(self):
        bm = BM25().fit(self.CORPUS)
        assert bm.score("完全不相关的词汇xyz") == [0.0, 0.0, 0.0]

    def test_rare_term_has_higher_idf(self):
        bm = BM25().fit(self.CORPUS + ["注意力"] * 5)
        assert bm.score("低秩")[1] > 0


class TestVectorIndex:
    def test_search_matches_bruteforce(self):
        rng = np.random.default_rng(0)
        vecs = rng.normal(size=(50, 16)).astype("float32")
        vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
        index = VectorIndex(16)
        index.add(vecs)
        q = rng.normal(size=16).astype("float32")
        q /= np.linalg.norm(q)
        _, idxs = index.search(q, 3)
        expect = np.argsort(-(vecs @ q))[:3]
        assert list(idxs) == list(expect)

    def test_identical_vector_score_one(self):
        vec = np.ones((1, 8), dtype="float32") / np.sqrt(8)
        index = VectorIndex(8)
        index.add(vec)
        scores, _ = index.search(vec[0], 1)
        assert scores[0] == pytest.approx(1.0, abs=1e-5)


class TestFusion:
    def test_rrf_favors_consensus(self):
        a = [0, 1, 2, 3]
        b = [1, 0, 3, 2]
        fused = rrf_fuse([a, b])
        top2 = sorted(fused, key=lambda k: -fused[k])[:2]
        assert set(top2) == {0, 1}  # 两路都排前面的文档胜出

    def test_weighted_normalizes(self):
        s1 = [0.0, 1.0, 2.0]
        s2 = [10.0, 5.0, 0.0]
        merged = weighted_fuse([s1, s2], [0.5, 0.5])
        assert len(merged) == 3
        assert max(merged) <= 1.0 + 1e-9


@pytest.fixture(scope="module")
def embedder():
    return Embedder("BAAI/bge-small-zh-v1.5")


class TestEmbedderReal:
    def test_related_closer_than_unrelated(self, embedder):
        q = embedder.encode(["LoRA 怎么微调大模型"], is_query=True)[0]
        d1 = embedder.encode(["LoRA 冻结原权重，只训练低秩矩阵 A 和 B"])[0]
        d2 = embedder.encode(["今天天气很好，适合出去散步"])[0]
        assert Embedder.cosine(q, d1) > Embedder.cosine(q, d2) + 0.1


@pytest.fixture(scope="module")
def reranker():
    return CrossEncoderReranker("cross-encoder/mmarco-mMiniLMv2-L12-H384-v1")


class TestRerankerReal:
    def test_relevant_pair_scores_higher(self, reranker):
        scores = reranker.score("什么是过拟合", [
            "过拟合是模型记住了训练数据的噪声，在新数据上表现变差。",
            "今天天气很好，适合出去散步。",
        ])
        assert scores[0] > scores[1] + 0.2


@pytest.fixture(scope="module")
def pipeline(tmp_path_factory, embedder, reranker):
    cfg = load_config(PROJECT_ROOT / "configs" / "default.json",
                      corpus_dir=str(SAMPLE_DOCS),
                      index_dir=str(tmp_path_factory.mktemp("index")),
                      retrieve_k=10, final_k=3)
    fake_gen = lambda q, ctx: "根据资料，LoRA 的可训练参数约为总参数的 0.1% [1]。"
    p = RAGPipeline(cfg, generator=fake_gen, embedder=embedder, reranker=reranker)
    p.ingest()
    return p


class TestPipeline:
    def test_ingest_sample_corpus(self, pipeline):
        assert pipeline._doc_count == 3
        assert len(pipeline.chunks) >= 3

    def test_hybrid_retrieve_finds_lora_doc(self, pipeline):
        hits = pipeline.retrieve("LoRA 的低秩矩阵怎么初始化", k=5, mode="hybrid")
        assert hits[0].chunk.doc_id == "lora.md"

    def test_modes_return_results(self, pipeline):
        for mode in ("bm25", "dense", "hybrid"):
            hits = pipeline.retrieve("RAG 的失败模式", k=3, mode=mode)
            assert len(hits) == 3

    def test_answer_parses_citations(self, pipeline):
        result = pipeline.answer("LoRA 微调的优势是什么")
        assert result.citations == [1]
        assert result.contexts
        assert set(result.timings_ms) == {"retrieve", "rerank", "generate", "total"}
        payload = result.to_dict()
        assert payload["sources"][0]["doc_id"].endswith(".md")

    def test_rerank_picks_rag_doc(self, pipeline):
        contexts = pipeline.prepare_contexts("RAG 常见的失败模式有哪些", top_n=1)
        assert contexts[0].chunk.doc_id == "rag.md"
        assert contexts[0].rerank_score > 0

    def test_index_cache_roundtrip(self, tmp_path, embedder, reranker):
        cfg = load_config(PROJECT_ROOT / "configs" / "default.json",
                          corpus_dir=str(SAMPLE_DOCS), index_dir=str(tmp_path / "idx"),
                          retrieve_k=5, final_k=2)
        p1 = RAGPipeline(cfg, generator=lambda q, c: "x [1]", embedder=embedder, reranker=reranker)
        first = p1.ingest()
        assert first["cached"] is False
        p2 = RAGPipeline(cfg, generator=lambda q, c: "x [1]", embedder=embedder, reranker=reranker)
        second = p2.ingest()
        assert second["cached"] is True
        assert len(p2.chunks) == len(p1.chunks)


class TestAPI:
    def test_health(self, pipeline):
        from fastapi.testclient import TestClient
        from rag_service.service_api import create_app

        with TestClient(create_app(pipeline)) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"

    def test_retrieve_endpoint(self, pipeline):
        from fastapi.testclient import TestClient
        from rag_service.service_api import create_app

        with TestClient(create_app(pipeline)) as client:
            resp = client.post("/retrieve", json={"question": "LoRA", "mode": "hybrid", "k": 3})
            body = resp.json()
            assert resp.status_code == 200
            assert len(body["hits"]) == 3
            assert body["hits"][0]["rank"] == 1

    def test_chat_endpoint(self, pipeline):
        from fastapi.testclient import TestClient
        from rag_service.service_api import create_app

        with TestClient(create_app(pipeline)) as client:
            resp = client.post("/chat", json={"question": "LoRA 的优势", "top_n": 2})
            body = resp.json()
            assert resp.status_code == 200
            assert body["citations"] == [1]
            assert body["sources"]
            assert "total" in body["latency_ms"]

    def test_chat_timeout_returns_504(self, embedder, reranker, tmp_path):
        from fastapi.testclient import TestClient
        from rag_service.service_api import create_app

        cfg = load_config(PROJECT_ROOT / "configs" / "default.json",
                          corpus_dir=str(SAMPLE_DOCS), index_dir=str(tmp_path / "idx2"),
                          request_timeout_s=0.01, retrieve_k=3, final_k=1)

        def slow_gen(q, ctx):
            time.sleep(2)
            return "慢回答"

        p = RAGPipeline(cfg, generator=slow_gen, embedder=embedder, reranker=reranker)
        p.ingest()
        with TestClient(create_app(p)) as client:
            resp = client.post("/chat", json={"question": "LoRA"})
            assert resp.status_code == 504

    def test_stream_endpoint_sends_sources_first(self, pipeline):
        from fastapi.testclient import TestClient
        from rag_service.service_api import create_app

        with TestClient(create_app(pipeline)) as client:
            with client.stream("POST", "/chat/stream", json={"question": "LoRA 优势", "top_n": 2}) as resp:
                assert resp.status_code == 200
                lines = [line for line in resp.iter_lines() if line.startswith("data: ")]
            first = json.loads(lines[0][len("data: "):])
            assert first["type"] == "sources"
            last = json.loads(lines[-1][len("data: "):])
            assert last["type"] == "done"
