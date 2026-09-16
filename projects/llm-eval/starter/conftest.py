"""pytest 全局配置：把 src/ 加进 import 路径，让 starter 开箱即可运行测试。

同时处理两个环境问题：
- KMP_DUPLICATE_LIB_OK：macOS 上 torch 与其它库各自携带 OpenMP，同时加载会 segfault；
- RUN_MODEL_TESTS：模型依赖测试开关（Step 7 会加载 tiny 模型）。
  CI 默认设置 RUN_MODEL_TESTS=0；本地默认 1。用法：RUN_MODEL_TESTS=0 pytest -q
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

RUN_MODEL_TESTS = os.environ.get("RUN_MODEL_TESTS", "1") == "1"
