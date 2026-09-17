这页是第 25 章的查阅区。主线页面讲分层与数据契约；遇到 argparse / logging / pytest 等具体问题时再打开这里。历史参考实现仍在 `projects/log-analyzer/`，**不是当前作业**，对照前不必先跑旧 starter。

## 25.3 Learn 参考手册：工程基础

以下内容是工程基础查阅。当前主线卡住时回来查对应小节即可，不必先做旧作业。

### 25.3.1 项目结构：为什么不能只有一个 train.py

单文件脚本在 200 行以内没问题。超过之后，第一个崩溃点一定是：

```
train.py
  ├── 数据加载代码
  ├── 模型定义
  ├── 训练循环
  ├── 评测逻辑
  ├── argparse 参数解析
  └── print 调试输出
→ 想换数据集要动训练代码；想单独测 parser 要先 import 整个训练脚本
```

工程化的第一步是**按职责拆分**：

```text
project/
├── configs/          # 配置（超参、路径）
├── src/<package>/    # 可 import 的源码
│   ├── data/         # 数据读取、清洗、切分
│   ├── models/       # 模型定义
│   ├── training/     # 训练循环
│   ├── evaluation/   # 评测
│   └── utils/        # 通用工具
├── scripts/          # 入口脚本（薄层，只做参数装配）
├── tests/            # pytest
├── outputs/          # 产物（gitignore）
├── requirements.txt
└── README.md
```

**为什么这样拆**：

- `data` 不 import `training`：数据管线可以脱离 GPU 单独测试；
- `scripts/` 只负责「解析参数 → 调 src」：换入口（CLI/Cron/Notebook）不动核心逻辑；
- `tests/` 与 `src/` 平行：每个模块都可以被独立 import 测试。

:::warning 新手最常犯的两个结构错误
1. **一切都在 `train.py`**：无法单元测试，无法复用，无法被别人接手；
2. **过度拆分**：第一段实习项目不需要 AbstractFactory / 依赖注入框架 / 30 个 config 文件。**清楚、可运行、可解释**比「高级」重要。
:::

训练日志分析器是这个结构的最小实例：`parser`（数据）→ `stats`（逻辑）→ `cli`（入口），三层互不 import 循环依赖。历史参考实现见可选目录，不是当前 Lab 作业。

### 25.3.2 从硬编码到 argparse

```python
# ❌ 改参数要改代码
lr = 3e-4
batch_size = 32
```

```python
# ✅ 参数在命令行
import argparse

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="训练一个小模型")
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--max-steps", type=int, default=1000)
    return parser

if __name__ == "__main__":
    args = build_parser().parse_args()
    print(args.lr, args.batch_size)
```

```bash
python train.py --lr 3e-4 --batch-size 32 --max-steps 1000
```

协作时的关键点：**默认值要能跑通**（`python train.py` 直接可用），覆盖项才用命令行传。

### 25.3.3 dataclass：比 dict 更适合中型工程

参数多起来之后，用 `dict` 传参会失控：`cfg["lr"]` 打错字不报错、没有补全、没有默认值。

```python
from dataclasses import dataclass, field

@dataclass
class TrainConfig:
    lr: float = 3e-4
    batch_size: int = 32
    max_steps: int = 1000
    target_modules: list[str] = field(default_factory=lambda: ["q_proj", "v_proj"])

cfg = TrainConfig(lr=1e-4)
cfg.lr          # 有补全、拼错属性名直接 AttributeError
```

dataclass 的四个实际收益：

1. 属性访问有补全、拼错立即报错（dict 不会）；
2. 默认值统一管理，`TrainConfig()` 一定是合法配置；
3. `asdict()` 直接序列化成 JSON，实验配置天然可记录；
4. 可变默认值必须用 `field(default_factory=...)`——顺便避免 Python 经典可变默认值坑。

历史 HuggingFace 参考实现里的 `config.py` 就是这个模式：dataclass 打底 + JSON 文件覆盖 + 命令行覆盖。那不是当前作业。

### 25.3.4 typing：只学实习真正用到的部分

不要做类型系统课程。AI 工程里 90% 的场景只需要这些：

```python
from typing import Optional, Callable, Protocol

def load_model(name: str, dtype: str = "float32") -> "Model": ...

def find_best(losses: list[float]) -> Optional[int]:      # 可能没有结果
    return losses.index(min(losses)) if losses else None

def train(step_fn: Callable[[int], float]) -> list[float]: ...

class DataSource(Protocol):                                # 只需要"长得像"
    def __iter__(self): ...
```

| 写法 | 用途 |
| --- | --- |
| `list[float]` / `dict[str, int]` | 容器类型（3.9+ 可直接用） |
| `Optional[int]` | 可能返回 None（比 int 诚实） |
| `Callable[[int], float]` | 传函数进函数 |
| `Protocol` | 描述「只要实现了这些方法就能传入」的接口 |

:::warning Optional 不是装饰
函数可能返回 None 时**必须**标 `Optional`：调用方因此知道要处理 None。`stats.final_loss` 在空日志时返回 None——这是特性，不是 bug。
:::

### 25.3.5 pathlib 与 JSONL：AI 项目的数据 I/O

AI 项目每天处理四类文件：**json / jsonl / csv / checkpoint**。统一用 `pathlib`，不要字符串拼路径：

```python
from pathlib import Path

path = Path("outputs") / "run_001" / "results.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text("{}", encoding="utf-8")
```

**JSONL（JSON Lines）是 LLM 生态最重要的格式**：一行一条 JSON，天然支持流式读取——不用把 100GB 数据一次读进内存。

```python
def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows
```

指令微调数据常见长这样：

```json
{"split": "train", "messages": [{"role": "user", "content": "用一句话解释什么是过拟合。"}, {"role": "assistant", "content": "过拟合是模型把训练数据的噪声也记住了，导致在新数据上表现变差。"}]}
```

:::warning 别用 json.load 读 jsonl
`json.load(f)` 读的是**单个** JSON 文档。JSONL 每行都是独立文档，必须逐行 `json.loads`。
:::

### 25.3.6 logging：从 print 到可检索的日志

```python
# ❌ print 的三个问题：无法分级、无法关闭、无法定位来源
print("loss:", loss)

# ✅
import logging
logger = logging.getLogger(__name__)
logger.info("step %d | loss %.4f", step, loss)
logger.warning("grad_norm=%.2f 超过阈值", grad_norm)
logger.error("checkpoint 写入失败：%s", path)
```

| 级别 | 用途 | 生产环境 |
| --- | --- | --- |
| DEBUG | 每步调试细节（张量形状、耗时） | 关闭 |
| INFO | 关键里程碑（每 N 步 loss、保存点） | 开启 |
| WARNING | 异常但可继续（grad norm 飙升、val loss 上升） | 开启 |
| ERROR | 出错了（OOM、文件写入失败、NaN） | 开启 + 告警 |

两个好习惯：`logger.info("%s", x)` 延迟格式化；`logging.getLogger(__name__)` 让日志带模块路径。

### 25.3.7 异常处理：真实世界的四个崩溃点

新手写 `except: pass` 等于把错误藏起来。真实 AI 工程的四个高频异常：

```python
# API timeout —— 网络永远不可信
try:
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
except requests.Timeout:
    logger.warning("请求超时，稍后重试")

# 文件缺失 —— 给出「缺什么、怎么办」
if not args.logfile.exists():
    logger.error("日志文件不存在：%s", args.logfile)
    return 2

# JSON 解析失败 —— 一行坏数据不该杀死全量处理
try:
    row = json.loads(line)
except json.JSONDecodeError:
    logger.warning("跳过坏行：%s", line[:80])

# CUDA OOM —— 显存是有限资源
try:
    out = model(batch)
except torch.cuda.OutOfMemoryError:
    logger.error("OOM：请减小 batch 或开启梯度累积")
    raise
```

:::warning 异常处理的三条纪律
1. 只在能处理的地方捕获；
2. 捕获之后必须留下信息；
3. 退出码是接口：0 成功 / 1 业务失败 / 2 参数或输入错误。
:::

### 25.3.8 requests / HTTP：模型服务的基本功

应用岗日常就是调 API。最少要理解：状态码、timeout、重试条件和指数退避。

```python
def call_with_retry(payload: dict, url: str, retries: int = 3) -> dict:
    for attempt in range(1, retries + 1):
        try:
            resp = requests.post(url, json=payload, timeout=30)
            if resp.status_code in (429, 500, 502, 503):
                raise requests.HTTPError(response=resp)
            resp.raise_for_status()
            return resp.json()
        except (requests.Timeout, requests.HTTPError):
            if attempt == retries:
                raise
            time.sleep(2 ** attempt)
```

### 25.3.9 asyncio：AI 应用开发的分水岭

调 10 次模型 API，每次等 2 秒：同步约 20 秒；受控异步并发约 2 秒加调度开销。

:::demo sync-async 交互：同步 vs 异步的时间线
拖动请求数量与单次延迟，对比两种模式的墙钟时间。
:::

```python
import asyncio

async def main(prompts):
    sem = asyncio.Semaphore(8)
    async def one(prompt):
        async with sem:
            return await call_model(prompt)
    return await asyncio.gather(*(one(prompt) for prompt in prompts), return_exceptions=True)
```

:::warning 为什么不能全并发
服务端有 QPS 限制，客户端也有连接和内存上限。`Semaphore` 控制并发度，配合重试是评测系统的标准做法。
:::

### 25.3.10 pytest：模型工程也需要测试

可测的东西非常多：数据解析、mask 构造、指标计算、配置加载和 CLI 行为。

```python
def test_parse_line_extracts_loss():
    event = parse_line("2025-01-10 09:00:02 INFO  step=10 loss=7.812 tokens/s=1180")
    assert event.loss == pytest.approx(7.812)

def test_nan_detected():
    stats = analyze(parse_log_file(SAMPLE_NAN))
    assert stats.has_nan
```

三个让测试真正有用的习惯：测异常路径；先故意改坏代码看测试变红；把测试当作最好的行为文档。

:::fold 练习：为什么 warning 行会导致 step/loss 错位？
```python
def test_best_step():
    stats = analyze(parse_log_file(SAMPLE))
    assert stats.best_step == 1000      # 未修复的实现会得到 550
```
日志里有 `WARNING step=550 val_loss increased`，它有 step 但没有 loss。不同来源的列表不能按下标对齐；修复方式是新增 `loss_steps` 同步追加。
:::

## 25.4 可选参考实现（非当前作业）

:::unfold 目标
对照一份训练日志分析器：跑完训练后（或训练崩了之后），它能回答 final loss、best loss、平均吞吐、warning 列表和是否出现 NaN。
:::

**位置**（可选查阅，不是当前主线任务）：[projects/log-analyzer](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer)

```bash
# 仅在你明确要对照历史实现时使用
cd projects/log-analyzer
pip install -r requirements.txt
python -m log_analyzer.cli samples/train.log
pytest -q
```

**架构**：

```text
src/log_analyzer/
├── parser.py    # 文本 → LogEvent
├── stats.py     # LogEvent 序列 → TrainRunStats
└── cli.py       # argparse + logging + JSON 输出 + 退出码
```

:::note 阅读时值得自问
为什么 best loss 与 step 对齐需要 `loss_steps`；`--json` 为什么是稳定接口；为什么坏行可跳过而文件缺失要用退出码 2。
:::

## 25.5 面试复盘：Python 工程

不能翻资料，试着回答：

1. 为什么按 `src/` 拆包，而不是全写在 `train.py`？
2. dataclass 相比 dict 解决了什么问题？
3. JSONL 和 JSON 的区别？流式读取的内存优势在哪？
4. logging 和 print 的本质区别是什么？
5. 你写过哪些 pytest，覆盖了哪些异常路径？
6. 一个 HTTP 请求失败，什么情况重试？
7. 10 个 LLM 请求如何做并发控制？
8. CLI 工具的退出码为什么是接口？
9. 描述 warning 行导致的错位：成因、症状、定位、修复。
10. 如果支持多份日志合并分析，你会改哪一层？为什么？

:::quiz
你在写一个批量评测脚本，需要给 5000 个问题调用 API。以下哪种方案最合理？

A. for 循环逐个请求，每个等待 30 秒超时
B. asyncio 全并发，把 5000 个请求同时发出去
C. asyncio + Semaphore(8) 控制并发 + 超时 + 指数退避重试
D. 起 5000 个线程一次打完

答案: C
解析: 并发提升吞吐，Semaphore 限流保护两端，超时与重试处理瞬时故障。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 怎么用这一章 | 当教材与手册阅读；旧 starter 不是当前作业 |
| 项目结构 | 按职责拆包；scripts 只装配，src 可测试 |
| 数据 I/O | pathlib 统一路径；JSONL 逐行流式读取 |
| 可观测性 | logging 分级；退出码是接口 |
| 并发 | asyncio + Semaphore 限流，不是全并发 |
| 测试 | pytest 覆盖异常路径；先有检查再写实现 |
| 错位 bug | 不同来源的列表不能按下标对齐；用 `loss_steps` 同步追加 |
:::

:::related
依赖 | 第 11 章 PyTorch, 第 23 章 LLM Evaluation
用于 | 第 26 章 HuggingFace 工作流阅读, 第 27 章评测分层
:::
