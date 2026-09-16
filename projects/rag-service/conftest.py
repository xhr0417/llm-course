"""pytest 全局配置：在导入 torch / faiss 之前允许重复的 OpenMP 运行时。

背景（真实踩坑）：macOS 上 faiss-cpu 与 torch 各自携带 OpenMP（libomp），
同一进程同时加载会直接 segfault。标准修复是设置 KMP_DUPLICATE_LIB_OK=TRUE。
这里在 conftest 里设置，保证用户 `pytest -q` 开箱即用。
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

# 模型依赖测试开关：CI 默认设置 RUN_MODEL_TESTS=0（不下载 bge/reranker）；
# 本地默认 1（完整验证）。用法：RUN_MODEL_TESTS=0 pytest -q
RUN_MODEL_TESTS = os.environ.get("RUN_MODEL_TESTS", "1") == "1"
