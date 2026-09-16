# Job-Ready Track · Batch 1 完成报告

> 范围：Python Engineering + HuggingFace + 求职入口基础设施 + 两个真实项目。
> 定位：Knowledge Track（懂）之后的 Job-Ready Track（能做）第一批。
> 纪律：不新增理论大章；一切数字来自真实运行；未跑过的一律标注。

---

## 一、本批交付

| # | 交付物 | 类型 | 状态 |
| --- | --- | --- | --- |
| 1 | `content/24-job-ready.md` | 求职总览章（Track A/B/C、能力矩阵、Checkpoint 体系、四级标准） | ✅ |
| 2 | `content/25-python-engineering.md` | Python 工程章（结构/配置/日志/异常/HTTP/asyncio/pytest） | ✅ |
| 3 | `content/26-huggingface.md` | HuggingFace 工程章（Tokenizer→Chat Template→logits→generate→LoRA→评测） | ✅ |
| 4 | `projects/log-analyzer/` | 真实 CLI 项目（标准库 + pytest） | ✅ 14/14 测试通过 |
| 5 | `projects/hf-mini-lab/` | 真实 HF 实验项目（transformers + peft + torch） | ✅ 10/10 测试通过 |
| 6 | 首页「我要找什么实习？」三条 Track 入口 + 学习顺序 | 站点功能 | ✅ 浏览器验证 |
| 7 | 进度系统升级：阅读 / Lab / 项目 三级分开（含旧数据迁移） | 站点功能 | ✅ 浏览器验证 |
| 8 | `tools/validate-jobs.js` | 新发布门禁（58 项检查） | ✅ |
| 9 | `js/demos-jobs.js` | 3 个新交互演示 | ✅ 浏览器验证 |

---

## 二、真实运行记录（全部本机实测）

### 2.1 log-analyzer（Python Engineering）

```
$ pytest -q
14 passed in 0.20s

$ python -m log_analyzer.cli samples/train.log
== 训练日志分析 ==
事件数            : 22（原始行 22）
step 范围         : 10 → 1000
final loss        : 2.2710
best  loss        : 2.2710 (step 1000)
平均吞吐          : 4936 tokens/s
warning 数        : 3
error   数        : 0
NaN 事件          : 否

$ python -m log_analyzer.cli samples/train_nan.log
NaN 事件          : 是（训练可能已发散！）
warning 数        : 2
error   数        : 2
```

开发过程中 pytest 真实抓出 2 个 bug（已修复并写入章节）：
1. `tokens/s` 键名解析失败（正则不含 `/`）；
2. `steps` 与 `losses` 按下标对齐错位（warning 行带 step 不带 loss）→ 修复为独立 `loss_steps`。

### 2.2 hf-mini-lab（HuggingFace）

模型：`Qwen/Qwen2.5-0.5B-Instruct`（CPU fp32，494.0M 参数）

```
$ pytest -q
10 passed

$ python scripts/run_lab.py
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%
训练 loss：2.6364 → 1.3052（60 步，batch 2，lr 2e-4，16 条训练样本）
held-out response-only loss：base=3.8168 → tuned=3.6102（Δ=-0.2065）
用时：60.2s（CPU）
```

实验中真实踩到并写入章节的坑：
1. **PEFT 就地注入**：用同一个 `model` 变量当基线会得到 Δ=0.0000（测的其实是带 adapter 的模型）→ 基线必须干净加载；
2. **logits 维度 ≥ 词表**：`logits.shape[-1]=151936 > tokenizer.vocab_size=151643`（测试断言从 `==` 改 `>=`）；
3. **tiny 随机模型不适合做 loss 收敛演示**（基线 ≈ ln(151643)≈11.93，几乎不降）→ 改用真实 instruct 模型。

### 2.3 浏览器验收（CDP）

- 首页：三条 Track 卡片、学习顺序、27 章侧边栏 ✅
- 新演示：`sync-async` / `chat-template` / `padding-side` 交互全部生效 ✅
- 三级进度：按钮切换、localStorage 对象结构、刷新保持、旧布尔进度自动迁移并写回 ✅
- 全站回归：**27 章 / 91 demos / 400 quiz / 0 console error** ✅

---

## 三、发布门禁更新

```
build-static → validate-static → validate-content → validate-batch2 → validate-jobs → rsync → git push
```

`validate-jobs.js`（58 项）检查：

- projects/ 结构标准（README/requirements/src/tests/Quick Start）；
- manifest Job-Ready 分组三章齐全、25/26 标记 lab/project；
- 章节引用的 `projects/<slug>` 必须真实存在；
- **README 声明的测试数量 = tests/ 中 `def test_` 实际数量**（防止文档吹牛）；
- 数据纪律：禁止「训练 N 天 / N 张 A100 / 实测」等伪造规模；第 24 章必须出现 `NOT EXECUTED` 纪律说明。

---

## 四、Known Limitations（本批）

1. **HF 实验是流程验证级**：16 条数据 / 60 步 → 只证明管线正确，不构成能力结论（章节已标注）。
2. **全部实验在 CPU 完成**：训练/推理速度数字（9.5 tok/s 生成）为 CPU 值；GPU 相关 Lab（Profiling、vLLM Benchmark）属于 Capstone 4，会明确标注 `NOT EXECUTED ON CUDA`。
3. **RAG / FastAPI / Eval Harness / SFT-LoRA / Infra 尚未交付**：按计划属于 Job Batch 2-5。
4. **Track 中的「下一批」章节占位**：第 24 章路线图中以灰字标注，交付后替换为真实链接。

---

## 五、下一批（Job Batch 2）计划

**Capstone 1 · Mini LLM Evaluation Harness**（`projects/llm-eval/`）：

- ModelAdapter（HuggingFace / OpenAI-compatible 通用接口）；
- EvalTask（C3 / XCOPA / Custom QA）+ 可靠 parser（多选题 A/B/C/D）；
- Metrics（accuracy / EM / F1）+ 并发评测（asyncio + Semaphore）+ retry/cache；
- Bad case 输出（badcases.jsonl）+ 自动报告（results.json / summary.md）；
- CLI：`python run_eval.py --model ./checkpoint --tasks c3 xcopa --output outputs/run_001`；
- 验收：真实跑通两个模型（或 base vs tuned）的对比评测 + bad case 分析。
