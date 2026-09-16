"""环境变量 → RAGPipeline（供 app.py 与测试使用）。"""
from __future__ import annotations

import os
from pathlib import Path

from rag_service.config import load_config
from rag_service.pipeline import RAGPipeline

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def build_pipeline_from_env() -> RAGPipeline:
    cfg = load_config(
        PROJECT_ROOT / "configs" / "default.json",
        corpus_dir=os.environ.get("RAG_CORPUS", str(PROJECT_ROOT.parent.parent / "content")),
        index_dir=os.environ.get("RAG_INDEX_DIR", str(PROJECT_ROOT / ".cache" / "index")),
        llm_model=os.environ.get("RAG_LLM"),
        chunk_size=os.environ.get("RAG_CHUNK_SIZE"),
    )
    return RAGPipeline(cfg)
