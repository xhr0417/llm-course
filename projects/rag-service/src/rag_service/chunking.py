"""Chunking：把长文档切成可检索的段落。

三种策略（第 28 章 6.2）：
- fixed：定长字符切分 + overlap（简单、可预测，可能切断句子）；
- sentence：按句子边界合并到接近 chunk_size（语义完整）；
- recursive：优先 \n\n → \n → 句号 → 逗号 递归下降（工业常用默认）。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Chunk:
    id: str
    doc_id: str
    text: str
    start: int
    end: int


def chunk_fixed(text: str, size: int = 512, overlap: int = 64) -> list[tuple[str, int, int]]:
    """定长切分：返回 (chunk_text, start, end) 列表。"""
    if overlap >= size:
        raise ValueError("overlap 必须小于 size")
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append((text[start:end], start, end))
        if end == len(text):
            break
        start = end - overlap
    return chunks


_SENT_RE = re.compile(r"[^。！？!?\n]+[。！？!?\n]?")


def chunk_sentences(text: str, size: int = 512) -> list[tuple[str, int, int]]:
    """按句子合并：句子不拆开，攒到接近 size。"""
    sentences = [(m.group(0), m.start(), m.end()) for m in _SENT_RE.finditer(text) if m.group(0).strip()]
    chunks: list[tuple[str, int, int]] = []
    buf, buf_start, buf_end = "", 0, 0
    for sent, s, e in sentences:
        if buf and len(buf) + len(sent) > size:
            chunks.append((buf, buf_start, buf_end))
            buf = ""
        if not buf:
            buf_start = s
        buf += sent
        buf_end = e
    if buf.strip():
        chunks.append((buf, buf_start, buf_end))
    return chunks


def chunk_recursive(text: str, size: int = 512, overlap: int = 64) -> list[tuple[str, int, int]]:
    """递归切分：按 separators 依次尝试，切不动就落到 fixed。"""
    separators = ["\n\n", "\n", "。", "；", "，", " "]
    parts: list[tuple[str, int, int]] = []

    def split(seg: str, offset: int, level: int) -> None:
        if len(seg) <= size or level >= len(separators):
            if seg.strip():
                parts.append((seg, offset, offset + len(seg)))
            return
        sep = separators[level]
        cursor = 0
        buf = ""
        buf_start = 0
        for piece in seg.split(sep):
            piece_full = piece + sep
            if buf and len(buf) + len(piece_full) > size:
                split(buf, offset + buf_start, level + 1)
                buf = ""
            if not buf:
                buf_start = cursor
            buf += piece_full
            cursor += len(piece_full)
        if buf.strip():
            split(buf, offset + buf_start, level + 1)

    split(text, 0, 0)
    if overlap <= 0 or len(parts) <= 1:
        return parts
    merged: list[tuple[str, int, int]] = []
    for i, (seg, s, e) in enumerate(parts):
        if i > 0:
            prev = parts[i - 1][0]
            seg = prev[-overlap:] + seg
            s = max(0, s - overlap)
        merged.append((seg, s, e))
    return merged


def chunk_text(text: str, strategy: str = "recursive", size: int = 512, overlap: int = 64):
    if strategy == "fixed":
        return chunk_fixed(text, size, overlap)
    if strategy == "sentence":
        return chunk_sentences(text, size)
    if strategy == "recursive":
        return chunk_recursive(text, size, overlap)
    raise ValueError(f"未知 chunk 策略：{strategy}")


def load_documents(corpus_dir: Path, patterns: tuple[str, ...] = ("*.md", "*.txt")) -> list[tuple[str, str]]:
    """读目录下的文档：返回 [(doc_id, text)]。doc_id 用相对路径（便于引用定位）。"""
    docs = []
    for pattern in patterns:
        for path in sorted(Path(corpus_dir).rglob(pattern)):
            text = path.read_text(encoding="utf-8", errors="ignore").strip()
            if text:
                docs.append((str(path.relative_to(corpus_dir)), text))
    return docs


def build_chunks(docs: list[tuple[str, str]], strategy: str = "recursive",
                 size: int = 512, overlap: int = 64) -> list[Chunk]:
    chunks: list[Chunk] = []
    for doc_id, text in docs:
        for i, (seg, s, e) in enumerate(chunk_text(text, strategy, size, overlap)):
            if seg.strip():
                chunks.append(Chunk(id=f"{doc_id}#{i}", doc_id=doc_id, text=seg, start=s, end=e))
    return chunks
