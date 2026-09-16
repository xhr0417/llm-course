# 第 25 章 · Python Engineering for AI：写出能跑的项目

:::intuition 一句话
第 11 章解决「怎么看懂模型代码」；这一章解决「**怎么写出一个真正的工程项目**」——从 `train.py` 一坨脚本，到别人能 clone、能跑、能测、能改的仓库。
:::

:::note 这一章不教 Python 语法
假设你已经会写 for 循环和函数。我们只教 **AI 实习里最常用的工程部分**：项目结构、配置、日志、异常、HTTP、异步、测试。学完的目标是能独立交付 Checkpoint A。
:::

## 25.1 项目结构：为什么不能只有一个 train.py

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

## 25.2 从硬编码到 argparse

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

## 25.3 dataclass：比 dict 更适合中型工程

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

本章项目的 `projects/hf-mini-lab/src/hf_lab/config.py` 就是这个模式：dataclass 打底 + JSON 文件覆盖 + 命令行覆盖。

## 25.4 typing：只学实习真正用到的部分

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

## 25.5 pathlib 与 JSONL：AI 项目的数据 I/O

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
        for line in f:                     # 逐行读，内存友好
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows
```

指令微调数据（本章项目 `hf-mini-lab/data/sft_mini.jsonl`）长这样：

```json
{"split": "train", "messages": [{"role": "user", "content": "用一句话解释什么是过拟合。"}, {"role": "assistant", "content": "过拟合是模型把训练数据的噪声也记住了，导致在新数据上表现变差。"}]}
```

:::warning 别用 json.load 读 jsonl
`json.load(f)` 读的是**单个** JSON 文档。JSONL 每行都是独立文档，必须逐行 `json.loads`。反过来，`json.loads` 一行包含多行的 pretty-printed JSON 也会失败——先看清格式再写读取代码。
:::

## 25.6 logging：从 print 到可检索的日志

```python
# ❌ print 的三个问题：无法分级、无法关闭、无法定位来源
print("loss:", loss)

# ✅
import logging
logger = logging.getLogger(__name__)
logger.info("step %d | loss %.4f", step, loss)     # 延迟格式化
logger.warning("grad_norm=%.2f 超过阈值", grad_norm)
logger.error("checkpoint 写入失败：%s", path)
```

四个级别就是四个用途：

| 级别 | 用途 | 生产环境 |
| --- | --- | --- |
| DEBUG | 每步调试细节（张量形状、耗时） | 关闭 |
| INFO | 关键里程碑（每 N 步 loss、保存点） | 开启 |
| WARNING | 异常但可继续（grad norm 飙升、val loss 上升） | 开启 |
| ERROR | 出错了（OOM、文件写入失败、NaN） | 开启 + 告警 |

两个好习惯：

1. `logger.info("%s", x)` 而不是 f-string——在 DEBUG 被关闭时不浪费格式化开销；
2. `logging.getLogger(__name__)`——日志自带模块路径，出问题能定位到文件。

## 25.7 异常处理：真实世界的四个崩溃点

新手写 `except: pass` 等于把错误藏起来，最后在离现场 3 小时的地方爆炸。真实 AI 工程的四个高频异常：

```python
# ① API timeout —— 网络永远不可信
import requests
try:
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
except requests.Timeout:
    logger.warning("请求超时，稍后重试")
except requests.HTTPError as e:
    logger.error("HTTP %s：%s", e.response.status_code, e.response.text[:200])

# ② 文件缺失 —— 给出「缺什么、怎么办」
if not args.logfile.exists():
    logger.error("日志文件不存在：%s", args.logfile)
    return 2                     # 退出码告诉上游：输入错误

# ③ JSON 解析失败 —— 一行坏数据不该杀死全量处理
try:
    row = json.loads(line)
except json.JSONDecodeError:
    logger.warning("跳过坏行：%s", line[:80])

# ④ CUDA OOM —— 显存是有限资源
try:
    out = model(batch)
except torch.cuda.OutOfMemoryError:
    logger.error("OOM：batch=%d seq=%d，请减小 batch 或开启梯度累积", batch, seq)
    raise
```

:::warning 异常处理的三条纪律
1. 只在**能处理**的地方捕获（能重试就重试，能跳过就跳过，不能处理就让它崩）；
2. 捕获之后必须留下信息（log 级别 + 上下文）；
3. 退出码是接口：0 成功 / 1 业务失败 / 2 参数或输入错误——写脚本给别人用时尤其重要。
:::

## 25.8 requests / HTTP：模型服务的基本功

应用岗日常就是调 API。最少要理解五件事：

```
GET   /v1/models                       # 读
POST  /v1/chat/completions             # 写（带 JSON body）
状态码：200 成功 / 400 请求错 / 401 鉴权 / 429 限流 / 500 服务端错
timeout：不设 timeout = 可能永久挂住
retry：429/5xx 可重试；4xx 重试无意义
```

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
            wait = 2 ** attempt                     # 指数退避：2s, 4s, 8s
            logger.warning("第 %d 次失败，%ds 后重试", attempt, wait)
            time.sleep(wait)
```

## 25.9 asyncio：AI 应用开发的分水岭

调 10 次模型 API，每次等 2 秒：

```
同步（串行）:  A → B → C → ... → J     总耗时 ≈ 10 × 2 = 20s
异步（并发）:  A B C D E F G H I J      总耗时 ≈ 2s + 调度开销
                （同时发出，一起等待）
```

:::demo sync-async 交互：同步 vs 异步的时间线
拖动请求数量与单次延迟，对比两种模式的墙钟时间。
:::

核心 API 只有三个：

```python
import asyncio, aiohttp

async def one_call(session, prompt, sem):
    async with sem:                       # 信号量：最多 N 个并发
        async with session.post(URL, json={"prompt": prompt}) as resp:
            return await resp.json()

async def main(prompts):
    sem = asyncio.Semaphore(8)            # ⚠️ 不能 10000 个请求同时打出去
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60)) as session:
        tasks = [one_call(session, p, sem) for p in prompts]
        return await asyncio.gather(*tasks, return_exceptions=True)

results = asyncio.run(main(prompts))
```

:::warning 为什么不能「全并发」
1. 服务端有 QPS 限制：超了直接 429，重试风暴更糟；
2. 你的客户端也有资源上限（连接数、内存）；
3. 用 `Semaphore` 控制并发度，配合重试是标准做法。评测系统里这叫「**并发 + 限流 + 重试**」三件套。
:::

## 25.10 pytest：模型工程也需要测试

「模型训练不确定性太大，测不了」是误解。可测的东西非常多：数据解析、mask 构造、指标计算、配置加载、CLI 行为。

```python
def test_parse_line_extracts_loss():
    event = parse_line("2025-01-10 09:00:02 INFO  step=10 loss=7.812 tokens/s=1180")
    assert event.loss == pytest.approx(7.812)

def test_nan_detected():
    stats = analyze(parse_log_file(SAMPLE_NAN))
    assert stats.has_nan

def test_missing_file_exit_code(tmp_path):
    assert main([str(tmp_path / "missing.log")]) == 2
```

三个让测试真正有用的习惯：

1. **测异常路径**：文件不存在、坏数据、空输入——bug 都藏在那里；
2. **测试要能失败**：写下测试后，先故意改坏代码看它变红；
3. **测试是最好的文档**：新人读 `tests/` 比读源码快。

:::fold 练习：为什么这个测试第一次跑是红的？
```python
def test_best_step():
    stats = analyze(parse_log_file(SAMPLE))
    assert stats.best_step == 1000      # 第一次跑实际得到 550
```
我们的日志里除了 loss 行，还有 `WARNING step=550 val_loss increased`——它有 step 但没有 loss。最初实现把「所有 step」和「所有 loss」存进两个列表按下标对齐，warning 行混进来后**错位**了。修复：新增 `loss_steps` 只记录「同时带 loss 的 step」。

真实 bug 就是这样被测试逼出来的——不是靠盯代码。
:::

## 25.11 实战 Lab：log-analyzer（本课程已验证项目）

:::unfold 目标
不复现「写个 CLI」的玩具，而是交付一个**真实项目**：训练日志分析器。跑完训练后（或训练崩了之后），它能回答：final loss、best loss、平均吞吐、warning 列表、是否出现 NaN。
:::

**项目位置**：[`projects/log-analyzer/`](https://github.com/xhr0417/llm-course/tree/main/projects/log-analyzer)

```bash
cd projects/log-analyzer
pip install -r requirements.txt

python -m log_analyzer.cli samples/train.log
pytest -q
```

**真实运行输出**（本课程实测）：

```
== 训练日志分析 ==
事件数            : 22（原始行 22）
step 范围         : 10 → 1000
final loss        : 2.2710
best  loss        : 2.2710 (step 1000)
平均吞吐          : 4936 tokens/s
warning 数        : 3
error   数        : 0
NaN 事件          : 否
```

对发散日志（`samples/train_nan.log`）：

```
NaN 事件          : 是（训练可能已发散！）
warning 数        : 2
error   数        : 2
```

**架构**（正好是本节的工程原则）：

```text
src/log_analyzer/
├── parser.py    # 文本 → LogEvent（dataclass + 正则 + KV 解析）
├── stats.py     # LogEvent 序列 → TrainRunStats（聚合指标）
└── cli.py       # argparse + logging + JSON 输出 + 退出码
tests/test_analyzer.py   # 14 个测试
```

**这个项目用到的本章知识点**：

| 知识点 | 项目中的位置 |
| --- | --- |
| 项目结构解耦 | parser / stats / cli 三层互不依赖 |
| dataclass | `LogEvent`、`TrainRunStats` |
| typing | 全模块 type hints + `Optional` 指标 |
| pathlib | 文件输入一律 `Path`，不存在时退出码 2 |
| logging | `logger.info/error`，`--verbose` 控制级别 |
| argparse | `--json / --warnings / --verbose` |
| pytest | 14 个测试：解析 / 统计 / CLI / 子进程入口 |
| 异常处理 | 文件不存在 → 2；空日志 → 1；坏行跳过不崩 |

:::note Checkpoint A 的验收问题
这个项目就是 Checkpoint A 的参考实现。完成后你必须能回答：
- 为什么 best loss 出现在 step 1000 却报「best」？（因为 loss 仍在下降，最终值也是最小值）
- `--json` 输出为什么要保证字段稳定？（上层脚本会 parse，字段改名 = 破坏接口）
- 为什么坏行是「跳过」而文件缺失是「退出码 2」？（可恢复 vs 不可恢复）
:::

## 25.12 面试复盘：Python 工程

不能翻资料，试着回答：

1. 你的项目为什么按 `src/` 拆包，而不是全写在 `train.py`？
2. 配置为什么用 dataclass 而不是 dict？可变默认值为什么必须用 `default_factory`？
3. JSONL 和 JSON 的区别？流式读取内存优势在哪？
4. `logging` 和 `print` 的本质区别？为什么生产环境要分级别？
5. 你写过哪些 pytest？覆盖了哪些异常路径？
6. 一个 HTTP 请求失败，你的重试策略是什么？为什么 4xx 不重试？
7. 10 个 LLM 请求如何做并发控制？`Semaphore` 解决什么问题？
8. CLI 工具的退出码有哪几类？为什么它对自动化很重要？

:::quiz
你在写一个批量评测脚本，需要给 5000 个问题调用 API。以下哪种方案最合理？

A. for 循环逐个请求，每个等待 30 秒超时
B. asyncio 全并发，把 5000 个请求同时发出去
C. asyncio + Semaphore(8) 控制并发 + 超时 + 指数退避重试
D. 起 5000 个线程一次打完

答案: C
解析: A 太慢（串行）；B/D 会把服务端和你自己一起打爆（429 限流、连接耗尽）。标准做法是 C：并发提升吞吐，Semaphore 限流保护两端，超时 + 重试处理瞬时故障。这是评测系统（Capstone 1）并发评测一节的核心。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 项目结构 | 按职责拆包；scripts 只装配，src 可测试 |
| 配置 | argparse（入口）+ dataclass（内部）+ JSON（实验记录） |
| 数据 I/O | pathlib 统一路径；JSONL 逐行流式读取 |
| 可观测性 | logging 分级 + 延迟格式化；退出码是接口 |
| 健壮性 | 超时 + 指数退避重试；坏行跳过、缺文件报错 |
| 并发 | asyncio.gather + Semaphore 限流（不是全并发） |
| 测试 | pytest 覆盖异常路径；先让测试变红再修复 |
:::

:::related
依赖 | 第 11 章 PyTorch, 第 23 章 LLM Evaluation（评测脚本工程化）
用于 | 第 26 章 HuggingFace, Capstone 1（Eval Harness）, Capstone 2（RAG Service）
:::
