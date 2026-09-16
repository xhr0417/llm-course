# 第 27 章 · Capstone 1：Mini LLM Evaluation Harness

:::intuition 一句话
评测岗的面试官不会问你「accuracy 怎么算」——他们会问「**你做过评测系统吗？bad case 怎么分类？并发怎么控？缓存 key 怎么设计？**」这一章交付一个真正能运行的评测框架：Checkpoint C。
:::

**项目位置**：[`projects/llm-eval/`](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval)
**真实运行**：Qwen2.5-0.5B-Instruct，128 题（C3 60 + XCOPA 60 + QA 8），CPU 32.3 秒跑完。

## 27.1 目标：从「会用指标」到「做出评测系统」

第 23 章教会了你 PPL、pass@k、置信区间、LLM-as-a-Judge。但真实岗位要的是这个：

```text
新模型训完了 → 它到底比上一版好还是坏？
  ↑ 你需要一个能重复运行、能比较两个模型、能自动找出失败案例的系统
```

这个系统必须解决五个工程问题：

| 问题 | 本项目的答案 |
| --- | --- |
| 模型五花八门（本地 HF / API / 不同服务商） | `ModelAdapter` 统一接口 |
| 任务五花八门（选择题 / 问答 / 生成） | `EvalTask` 统一四件套 |
| 模型输出脏（"答案是 C。"） | 专门设计的 `parser.py` |
| API 会超时、限流、失败 | 重试 + 退避 + 并发上限 |
| 评测跑一次太贵太慢 | 响应缓存 |
| 跑完一堆数字看不懂 | 自动报告 + bad case 分类 |

## 27.2 架构：Adapter × Task × Runner × Reports

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

四个模块各自独立、各自可测：

```text
src/llm_eval/
├── adapters/   ModelAdapter：怎么向模型要答案
├── tasks/      EvalTask：怎么问、怎么判分
├── runner.py   并发 + 重试 + 缓存 + badcase
└── reports.py  结果落盘
```

:::warning 为什么这个拆法非常重要
eval harness 最容易被写成一坨：`for q in questions: answer = model.generate(q); if answer == gold: correct += 1`。

一坨代码的问题是：换模型要改动核心逻辑、加并发会乱、缓存没处放、bad case 只能靠 print。

拆成 Adapter/Task 之后：
- 换模型 = 换 Adapter（HF → OpenAI 兼容 → 任何服务）；
- 加任务 = 加 Task（C3 → XCOPA → 自研 QA → 以后加 GSM8K）；
- 评测逻辑（并发/缓存/重试）只写一次。
:::

## 27.3 ModelAdapter：统一「要答案」的接口

```python
class ModelAdapter(ABC):
    @abstractmethod
    def generate(self, prompts: list[str]) -> list[str]: ...

    async def agenerate(self, prompts: list[str]) -> list[str]:
        return await asyncio.to_thread(self.generate, prompts)  # 默认：同步实现丢线程池
```

三种实现：

| 适配器 | 用途 | 关键细节 |
| --- | --- | --- |
| `HuggingFaceAdapter` | 本地模型（第 26 章） | chat template + left padding + batch |
| `OpenAICompatibleAdapter` | 任何 `/v1/chat/completions` 服务 | httpx 异步 + Bearer 鉴权 + 429/5xx 归类为可重试 |
| `MockAdapter` | 测试/冒烟 | 确定性输出；可模拟「前 N 次失败」测重试 |

**只依赖通用接口，不绑定特定收费服务**——本地 vLLM、Ollama、公司网关都是同一个适配器。

## 27.4 EvalTask：load / build_prompt / parse_answer / score

```python
class EvalTask(ABC):
    def load(self) -> list[EvalItem]: ...            # 读数据 → 已构造好的 prompt
    def build_prompt(self, row) -> str: ...          # 每种任务的提问格式
    def parse_answer(self, raw) -> Optional[str]: ...# 原始输出 → 规范答案
    def score(self, prediction, item) -> dict: ...   # 打分（支持多指标）
```

本项目的三个任务：

| 任务 | 数据 | 问法 | 判分 |
| --- | --- | --- | --- |
| `C3Task` | 中文阅读理解（C3 dialog，4 选 1） | 「只回答一个字母」 | accuracy |
| `XCOPATask` | 因果推理（XCOPA zh，2 选 1） | cause/effect 转中文提问 | accuracy |
| `QATask` | 自定义问答 | 「尽量简洁」 | EM + F1 |

数据加载双通道：默认读仓库内的教学夹具（`data/mini_*.jsonl`），也可以 `--data c3=你的文件.jsonl` 换成任意数据。**任务定义与数据解耦**——这是能接真实数据集的关键。

## 27.5 Parser：accuracy 的隐形杀手

模型不会乖乖输出一个字母。它可能输出：

```
"C"            "c"           "C."          "答案是 C"
"我认为选 B"    "**D**"       "C) 因为……"    "The correct answer is C."
```

解析失败的题目会被判错——**parser 的 bug 会伪装成「模型能力差」**。所以 parser 是重点测试对象：29 个用例里有 12 条在测它。

```python
def parse_choice(text: str, valid: str = "ABCD") -> Optional[str]:
    cleaned = re.sub(r"[*`_]", "", text.strip()).upper()   # 去 markdown、统一大小写
    for pattern in _COMPILED:                              # 多级模式，从严格到宽松
        m = pattern.search(cleaned)
        if m and m.group(1) in valid:
            return m.group(1)
    return None                                            # 无法解析 → parse_failure
```

无法解析的样本单独计为 `parse_failure`——它和「答错」是两种问题：前者修 parser / 改 prompt，后者修模型。

## 27.6 Runner：并发 + 重试 + 缓存

### 并发（API 场景）

```python
sem = asyncio.Semaphore(cfg.concurrency)     # 例：8
async def one(prompt):
    async with sem:                          # 最多 8 个请求同时在飞
        return await with_retry(prompt)
await asyncio.gather(*(one(p) for p in prompts))
```

为什么不能 10000 个一起打出去？**429 限流 → 重试风暴 → 更慢**——第 25 章讲过原理，这里就是它的生产级实现。本地 HF 模型则是批量串行（`concurrency=1`），因为瓶颈是 CPU/GPU 而不是网络。

### 重试（指数退避）

```python
for attempt in range(cfg.retries + 1):
    try: return call()
    except AdapterError:
        time.sleep(cfg.retry_backoff_s * (2 ** attempt))   # 1.5s → 3s → 6s
```

关键设计：适配器把「可重试」（超时、429、5xx）和「不可重试」（400 参数错、401 鉴权）分开了——后者重试多少次都没用。

### 缓存（key 的设计）

```python
key = sha256(model + prompt + max_new_tokens + temperature)   # 影响输出的参数必须全部进 key
```

实测效果：同一评测跑第二遍，**评测阶段从 32.3s 降到 0.0s**（128 条全部命中 SQLite 缓存）。调参重跑只重算变化的样本——评测迭代速度提升一个量级。

:::warning 缓存的三个坑
1. **key 少参**：改了 `max_new_tokens` 却命中旧答案 → 结果错得毫无察觉（本章项目把全部生成参数写进 key）；
2. **缓存永不失效**：模型更新（比如你重训了 checkpoint）后如果路径/名字没变，会拿到旧响应——用版本号或按内容哈希命名 checkpoint；
3. **失败也被缓存**：本项目对空响应不写缓存，避免「一次网络抖动永久污染结果」。
:::

## 27.7 Bad case：从「错了几个」到「错在哪」

每个失败样本都落一条结构化记录：

```json
{
  "task": "c3", "id": "c3-dialog-m14-1-0",
  "gold": "A", "prediction": "B", "raw_output": "B",
  "error_type": "wrong_answer",
  "prompt": "阅读下面的材料，回答问题。……"
}
```

`error_type` 让失败可归类：

| error_type | 含义 | 该修什么 |
| --- | --- | --- |
| `parse_failure` | 无法从输出里提取答案 | parser / prompt 格式 |
| `wrong_answer` | 解析成功但答错 | 模型 / 数据 |
| `empty_output` | 模型返回空 | 服务 / 参数 |
| `api_error` | 请求最终失败（重试耗尽） | 并发 / 超时 / 限流配置 |
| `low_f1` | 问答 F1 < 0.5 | 回答风格 / 指标设计 |

报告自动生成三件套：`results.json`（机读）、`summary.md`（人读）、`badcases.jsonl`（逐条分析）。

## 27.8 真实运行结果（本机实测）

Qwen2.5-0.5B-Instruct，真实数据切片（`scripts/fetch_data.py` 从 HuggingFace 拉取）：

| 任务 | 数据 | n | 指标 | parse_failure | api_error | 用时 |
| --- | --- | --- | --- | --- | --- | --- |
| c3 | C3 dialog 切片 | 60 | accuracy **55.0%**（随机 25%） | 0 | 0 | 19.2s |
| xcopa | XCOPA zh 切片 | 60 | accuracy **55.0%**（随机 50%） | 0 | 0 | 8.2s |
| qa | 教学夹具 | 8 | EM 0% / F1 **21.9%** | 0 | 0 | 4.9s |

**怎么读这些数字（第 23 章纪律）**：

- C3 高于随机基线 25pt、XCOPA 高于随机 5pt——0.5B 小模型的合理水平；**n=60 的置信区间很宽（±12pt 量级），不能下强结论**；
- QA 的 F1 低不是因为「模型不会回答」，而是回答风格与指标不匹配：模型输出长句，标准答案是短语。做了一个对照实验——把 `max_new_tokens` 从 16 加到 64 后 F1 **反而降到 17.6%**（回答更长，不匹配的代价更大）→ 结论：**瓶颈在指标与回答风格的匹配，不在生成长度**。这是评测工程里典型的一课：**先怀疑配置，再怀疑模型**。

**缓存实测**：第二次同参数运行，评测阶段 0.0s，128 条全部命中缓存。

## 27.9 使用方式

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
pytest -q    # 29 passed
```

## 27.10 面试复盘：Eval Harness

不能翻资料，逐条回答（对照 `projects/llm-eval/` 源码）：

1. parser 为什么会影响 accuracy？你测过哪些输出格式？
2. async 怎么控制并发？Semaphore 放在哪一层？
3. retry 会不会导致重复请求？什么错误该重试、什么不该？
4. cache key 怎么设计？缓存什么时候必须失效？
5. bad case 怎么分类？分类之后各自的修法是什么？
6. 怎么保证评测两个模型时是公平比较？（同一数据、同一 prompt、同一解析、同一指标）
7. 评测结果里为什么必须报告 n 和 parse_failure 数？
8. 如果明天要加 GSM8K（生成式数学题），你的框架需要改哪几个文件？

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
:::

:::related
依赖 | 第 23 章 LLM Evaluation, 第 25 章 Python 工程, 第 26 章 HuggingFace
用于 | Capstone 2（RAG 评测）, Capstone 3（SFT 前后对比）, 大模型评测实习面试
:::
