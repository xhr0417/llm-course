"""uvicorn app:app —— RAG Service HTTP 入口。"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from rag_service.service_api import create_app  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
