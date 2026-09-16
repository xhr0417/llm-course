"""FastAPI 服务：/health /retrieve /chat /chat/stream（SSE）。

- Pydantic 定义 request/response schema；
- 同步 CPU 任务放线程池（run_in_threadpool），不阻塞事件循环；
- 超时用 asyncio.wait_for，超时返回 504；
- /chat/stream 走 SSE（ChatGPT 式 token 流）。
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from rag_service.pipeline import RAGPipeline

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    mode: str = Field("hybrid", pattern="^(bm25|dense|hybrid)$")
    top_k: int = Field(20, ge=1, le=100)
    top_n: int = Field(5, ge=1, le=20)
    use_rerank: bool = True


class SourceInfo(BaseModel):
    chunk_id: str
    doc_id: str
    score: float
    stage: str
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[int]
    sources: list[SourceInfo]
    latency_ms: dict[str, float]


class RetrieveRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    mode: str = Field("hybrid", pattern="^(bm25|dense|hybrid)$")
    k: int = Field(10, ge=1, le=100)


class RetrieveHit(BaseModel):
    rank: int
    chunk_id: str
    doc_id: str
    score: float
    bm25_score: float
    dense_score: float
    snippet: str


class RetrieveResponse(BaseModel):
    question: str
    mode: str
    hits: list[RetrieveHit]


def create_app(pipeline: Optional[RAGPipeline] = None) -> FastAPI:
    state = {"pipeline": pipeline}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if state["pipeline"] is None:
            from rag_service.app_config import build_pipeline_from_env
            state["pipeline"] = build_pipeline_from_env()
        await run_in_threadpool(state["pipeline"].ingest)
        yield

    app = FastAPI(title="RAG Service", version="0.1.0",
                  description="Capstone 2：Search + Rerank + RAG（以课程内容为语料）",
                  lifespan=lifespan)

    def get_pipeline() -> RAGPipeline:
        if state["pipeline"] is None:
            raise HTTPException(status_code=503, detail="RAG pipeline 未就绪（服务启动中或索引构建失败）")
        return state["pipeline"]

    @app.get("/health")
    async def health() -> dict:
        p = get_pipeline()
        return {"status": "ok", "docs": p._doc_count, "chunks": len(p.chunks), "llm": p.cfg.llm_model}

    @app.post("/retrieve", response_model=RetrieveResponse)
    async def retrieve(req: RetrieveRequest) -> RetrieveResponse:
        p = get_pipeline()
        try:
            hits = await asyncio.wait_for(
                run_in_threadpool(p.retrieve, req.question, req.k, req.mode),
                timeout=p.cfg.request_timeout_s,
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="检索超时")
        return RetrieveResponse(question=req.question, mode=req.mode, hits=[
            RetrieveHit(rank=i + 1, chunk_id=h.chunk.id, doc_id=h.chunk.doc_id, score=round(h.score, 4),
                        bm25_score=round(h.bm25_score, 4), dense_score=round(h.dense_score, 4),
                        snippet=h.chunk.text[:160].replace("\n", " "))
            for i, h in enumerate(hits)
        ])

    @app.post("/chat", response_model=ChatResponse)
    async def chat(req: ChatRequest) -> ChatResponse:
        p = get_pipeline()
        try:
            result = await asyncio.wait_for(
                run_in_threadpool(p.answer, req.question, req.mode, req.top_k, req.top_n, req.use_rerank),
                timeout=p.cfg.request_timeout_s,
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail=f"生成超时（>{p.cfg.request_timeout_s}s）")
        return ChatResponse(
            answer=result.answer,
            citations=result.citations,
            sources=[SourceInfo(**{k: s[k] for k in ("chunk_id", "doc_id", "score", "stage", "snippet")})
                     for s in (c.to_dict() for c in result.contexts)],
            latency_ms={k: round(v, 1) for k, v in result.timings_ms.items()},
        )

    @app.post("/chat/stream")
    async def chat_stream(req: ChatRequest) -> StreamingResponse:
        p = get_pipeline()

        def event_source():
            try:
                for kind, payload in p.answer_stream(req.question, req.mode, req.top_k, req.top_n, req.use_rerank):
                    if kind == "sources":
                        yield "data: " + json.dumps({"type": "sources", "sources": payload}, ensure_ascii=False) + "\n\n"
                    else:
                        yield "data: " + json.dumps({"type": "token", "text": payload}, ensure_ascii=False) + "\n\n"
                yield "data: " + json.dumps({"type": "done"}, ensure_ascii=False) + "\n\n"
            except Exception as e:  # noqa: BLE001
                logger.exception("stream 失败")
                yield "data: " + json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False) + "\n\n"

        return StreamingResponse(event_source(), media_type="text/event-stream")

    return app
