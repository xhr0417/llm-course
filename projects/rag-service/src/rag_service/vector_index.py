"""向量索引：FAISS 精确检索（IndexFlatIP），无 FAISS 时回退 numpy。"""
from __future__ import annotations

import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

# macOS 上 faiss-cpu 与 torch 各自携带 OpenMP，同进程加载可能 segfault；
# 这个开关必须在 import faiss 之前设置（详见 README「已知问题」）。
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

try:
    import faiss
    _HAS_FAISS = True
except ImportError:
    _HAS_FAISS = False


class VectorIndex:
    """归一化向量 + 内积 = 余弦相似度。"""

    def __init__(self, dim: int):
        self.dim = dim
        self.vectors: np.ndarray | None = None
        self.index = faiss.IndexFlatIP(dim) if _HAS_FAISS else None
        if not _HAS_FAISS:
            logger.warning("未安装 faiss，使用 numpy 精确检索回退实现")

    def add(self, vectors: np.ndarray) -> None:
        vectors = np.ascontiguousarray(vectors.astype("float32"))
        self.vectors = vectors
        if self.index is not None:
            self.index.add(vectors)

    def search(self, query_vector: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
        """返回 (分数, 下标)，按分数降序。"""
        q = np.ascontiguousarray(query_vector.astype("float32")).reshape(1, -1)
        if self.index is not None:
            scores, idxs = self.index.search(q, min(k, self.index.ntotal))
            return scores[0], idxs[0]
        sims = self.vectors @ q[0]
        order = np.argsort(-sims)[:k]
        return sims[order], order

    def __len__(self) -> int:
        return 0 if self.vectors is None else len(self.vectors)
