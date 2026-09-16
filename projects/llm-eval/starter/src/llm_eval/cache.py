"""响应缓存：同一 (模型, prompt, 参数) 只请求一次（sqlite，标准库实现）。

这是 starter 的【待实现文件】：
- Step 8：实现 make_key / get / put / close

__init__ 已给出（建表 + hits/misses 计数器）。
"""
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
        """Step 8：生成缓存 key。

        sha256(json.dumps({"model": model, "prompt": prompt, "params": params},
                          ensure_ascii=False, sort_keys=True)).hexdigest()

        教学警告：params 必须包含全部影响输出的参数（max_new_tokens / temperature）——
        如果 key 里只有 model + prompt，改了生成参数会命中旧答案，结果错得毫无察觉。
        测试会直接检查「不同 max_new_tokens / temperature → 不同 key」。
        """
        raise NotImplementedError("Step 8：实现 make_key（params 必须进 key！）")

    def get(self, key: str) -> str | None:
        """Step 8：命中返回 response 且 hits += 1；未命中返回 None 且 misses += 1。"""
        raise NotImplementedError("Step 8：实现 get（查询 + hits/misses 计数）")

    def put(self, key: str, response: str) -> None:
        """Step 8：INSERT OR REPLACE 写入 (key, response, created_at=time.time()) 并 commit。"""
        raise NotImplementedError("Step 8：实现 put")

    def close(self) -> None:
        """Step 8：关闭 sqlite 连接。"""
        raise NotImplementedError("Step 8：实现 close")
