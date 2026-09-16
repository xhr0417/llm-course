"""rag_service —— Capstone 2：Search + Rerank + RAG Service。

Pipeline：documents → chunk → BM25 + embedding → hybrid retrieval → reranker
          → top-k context → LLM → answer + citations
"""
from rag_service.config import RAGConfig
from rag_service.pipeline import RAGPipeline

__all__ = ["RAGConfig", "RAGPipeline"]
__version__ = "0.1.0"
