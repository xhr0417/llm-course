"""pytest 全局配置：把 src/ 加进 import 路径，并允许 OpenMP 重复加载。

背景（真实踩坑）：macOS 上 torch 与其它库可能各自携带 libomp，
同一进程重复加载会直接崩溃。标准做法是设置 KMP_DUPLICATE_LIB_OK=TRUE。
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

# 模型依赖测试开关：本 lab 的测试用本地缓存的 tiny 模型；
# CI 想跳过模型测试时：RUN_MODEL_TESTS=0 pytest -q
RUN_MODEL_TESTS = os.environ.get("RUN_MODEL_TESTS", "1") == "1"
