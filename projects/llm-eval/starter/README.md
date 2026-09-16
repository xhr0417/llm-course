# llm-eval · Starter（Guided Build）

这是 **第 27 章 · Capstone 1：Mini LLM Evaluation Harness** 的 Guided Build 起点项目。

**它现在是一个不完整的项目**：`src/llm_eval/` 里的核心函数只有签名和 `NotImplementedError`，
15 个测试文件里的 79 个用例中有 77 个是红的。
你的任务不是「看懂」，而是**一步一步把函数写出来，让测试从红变绿**。

> 项目目标：一个可运行的评测框架 —— 统一模型接口（Mock / 本地 HF / OpenAI 兼容）
> × 可插拔任务（C3 / XCOPA / QA）× 并发 + 重试 + 缓存
> → 自动产出 `results.json` / `summary.md` / `badcases.jsonl`。

## 从零开始：我要在哪里开始、怎么开始

**推荐执行位置**：

| 做什么 | 推荐机器 | 原因 |
| --- | --- | --- |
| `pytest`（全部 15 个 Step） | 🖥 Mac 或 ☁ Server 都可以 | 不需要 GPU；Step 7 需要 transformers/torch（tiny 模型，很小） |
| `--adapter mock` 跑 CLI | 🎮 均可 | 不加载任何真实模型 |
| `--adapter hf` 真实评测 | ☁ Server 优先 | 与第 26 章一样使用 Qwen，模型进 HF 缓存 |
| `--adapter openai`（API） | 🎮 任意能联网的环境 | API key 只放环境变量（`export ...`），**绝不进 Git** |

在哪台机器执行，`pip install` 和 `pytest` 就必须都在**同一台**机器上。

### 1. 先分清三个「地址」＋ 产出文件去哪里

| 东西 | 是什么 | 示例（只是示例） |
| --- | --- | --- |
| GitHub 仓库 | 远程仓库（代码的源头） | `https://github.com/xhr0417/llm-course` |
| 你的 clone | 本机工作副本 | Mac：`~/Projects/llm-course` · Server：`~/workspace/llm-course` |
| 本 starter | repo 里的子目录 | `<你的 clone>/projects/llm-eval/starter` |
| 评测产出 | 运行时生成在 `outputs/run_xxx/`（已 gitignore）；`summary.md` 等**小型报告**可以拷进你的仓库 | `results.json` / `summary.md` / `badcases.jsonl` |
| 模型缓存 | **不在 repo 里**：HuggingFace 缓存目录（`echo $HF_HOME` 查看） | 大文件留服务器 |

### 2. 五条命令：从零到第一次 pytest

```bash
# ① 【在哪执行】Mac 或 Linux Server（任选一台）
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
pwd        # 记下它 = repo root（已有 clone 就直接 cd 过来）

# ② 进入 starter
# 【当前目录】repo root
cd projects/llm-eval/starter
pwd        # 应看到 .../llm-course/projects/llm-eval/starter

# ③ 安装依赖（httpx + pytest；Step 7 再装 transformers/torch）
pip install -r requirements.txt

# ④ 第一次运行：应该满屏红色
pytest -q
```

### 3. starter 和 reference 是什么关系？

- **starter**（你现在这里）：刻意**不完整**；77 个失败就是你的任务清单；
- **reference**（上一级 `projects/llm-eval/`）：完整实现 + 真实 C3/XCOPA 评测记录。**做完再看**。

### 4. 哪些文件要改？哪些不要改？

| 文件 | 动它吗 |
| --- | --- |
| `src/llm_eval/**` | ✅ 要实现的代码全在这里 |
| `tests/test_step*.py` | ❌ 不要改（验收标准） |
| `run_eval.py` | ✅ 只有 `build_adapter()` 留给你补全 |
| `data/mini_*.jsonl` | 🔧 小夹具，可读可加 |
| `scripts/fetch_data.py` | ✅ Step 13 拉真实数据时用（需联网） |
| `../`（reference） | ⚠️ 只做对照 |

### 5. 做完之后：代码和报告放哪里？

```bash
# 【在哪执行】做项目的机器【当前目录】repo root
mkdir -p ~/Projects/my-llm-eval
cp -R projects/llm-eval/starter/. ~/Projects/my-llm-eval/
cd ~/Projects/my-llm-eval
git init && git add . && git commit -m "my mini eval harness"
```

你的作品集仓库里适合放：源码、测试、`summary.md` 这类小型报告、`badcases.jsonl` 的截取样例。
不适合放：模型权重、大数据集、`.cache/`（sqlite 缓存）。

⚠️ 不要把整个课程 repo 伪装成你独立写的作品。

## Quick Start

```bash
cd projects/llm-eval/starter
pip install -r requirements.txt

pytest -q          # 现在就应该失败（这是设计的一部分）
```

**初始状态（真实记录）**：`77 failed, 2 passed in 3.6s`
（2 个 passed 断言的是已给出代码的配置项：`supports_concurrency` 的默认值）。
失败不是错误，而是给你看的任务清单。请对照课程第 27 章逐组变绿。

## Step → 测试 对应表

| Step | 主题 | 运行（只看本步） | 变绿意味着 |
| --- | --- | --- | --- |
| 1a | parser 基本格式（"C" / "c" / "C."） | `pytest -q tests/test_step1a_parser_basic.py` | 5 passed |
| 1b | parser 鲁棒性（12 种真实输出 / None / strip_special） | `pytest -q tests/test_step1b_parser_robust.py` | 15 passed |
| 2 | 指标：accuracy / exact_match / f1_score | `pytest -q tests/test_step2_metrics.py` | 12 passed |
| 3a | C3Task：load / parse_answer / score | `pytest -q tests/test_step3a_c3_task.py` | 6 passed |
| 3b | XCOPATask：cause / effect 转中文提问 | `pytest -q tests/test_step3b_xcopa_task.py` | 4 passed |
| 4 | MockAdapter：policy + calls 计数 | `pytest -q tests/test_step4_mock_adapter.py` | 4 passed |
| 5 | Runner 端到端：evaluate_tasks（mock） | `pytest -q tests/test_step5_runner.py` | 4 passed |
| 6 | badcase 分类：parse_failure / api_error / wrong_answer | `pytest -q tests/test_step6_badcase.py` | 3 passed |
| 7 | HuggingFaceAdapter：chat template + 左 padding + batch | `pytest -q tests/test_step7_hf_adapter.py` | 2 passed |
| 8 | ResponseCache：params 进 key；空响应不缓存 | `pytest -q tests/test_step8_cache.py` | 7 passed |
| 9 | OpenAICompatibleAdapter：httpx + 400/401 不可重试 | `pytest -q tests/test_step9_api_adapter.py` | 5 passed |
| 10 | 并发：Semaphore 上限 + 真的并行 | `pytest -q tests/test_step10_async.py` | 3 passed |
| 11 | 重试：指数退避；FatalAdapterError 不重试 | `pytest -q tests/test_step11_retry.py` | 3 passed |
| 12 | 报告三件套：results / summary / badcases | `pytest -q tests/test_step12_reports.py` | 4 passed |
| 13 | CLI 收口：`python run_eval.py --adapter mock ...` | `pytest -q tests/test_step13_cli.py` | 2 passed |

> 跑全量 `pytest -q` 时，后面步骤的测试也会一起失败——这是正常的：
> 它们在等你先完成前面的步骤。全部完成后：`pytest -q` → **79 passed**。

**Step 7 需要额外依赖**（不在 requirements.txt 里，做到那一步再装）：

```bash
pip install transformers torch
```

测试用 tiny 模型（`trl-internal-testing/tiny-Qwen2ForCausalLM-2.5`）验证，
首次运行会下载（很小，CPU 几秒）；`RUN_MODEL_TESTS=0 pytest -q` 可跳过模型测试
（结果：77 passed, 2 skipped）。

> 小提示：`run_eval.py` 的 CLI 骨架已给出，只有 `build_adapter()` 是空的。
> Step 4 之后你就可以先补上 mock 分支（`return MockAdapter()`），让命令行走通；
> hf / openai 分支在 Step 7 / 9 完成。

## 目录结构

```text
starter/
├── README.md
├── requirements.txt        # httpx + pytest（Step 7 再装 transformers / torch）
├── pytest.ini              # testpaths = tests
├── conftest.py             # src/ 进 import 路径 + KMP + RUN_MODEL_TESTS
├── run_eval.py             # CLI 骨架（已给出；build_adapter 留给你）
├── configs/default.json    # EvalConfig 示例（dataclass + JSON 覆盖）
├── data/mini_*.jsonl       # 教学夹具：c3 12 题 / xcopa 12 题 / qa 8 题
├── scripts/fetch_data.py   # 可选：从 HuggingFace 拉真实数据切片（Step 13）
├── src/llm_eval/
│   ├── config.py           # EvalConfig（已给出）
│   ├── parsers.py          # Step 1：parse_choice / strip_special
│   ├── metrics.py          # Step 2：accuracy / exact_match / f1_score
│   ├── tasks/              # Step 3：c3 / xcopa（qa 已给出，作多指标参考）
│   ├── adapters/           # Step 4/7/9：mock / hf / openai_compat
│   ├── cache.py            # Step 8：sqlite 响应缓存
│   ├── runner.py           # Step 5/6/10/11：并发 + 重试 + 缓存 + badcase
│   └── reports.py          # Step 12：报告三件套
└── tests/
    └── test_step*.py       # 课程提供的测试（不要改）
```

## 三条纪律

1. **不要先看参考实现**：完整实现就在上一级目录（`../src/`，Level 3 参考解）。
   卡住时先看课程里的 Hint 1 / Hint 2；只有两次 Hint 都用完、仍然卡住时才打开
   `[查看参考实现]`。抄一遍 ≠ 学会。
2. **先预测，再运行**：每一步的 `pytest` 之前，先写下你预期看到几个 failed / passed。
   预测和实际不一致的地方，才是你真正需要理解的地方。
   典型预测点：`accuracy(0, 0)` 应该是 0 还是 nan？第二次评测为什么可以 0 次模型调用？
3. **self-check 诚实**：课程页面上的进度条需要你**在本地真实跑通测试后**才点「我已在本地通过」。
   网站无法验证你的本地环境——自己骗自己没有意义。

## 完成之后

- `pytest -q` 全部通过（79 passed），且 `python run_eval.py --adapter mock --tasks c3 --limit 12 --no-cache`
  能输出评测结论并生成 `results.json` / `summary.md` / `badcases.jsonl`；
- 有 GPU / API 环境的话，再跑一次真实模型（`--adapter hf` 或 `--adapter openai`），
  对照 `../README.md` 里的真实运行记录，看看你的数字和参考实现是否一致；
- 对照上一级的完整工程（`../README.md` / `../src/`），看看你的实现和它差在哪里；
- 回到课程页面回答 27.10 的面试复盘问题——能不看代码回答，才算完成 Checkpoint C。
