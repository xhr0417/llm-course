# 第 27 章 · Capstone 1：Build Your Own Mini LLM Evaluation Harness

:::intuition 一句话
评测岗的面试官不会问你「accuracy 怎么算」——他们会问「**你做过评测系统吗？bad case 怎么分类？并发怎么控？缓存 key 怎么设计？**」这一章你要**亲手写出来**：Checkpoint C。
:::

:::warning 这一章是整个 Job-Ready Track 最重要的一课
| 层级 | 你获得什么 | 在哪里 |
| --- | --- | --- |
| **Level 1 · Learn** | Adapter / Task / Parser / Metric / Runner / Cache / Retry / Bad case 的设计原理 | 27.3 参考手册 + 各 Step 知识盒 |
| **Level 2 · Guided Build** | 不完整的 harness starter + 15 步任务 + 79 个分步测试 | `projects/llm-eval/starter/`（27.2 Lab） |
| **Level 3 · Reference Solution** | 完整评测工程 + 真实 C3/XCOPA 评测记录 | `projects/llm-eval/`（27.5） |

**完成的定义**：starter 的 79 个测试全绿 + `run_eval.py` 能对 mock 与（可选）真实模型产出三件套报告 + 能回答 Step 14 的 Final Checkpoint。
:::

## 27.1 本章怎么学

第 23 章教会了你 PPL、pass@k、置信区间、LLM-as-a-Judge。但真实岗位要的是这个：

```text
新模型训完了 → 它到底比上一版好还是坏？
  ↑ 你需要一个能重复运行、能比较两个模型、能自动找出失败案例的系统
```

这个系统就是你要亲手构建的东西。它的每一层都解决一个真实的工程问题：

| 问题 | 你要实现的答案 | 在 Step |
| --- | --- | --- |
| 模型五花八门（本地 HF / API / 不同服务商） | `ModelAdapter` 统一接口 | 4 / 7 / 9 |
| 任务五花八门（选择题 / 问答 / 生成） | `EvalTask` 统一四件套 | 3 |
| 模型输出脏（"答案是 C。"） | 专门设计的 `parser` | 1 |
| API 会超时、限流、失败 | 重试 + 退避 + 并发上限 | 10 / 11 |
| 评测跑一次太贵太慢 | 响应缓存 | 8 |
| 跑完一堆数字看不懂 | 自动报告 + bad case 分类 | 6 / 12 |
| 分数虚高但不知道错在哪 | 结构化 bad case 分析 | 14 |

## 27.2 项目：llm-eval（Guided Build）

**架构**（你要亲手把每一块变成现实）：

```
run_eval.py（CLI）
    │
    ▼
Runner ──────────────────────────────────────────────
    │  对每个 Task 的每个 Item：                        │
    │  ① 查缓存 → ② 需要则调 Adapter（重试+限流）        │
    │  ③ task.parse_answer → ④ task.score              │
    │  ⑤ 收集 bad case                                 │
    ▼
Reports：results.json / summary.md / badcases.jsonl
```

```text
starter/src/llm_eval/
├── adapters/   ModelAdapter：怎么向模型要答案（mock / hf / openai）
├── tasks/      EvalTask：怎么问、怎么判分（c3 / xcopa / qa）
├── parsers.py  模型自由文本 → 规范答案
├── metrics.py  accuracy / EM / F1
├── runner.py   并发 + 重试 + 缓存 + badcase
├── cache.py    SQLite 响应缓存
└── reports.py  结果落盘
```

参考实现的真实运行记录（你做完后对标）：

```
Qwen2.5-0.5B-Instruct，128 题（C3 60 + XCOPA 60 + QA 8），CPU 32.3 秒
c3:   accuracy 55.0%（随机 25%）| parse_failure 0 | api_error 0 | 19.2s
xcopa: accuracy 55.0%（随机 50%）| parse_failure 0 | api_error 0 | 8.2s
qa:   EM 0% / F1 21.9%          | parse_failure 0 | api_error 0 | 4.9s
缓存复跑：同一评测第二遍，评测阶段 32.3s → 0.0s（128 条全部命中）
```

:::lab llm-eval · Guided Build（Capstone 1）
goal: 从零构建评测 harness：parser × metrics × task × adapter × runner（缓存/并发/重试）× bad case × reports
project: projects/llm-eval/starter
effort: 4–8 小时（15 步；Step 10-11 需要理解 asyncio）
prereq: 第 23 章评测概念 + 第 25 章工程（asyncio/重试/退出码）+ 第 26 章 HF（Step 7 用）
deliverable: 79 测试全绿 + results.json/summary.md/badcases.jsonl + 一份你自己的 bad case 分析

:::step 0 Starter：先让 77 个测试红给你看
:::goal
跑通 starter，接受「77 failed, 2 passed」这个起点，并理解为什么这个数字是设计好的。
:::

:::why
这是整个 Track 最大的项目。一上来就 77 个红色很容易让人想放弃——
所以先做一个心理建设：**它们不是错误，是任务清单**。你会按 Step 一组一组把它们变绿。
:::

:::files
starter/
├── README.md            # Step → 测试表（先读）
├── requirements.txt     # httpx + pytest（Step 7 再装 transformers/torch）
├── run_eval.py          # CLI 骨架（已给出；只有 build_adapter 留给你）
├── data/mini_*.jsonl    # 教学夹具：c3 12 / xcopa 12 / qa 8
├── src/llm_eval/        # ← 你要写代码的地方
└── tests/               # 79 个用例，按 Step 拆成 15 个文件
:::

:::run
```bash
cd projects/llm-eval/starter
pip install -r requirements.txt
pytest -q
```
:::

:::expect
```
77 failed, 2 passed in 3.6s
```
（真实记录。2 个 passed 断言的是已给出代码的配置项——比如 `supports_concurrency` 的默认值。）
:::

:::fail
- 大量 `ImportError` 而不是 `NotImplementedError` → 你的 Python 环境没装 httpx（`pip install -r requirements.txt`）；
- `collected 0 items` → 目录不对；
- 想知道每步变绿多少 → 看 README 的 Step 表，一次只跑一个文件。
:::

:::hint Hint 1
不要一次修 77 个。课程每一步对应一个测试文件，例如 Step 1 只需要
`pytest -q tests/test_step1a_parser_basic.py`。
:::

:::hint Hint 2
从 Step 1（parser）开始，因为它是纯字符串逻辑、零依赖、最快得到正反馈；
Runner/并发那些「难」的部分都在后面，那时你已经热身完毕。
:::

:::checkpoint
你知道 77 个失败被拆成了 15 步，并且跑过至少一个单文件测试命令。
:::

:::explain
- 为什么这个 starter 不把测试文件合并成一个？
- 「77 failed」里，有多少是 import 层面的失败、多少是行为层面的失败？为什么这个区别重要？
:::
:::

:::step 1 Choice Parser：accuracy 的隐形杀手
:::goal
实现 `parse_choice()` / `strip_special()`：从模型五花八门的自由文本里可靠地提取选项字母。
:::

:::why
模型不会乖乖输出一个字母。它可能输出 `"C"`、`"c"`、`"答案是 C"`、`"**D**"`、`"C) 因为……"`。
解析失败的题目会被判错——**parser 的 bug 会伪装成「模型能力差」**。
所以 parser 是重点测试对象，也是面试里区分「用过评测框架」和「写过评测框架」的第一个问题。
:::

:::files
要改的文件：`src/llm_eval/parsers.py`
:::

:::note 真实模型的输出形态（全都真实出现过）
```
"C"            "c"           "C."          "答案是 C"
"我认为选 B"    "**D**"       "C) 因为……"    "The correct answer is C."
"答案：D"       "（C）"        "[B]"
```
:::

:::write
**你来写**（`parsers.py`）：

- TODO 1：`strip_special`——去掉 `<|im_end|>` 之类的特殊 token；
- TODO 2：`parse_choice(text, valid="ABCD")` 的第一版：只处理 `"C"` / `"c"` / `"C."`（Step 1a 的测试）；
- TODO 3：升级到鲁棒版（Step 1b 的测试）：大小写、去 markdown 符号（`*` `` ` `` `_`）、
  「答案是 X」「我认为选 X」「**X**」「X)」「（X）」等模式；
- TODO 4：`valid` 之外的结果必须返回 None（评测里 `"E"` 对 4 选 1 是无效答案）。
:::

:::run
```bash
pytest -q tests/test_step1a_parser_basic.py    # 第一版：5 passed
pytest -q tests/test_step1b_parser_robust.py   # 鲁棒版：15 passed
```
:::

:::expect
```
5 passed
15 passed
```
:::

:::fail
- 把「C) 因为天气原因」解析成 None → 你的模式没有覆盖「字母 + 右括号 + 解释」；
- 把「The correct answer is C.」解析成 None → 需要英文模式（大小写不敏感）；
- 把 `"E"` 当成有效答案 → `valid` 检查没做。
:::

:::hint Hint 1
清洗步骤：`re.sub(r"[*`_]", "", text.strip()).upper()`——先去掉 markdown 符号，再统一大写。
:::

:::hint Hint 2
多级模式从严格到宽松逐个尝试（先试「答案：X」，再试「X)」，最后试「单独的字母」）；
任何一个命中就返回；全部失败返回 None。**不要**用「找到第一个 A-H 字母」这种贪心策略——
它会把「As we know…」解析成 A。
:::

:::solution
```python
_PATTERNS = [
    r"(?:正确答案|答案|正确选项|应选|选择|选)\s*(?:是|为|:|：)?\s*[（(\[]?\s*([A-H])\s*[)）\]]?",
    r"(?:correct\s+answer|answer)\s*(?:is|:)?\s*[（(\[]?\s*([A-H])\b",
    r"\b([A-H])\s*[)）.、]\s*",
    r"[（(\[]\s*([A-H])\s*[)）\]]",
    r"^\s*[（(\[]?\s*([A-H])\s*[)）\]]?\s*[.。!！?？,，]*\s*$",
]

def parse_choice(text: str, valid: str = "ABCDEFGH") -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"[*`_]", "", text.strip()).upper()
    for pattern in _COMPILED:
        m = pattern.search(cleaned)
        if m and m.group(1).upper() in valid:
            return m.group(1).upper()
    return None
```
:::

:::checkpoint
1a 与 1b 全绿；你能说出至少 5 种真实模型输出格式和你对应的处理。
:::

:::explain
- 为什么「解析失败」要单独统计为 parse_failure，而不是和答错共用一种错误？
- 如果你的 parser 贪心地匹配「第一个出现的 A-H 字母」，举一个真实句子说明它会怎么错。
:::
:::

:::step 2 Metrics：accuracy / exact_match / F1
:::goal
实现 `accuracy` / `exact_match` / `f1_score` 与文本归一化。
:::

:::why
指标是评测的语言。写错指标比写错模型更可怕：它让所有结论静默失真。
第 3 章与第 23 章的指标数学在这里第一次变成生产代码。
:::

:::files
要改的文件：`src/llm_eval/metrics.py`（`normalize_text` 与 `_tokenize` 已给出，其余你来写）
:::

:::predict
先回答这三个边界题，再写代码：
1. `accuracy(0, 0)` 应该是 `0` 还是 `nan`？为什么？
2. `exact_match("Hello, World!", ["hello world"])` 是 0 还是 1？
3. `f1_score("模型记住了噪声", "模型记住了训练噪声")` 大概是多少？（提示：中文按字切分）
:::

:::note 指标口径（本项目的实现标准）
- `accuracy = n_correct / n_total`，`n_total == 0` 返回 `nan`（**不是 0**——没评测过 ≠ 全错）；
- `exact_match`：归一化后相等（小写、去中英标点、压缩空白；再比较一次「去全部空格」的版本）；
- `f1_score`：token 级 precision/recall 的调和平均；中文按字切分、英文按词切分（朴素但够用）；
- 空预测 → EM 0、F1 0。
:::

:::write
**你来写**（`metrics.py`）：

- TODO 1：`accuracy(n_correct, n_total)`；
- TODO 2：`exact_match(prediction, golds)`——任一 gold 匹配即 1.0；
- TODO 3：`f1_score(prediction, gold)`——用给出的 `_tokenize`，注意多重集合（词频）匹配。
:::

:::run
```bash
pytest -q tests/test_step2_metrics.py
```
:::

:::expect
```
12 passed
```
:::

:::fail
- `accuracy(0,0)` 返回 0 → 你的实现漏了空集合分支（测试会明确检查 nan）；
- F1 精确匹配时不是 1.0 → precision/recall 的除零保护有问题；
- EM 对「不 知道」/「不知道」判 0 → 空格归一化没做。
:::

:::hint Hint 1
`nan` 的写法：`float("nan")`；判断用 `v != v`（NaN 不等于自身）。
:::

:::hint Hint 2
F1 用词频匹配：先数 gold 的 token 计数，遍历 pred 时命中就减一，最后 `common` 是匹配数。
:::

:::solution
```python
def accuracy(n_correct: int, n_total: int) -> float:
    return (n_correct / n_total) if n_total else float("nan")

def exact_match(prediction, golds) -> float:
    pred = normalize_text(prediction or "")
    if not pred:
        return 0.0
    pred_ns = pred.replace(" ", "")
    for g in golds:
        gold_ns = normalize_text(g)
        if pred == gold_ns or pred_ns == gold_ns.replace(" ", ""):
            return 1.0
    return 0.0
```

```python
def f1_score(prediction, gold) -> float:
    pred_tokens = _tokenize(prediction or "")
    gold_tokens = _tokenize(gold)
    if not pred_tokens or not gold_tokens:
        return 0.0
    common, gold_count = 0, {}
    for t in gold_tokens:
        gold_count[t] = gold_count.get(t, 0) + 1
    for t in pred_tokens:
        if gold_count.get(t, 0) > 0:
            common += 1
            gold_count[t] -= 1
    if common == 0:
        return 0.0
    precision = common / len(pred_tokens)
    recall = common / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)
```
:::

:::checkpoint
12 passed；你能解释为什么 `accuracy(0,0)` 是 nan 而 EM 空预测是 0。
:::

:::explain
- 为什么评测报告必须同时给 n 与指标，而不能只给百分比？
- 为什么 EM 适合 C3/XCOPA 但不适合开放问答？（对照 QA 任务的 F1）
:::
:::

:::step 3 EvalTask：先只做 C3，再做 XCOPA
:::goal
实现任务四件套协议：`build_prompt`（已给）→ `parse_answer` / `score` / `_to_items`（你来写），并复制模式到 XCOPA。
:::

:::why
「任务」在评测系统里是一个可插拔单元：加一个新数据集 = 加一个新 Task，而不是改核心逻辑。
这是 harness 可扩展性的来源，也是面试里「如果明天加 GSM8K 你要改哪几个文件」的标准答案。
:::

:::files
要改的文件：`src/llm_eval/tasks/c3.py` 与 `src/llm_eval/tasks/xcopa.py`
（`EvalTask` 基类与 `EvalItem` 已给出；`qa.py` 已给出作多指标参考）
:::

:::note EvalTask 四件套
```python
class EvalTask(ABC):
    def load(self) -> list[EvalItem]: ...            # 读数据 → 已构造好的 prompt
    def build_prompt(self, row) -> str: ...          # 每种任务的提问格式（已给）
    def parse_answer(self, raw) -> Optional[str]: ...# 原始输出 → 规范答案
    def score(self, prediction, item) -> dict: ...   # 打分（支持多指标）
```
`EvalItem(id, prompt, gold, meta)`——`meta` 保留原始信息，bad case 分析时用得上。
:::

:::write
**你来写**：

- TODO 1（C3）：`parse_answer`（复用 Step 1 的 `parse_choice(raw, valid="ABCD")`）、
  `score`（accuracy 1.0/0.0）、`_to_items`（构造 `EvalItem`，gold 取 `row["answer"].upper()`）；
- TODO 2（XCOPA）：同样的四件套，`valid="AB"`——**先自己写，再对照 C3**；
- TODO 3：跑测试时注意夹具答案的均衡性断言（防止全 A / 全 B 造成假高分——这是测试的自我拷问）。
:::

:::run
```bash
pytest -q tests/test_step3a_c3_task.py      # 6 passed
pytest -q tests/test_step3b_xcopa_task.py   # 4 passed
```
:::

:::expect
```
6 passed
4 passed
```
:::

:::fail
- `gold` 是小写字母 → 忘了 `.strip().upper()`；
- XCOPA 的 prompt 里没有「原因/结果」 → `QUESTION_ZH` 映射用错（模板已给，检查你是否改动了它）；
- `_to_items` 的 prompt 没有用 `build_prompt(row)` → 数据与提问脱节。
:::

:::hint Hint 1
`_to_items` 就是把每行 dict 变成 `EvalItem(id=str(row["id"]), prompt=self.build_prompt(row), gold=..., meta={...})`。
:::

:::hint Hint 2
XCOPA 的 `question` 字段是 `cause` / `effect` 两个英文值，prompt 里要转成中文提问——
映射表 `QUESTION_ZH` 已在模板代码里给出。
:::

:::solution
```python
class C3Task(EvalTask):
    name = "c3"
    primary_metric = "accuracy"

    def parse_answer(self, raw: str) -> Optional[str]:
        return parse_choice(raw, valid="ABCD")

    def score(self, prediction, item) -> dict[str, float]:
        return {"accuracy": 1.0 if prediction == item.gold else 0.0}

    def _to_items(self, rows: list[dict]) -> list[EvalItem]:
        return [
            EvalItem(
                id=str(row["id"]),
                prompt=self.build_prompt(row),
                gold=row["answer"].strip().upper(),
                meta={"question": row["question"], "options": row["options"], "context": row.get("context", "")},
            )
            for row in rows
        ]
```
:::

:::checkpoint
10 passed（3a + 3b）；你能说出「加一个新任务需要改哪几个文件」。
:::

:::explain
- 为什么 `score()` 返回 dict 而不是 float？（对照 QA 任务的 EM + F1）
- 任务定义与数据解耦的好处：`mini_c3.jsonl` 换成 10000 题的真实 C3，需要改代码吗？
:::
:::

:::step 4 Mock ModelAdapter：先不要碰真实模型
:::goal
实现 `MockAdapter.generate()`，用假模型把整条评测管线先打通。
:::

:::why
**为什么测试系统不能每次真的加载 Qwen？** 三个理由：慢、贵、不确定。
Mock 让「Runner 的逻辑」独立于「模型的推理」被测试——这正是 Adapter 模式的核心价值。
:::

:::files
要改的文件：`src/llm_eval/adapters/mock.py`（`base.py` 已给出完整接口）
:::

:::note ModelAdapter 接口
```python
class ModelAdapter(ABC):
    name: str = "base"
    supports_concurrency = False

    @abstractmethod
    def generate(self, prompts: list[str]) -> list[str]: ...

    async def agenerate(self, prompts: list[str]) -> list[str]:
        return await asyncio.to_thread(self.generate, prompts)   # 默认丢线程池
```
`MockAdapter(policy=..., ...)`：`policy(prompt) -> response` 决定假模型的输出；
`calls` 计数器让测试可以断言「模型被调用了几次」（缓存/重试测试全靠它）。
:::

:::write
**你来写**（`mock.py`）：

- TODO 1：`generate(prompts)`——`self.calls += len(prompts)`；
- TODO 2：返回 `[self.policy(p) for p in prompts]`（默认 policy 返回 `"A"`）。
:::

:::run
```bash
pytest -q tests/test_step4_mock_adapter.py
```
:::

:::expect
```
4 passed
```
:::

:::fail
- `calls` 计数不对 → 注意按 **prompt 个数**累加（batch 算多次调用）。
:::

:::hint Hint 1
MockAdapter 总共不到 5 行代码——它的价值不在实现，而在它支撑的所有测试。
:::

:::hint Hint 2
`policy` 让每个测试定制模型行为：返回 "A"（全对）/ 返回乱文本（parse_failure）/
按题号返回不同答案（部分正确）——后面 Step 6 会用到。
:::

:::solution
```python
def generate(self, prompts: list[str]) -> list[str]:
    self.calls += len(prompts)
    return [self.policy(p) for p in prompts]
```
:::

:::checkpoint
4 passed；你能解释「测试系统为什么不每次加载真实模型」。
:::

:::explain
- MockAdapter 不能代替真实评测——那它到底在测试什么？（提示：管线正确性 vs 模型能力）
- 如果 Mock 的 policy 永远返回 "A"，为什么 C3 夹具的答案还要设计成均衡的？
:::
:::

:::step 5 Runner：把 Task → Adapter → Parser → Score 串起来
:::goal
实现 `evaluate_task()` / `evaluate_tasks()` 的第一版：先不管缓存、并发、重试，把管线跑通。
:::

:::why
Runner 是评测系统的发动机。第一版故意写「笨」一点：一个个题生成、一个个判分——
**先正确，再更快**。看懂这一版，后面所有优化都只是往里插模块。
:::

:::files
要改的文件：`src/llm_eval/runner.py`（`TaskReport` / `RunReport` 已给出）
:::

:::predict
先预测，再运行：
```
MockAdapter(policy=lambda p: "A") 评测 c3（12 题，答案均衡 3A/3B/3C/3D）
```
accuracy 会接近 25%（随机水平）还是更高？为什么？
:::

:::write
**你来写**（`runner.py`）：

- TODO 1：`evaluate_task`——`items = task.load()[:cfg.limit]`；
  收集 prompts → `await adapter.agenerate(prompts)` → 对每个输出 `strip_special` → `task.parse_answer` → `task.score`；
- TODO 2：累计 `metrics`（分数求和，最后除以 n）；统计 `parse_failures`；
- TODO 3：`evaluate_tasks`——循环任务、构造 `RunReport`、`finally` 里关闭 cache 与 adapter
  （优先 `await adapter.aclose()`，否则 `adapter.close()`）。
:::

:::run
```bash
pytest -q tests/test_step5_runner.py
```
:::

:::expect
```
4 passed
```
:::

:::fail
- accuracy 是 1.0 或 0.0 → 你忘了除以 n（或答案均衡夹具下恰好全对/全错，检查 policy）；
- `RuntimeError: Event loop is closed` → `evaluate_tasks` 没有在 finally 里正确关闭连接；
- 指标是累加值而不是平均值 → 除以 `len(items)` 的步骤漏了。
:::

:::hint Hint 1
骨架：
```python
raw_outputs = await adapter.agenerate([item.prompt for item in items])
for item, raw in zip(items, raw_outputs):
    cleaned = strip_special(raw)
    prediction = task.parse_answer(cleaned)
    scores = task.score(prediction, item)
    ...
```
:::

:::hint Hint 2
为什么函数是 `async` 的？这一版是串行的——但接口先定成异步，
Step 10 加并发时**调用方一行都不用改**。这就是接口设计的价值。
:::

:::solution
```python
async def evaluate_tasks(adapter, tasks, cfg) -> RunReport:
    run = RunReport(adapter=adapter.name, model=cfg.model, config=cfg.__dict__.copy())
    run.started_at = datetime.now().isoformat(timespec="seconds")
    t0 = time.time()
    cache = ResponseCache(cfg.cache_path) if cfg.use_cache else None
    try:
        for task in tasks:
            run.tasks.append(await evaluate_task(adapter, task, cfg, cache))
    finally:
        if cache:
            cache.close()
        aclose = getattr(adapter, "aclose", None)
        if aclose is not None:
            await aclose()
        else:
            adapter.close()
    run.duration_s = time.time() - t0
    run.finished_at = datetime.now().isoformat(timespec="seconds")
    return run
```
:::

:::checkpoint
4 passed；你能画出 Runner 的数据流（谁调用谁、每一步的输入输出类型）。
:::

:::explain
- 为什么先写「串行版」再优化？如果不先写它，Step 8/10/11 会出现什么问题？
- `RunReport.to_dict()` 直接 `asdict`——这对报告格式意味着什么？
:::
:::

:::step 6 Bad Case：从「错了几个」到「错在哪」
:::goal
让每个失败样本都落一条结构化记录：`error_type` + gold + prediction + raw_output。
:::

:::why
只统计 accuracy 的评测系统是没用的：你只知道「错了 45%」，不知道「该修 parser、修 prompt、还是修模型」。
bad case 分类把「失败」变成「可行动项」。
:::

:::files
要改的文件：`src/llm_eval/runner.py`（在 evaluate_task 里构建 badcase 列表）
:::

:::note 五类 error_type（各有不同的修法）
| error_type | 含义 | 该修什么 |
| --- | --- | --- |
| `parse_failure` | 无法从输出里提取答案 | parser / prompt 格式 |
| `wrong_answer` | 解析成功但答错 | 模型 / 数据 |
| `empty_output` | 模型返回空 | 服务 / 参数 |
| `api_error` | 请求最终失败（重试耗尽） | 并发 / 超时 / 限流配置 |
| `low_f1` | 问答 F1 < 0.5 | 回答风格 / 指标设计 |
:::

:::write
**你来写**（`runner.py`）：

- TODO 1：非满分样本（`scores` 中任一 < 1.0）进 `report.badcases`；
- TODO 2：每条记录包含 `task / id / prompt / gold / prediction / raw_output / error_type / scores`；
- TODO 3：`error_type` 的判定顺序：生成失败（raw == ""）→ `api_error`；否则调用 `task.error_type(raw, prediction, item)`；
- TODO 4：生成失败时同时累加 `report.api_errors`。
:::

:::run
```bash
pytest -q tests/test_step6_badcase.py
```
:::

:::expect
```
3 passed
```
:::

:::fail
- badcase 数量对但 `raw_output` 是空 → 你保存的是清理前的变量或清理后的变量（要保存**清理前**的原始输出，供事后分析）；
- error_type 全是 wrong_answer → `parse_failure` 分支没接上 `task.error_type`。
:::

:::hint Hint 1
`task.error_type(raw, prediction, item)` 的默认实现已给出：
空输出 → empty_output；预测 None → parse_failure；否则 wrong_answer。
:::

:::hint Hint 2
badcase 的 `raw_output` 字段写原始返回（可以很长）——它就是你事后 debug parser 的证据。
:::

:::solution
```python
full_credit = all(v >= (1.0 - 1e-12) for v in scores.values())
if not full_credit:
    badcase = {
        "task": task.name,
        "id": item.id,
        "prompt": item.prompt,
        "gold": item.gold,
        "prediction": prediction,
        "raw_output": raw,
        "error_type": "api_error" if failed else task.error_type(raw, prediction, item),
        "scores": scores,
    }
    report.badcases.append(badcase)
```
:::

:::checkpoint
3 passed；你能对每一类 error_type 说出「下一步该修什么」。
:::

:::explain
- 为什么 parse_failure 和 wrong_answer 必须分开统计？两个模型的 accuracy 相同，bad case 分布不同，说明什么？
- bad case 里为什么要存 prompt？（提示：复现与归类）
:::
:::

:::step 7 HuggingFace Adapter：接回第 26 章
:::goal
实现 `HuggingFaceAdapter`：chat template + left padding + batch 生成，让本地模型进入评测系统。
:::

:::why
到这里，前六步的系统已经可以为任意「会说话的模型」打分了。现在把第 26 章学到的
HF 推理代码包装成 Adapter——你会看到「换模型 = 换 Adapter」这句话的真实含义。
:::

:::files
要改的文件：`src/llm_eval/adapters/hf.py`（Step 7 需要 `pip install transformers torch`）
:::

:::note Adapter 的边界：模型细节只生活在适配器内部
第 23/26 章的知识在这里全部汇合：
- `apply_chat_template`（任务 prompt 会以 user 消息进入模型）；
- `padding_side = "left"`；
- `batch_size` 分块生成（CPU 上 4 条一批）；
- `do_sample=False` 贪心（评测要可复现）；
- 可选 `peft_adapter`（Capstone 3 会用它评测微调前后）。
:::

:::write
**你来写**（`hf.py`）：

- TODO 1：`__init__`——加载 tokenizer（pad 兜底）+ 模型（`dtype` 映射）；如传 `peft_adapter` 则 `PeftModel.from_pretrained`；
- TODO 2：`_generate_batch`——chat template → 批量编码（left padding）→ `generate` → 只 decode 新 token；
- TODO 3：`generate`——按 `self.batch_size` 分块调用。
:::

:::run
```bash
pip install transformers torch
pytest -q tests/test_step7_hf_adapter.py
```
:::

:::expect
```
2 passed
```
（测试用 tiny 模型；`RUN_MODEL_TESTS=0` 时跳过。）
:::

:::fail
- 生成的回答包含问题本身 → 切片 `output[:, input_len:]` 漏了；
- 中文输出混着特殊 token → `skip_special_tokens=True` 漏了；
- 两个不同长度 prompt 的结果错乱 → padding_side 不是 left。
:::

:::hint Hint 1
`self.name = f"hf:{model_name}"`（有 peft 时追加后缀）——这个名字会进缓存 key 与报告。
:::

:::hint Hint 2
CPU 上 batch_size=4 比 1 快很多；但别设太大，内存吃紧。
:::

:::solution
```python
def _generate_batch(self, prompts: list[str]) -> list[str]:
    chats = [
        self.tokenizer.apply_chat_template([{"role": "user", "content": p}],
                                           tokenize=False, add_generation_prompt=True)
        for p in prompts
    ]
    batch = self.tokenizer(chats, return_tensors="pt", padding=True, truncation=True, max_length=1024)
    batch = {k: v.to(self.model.device) for k, v in batch.items()}
    gen_kwargs = dict(max_new_tokens=self.max_new_tokens, pad_token_id=self.tokenizer.pad_token_id)
    if self.temperature and self.temperature > 0:
        gen_kwargs.update(do_sample=True, temperature=self.temperature)
    else:
        gen_kwargs.update(do_sample=False)
    with torch.no_grad():
        out = self.model.generate(**batch, **gen_kwargs)
    new_tokens = out[:, batch["input_ids"].shape[1]:]
    return self.tokenizer.batch_decode(new_tokens, skip_special_tokens=True)
```
:::

:::checkpoint
2 passed（或 RUN_MODEL_TESTS=0 时跳过）；你能说出 Adapter 内封装了哪些「模型细节」。
:::

:::explain
- 为什么 `temperature=0` 时改用 `do_sample=False`？（评测的可复现性）
- 如果明天换成本地 vLLM 服务，你的 Adapter 应该长什么样？（先想，Step 9 类似）
:::
:::

:::step 8 Cache：第一次运行 vs 第二次运行
:::goal
实现 `ResponseCache`（sqlite）并接入 Runner；先故意写一个「少参数」的 cache key，让测试教你错在哪。
:::

:::why
评测迭代的真实循环是「改 prompt/parser → 重跑」。如果每次都重新调模型，迭代速度会被模型推理拖死。
缓存让「只重算变化的样本」成为可能——参考实现里第二次运行 32.3s → 0.0s。
:::

:::files
要改的文件：`src/llm_eval/cache.py` + `src/llm_eval/runner.py`（缓存接入）
:::

:::predict
先做这个实验（顺序很重要，别跳）：
```python
# 第一版：故意只写 model + prompt（社区里最常见的错误）
@staticmethod
def make_key(model, prompt, params):
    payload = json.dumps({"model": model, "prompt": prompt})
    return hashlib.sha256(payload.encode()).hexdigest()
```
问题：
1. 这个 key 有什么问题？什么时候会「命中旧答案」？
2. 改动 `max_new_tokens` 或 `temperature` 之后，同一个 prompt 应该命中缓存吗？
:::

:::run
```bash
pytest -q tests/test_step8_cache.py
```
:::

:::expect
```
7 failed（第一版 key）
```
测试会明确指出 `max_new_tokens` / `temperature` 变化时必须得到不同的 key。修好之后：
```
7 passed
```
:::

:::note 缓存的三个坑
1. **key 少参**：改了 `max_new_tokens` 却命中旧答案 → 结果错得毫无察觉；
2. **缓存永不失效**：模型 checkpoint 更新后要换 key（用版本号/内容哈希命名）；
3. **失败也被缓存**：空响应绝不能写缓存，否则一次网络抖动永久污染结果（测试明确检查）。
:::

:::write
**你来写**：

- TODO 1（`cache.py`）`make_key`——`sha256(json.dumps({"model", "prompt", "params"}, sort_keys=True))`；
- TODO 2：`get`（命中 `hits += 1` / 未命中 `misses += 1`）/ `put`（INSERT OR REPLACE）/ `close`；
- TODO 3（`runner.py`）评测前查缓存（命中直接用）、评测后 `put`——**空响应不写**；
- TODO 4：`report.cache_hits` 用「本任务内 cache.hits 的增量」统计（多个任务连续评测时不串账）。
:::

:::fail
- `test_second_run_hits_cache` 失败 → 缓存没有真正接入 Runner，或 key 每次不同；
- `test_empty_response_not_cached` 失败 → 你把 `""` 也写进去了；
- cache_hits 数字叠加 → 用了累计值而不是增量。
:::

:::hint Hint 1
`params = {"max_new_tokens": cfg.max_new_tokens, "temperature": cfg.temperature}` —— 凡会影响输出的参数都要进 key。
:::

:::hint Hint 2
命中缓存的样本不需要进 `missing_prompts`；miss 的样本才生成，生成完后按原顺序回填结果数组。
:::

:::solution
```python
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
```
:::

:::checkpoint
7 passed；你能说出缓存 key 的设计原则，并举出「少一个参数」造成错误命中的具体场景。
:::

:::explain
- 「第二次运行为什么会快」——从 SQLite 查询到指标复算，整条链路发生了什么？
- 如果模型重新训练了但名字没变，缓存会怎样误导你？工程上怎么防？
:::
:::

:::step 9 API Adapter：任何 OpenAI 兼容服务
:::goal
实现 `OpenAICompatibleAdapter`：httpx 异步请求 + Bearer 鉴权 + 状态码语义（429/5xx 可重试，400/401 致命）。
:::

:::why
真实实习里你评测的往往是 API 模型（公司网关、vLLM、Ollama 都提供 `/v1/chat/completions`）。
**只依赖通用接口，不绑定特定收费服务**——这是这一段代码的工程立场。
:::

:::files
要改的文件：`src/llm_eval/adapters/openai_compat.py`
:::

:::note 状态码语义（重试策略的地基）
| 类别 | 例子 | 处理 |
| --- | --- | --- |
| 可重试 | 超时 / 429 限流 / 500 / 502 / 503 / 504 | 指数退避后重试 |
| 不可重试（致命） | 400 参数错误 / 401 鉴权失败 | 立即放弃（`FatalAdapterError`） |
:::

:::write
**你来写**（`openai_compat.py`）：

- TODO 1：`_headers`——`Content-Type` + 可选 `Authorization: Bearer <key>`；
- TODO 2：`_payload`——model / messages / temperature / max_tokens；
- TODO 3：`_one`——POST `base_url + "/v1/chat/completions"`；
  429/5xx 与超时 → `AdapterError`（可重试）；400/401 → `FatalAdapterError`；
- TODO 4：`agenerate`（复用长连接 `httpx.AsyncClient`）+ `aclose`（在事件循环内关闭）。
:::

:::run
```bash
pytest -q tests/test_step9_api_adapter.py
```
:::

:::expect
```
5 passed
```
（测试用本地 HTTP 假服务端验证协议，不访问收费 API。）
:::

:::fail
- 400/401 被当成可重试 → 你的错误分类放在了 `raise_for_status` 的统一 except 里，需要先判状态码；
- 假服务端断言失败 → 检查 Authorization 头和你发送的 JSON 字段名。
:::

:::hint Hint 1
`resp.status_code in (429, 500, 502, 503, 504)` → 抛 `AdapterError`（可重试）；
`400 <= status < 500` 的其他码 → 抛 `FatalAdapterError`（立即失败）。
:::

:::hint Hint 2
超时用 `httpx.TimeoutException` 捕获——它在客户端超时和连接失败时都会抛。
:::

:::solution
```python
async def _one(self, client, prompt: str) -> str:
    try:
        resp = await client.post(self.base_url + "/v1/chat/completions",
                                 json=self._payload(prompt), headers=self._headers())
        if resp.status_code in (429, 500, 502, 503, 504):
            raise AdapterError(f"HTTP {resp.status_code}（可重试）")
        if resp.status_code in (400, 401):
            raise FatalAdapterError(f"HTTP {resp.status_code}（不可重试）")
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except httpx.TimeoutException as e:
        raise AdapterError(f"请求超时：{e}") from e
```
:::

:::checkpoint
5 passed；你能把「哪些错误该重试、哪些不该」讲给面试官。
:::

:::explain
- 为什么不设超时的 `httpx` 请求在生产环境等于定时炸弹？
- 复用 `AsyncClient` 与每次新建连接，性能和资源上差在哪？
:::
:::

:::step 10 Async + Semaphore：并发不能「全飞」
:::goal
把 Runner 的串行生成改成受控并发：`Semaphore(cfg.concurrency)`，并让非并发适配器保持批量串行。
:::

:::why
评测 5000 题的墙钟时间主要由「模型调用」决定。全并发会把服务端和你自己一起打爆——
**并发 + 限流**才是标准答案。这是第 25 章 asyncio 知识的生产级应用。
:::

:::files
要改的文件：`src/llm_eval/runner.py`（生成阶段）
:::

:::predict
用假服务端做实验：
- 9 个请求、每个耗时 0.3s：串行 ≈ 2.7s，并发 3 ≈ 0.9s，全并发 9 ≈ 0.3s。
- 问题：为什么不能直接开 9（或 10000）个全并发？服务端和客户端分别会发生什么？
:::

:::note 并发的三个约束
1. 服务端有 QPS 限制：超了直接 429，重试风暴更糟；
2. 客户端资源有限（连接数、内存）；
3. 本地 HF 模型瓶颈是 CPU/GPU 而不是网络 → `supports_concurrency=False` 时保持**批量串行**。
:::

:::write
**你来写**（`runner.py`）：

- TODO 1：`_generate_missing(adapter, prompts, cfg)`——`prompts` 为空直接返回 `[]`；
- TODO 2：`adapter.supports_concurrency == True` 时：`sem = asyncio.Semaphore(cfg.concurrency)`，
  每题一个 task（`async with sem:`），`asyncio.gather` 收集；
- TODO 3：`False` 时：`await asyncio.to_thread(lambda: adapter.generate(prompts))`（批量一次调用）；
- TODO 4：把 Step 5 的「一次性 agenerate」替换为「先查缓存 → 生成缺失 → 回填」。
:::

:::run
```bash
pytest -q tests/test_step10_async.py
```
:::

:::expect
```
3 passed
```
关键是第二个断言：`max_inflight > 1`——一个串行 for 循环会让它失败。
:::

:::fail
- `max_inflight` 恒为 1 → 你还在串行（或 semaphore 包错了位置，把整批请求包成了 1 个）；
- `max_inflight` 超过 cfg.concurrency → semaphore 创建在循环内部（每次都是新的）；
- 非并发分支卡死 → `asyncio.to_thread` 忘了 await。
:::

:::hint Hint 1
semaphore 要在循环**外**创建一次：
```python
sem = asyncio.Semaphore(max(1, cfg.concurrency))
async def one(prompt):
    async with sem:
        ...
results = await asyncio.gather(*(one(p) for p in prompts))
```
:::

:::hint Hint 2
`supports_concurrency` 是适配器类属性：Mock/OpenAI 为 True，HF 保持 False（它有自己的 batch 逻辑）。
:::

:::solution
```python
async def _generate_missing(adapter, prompts, cfg):
    if not prompts:
        return []
    if getattr(adapter, "supports_concurrency", False):
        sem = asyncio.Semaphore(max(1, cfg.concurrency))
        async def one(prompt: str) -> str:
            async with sem:
                try:
                    return (await adapter.agenerate([prompt]))[0]
                except AdapterError as e:
                    logger.error("请求最终失败：%s", e)
                    return ""
        return list(await asyncio.gather(*(one(p) for p in prompts)))
    try:
        return await asyncio.to_thread(lambda: adapter.generate(prompts))
    except AdapterError as e:
        logger.error("批量生成最终失败：%s", e)
        return [""] * len(prompts)
```
:::

:::checkpoint
3 passed；你能解释「10000 个请求不能全部一起飞」的两个层面（服务端 / 客户端）。
:::

:::explain
- Semaphore 的 `concurrency=8` 与「8 个线程」有什么本质区别？
- 为什么本地 HF 模型反而不该走 Semaphore 并发？
:::
:::

:::step 11 Retry：区分「值得重试」与「重试无用」
:::goal
实现指数退避重试：只重试 `AdapterError`（超时/429/5xx），`FatalAdapterError`（400/401）立即放弃。
:::

:::why
网络失败是常态。但**重试不是万能的**：401 重试一万次还是 401。
把「可恢复」与「不可恢复」分开，是分布式系统的第一课，也是面试高频题。
:::

:::files
要改的文件：`src/llm_eval/runner.py`（`_async_with_retry`）
:::

:::predict
1. 同一个 500 错误重试 2 次、每次退避 1.5s × 2^n，总等待时间是多少？
2. 401 应该重试吗？为什么错误分类要放在**适配器**里而不是重试逻辑里？
:::

:::write
**你来写**（`runner.py`）：

- TODO 1：`_async_with_retry(fn, cfg)`——最多 `cfg.retries + 1` 次尝试；
- TODO 2：只捕获 `AdapterError`；`FatalAdapterError` 属于它但**立即重新抛出**（或用类型判断跳过重试）；
- TODO 3：退避 `await asyncio.sleep(cfg.retry_backoff_s * (2 ** attempt))`；
- TODO 4：把两个生成分支（并发/批量）都包进重试。
:::

:::run
```bash
pytest -q tests/test_step11_retry.py
```
:::

:::expect
```
3 passed
```
- 前 4 次失败的适配器最终成功（`api_errors == 0`）；
- `FatalAdapterError` 只被调用 1 次（不重试）。
:::

:::fail
- 致命错误被重试 → 你的 `except AdapterError` 把子类也吞了，需要在里面 `if isinstance(e, FatalAdapterError): raise`；
- 重试次数对不上 → 循环边界写成 `range(cfg.retries)` 而不是 `retries + 1`（首次尝试不算重试）。
:::

:::hint Hint 1
结构：
```python
last = None
for attempt in range(cfg.retries + 1):
    try:
        return await fn()
    except FatalAdapterError:
        raise
    except AdapterError as e:
        last = e
        if attempt < cfg.retries:
            await asyncio.sleep(cfg.retry_backoff_s * (2 ** attempt))
raise last
```
:::

:::hint Hint 2
退避用 `2 ** attempt`：1.5s → 3s → 6s。为什么是「翻倍」而不是「固定 1s」？
（提示：重试风暴 = 所有客户端同时对服务端施加相同压力）
:::

:::solution
```python
async def _async_with_retry(fn, cfg):
    last = None
    for attempt in range(cfg.retries + 1):
        try:
            return await fn()
        except FatalAdapterError:
            raise
        except AdapterError as e:
            last = e
            if attempt < cfg.retries:
                wait = cfg.retry_backoff_s * (2 ** attempt)
                logger.warning("调用失败（第 %d 次）：%s；%.1fs 后重试", attempt + 1, e, wait)
                await asyncio.sleep(wait)
    raise last
```
:::

:::checkpoint
3 passed；你能回答「哪些错误该重试」并解释指数退避的作用。
:::

:::explain
- 为什么 400 参数错误不应该重试？（提示：确定性 vs 瞬时性）
- 重试会引入重复请求吗？对评测任务为什么无所谓，对下单接口为什么致命？
:::
:::

:::step 12 Reports：让结果自动落盘
:::goal
实现 `write_reports()`：`results.json`（机读）/ `summary.md`（人读）/ `badcases.jsonl`（逐条分析）。
:::

:::why
评测的最终交付物是报告，不是终端输出。三件套分别服务三类读者：
脚本（json）、你/面试官（md）、后续分析（jsonl）。这是「跑完一堆数字看不懂」问题的标准解法。
:::

:::files
要改的文件：`src/llm_eval/reports.py`
:::

:::write
**你来写**（`reports.py`）：

- TODO 1：`results.json`——`json.dumps(run.to_dict(), ensure_ascii=False, indent=2)`；
- TODO 2：`badcases.jsonl`——逐条一行 JSON（所有 task 的 badcase 汇总）；
- TODO 3：`summary.md`——标题、环境信息（adapter/model/时间/并发/重试/缓存）、
  结果总览表（任务 / 样本数 / 指标百分比 / parse_failure / api_error / 用时）、bad case 示例、复现命令；
- TODO 4：返回 `{"results": Path, "summary": Path, "badcases": Path}`。
:::

:::run
```bash
pytest -q tests/test_step12_reports.py
```
:::

:::expect
```
4 passed
```
:::

:::fail
- summary 里百分比不对 → 指标是 0–1 的小数，展示时要 × 100；
- results.json 中文乱码 → 少了 `ensure_ascii=False`；
- badcases.jsonl 空文件 → 你写的是 badcases 列表的字符串而不是逐行 JSON。
:::

:::hint Hint 1
`run.tasks` 里每个 `TaskReport` 都有自己的 metrics / badcases / duration；
汇总表一行一个任务。
:::

:::hint Hint 2
复现命令就写你实际跑的那条，例如：
`python run_eval.py --adapter mock --model mock --tasks c3 --limit 12 --output outputs/run`。
:::

:::solution
```python
def write_reports(run, cfg, out_dir: Path) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    results_path = out_dir / "results.json"
    results_path.write_text(json.dumps(run.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    badcases_path = out_dir / "badcases.jsonl"
    with badcases_path.open("w", encoding="utf-8") as f:
        for t in run.tasks:
            for case in t.badcases:
                f.write(json.dumps(case, ensure_ascii=False) + "\n")
    ...  # summary.md 拼接（表头 + 每任务一行 + bad case 示例 + 复现命令）
```
:::

:::checkpoint
4 passed；你能说出三件套各自的读者是谁。
:::

:::explain
- 如果要把结果接入 CI（比如 F1 低于阈值就让 build 失败），你会读哪个文件？
- summary.md 里为什么必须带上 parse_failure 与 api_error 两列？
:::
:::

:::step 13 收口 CLI 与真实数据
:::goal
补全 `build_adapter()`；先用 mock 跑通 `run_eval.py`，再用真实数据切片（C3 / XCOPA）跑一次小评测。
:::

:::why
到这一步，所有模块都已经写好——但「能 import」不等于「能交付」。
CLI 是用户唯一看见的界面：参数、退出码、输出目录，缺一不可。
:::

:::files
要改的文件：`run_eval.py`（只有 `build_adapter` 是空的）
:::

:::write
**你来写**（`run_eval.py`）：

- TODO 1：`build_adapter(cfg)`——mock → `MockAdapter()`；hf → `HuggingFaceAdapter(...)`；
  openai → `OpenAICompatibleAdapter(...)`；未知类型抛 `ValueError`；
- TODO 2：先跑通 mock：`python run_eval.py --adapter mock --tasks c3 --limit 12 --no-cache`；
- TODO 3（可选，需要网络）：拉真实数据切片：
  `python scripts/fetch_data.py --task xcopa --n 60 --out data/xcopa_zh_60.jsonl`；
- TODO 4（可选，需要 transformers/torch）：真实模型评测——
  `python run_eval.py --adapter hf --model Qwen/Qwen2.5-0.5B-Instruct --tasks c3 --data c3=data/c3_dialog_60.jsonl --limit 60 --output outputs/run_real`。
:::

:::run
```bash
pytest -q tests/test_step13_cli.py
pytest -q                          # 全量：79 passed
python run_eval.py --adapter mock --tasks c3 xcopa qa --limit 12 --output outputs/run_mock
ls outputs/run_mock
```
:::

:::expect
```
2 passed
79 passed
outputs/run_mock/ 里出现 results.json summary.md badcases.jsonl
```
参考实现的真实评测记录（你的数字应与它同量级）：
```
c3    n=60 accuracy 55.0% | parse_failure 0 | api_error 0 | 19.2s
xcopa n=60 accuracy 55.0% | parse_failure 0 | api_error 0 | 8.2s
qa    n=8  EM 0% / F1 21.9% | 4.9s
第二次同参数运行：评测阶段 0.0s（128 条全部命中缓存）
```
:::

:::fail
- `--json` 之类参数报错 → 检查 argparse 定义与 cfg 覆盖的优先级（命令行 > JSON 配置 > 默认值）；
- mock 跑出 `parse_failure` 一大堆 → 正常：mock 的 policy 返回的不是标准字母（换 policy 或忽略）；
- 真实数据下载失败 → 网络问题，可继续用 mini 夹具；不要伪造数据。
:::

:::hint Hint 1
`build_adapter` 里注意把 CLI 参数（concurrency/max_new_tokens/temperature/base_url/api_key）透传给适配器构造函数。
:::

:::hint Hint 2
真实数据切片的分数字段：C3 的行格式 `{"id","context","question","options","answer"}`，
XCOPA `{"id","premise","question","choice1","choice2","answer"}`——与你的 `_to_items` 对齐检查一遍。
:::

:::solution
```python
def build_adapter(cfg: EvalConfig) -> ModelAdapter:
    if cfg.adapter == "mock":
        return MockAdapter()
    if cfg.adapter == "hf":
        from llm_eval.adapters.hf import HuggingFaceAdapter
        return HuggingFaceAdapter(cfg.model, max_new_tokens=cfg.max_new_tokens,
                                  temperature=cfg.temperature, peft_adapter=cfg.peft_adapter or None)
    if cfg.adapter == "openai":
        from llm_eval.adapters.openai_compat import OpenAICompatibleAdapter
        return OpenAICompatibleAdapter(cfg.model, base_url=cfg.base_url, api_key=cfg.api_key,
                                       max_new_tokens=cfg.max_new_tokens, temperature=cfg.temperature)
    raise ValueError(f"未知 adapter：{cfg.adapter}")
```
:::

:::checkpoint
79 passed + 你的 `outputs/run_mock/` 里躺着三件套报告。
:::

:::explain
- CLI 的优先级链（命令行 > 配置文件 > 默认值）是怎么实现的？
- 为什么「先 mock、后真实模型」是评测系统开发的标准顺序？
:::
:::

:::step 14 分析结果：不是「accuracy = xx，完成」
:::goal
打开你的报告，回答四个问题——把「分数」变成「结论」。
:::

:::why
这是整个 Capstone 的最后一课：评测工程师的价值不在跑分，而在**解释分数**。
面试官会盯着你的 bad case 分析问：这些错误里，哪些是系统问题？哪些才是模型能力？
:::

:::files
要改的文件：新建 `outputs/run_real/analysis.md`（或在你自己的实验仓库里写；本节不写代码）
:::

:::write
**你来写**（分析报告，4 个问题）：

- Q1：parser failure 有多少条？如果大于 0，它们是系统问题还是模型问题？
- Q2：wrong answer 有多少条？抽 3 条看原文——模型是「完全不会」还是「差一点」？
- Q3：API error 有多少条？（本地模型通常是 0；API 模型要关注）
- Q4：哪些错误是系统问题（parser/prompt/并发配置），哪些才是模型能力？
:::

:::run
```bash
# 从你的报告里统计（示例）
python - <<'EOF'
import json
cases = [json.loads(l) for l in open("outputs/run_mock/badcases.jsonl", encoding="utf-8")]
from collections import Counter
print(Counter(c["error_type"] for c in cases))
EOF
```
:::

:::expect
参考实现的真实分析（128 题那个 run）：
```
c3 / xcopa 的 parse_failure 与 api_error 都是 0 —— 说明出错的全是模型能力问题；
qa 的 F1 21.9% 低，不是「模型不会回答」，而是回答风格与指标不匹配：
  模型输出长句，标准答案是短语。
对照实验：max_new_tokens 从 16 加到 64 → F1 反而降到 17.6%（回答更长，不匹配的代价更大）
结论：瓶颈在指标与回答风格的匹配，不在生成长度。
→ 评测工程的第一纪律：先怀疑配置，再怀疑模型。
```
:::

:::note 最终交付物（Portfolio Output）
完成后你的评测目录里应该有**你自己跑出来的**：

```
outputs/run_*/
├── results.json        # 机读结果（模型 / 任务 / 指标 / 计数）
├── summary.md          # 人读报告（n、parse_failure、api_error、用时）
├── badcases.jsonl      # 逐条 bad case（含 error_type 分类）
└── analysis.md         # 你的分析：系统问题 vs 模型能力
```

**如果你要把它写进简历**，你必须能解释：Adapter/Task 为什么这样拆（A）、
parser 为什么影响 accuracy（B）、cache key 的设计（C）、
以及 bad case 里哪些是系统问题、哪些才是模型问题（D）。这是评测岗面试的第一个深水区。
:::

:::checkpoint
Final Checkpoint —— 合上代码，回答：
1. `ModelAdapter` 为什么存在？没有它，评测两个模型的成本是什么？
2. `EvalTask` 为什么存在？加 GSM8K 要改哪几处？
3. parser 为什么影响 accuracy？你测过哪些输出格式？
4. cache key 怎么设计？什么参数必须进 key？失败为什么不能缓存？
5. async 为什么要 semaphore？全并发会发生什么？
6. retry 为什么不能重试 401？哪些错误可重试？
7. bad case 为什么要结构化？五类 error_type 各自的修法是什么？
8. 第二次运行为什么会快？缓存命中链路上发生了什么？
:::

:::explain
这 8 题就是 Checkpoint C 的口试清单。全部答上 = 你完成了一个可以写进简历的评测项目。
:::

:::solution 查看参考实现（完成后对照）
完整实现：`projects/llm-eval/`（21 个测试函数 / 32 个用例 + 真实 C3/XCOPA 运行记录）。
对照重点：
1. `runner.py` 的「查缓存 → 生成缺失 → 回填 → 判分」主循环；
2. `openai_compat.py` 的状态码分类；
3. `reports.py` 的 summary.md 结构。
:::
:::
:::

## 27.3 Learn 参考手册：评测系统的七块拼图（做项目时回来查）

### 27.3.1 为什么不能写成一坨

eval harness 最容易被写成一坨：

```python
for q in questions:
    answer = model.generate(q)
    if answer == gold:
        correct += 1
```

一坨代码的问题是：换模型要改动核心逻辑、加并发会乱、缓存没处放、bad case 只能靠 print。

拆成 Adapter/Task 之后：

- 换模型 = 换 Adapter（HF → OpenAI 兼容 → 任何服务）；
- 加任务 = 加 Task（C3 → XCOPA → 自研 QA → 以后加 GSM8K）；
- 评测逻辑（并发/缓存/重试）只写一次。

### 27.3.2 ModelAdapter：统一「要答案」的接口

```python
class ModelAdapter(ABC):
    @abstractmethod
    def generate(self, prompts: list[str]) -> list[str]: ...

    async def agenerate(self, prompts: list[str]) -> list[str]:
        return await asyncio.to_thread(self.generate, prompts)  # 默认：同步实现丢线程池
```

| 适配器 | 用途 | 关键细节 |
| --- | --- | --- |
| `HuggingFaceAdapter` | 本地模型（第 26 章） | chat template + left padding + batch |
| `OpenAICompatibleAdapter` | 任何 `/v1/chat/completions` 服务 | httpx 异步 + Bearer 鉴权 + 429/5xx 归类为可重试 |
| `MockAdapter` | 测试/冒烟 | 确定性输出；可模拟「前 N 次失败」测重试 |

**只依赖通用接口，不绑定特定收费服务**——本地 vLLM、Ollama、公司网关都是同一个适配器。

### 27.3.3 EvalTask：load / build_prompt / parse_answer / score

| 任务 | 数据 | 问法 | 判分 |
| --- | --- | --- | --- |
| `C3Task` | 中文阅读理解（C3 dialog，4 选 1） | 「只回答一个字母」 | accuracy |
| `XCOPATask` | 因果推理（XCOPA zh，2 选 1） | cause/effect 转中文提问 | accuracy |
| `QATask` | 自定义问答 | 「尽量简洁」 | EM + F1 |

数据加载双通道：默认读仓库内的教学夹具（`data/mini_*.jsonl`），也可以 `--data c3=你的文件.jsonl` 换成任意数据。**任务定义与数据解耦**——这是能接真实数据集的关键。

### 27.3.4 Parser：accuracy 的隐形杀手

无法解析的样本单独计为 `parse_failure`——它和「答错」是两种问题：前者修 parser / 改 prompt，后者修模型。

```python
def parse_choice(text: str, valid: str = "ABCD") -> Optional[str]:
    cleaned = re.sub(r"[*`_]", "", text.strip()).upper()   # 去 markdown、统一大小写
    for pattern in _COMPILED:                              # 多级模式，从严格到宽松
        m = pattern.search(cleaned)
        if m and m.group(1) in valid:
            return m.group(1)
    return None                                            # 无法解析 → parse_failure
```

### 27.3.5 Runner：并发 + 重试 + 缓存

**并发（API 场景）**：

```python
sem = asyncio.Semaphore(cfg.concurrency)     # 例：8
async def one(prompt):
    async with sem:                          # 最多 8 个请求同时在飞
        return await with_retry(prompt)
await asyncio.gather(*(one(p) for p in prompts))
```

为什么不能 10000 个一起打出去？**429 限流 → 重试风暴 → 更慢**。本地 HF 模型则是批量串行（`concurrency=1`），因为瓶颈是 CPU/GPU 而不是网络。

**重试（指数退避）**：

```python
for attempt in range(cfg.retries + 1):
    try: return call()
    except AdapterError:
        time.sleep(cfg.retry_backoff_s * (2 ** attempt))   # 1.5s → 3s → 6s
```

关键设计：适配器把「可重试」（超时、429、5xx）和「不可重试」（400 参数错、401 鉴权）分开了——后者重试多少次都没用。

**缓存（key 的设计）**：

```python
key = sha256(model + prompt + max_new_tokens + temperature)   # 影响输出的参数必须全部进 key
```

实测效果：同一评测跑第二遍，**评测阶段从 32.3s 降到 0.0s**。调参重跑只重算变化的样本。

### 27.3.6 Bad case：五类 error_type

| error_type | 含义 | 该修什么 |
| --- | --- | --- |
| `parse_failure` | 无法从输出里提取答案 | parser / prompt 格式 |
| `wrong_answer` | 解析成功但答错 | 模型 / 数据 |
| `empty_output` | 模型返回空 | 服务 / 参数 |
| `api_error` | 请求最终失败（重试耗尽） | 并发 / 超时 / 限流配置 |
| `low_f1` | 问答 F1 < 0.5 | 回答风格 / 指标设计 |

每个失败样本都落一条结构化记录：

```json
{
  "task": "c3", "id": "c3-dialog-m14-1-0",
  "gold": "A", "prediction": "B", "raw_output": "B",
  "error_type": "wrong_answer",
  "prompt": "阅读下面的材料，回答问题。……"
}
```

报告自动生成三件套：`results.json`（机读）、`summary.md`（人读）、`badcases.jsonl`（逐条分析）。

## 27.4 真实运行结果与使用方式（Reference Solution 实测）

Qwen2.5-0.5B-Instruct，真实数据切片（`scripts/fetch_data.py` 从 HuggingFace 拉取）：

| 任务 | 数据 | n | 指标 | parse_failure | api_error | 用时 |
| --- | --- | --- | --- | --- | --- | --- |
| c3 | C3 dialog 切片 | 60 | accuracy **55.0%**（随机 25%） | 0 | 0 | 19.2s |
| xcopa | XCOPA zh 切片 | 60 | accuracy **55.0%**（随机 50%） | 0 | 0 | 8.2s |
| qa | 教学夹具 | 8 | EM 0% / F1 **21.9%** | 0 | 0 | 4.9s |

**怎么读这些数字（第 23 章纪律）**：

- C3 高于随机基线 25pt、XCOPA 高于随机 5pt——0.5B 小模型的合理水平；**n=60 的置信区间很宽（±12pt 量级），不能下强结论**；
- QA 的 F1 低不是因为「模型不会回答」，而是回答风格与指标不匹配：模型输出长句，标准答案是短语。做对照实验——`max_new_tokens` 从 16 加到 64 后 F1 **反而降到 17.6%**（回答更长，不匹配的代价更大）→ 结论：**瓶颈在指标与回答风格的匹配，不在生成长度**。这是评测工程里典型的一课：**先怀疑配置，再怀疑模型**。

**缓存实测**：第二次同参数运行，评测阶段 0.0s，128 条全部命中缓存。

**使用方式**（参考实现）：

```bash
cd projects/llm-eval
pip install -r requirements.txt

# 拉真实数据（可选）
python scripts/fetch_data.py --task xcopa --n 60 --out data/xcopa_zh_60.jsonl
python scripts/fetch_data.py --task c3   --n 60 --out data/c3_dialog_60.jsonl

# 跑真实评测
python run_eval.py --model Qwen/Qwen2.5-0.5B-Instruct --tasks c3 xcopa qa \
  --data c3=data/c3_dialog_60.jsonl --data xcopa=data/xcopa_zh_60.jsonl \
  --limit 60 --output outputs/run_001

# 对 API 模型并发评测
python run_eval.py --adapter openai --model qwen2.5 --base-url http://localhost:8000 \
  --tasks c3 xcopa --concurrency 8

# 测试
pytest -q    # 32 passed（21 个测试函数）
```

## 27.5 Level 3 · Reference Solution

完整工程：[`projects/llm-eval/`](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval)

| 你写的文件 | 参考实现对应 | 差异点 |
| --- | --- | --- |
| `parsers.py` | 同名 | 模式列表更全（可对照） |
| `metrics.py` | 同名 | 多实现了 `pass_at_k` / `percentile`（本 Lab 不需要） |
| `runner.py` | 同名 | 参考实现把重试同时用于并发与批量两个分支 |
| `cache.py` | 同名 | 一致 |
| `adapters/*` | 同名 | 参考实现多一个 `_sync_with_retry` |
| `reports.py` | 同名 | 一致 |

## 27.6 面试复盘：Eval Harness

不能翻资料，逐条回答（对照 `projects/llm-eval/` 源码）：

1. parser 为什么会影响 accuracy？你测过哪些输出格式？
2. async 怎么控制并发？Semaphore 放在哪一层？
3. retry 会不会导致重复请求？什么错误该重试、什么不该？
4. cache key 怎么设计？缓存什么时候必须失效？
5. bad case 怎么分类？分类之后各自的修法是什么？
6. 怎么保证评测两个模型时是公平比较？（同一数据、同一 prompt、同一解析、同一指标）
7. 评测结果里为什么必须报告 n 和 parse_failure 数？
8. 如果明天要加 GSM8K（生成式数学题），你的框架需要改哪几个文件？
9. **（新版）** 你的 harness 里，哪一部分是「系统问题」可能引入的错误？你怎么用 bad case 区分「系统坏了」和「模型不行」？
10. **（新版）** 描述你的缓存 key 里包含哪些参数，以及你如何验证「第二次运行真的快」。

:::quiz
你的评测框架在 A 模型上 accuracy=72%，B 模型 71%，报告结论「A 比 B 好」。以下哪种做法最专业？

A. 直接写进简历：A 模型优于 B
B. 报告 72% vs 71%，并给出样本量与置信区间（如 n=500 时 ±3.9pt），指出差异不显著
C. 多跑几遍取最高的一次
D. 换一个对 A 更有利的指标

答案: B
解析: 评测工程的第一纪律是「分数必须带不确定性」。n=500 时 95% CI 约 ±3.9pt——1pt 的差异完全在噪声范围内。C 是 cherry-picking；D 是指标操纵。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 架构 | Adapter（要答案）× Task（问/判）× Runner（并发/重试/缓存）× Reports |
| Parser | 解析失败会伪装成模型变差；parse_failure 要单独统计 |
| 并发 | asyncio + Semaphore；全并发 = 429 重试风暴 |
| 缓存 | key 必须包含全部影响输出的参数；失败不缓存 |
| Bad case | 五类 error_type，各有不同的修法 |
| 纪律 | 报告必须带 n 与不确定性；先怀疑配置再怀疑模型 |
| 学习模式 | Learn（手册）→ Guided Build（starter 15 步）→ Reference（完整工程） |
:::

:::related
依赖 | 第 23 章 LLM Evaluation, 第 25 章 Python 工程, 第 26 章 HuggingFace
用于 | Capstone 2（RAG 评测）, Capstone 3（SFT 前后对比）, 大模型评测实习面试
:::
