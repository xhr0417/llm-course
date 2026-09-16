"""配置（dataclass + JSON 覆盖）。"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class RAGConfig:
    corpus_dir: str = "../content"             # 默认吃课程自己的 markdown
    index_dir: str = ".cache/index"            # 分块/向量/BM25 缓存
    chunk_strategy: str = "recursive"          # fixed | sentence | recursive
    chunk_size: int = 512                      # 字符
    chunk_overlap: int = 64
    embed_model: str = "BAAI/bge-small-zh-v1.5"
    rerank_model: str = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
    llm_model: str = "Qwen/Qwen2.5-0.5B-Instruct"
    retrieve_k: int = 20                       # 进入 reranker 的候选数
    final_k: int = 5                           # 最终注入 prompt 的段落数
    fusion: str = "rrf"                        # rrf | weighted
    bm25_weight: float = 0.5                   # fusion=weighted 时的权重
    max_new_tokens: int = 256
    request_timeout_s: float = 60.0

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2), encoding="utf-8")


def load_config(path: Optional[Path] = None, **overrides) -> RAGConfig:
    data: dict = {}
    if path is not None and Path(path).exists():
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    data.update({k: v for k, v in overrides.items() if v is not None})
    return RAGConfig(**data)
