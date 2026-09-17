# 第 27 章 · Mini LLM Evaluation Harness：评测系统怎么拆

:::intuition 一句话
评测岗不会只问「accuracy 怎么算」——他们会问 **bad case 怎么分类、并发怎么控、缓存 key 怎么设计**。第 23 章讲指标与纪律；这一章讲评测系统的分层。当前主线作业仍是 Attention，不是再写一套旧 Capstone harness。
:::

:::note 本章在当前主线中的位置
当前主线是「小模型学习实验室 → 技术声明核验助手 / 单 Agent → 算法或 Infra 专项」。本章当教材阅读：保留 Adapter / Task / Runner / 缓存 / bad case 原理，以及 C3/XCOPA 的历史实测。`projects/llm-eval/` 是历史参考实现，**不是当前作业**。不要进入 `starter/`，不要把 79 个测试全绿当必修。
:::

## 27.1 为什么需要一层 harness

第 23 章教会了 PPL、pass@k、置信区间、LLM-as-a-Judge。岗位上还要能重复运行、比较两个模型、自动找出失败案例：

```text
新模型训完了 → 它到底比上一版好还是坏？
  ↑ 需要能复跑、能比较、能把失败样本结构化落盘的系统
```

| 问题 | 工程答案 |
| --- | --- |
| 模型五花八门（本地 HF / API / 不同服务商） | `ModelAdapter` 统一接口 |
| 任务五花八门（选择题 / 问答 / 生成） | `EvalTask`：load / build_prompt / parse_answer / score |
| 模型输出脏（「答案是 C。」） | 专门的 `parser`；解析失败单独计数 |
| API 会超时、限流 | 重试 + 退避；401 等不可重试错误要分开 |
| 评测太贵太慢 | 响应缓存；影响输出的参数必须全部进 key |
| 一堆数字看不懂 | 自动报告 + 结构化 bad case |

```
Runner
  对每个 Task 的每个 Item：
  ① 查缓存 → ② 需要则调 Adapter（重试+限流）
  ③ task.parse_answer → ④ task.score
  ⑤ 收集 bad case
  → results.json / summary.md / badcases.jsonl
```

## 27.2 历史实测（可选对照）

Qwen2.5-0.5B-Instruct，128 题（C3 60 + XCOPA 60 + QA 8），CPU：

```
c3:    accuracy 55.0%（随机 25%）| parse_failure 0 | api_error 0 | 19.2s
xcopa: accuracy 55.0%（随机 50%）| parse_failure 0 | api_error 0 | 8.2s
qa:    EM 0% / F1 21.9%          | parse_failure 0 | api_error 0 | 4.9s
缓存复跑：评测阶段 32.3s → 0.0s（128 条全部命中）
```

n=60 时置信区间很宽，不能下「模型变好了」的强结论。QA 的 F1 低往往是回答风格与指标不匹配，不是「模型完全不会答」。

:::note 可选参考（非当前作业）
对照实现见 [projects/llm-eval](https://github.com/xhr0417/llm-course/tree/main/projects/llm-eval)。不要 `cd` 进 `starter/`，也不要把旧 eval harness 当当前 Capstone。
:::

## 27.3 评测系统的七块拼图

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

任务定义与数据解耦：同一套 Task 可以换教学夹具或真实切片。

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

关键设计：适配器把「可重试」（超时、429、5xx）和「不可重试」（400 参数错、401 鉴权）分开——后者重试多少次都没用。

**缓存（key 的设计）**：

```python
key = sha256(model + prompt + max_new_tokens + temperature)   # 影响输出的参数必须全部进 key
```

历史实测：同一评测跑第二遍，**评测阶段从 32.3s 降到 0.0s**。失败响应不要写入缓存。

### 27.3.6 Bad case：五类 error_type

| error_type | 含义 | 该修什么 |
| --- | --- | --- |
| `parse_failure` | 无法从输出里提取答案 | parser / prompt 格式 |
| `wrong_answer` | 解析成功但答错 | 模型 / 数据 |
| `empty_output` | 模型返回空 | 服务 / 参数 |
| `api_error` | 请求最终失败（重试耗尽） | 并发 / 超时 / 限流配置 |
| `low_f1` | 问答 F1 < 0.5 | 回答风格 / 指标设计 |

每个失败样本都落一条结构化记录（task / id / gold / prediction / raw_output / error_type / prompt）。报告三件套：`results.json`（机读）、`summary.md`（人读）、`badcases.jsonl`（逐条分析）。

## 27.4 怎么读历史分数

| 任务 | 数据 | n | 指标 | parse_failure | api_error | 用时 |
| --- | --- | --- | --- | --- | --- | --- |
| c3 | C3 dialog 切片 | 60 | accuracy **55.0%**（随机 25%） | 0 | 0 | 19.2s |
| xcopa | XCOPA zh 切片 | 60 | accuracy **55.0%**（随机 50%） | 0 | 0 | 8.2s |
| qa | 教学夹具 | 8 | EM 0% / F1 **21.9%** | 0 | 0 | 4.9s |

- C3 高于随机 25pt、XCOPA 高于随机 5pt——0.5B 的合理水平；**n=60 的置信区间很宽（±12pt 量级），不能下强结论**；
- QA 的 F1 低：模型输出长句，标准答案是短语。`max_new_tokens` 从 16 加到 64 后 F1 **反而降到 17.6%** → **先怀疑配置，再怀疑模型**。

若只想复现当时命令，见可选参考目录里的 README。那不是当前作业。

## 27.5 自问（教材理解，不是旧 Capstone 打卡）

1. parser 为什么会影响 accuracy？解析失败和答错为什么要分开统计？
2. asyncio 怎么控制并发？Semaphore 放在哪一层？全并发会怎样？
3. 什么错误该重试、什么不该？失败为什么不能进缓存？
4. cache key 必须包含哪些参数？第二次运行为什么会快？
5. 五类 error_type 各自该修系统还是修模型？
6. 比较两个模型时，同一数据、同一 prompt、同一解析、同一指标少了哪一条会不公平？
7. 若要加 GSM8K，Adapter / Task / Runner 各改什么、不改什么？

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
用于 | 第 28–30 章的评测纪律阅读, 后续核验助手里的简化 evaluator
:::
