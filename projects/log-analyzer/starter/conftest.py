"""pytest 全局配置：把 src/ 加进 import 路径，让 starter 开箱即可运行测试。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
