:::intuition 一句话
第 11 章解决「怎么看懂模型代码」；这一章解决「**怎么亲手写出一个真正的工程项目**」——不是看一个做好的仓库，而是从一个不完整的 starter 出发，让 41 个测试从红变绿。
:::

:::warning 这一章的模式变了：三层结构
以前的章节是「解释概念 → 给完整代码 → 让你运行」。这一章开始，Job-Ready Track 升级为 **Guided Build**：

| 层级 | 你获得什么 | 在哪里 |
| --- | --- | --- |
| **Level 1 · Learn** | 工程基础讲解（argparse / dataclass / logging / pytest…） | 本章 25.3 参考手册 + 各 Step 内嵌知识盒 |
| **Level 2 · Guided Build** | 一个不完整的 starter + 10 步任务 + 分步测试 | `projects/log-analyzer/starter/`（25.2 的 Lab） |
| **Level 3 · Reference Solution** | 完整工程实现（完成后才能对照） | `projects/log-analyzer/`（25.4） |

**完成的定义**：starter 的 41 个测试全部通过 + 你能不看资料回答 Step 9 的复盘问题。打开参考实现不算完成。
:::

## 25.1 这一章怎么学

本文档假设你已经会写 Python 函数和循环。我们只教 **AI 实习里最常用的工程部分**，而且是用「做项目」的方式教：

```
你打开一章
   ↓
下载 starter
   ↓
运行 pytest：41 failed（这是设计好的，不是你的错）
   ↓
写第一段代码（Step 1）
   ↓
测试变绿一部分
   ↓
遇到脏数据、错位 bug（Step 3 / Step 5）
   ↓
定位 → 修复 → 测试全绿
   ↓
真实运行 CLI，产出你自己的报告
   ↓
最后对照 Reference Solution，回答复盘问题
```

每一步都遵循同一个循环：

**目标 → 预测 → 你来写 → 运行 → （失败）→ 观察 → 修复 → 测试 → 解释**

:::note 为什么先给「失败的测试」
真实工程里，测试就是需求和验收标准。starter 的 41 个失败不是惩罚，而是任务清单：
每写一个函数，就有一组测试从红变绿。你会同时得到「方向」和「反馈」——
这正是工业界读一个陌生 repo、接手一个未完成 feature 的真实体验。
:::

## 25.2 项目：Training Log Analyzer

**要解决的问题**：一次训练跑完（或崩掉）之后，你要从 `train.log` 里快速回答：

- final loss / best loss 是多少、出现在哪一步？
- 平均吞吐（tokens/s）是多少？
- 有没有 warning（grad norm 超阈值、val loss 上升）？
- 有没有出现 NaN、训练是否发散？

**最终交付物**（就是你要亲手做的）：一个 CLI 项目 ——

```bash
# 【在哪台机器】Mac 或 Linux Server 都可以【当前目录】repo root
cd projects/log-analyzer/starter
python -m log_analyzer.cli samples/train.log          # 人读报告
python -m log_analyzer.cli samples/train.log --json    # 机读 JSON（字段契约）
python -m log_analyzer.cli samples/train_nan.log --warnings
pytest -q                                              # 41 passed（= 课程提供的 38 个 + 你写的 3 个）
```

参考实现的真实输出（本课程实测，你做完后应该得到同类结果）：

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

**starter 在哪里**：`projects/log-analyzer/starter/`（你写代码的地方）。
**参考实现在哪里**：`projects/log-analyzer/`（先不要打开——最后对照用）。

:::lab log-analyzer · Guided Build
goal: 从零实现一个训练日志分析 CLI：parser / stats / CLI 三层，41 个测试全绿
project: projects/log-analyzer/starter
effort: 2–4 小时（每个 Step 约 10–30 分钟）
prereq: 会写 Python 函数 / 循环 / dict；装好 Python 3.9+ 与 pytest
deliverable: 通过全部测试的 src/log_analyzer/（parser + stats + cli；41 = 课程提供的 38 + 你在 Step 8 自己写的 3 个）+ 真实运行输出

:::where
机器：🖥 Mac 或 ☁ Linux Server 都可以（纯标准库 + pytest，不需要 GPU，也不需要下载模型）
执行纪律：`pip install` 和 `pytest` 必须在同一台机器上执行；换机器要重新装依赖
Repo Root：你 clone 的 llm-course 目录（`pwd` 确认；忘了位置用 `git rev-parse --show-toplevel`）
Starter：projects/log-analyzer/starter（你写代码的地方）
Reference：projects/log-analyzer（完整参考实现，做完再对照）
大文件：无——本项目不产生模型 / 数据集 / checkpoint
GitHub：只提交 src/ tests/ README 等小文件；先 `git status` 看，再 `git add` 具体文件
:::

:::step 0 准备环境与第一次运行
:::goal
在一台明确的机器（Mac 或 Linux Server）上、一个明确的目录里，把 starter 跑起来看到初始红色测试——
并且理解：**这是正常的**。
:::

:::why
Guided Build 的第一步永远是「先让项目在你机器上跑起来」。连测试都不会跑，
后面每一步的反馈都无从谈起。

但比「跑起来」更前置的问题是：**这条命令在哪台机器、哪个目录执行？** 很多新手就卡在这里——
所以本步会把你需要的环境知识一次讲清，后面所有 Step 都只重复标签。
:::

:::note 先建立三个「地方」的心智模型（只读一次，后面都靠它）
```text
        🌐 GitHub（远程仓库）               ← 网页，不是命令执行环境
        https://github.com/xhr0417/llm-course
                 ↑ push / pull        ↓ clone / pull
        🖥 Mac（本地）                  ☁ Linux 服务器
        ~/Projects/llm-course         ~/workspace/llm-course
```
- **GitHub 不是文件夹、也不跑命令**：任何机器都必须先 `git clone`，本地才有一份真实目录；
- **Mac 和服务器可以各有一份 clone**：两块硬盘上的两份文件，不会自动同步（用 GitHub 中转）；
- **`cd` 只改变你当前登录那台机器的当前目录**：Mac 终端里 `cd llm-course` 进的是 Mac 的目录；
  `ssh` 之后再 `cd llm-course`，进的是服务器的目录——名字一样，其实是两份文件。

完整版（含服务器工作流 / 文件该放哪里 / 常见报错）：[docs/ENVIRONMENT_AND_WORKFLOW.md](https://github.com/xhr0417/llm-course/blob/main/docs/ENVIRONMENT_AND_WORKFLOW.md)。
:::

:::files
starter/
├── README.md            # 先读它：Step → 测试 对应表
├── requirements.txt     # 只需要 pytest
├── samples/train.log    # 真实训练日志（22 行）
├── samples/train_nan.log
├── src/log_analyzer/    # ← 你要在这里写代码（现在全是 NotImplementedError）
└── tests/               # 41 个测试，分 8 个步骤文件
:::

:::run 🖥 Mac 或 ☁ Linux Server（任选一台，以下命令全部在同一台上执行）
```bash
# 【第 0 件事】确认你在哪台机器（看提示符不够放心就运行这两条）
hostname        # 我在哪台机器
pwd             # 我在哪个目录

# 【如果你还没有这个 repo】先 clone（路径只是示例，可以换成你喜欢的目录）
cd ~/Projects                       # Mac 示例；服务器可用 mkdir -p ~/workspace && cd ~/workspace
git clone https://github.com/xhr0417/llm-course.git
cd llm-course

# 【如果你已经有 repo，只是想确认/回到 repo root】
cd "$(git rev-parse --show-toplevel)"
pwd                                 # 记下这个输出 = 你的 repo root

# 【进入 starter】
cd projects/log-analyzer/starter
pwd                                 # 必须以 llm-course/projects/log-analyzer/starter 结尾
                                    # ⚠️ 不是这个结尾就先别继续：你可能在另一台机器或另一个目录

# 【装依赖 + 第一次运行】在哪台机器跑 pytest，就在哪台机器装依赖
pip install -r requirements.txt
pytest -q
```
:::

:::expect
```text
41 failed in 0.15s
```
（真实记录：本课程在 Python 3.12 + pytest 9 下实测为 `41 failed in 0.15s`；pytest 版本不同时措辞可能略有差异，关键是 41 个失败。）
:::

:::fail
如果你看到的是：
- `No module named pytest` → 依赖没装好，先 `pip install -r requirements.txt`（注意：要在**同一台机器**上装）；
- `collected 0 items` → 你在错误的目录里运行 pytest，先用 `pwd` 确认路径最后是 `projects/log-analyzer/starter`；
- `0 failed` 全绿 → 你打开的不是 starter，而是参考实现（检查路径里有没有 `starter/`）；
- `cd: no such file or directory` → 目录名不对或你在另一台机器；用 `pwd` + `ls` 看看自己实际在哪。
:::

:::hint Hint 1 — 用哪个 Python
先 `python --version` 确认 3.9+。如果有多个环境（conda / pyenv / venv），
记住你装 pytest 的那个环境和运行 pytest 的必须是同一个。
:::

:::hint Hint 2 — 只跑本步
一上来跑全量 41 个失败容易晕。课程每一步都给了单文件命令，例如
`pytest -q tests/test_step1_load.py`——一次只看 5 个测试。
:::

:::checkpoint
你能画出这条链：**starter（不完整）→ pytest 红 → 我实现 → pytest 绿**。
:::

:::explain
- 为什么 starter 一上来应该是红的？如果它全绿，问题出在哪？
- 测试文件为什么按 step 拆成 8 个而不是一个大文件？
- 在 Mac 终端里 `cd llm-course` 和 ssh 到服务器后 `cd llm-course`，进入的是同一个文件夹吗？为什么？
- 现在你运行 `pytest` 的这台机器是 Mac 还是服务器？刚才 `pip install` 装到了哪台机器上？
:::
:::

:::step 1 先读取日志文件（pathlib / encoding）
:::goal
实现 `load_lines()`：按 UTF-8 读出文件的每一行；文件不存在时抛出 `FileNotFoundError`。
:::

:::why
所有数据管线都从「把文件读进内存」开始。用 `pathlib.Path` 而不是字符串拼路径，
是所有 AI 项目的统一惯例（Windows/macOS/Linux 行为一致，还能直接用 `/` 拼路径）。
:::

:::files
要改的文件：`src/log_analyzer/parser.py`（函数 `load_lines`）
:::

:::note pathlib 与编码的两个硬规则
```python
from pathlib import Path

path = Path("samples") / "train.log"          # 用 / 拼路径，不写 "samples/train.log"
text = path.read_text(encoding="utf-8")       # 中文环境必须显式 utf-8
lines = text.splitlines()                     # 不带换行符；空行保留（占总行数是有效信息）
```
- `encoding` 不写也能跑——直到某天遇到 GBK 日志在 CI 上炸掉。**显式写**。
- `.splitlines()` 和 `.split("\n")` 的区别：前者处理 `\r\n`、`\r`，跨平台更稳。
:::

:::write
**你来写**：实现 `load_lines(path)`。

- TODO 1：用 `Path(path).read_text(encoding="utf-8")` 读文件；
- TODO 2：用 `.splitlines()` 拆行返回（返回 `list[str]`）；
- TODO 3：**不要** try/except 吞掉 `FileNotFoundError`——让它抛给调用方。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step1_load.py
```
:::

:::expect
```
5 passed
```
:::

:::fail
- `UnicodeDecodeError` → 检查是否真的写了 `encoding="utf-8"`；
- 测试报 `DID NOT RAISE FileNotFoundError` → 你把异常吞掉了（比如错误的 try/except）；
- 行尾多了 `\n` → 你用了 `read().split("\n")` 而文本以换行结尾会多出一个空字符串，改用 `splitlines()`。
:::

:::hint Hint 1
函数体可以只有两行：一行读取（显式 utf-8），一行 splitlines。
:::

:::hint Hint 2
如果你习惯性写了 `if not path.exists(): return []`——删掉它。
「文件不存在」和「文件是空的」是两种完全不同的情况，第一步就要把它们分开。
:::

:::solution
```python
def load_lines(path: "Path | str") -> list[str]:
    """按 UTF-8 读取文件的每一行（不含行尾换行符）。"""
    return Path(path).read_text(encoding="utf-8").splitlines()
```
:::

:::checkpoint
`pytest -q tests/test_step1_load.py` → 5 passed。并且你能说出缺文件时抛异常的理由。
:::

:::explain
- 为什么「文件不存在」应该是异常，而「文件为空」是空列表？两者在 CLI 上的处理有何不同（退出码 2 vs 1，Step 7 会验收）？
- 显式声明 `encoding="utf-8"` 防的是什么类型的 bug？
:::
:::

:::step 2 解析第一条训练日志（dataclass / typing / 正则）
:::goal
把一行文本变成结构化数据：定义 `LogEvent`，实现 `parse_line()` / `parse_lines()` / `parse_log_file()`。
:::

:::why
文本日志是一坨非结构化字符串；后面的所有统计（loss 曲线、吞吐、warning）都依赖
「先把它变成有类型的数据」。这正是 AI 数据管线的通用第一步：**解析成结构化记录**。
:::

:::note dataclass：为什么不用 dict
```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class LogEvent:
    timestamp: datetime
    level: str
    message: str
    fields: dict[str, str] = field(default_factory=dict)
```
1. 属性访问有补全、拼错属性名直接 `AttributeError`（`event.los` 这种错在 dict 里要跑到线上才发现）；
2. 默认值统一管理，`LogEvent(...)` 构造出来的对象一定合法；
3. 可变默认值必须用 `field(default_factory=...)`——顺便避开 Python 经典坑；
4. `frozen=True` 让事件不可变：日志是事实，不应被下游随手改。
:::

:::note 类型注解只需要这些
```python
from typing import Optional

def parse_line(line: str) -> Optional[LogEvent]: ...   # 可能解析失败 → None
@property
def step(self) -> Optional[int]: ...                    # 可能没有 step → None
```
`Optional[X]` 不是装饰品：它告诉调用方「这里必须处理 None」。这是你能给协作者的最低成本的文档。
:::

:::files
要改的文件：`src/log_analyzer/parser.py`
- `LogEvent.step` / `LogEvent.loss` / `LogEvent.tokens_per_sec` 三个 property
- `parse_line` / `parse_lines` / `parse_log_file`
:::

:::predict
运行之前先预测（写在纸上）：
1. 对 `"2025-01-10 09:00:02 INFO  step=10 loss=7.812 lr=3.0e-4 tokens/s=1180"`，`fields` 字典会有几个键？
2. `samples/train.log` 一共 22 行，`parse_log_file` 应该返回几个事件？
:::

:::write
**你来写**：

- TODO 1：`step` property——`fields.get("step")`，是纯数字才转 `int`，否则 `None`；
- TODO 2：`loss` property——转 `float`，转换失败返回 `None`（不要抛异常）；
- TODO 3：`tokens_per_sec` property——**注意键名是 `tokens/s`**（带斜杠）；
- TODO 4：`parse_line`——先过行级正则拿到「时间戳 + 级别 + 内容」，再把内容里的 `key=value` 全部切进 `fields`；
- TODO 5/6：`parse_lines`（跳过 None）、`parse_log_file`（组合 `load_lines` + `parse_lines`）。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step2_parse.py
```
:::

:::expect
```
8 passed
```
:::

:::fail
- `tokens_per_sec` 永远返回 None → 你的 KV 正则不允许键名里出现 `/`（这是本项目开发时**真实踩过的坑**，见下方 Bug 记录）；
- 时间戳解析失败 → 格式是 `%Y-%m-%d %H:%M:%S`；
- `parse_line("garbage")` 抛异常 → 正则用 `match` 时要先判 None 再继续。
:::

:::bug 真实踩坑 · 正则漏了斜杠（本项目开发记录）
早期版本的 KV 正则是 `[A-Za-z_][A-Za-z0-9_]*=`——不允许键名含 `/`。
于是每一行里的 `tokens/s=1180` 都解析不出来，`tokens_per_sec` 永远 None，
吞吐统计静默为空。**pytest 抓出了它**（而不是靠盯代码）。修复：`[A-Za-z_][A-Za-z0-9_/]*=`。
教训：正则的字符集要按「真实日志里可能出现的键名」写，写完先打印一遍 `fields` 肉眼核对。
:::

:::hint Hint 1
行级正则的形状是：
`^(时间戳)\s+(级别)\s+(内容)$`——时间戳用 `\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}`，
级别用 `DEBUG|INFO|WARNING|ERROR`，内容用 `.*`。用命名分组（`(?P<name>...)`）更可读。
:::

:::hint Hint 2
`fields` 的构造可以一行完成：
`{kv.group("key"): kv.group("value") for kv in KV_RE.finditer(message)}`。
KV 正则的 value 部分用 `[^\s]+`（直到空白为止），这样 `lr=3.0e-4` 会被完整拿到。
:::

:::solution
```python
LINE_RE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+"
    r"(?P<level>DEBUG|INFO|WARNING|ERROR)\s+"
    r"(?P<msg>.*)$"
)
KV_RE = re.compile(r"(?P<key>[A-Za-z_][A-Za-z0-9_/]*)=(?P<value>[^\s]+)")


def parse_line(line: str) -> Optional[LogEvent]:
    line = line.rstrip("\n")
    if not line.strip():
        return None
    m = LINE_RE.match(line)
    if not m:
        return None
    fields = {kv.group("key"): kv.group("value") for kv in KV_RE.finditer(m.group("msg"))}
    return LogEvent(
        timestamp=datetime.strptime(m.group("ts"), TS_FORMAT),
        level=m.group("level"),
        message=m.group("msg"),
        fields=fields,
    )
```
:::

:::checkpoint
`pytest -q tests/test_step2_parse.py` → 8 passed。你能口头解释 `fields` 为什么不拆成 `self.step` 这样的字段。
:::

:::explain
- dataclass 相比 dict 的 4 个收益里，哪个对你调试最有帮助？
- 为什么 `step` / `loss` 用 property 从 `fields` 里「按需解析」，而不是在 `parse_line` 里立刻转好？
:::
:::

:::step 3 现实日志没有这么干净（脏行 / 未知字段 / 坏值）
:::goal
让 parser 扛住真实世界的四类脏数据：WARNING/ERROR 行、NaN 描述行、未知新字段、坏 KV 值。
:::

:::why
教程里的日志永远是干净的；生产日志不是。处理边界输入的能力，
是「玩具代码”和「工程代码」的分界线——也是面试官判断你写没写过真实项目的地方。
:::

:::files
要改的文件：还是 `src/log_analyzer/parser.py`（增强 `parse_line` 与属性解析）
:::

:::predict
先预测，再看答案：
1. `parse_line("2025-01-10 09:00:02 INFO  step=10 loss=abc tokens/s=1180")` —— `loss` 应该抛出 `ValueError`，还是返回 `None`？
2. 一行 `File "train.py", line 42`（没有时间戳）应该被解析成事件吗？
3. `samples/train_nan.log` 的 `ERROR step=34 loss is NaN` —— 这一行有 `loss=` 键值对吗？NaN 该怎么被发现？
:::

:::note `except: pass` 为什么危险（三条纪律）
1. **只捕获你能处理的异常**：坏 KV 值 → 返回 None 是可以处理的；文件不存在 → 不该在这里处理；
2. **捕获后必须留下信息**：要么转成有语义的返回值（None），要么日志记录，禁止静默吞掉；
3. **不要捕获裸 `Exception`**：`except: pass` 会把 `KeyboardInterrupt`、拼写错误、逻辑 bug 一起吞掉，
   最后在离现场 3 小时的地方爆炸。
:::

:::write
**你来写**（都在 `parser.py`）：

- TODO 1：`loss` / `tokens_per_sec` 对坏值（`loss=abc`）返回 `None` 而不是崩溃；
- TODO 2：未知字段照单全收（`new_metric=0.42` 要出现在 `fields` 里）；
- TODO 3：确认 `parse_line` 对空行 / 续行（无时间戳）返回 `None`；
- TODO 4：不用改代码，但用一行 Python 验证 NaN 行如何进入统计——它的信号在 `message` 里（含 "NaN"），不在 `fields` 里。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step3_messy.py
```
:::

:::expect
```
6 passed
```
:::

:::fail
- `test_bad_value_does_not_crash` 失败 → 你在属性里让 `ValueError` 冒出来了；
- `test_unknown_fields_are_kept` 失败 → 你的 KV 切分只认白名单键名；
- 数一数 `pytest` 输出里的行数：WARNING 行有 step 但没有 loss——**记住这个观察，Step 5 会用到**。
:::

:::hint Hint 1
`float("abc")` 抛 `ValueError`，所以 `loss` 里需要：
```python
try:
    return float(raw)
except ValueError:
    return None
```
:::

:::hint Hint 2
“跳过坏行”和“字段变 None”是两种不同处理：
- 整行无结构（续行）→ `parse_line` 返回 None（跳过）；
- 行有结构但某字段坏了 → 事件保留、该字段 None。
问自己：为什么不能把坏字段的行整个丢掉？
:::

:::solution
```python
@property
def loss(self) -> Optional[float]:
    raw = self.fields.get("loss")
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None
```

```python
@property
def step(self) -> Optional[int]:
    raw = self.fields.get("step")
    return int(raw) if raw is not None and raw.isdigit() else None
```
:::

:::checkpoint
`pytest -q tests/test_step3_messy.py` → 6 passed。你能说出「跳过整行」与「字段为 None」的语义区别。
:::

:::explain
- 如果 `parse_line` 遇到坏 KV 就 raise，CLI 的行为会怎样变化？这是你想要的行为吗？
- 为什么 NaN 检测依赖 `message` 而不是某个 KV 字段？（提示：看 `samples/train_nan.log` 那一行的实际格式）
:::
:::

:::step 4 统计训练结果（聚合指标）
:::goal
实现 `analyze()`：从事件序列算出 final loss、best loss、平均吞吐、warning/error/NaN 统计，并提供 `to_dict()`。
:::

:::why
解析只是原料；面试官和论文看的是**指标**。聚合逻辑（哪些事件算样本、缺值怎么办）
是数据正确性的核心——统计口径错了，后面所有结论都错。
:::

:::files
要改的文件：`src/log_analyzer/stats.py`
- 属性 `final_loss` / `best_loss` / `avg_tokens_per_sec` / `has_nan`
- 方法 `to_dict()` 与函数 `analyze()`
:::

:::predict
运行之前先回答（这是本项目的第一个「数据直觉」题）：
1. `samples/train.log` 的 final loss 和 best loss，哪个应该更大？
2. 平均吞吐的量级大概是多少（几百 / 几千 / 几万 tokens/s）？
3. `samples/train_nan.log` 里 warning 数和 error 数分别是几？
:::

:::write
**你来写**（`stats.py`）：

- TODO 1：`final_loss`——`losses[-1]`，空列表返回 None；
- TODO 2：`best_loss`——`min(losses)`，空列表返回 None；
- TODO 3：`avg_tokens_per_sec`——吞吐样本的算术平均；
- TODO 4：`has_nan`——`nan_events` 非空即为 True；
- TODO 5：`to_dict()`——把结果整理成 JSON 友好的 dict（Step 6 的 `--json` 直接用它，**字段名就是对外契约**）；
- TODO 6：`analyze(events, total_lines)`——遍历事件：填 steps / losses / throughput / warnings / errors / nan_events / start_time / end_time。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step4_stats.py
```
:::

:::expect
```
6 passed
```
（此时 final loss = 2.271，平均吞吐 ≈ 4936 tokens/s——你的预测对吗？）
:::

:::fail
- 数字对不上 → 先打印你填充的 `losses` 列表和真实日志对比；
- `test_nan_detected` 失败 → `"nan" in event.message.lower()`，注意大小写；
- `test_to_dict_is_json_friendly` 失败 → 检查 `steps` 是不是 `{"first": ..., "last": ...}` 结构、`num_warnings` 等字段名是否完全一致——**JSON 字段名是不能随便改的接口**。
:::

:::hint Hint 1
`analyze` 用一次 for 循环就能填完所有字段。start_time 只记第一个事件的、
end_time 每次覆盖（这样最后一次覆盖就是最后一个事件的时间）。
:::

:::hint Hint 2
`to_dict` 里 `steps` 字段是嵌套 dict（`{"first":..., "last":...}`）；
`parsed_events` 用 `len(events)`，`total_lines` 从参数传入——这两个数字不一样大是正常的（有坏行时）。
:::

:::solution
```python
@property
def final_loss(self) -> Optional[float]:
    return self.losses[-1] if self.losses else None

@property
def best_loss(self) -> Optional[float]:
    return min(self.losses) if self.losses else None

@property
def avg_tokens_per_sec(self) -> Optional[float]:
    if not self.throughput_samples:
        return None
    return sum(self.throughput_samples) / len(self.throughput_samples)

@property
def has_nan(self) -> bool:
    return len(self.nan_events) > 0
```
:::

:::checkpoint
`pytest -q tests/test_step4_stats.py` → 6 passed。你能解释 `final_loss` 与 `best_loss` 在本样例中为什么相等吗？
:::

:::explain
- 「平均吞吐」用算术平均合理吗？如果日志里前 100 步和后 900 步样本数不均，会出现什么问题？
- `to_dict()` 的字段名为什么说「是对外契约」？（提示：想想 `--json` 输出被别的脚本消费的场景）
:::
:::

:::step 5 制造并修复一个真实容易出现的错位 bug
:::goal
先让你的实现得到一个**自信的错误答案**（best_step = 550），再定位并修复它（正确答案 1000）。
:::

:::why
这是本 Lab 最重要的一步，也是真实工程里最贵的一类 bug：
**数据错位（misalignment）**。它不会报错、不会崩溃，只会给你一个看起来很正常、实际上是错的数字。
如果你将来做 LLM 评测/数据管线，错位的形态会变（prompt 与 label 错位、样本与分数错位），但本质完全一样。
:::

:::bug 真实踩坑（本项目开发时 pytest 抓出）→ 在 starter 中被刻意复现为 Deliberate Exercise
日志里有 3 行 WARNING 是「有 step、没有 loss」的：
```
WARNING step=25  grad_norm=12.53 (> clip 1.0)
WARNING step=75  grad_norm=8.91 (> clip 1.0)
WARNING step=550 val_loss increased (2.41 -> 2.46)
```
如果实现把「所有 step」和「所有 loss」按下标对齐：
`best_step = steps[losses.index(min(losses))]`，
那么第 3 行 warning 之后，两个数组整体错位——best loss 明明发生在 step 1000，
你却会得到 **550**（真实开发时就是 550 这个数字，由 pytest 抓出）。
:::

:::files
要改的文件：`src/log_analyzer/stats.py`
:::

:::predict
先预测，再运行：
1. 现在的实现（steps 和 losses 按出现顺序各自收集）算出的 `best_step` 会是什么？
2. 正确答案应该是什么？为什么？
3. 把 `steps` 列表打印出来，数一数它有几个元素？`losses` 呢？
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step5_alignment.py
```
:::

:::expect
```
3 failed
```
预期失败信息：`assert 550 == 1000`（或类似）。**这个红色是设计好的**——它模拟真实开发中测试抓出 bug 的那一刻。
:::

:::fail
如果 `best_step` 直接 AttributeError → 你的 `TrainRunStats` 还没有 `best_step` / `loss_steps`，这正是本步要添加的。
:::

:::write
**你来写**（`stats.py`）：

- TODO 1：给 `TrainRunStats` 新增字段 `loss_steps: list[int]`；
- TODO 2：在 `analyze()` 里，只有 `event.loss is not None` **且** `event.step is not None` 时才向 `loss_steps` 追加；
- TODO 3：实现 `best_step` property，用 `loss_steps`（而不是 `steps`）和 `losses` 对齐。
:::

:::inspect
定位三连（不要猜，逐步验证）：
1. `print(len(stats.steps))` → 20；`print(len(stats.losses))` → 17。20 ≠ 17，**错位的源头就在这里**；
2. 在 `samples/train.log` 里找到那 3 行「有 step 没 loss」的 WARNING（step=25 / 75 / 550）；
3. 结论：`steps` 不能直接和 `losses` 配对。需要一个「只记录带 loss 的 step」的新列表。
:::

:::hint Hint 1
在 `TrainRunStats` 里新增字段 `loss_steps: list[int]`；
在 `analyze()` 里，只有当 `event.loss is not None and event.step is not None` 时，才往 `loss_steps` 追加 `event.step`。
:::

:::hint Hint 2
`best_step` 的实现应该用 `loss_steps` 与 `losses` 对齐：
```python
best_idx = self.losses.index(min(self.losses))
return self.loss_steps[best_idx]
```
并处理空列表（返回 None）。
:::

:::solution
```python
@dataclass
class TrainRunStats:
    ...
    loss_steps: list[int] = field(default_factory=list)   # 新增：只含带 loss 的 step

@property
def best_step(self) -> Optional[int]:
    if not self.losses or not self.loss_steps:
        return None
    best_idx = self.losses.index(min(self.losses))
    return self.loss_steps[best_idx]
```

```python
# analyze() 内：
if event.loss is not None:
    stats.losses.append(event.loss)
    if event.step is not None:
        stats.loss_steps.append(event.step)     # 对齐修复：两个列表同步追加
```
:::

:::checkpoint
`pytest -q tests/test_step5_alignment.py` → 3 passed（best_step = 1000）。
:::

:::explain
- 用一句话向面试官解释这个 bug 的成因和你的修复（提示：数据来源不同步的两个列表不能按位置配对）；
- 为什么这个 bug 在 code review 时很难看出来，而一个 3 行的测试就能抓住它？
- 如果把「warning 行」换成「多机训练时两台机器的日志合并」，同样的错位会以什么形式出现？
:::
:::

:::step 6 把脚本变成 CLI（argparse）
:::goal
实现 `build_parser()` / `format_report()` / `main()`：支持 `--json` / `--warnings` / `--verbose`，用 `python -m` 运行。
:::

:::why
项目从「能跑」到「别人能用」，就差一个命令行入口。实习里 90% 的交付物最终都是
一个可复用命令 + 一个配置文件——而不是一段要求别人改代码的脚本。
:::

:::files
要改的文件：`src/log_analyzer/cli.py`
:::

:::note argparse 的五个要点
```python
import argparse

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="log_analyzer", description="分析训练日志")
    parser.add_argument("logfile", type=Path, help="日志文件路径")          # 位置参数
    parser.add_argument("--json", action="store_true", help="JSON 输出")     # 开关
    parser.add_argument("--warnings", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    return parser
```
1. `python -m log_analyzer.cli` 依赖 `if __name__ == "__main__": raise SystemExit(main())`；
2. `main(argv=None)` 接收 argv 才能在测试里直接调用（不要写死 `sys.argv`）；
3. 默认值必须能跑通：`python -m log_analyzer.cli samples/train.log` 不带任何选项就出报告；
4. `--json` 的字段名是给脚本消费的接口；
5. `type=Path` 让 argparse 直接给你 Path 对象。
:::

:::write
**你来写**（`cli.py`）：

- TODO 1：`build_parser()`——四个参数如上；
- TODO 2：`format_report(stats)`——人读文本（至少包含 `final loss` / `best` / `平均吞吐` / `warning` / `NaN` 这些词）；
- TODO 3：`main(argv)`——解析参数 → 读文件 → 解析 → 统计 → 输出；`--json` 时 `print(json.dumps(stats.to_dict(), ensure_ascii=False, indent=2))`；
- TODO 4：文件末尾加 `if __name__ == "__main__": raise SystemExit(main())`。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step6_cli.py
python -m log_analyzer.cli samples/train.log
```
:::

:::expect
```
4 passed
```
以及你在终端里第一次看到自己写的报告。
:::

:::fail
- `SystemExit` 相关失败 → `main` 里千万**不要**自己调 `sys.exit()`，只 `return` 退出码，让 `__main__` 兜底；
- `test_json_output_contract` 失败 → 对照 `to_dict()` 的字段名逐字核对；
- 子进程测试失败（`test_module_entrypoint`）→ 确认 `src/` 通过 `PYTHONPATH` 或 `pip install -e .` 可见。
:::

:::hint Hint 1
`main` 的骨架：
`args = build_parser().parse_args(argv)` → `events = parse_log_file(args.logfile)`
→ `stats = analyze(events, total_lines=...)` → 按 `args.json` 分支输出 → `return 0`。
:::

:::hint Hint 2
`--warnings` 分支：遍历 `stats.warnings` 打印 `[timestamp] message`；
`--verbose` 这一步只需要把参数定义加上（Step 7 才接 logging）。
:::

:::solution
```python
def format_report(stats) -> str:
    lines = [
        "== 训练日志分析 ==",
        f"事件数            : {stats.parsed_events}（原始行 {stats.total_lines}）",
        f"step 范围         : {stats.steps[0] if stats.steps else '-'} → {stats.steps[-1] if stats.steps else '-'}",
        f"final loss        : {stats.final_loss:.4f}" if stats.final_loss is not None else "final loss        : -",
        f"best  loss        : {stats.best_loss:.4f} (step {stats.best_step})" if stats.best_loss is not None else "best  loss        : -",
        f"平均吞吐          : {stats.avg_tokens_per_sec:.0f} tokens/s" if stats.avg_tokens_per_sec else "平均吞吐          : -",
        f"warning 数        : {len(stats.warnings)}",
        f"error   数        : {len(stats.errors)}",
        f"NaN 事件          : {'是（训练可能已发散！）' if stats.has_nan else '否'}",
    ]
    return "\n".join(lines)
```
:::

:::checkpoint
`pytest -q tests/test_step6_cli.py` → 4 passed，并且 `python -m log_analyzer.cli samples/train.log` 在你终端里输出报告。
:::

:::explain
- 为什么 `main` 只返回 int、不调用 `sys.exit()`？（提示：可测试性）
- `--json` 输出为什么要保证字段稳定？字段改名会给谁带来麻烦？
:::
:::

:::step 7 logging 与退出码：可恢复 vs 致命
:::goal
用 `logging` 取代 print 调试；区分「坏行跳过」（可恢复）与「文件缺失 / 空日志」（致命），并用退出码表达。
:::

:::why
脚本给别人用的那一刻起，**退出码就是你和上游的接口**：
CI / Shell / Airflow 都靠它判断成败。而 logging 决定了线上出问题时你能否定位。
:::

:::files
要改的文件：`src/log_analyzer/cli.py`
:::

:::note logging 四个级别与三条纪律
| 级别 | 用途 | 生产环境 |
| --- | --- | --- |
| DEBUG | 每步调试细节（`--verbose` 时开启） | 关闭 |
| INFO | 关键里程碑（分析开始 / 完成） | 开启 |
| WARNING | 异常但可继续（跳过坏行） | 开启 |
| ERROR | 出错（文件不存在、无有效事件） | 开启 + 告警 |

- 用 `logging.getLogger(__name__)`，日志自带模块路径；
- 用 `logger.info("%s", x)` 而不是 f-string（关闭日志级别时不浪费格式化开销）；
- 退出码：**0 成功 / 1 业务失败 / 2 参数或输入错误**。
:::

:::predict
先分类再写代码——下面四种情况，哪些是「跳过继续」，哪些是「退出」？退出该用 0/1/2 哪个码？
1. 日志文件路径不存在；
2. 22 行里混了 1 行损坏数据；
3. 文件存在但一整行有效事件都没有；
4. `samples/train_nan.log` 里出现 NaN。
:::

:::write
**你来写**（`cli.py`）：

- TODO 1：`logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, ...)`；
- TODO 2：文件不存在 → `logger.error(...)` + `return 2`（**不要**让 `FileNotFoundError` 冒出去）；
- TODO 3：解析后没有任何事件 → `return 1`；
- TODO 4：坏行只记 `logger.warning` / 静默跳过，最终 `return 0`；
- TODO 5：NaN 事件打到 `stderr`（`print(..., file=sys.stderr)`）。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step7_logging.py
python -m log_analyzer.cli samples/train_nan.log; echo "exit=$?"
```
:::

:::expect
```
6 passed
```
`echo "exit=$?"` 对 NaN 日志应显示 `exit=0`（NaN 是业务结论，不是程序失败）。
:::

:::fail
- 看到 Python traceback → 你在 `main` 外抛了异常；
- `test_missing_file_exit_2` 失败 → 检查是否在解析前就 `return 2`；
- `test_bad_lines_are_skipped_not_fatal` 失败 → 检查 `parsed_events` 与 `total_lines` 有没有分别正确统计。
:::

:::hint Hint 1
`args.logfile.exists()` 判断必须在 `parse_log_file` 之前——
否则 `FileNotFoundError` 会先炸在 parser 里。
:::

:::hint Hint 2
空日志与「全坏行」都是 `if not events: return 1`——它们对用户是同一种结论：
「这个文件里没有你能用的数据」。
:::

:::solution
```python
def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    if not args.logfile.exists():
        logger.error("日志文件不存在：%s", args.logfile)
        return 2
    events = parse_log_file(args.logfile)
    if not events:
        logger.error("没有解析到任何合法日志行：%s", args.logfile)
        return 1
    stats = analyze(events, total_lines=len(load_lines(args.logfile)))
    ...
    return 0
```
:::

:::checkpoint
`pytest -q tests/test_step7_logging.py` → 6 passed。你能说出 0/1/2 三个退出码各自的含义。
:::

:::explain
- CI 里 `python -m log_analyzer.cli log.txt || echo "failed"` 会因为哪个退出码触发？
- 为什么「文件不存在」用退出码 2，而不是 1？（提示：调用方要区分「我参数传错了」和「程序跑失败了」）
:::
:::

:::step 8 写你自己的 3 个边界测试
:::goal
为你的 parser / stats / CLI 增加 3 个课程没有覆盖的边界测试——并让它们通过。
:::

:::why
这一步不是「再讲一遍 pytest 定义」。真实的测试能力体现在：
**你能不能想到课程作者没想到的输入**。三个提示方向（空输入 / 极端数值 / CLI 边界）都来自真实项目的 bug 历史。
:::

:::files
要改的文件：`tests/test_step8_edge_cases.py`（把 3 个 `pytest.fail` 占位测试改成你自己的用例）
:::

:::note 好测试的三个习惯
1. **测异常路径**：空输入、坏数据、边界数值——bug 都藏在那里；
2. **测试要能失败**：写完先故意改坏一行实现，确认测试变红，再改回来；
3. **测试即文档**：新人读 `tests/` 比读源码快——命名说清楚你在保护什么行为。
:::

:::write
**你来写**：

- TODO 1：空文件 / 只有空行的文件 → `analyze` 应返回「全 None」而不是崩溃；
- TODO 2：极端数值（`loss=0.0` / 超长行 / 重复 step）→ 你的统计口径是什么？用测试把它固化下来；
- TODO 3：CLI 边界（相对路径 / 临时目录里的中文文件名 / `--json` 同时 `--warnings`）→ 行为符合预期。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step8_edge_cases.py
```
:::

:::expect
```
3 passed
```
只有你自己写完才会变绿。
:::

:::fail
如果你的新测试抓出了实现里的 bug——恭喜，这就是测试的价值。
先修实现（可能返回 Step 1-7 改代码），再让测试绿。
:::

:::hint Hint 1
把 `pytest.fail(...)` 换成真实断言。例如空文件：
`stats = analyze([]); assert stats.final_loss is None and not stats.has_nan`。
:::

:::hint Hint 2
写 CLI 边界用 `tmp_path` 夹具构造文件，再用 `main([str(f)])` 直接调用——
不需要真的开子进程（Step 6 已经有一个子进程用例了）。
:::

:::checkpoint
3 个属于你自己的测试通过，并且你至少验证过一次「故意改坏 → 测试变红」。
:::

:::explain
- 你的 3 个测试分别保护了什么行为？如果未来有人重构 parser，它们能拦住什么回归？
:::
:::

:::step 9 最终验收与复盘
:::goal
`pytest -q` 全部通过；对两个真实样例运行 CLI；不看资料回答 5 个复盘问题。
:::

:::run 🎮 Mac / Server
```bash
pytest -q
python -m log_analyzer.cli samples/train.log
python -m log_analyzer.cli samples/train_nan.log --warnings
```
:::

:::expect
```
41 passed
```
口径说明：41 = 课程提供的 38 个测试 + **你在 Step 8 自己写的 3 个边界测试**。
如果这里显示 `38 passed, 3 failed`，说明源码已经完成、但 Step 8 的 3 个占位测试还没换成你自己的用例。

CLI 输出（参考实现的真实记录；你的格式可以不同，但要包含同样的信息）：

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
:::

:::note 最终交付物（Portfolio Output）
完成本项目后，你的 GitHub 上应该有一个**你可以亲手演示**的仓库：

```
log-analyzer/
├── README.md          # Quick Start + 真实运行输出（你跑出来的，不是抄的）
├── src/log_analyzer/  # parser / stats / cli 三层（你实现的版本）
├── tests/             # 41 个通过用例 —— 其中 3 个是你自己写的边界测试
└── samples/           # 真实日志样例
```

**如果你要把它写进简历**，你必须能不看代码解释：
分层原因（A）→ dataclass vs dict（B）→ 错位 bug 的定位与修复（C）→ 退出码语义（D）。
解释不了就不要写——面试官只需要追问两层。
:::

:::checkpoint
以下 5 题必须**不看代码、不看资料**回答：
1. 为什么 parser / stats / CLI 要分成三层？各层的输入输出是什么？
2. 为什么 `LogEvent` 用 dataclass 而不是 dict？可变默认值为什么必须用 `default_factory`？
3. 为什么 warning 行会导致 step/loss 错位？你的修复是怎么保证两个列表同步的？
4. 退出码 0 / 1 / 2 分别代表什么？为什么它是「接口」？
5. JSONL 为什么适合 AI 数据？（提示：流式读取 / 一行一条记录）
:::

:::explain
这 5 题就是 Checkpoint A 的口试清单。任何一题卡住 → 回到对应 Step 的重读。
:::

:::solution Reference Solution（完成后对照）
完整实现：`projects/log-analyzer/`（README + 14 个测试函数的独立实现）。
把你的 starter 实现和它对照，重点看三个地方：
1. `parser.py` 的正则与 None 语义；
2. `stats.py` 的 `loss_steps` 对齐写法；
3. `cli.py` 的退出码与 logging 分支。
如果你的实现通过了 41 个测试又和它在风格上不同——**这是好事**，说明你有自己的工程判断。
但请确认你能解释它每一个设计选择的理由。
:::
:::
:::

## 25.3-25.5 参考手册与复盘

主线到这里结束。项目进行时按需打开参考手册，不要让参考资料阻塞 Guided Build。

:::reference python-engineering
打开 Python Engineering 参考手册
:::
