"""BM25：从零实现的关键词检索（稀疏检索基线）。

为什么必须讲 BM25（第 28 章 6.5）：
    dense retrieval 不是万能的——「RTX 5090」「3.14159」「错误码 0x80070005」
    这类精确匹配，关键词方法的召回经常优于 embedding。
"""
from __future__ import annotations

import math
import re
from collections import Counter

_PUNCT_RE = re.compile(r"[\s，。！？；：、（）《》【】“”‘’…—·,.!?;:()\[\]{}\"'`~@#$%^&*+=|\\/<>-]+")


def tokenize(text: str) -> list[str]:
    """中文用 jieba 分词 + 英文/数字保留，去标点。"""
    text = text.lower()
    try:
        import jieba
        tokens = jieba.lcut(text)
    except ImportError:  # 无 jieba 时的朴素回退：CJK 按字、英文按词
        tokens = []
        buf = ""
        for ch in text:
            if "\u4e00" <= ch <= "\u9fff":
                if buf:
                    tokens.append(buf)
                    buf = ""
                tokens.append(ch)
            elif ch.isalnum():
                buf += ch
            else:
                if buf:
                    tokens.append(buf)
                    buf = ""
        if buf:
            tokens.append(buf)
    return [t for t in (_PUNCT_RE.sub("", tok) for tok in tokens) if t]


class BM25:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_tokens: list[list[str]] = []
        self.doc_freqs: list[Counter] = []
        self.idf: dict[str, float] = {}
        self.avg_len = 0.0

    def fit(self, documents: list[str]) -> "BM25":
        self.corpus_tokens = [tokenize(doc) for doc in documents]
        self.doc_freqs = [Counter(tokens) for tokens in self.corpus_tokens]
        n = len(self.corpus_tokens)
        df: Counter = Counter()
        for freq in self.doc_freqs:
            df.update(freq.keys())
        self.idf = {term: math.log((n - count + 0.5) / (count + 0.5) + 1.0) for term, count in df.items()}
        self.avg_len = sum(len(t) for t in self.corpus_tokens) / n if n else 0.0
        return self

    def score(self, query: str) -> list[float]:
        """返回每个文档的 BM25 分数（与 fit 时的顺序一致）。"""
        q_tokens = tokenize(query)
        scores = [0.0] * len(self.corpus_tokens)
        for token in q_tokens:
            idf = self.idf.get(token)
            if idf is None:
                continue
            for i, freq in enumerate(self.doc_freqs):
                tf = freq.get(token, 0)
                if tf == 0:
                    continue
                doc_len = len(self.corpus_tokens[i])
                denom = tf + self.k1 * (1 - self.b + self.b * doc_len / (self.avg_len or 1))
                scores[i] += idf * tf * (self.k1 + 1) / denom
        return scores
