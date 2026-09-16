"""响应缓存：同一 (模型, prompt, 参数) 只请求一次（sqlite，标准库实现）。"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from pathlib import Path


class ResponseCache:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.path))
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS responses ("
            " key TEXT PRIMARY KEY, response TEXT, created_at REAL)"
        )
        self.conn.commit()
        self.hits = 0
        self.misses = 0

    @staticmethod
    def make_key(model: str, prompt: str, params: dict) -> str:
        payload = json.dumps({"model": model, "prompt": prompt, "params": params},
                             ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def get(self, key: str) -> str | None:
        row = self.conn.execute("SELECT response FROM responses WHERE key = ?", (key,)).fetchone()
        if row is None:
            self.misses += 1
            return None
        self.hits += 1
        return row[0]

    def put(self, key: str, response: str) -> None:
        self.conn.execute("INSERT OR REPLACE INTO responses (key, response, created_at) VALUES (?, ?, ?)",
                          (key, response, time.time()))
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()
