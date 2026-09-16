# Guided Build Track · 升级审计（G0-G3）

> 范围：把 Job-Ready Track 从「Reference Project / 完整参考实现」升级为 **Guided Build / 项目式教学系统**。
> 执行批次：G0（基础设施）→ G1（Python Engineering）→ G2（HuggingFace）→ G3（Eval Harness）。
> 纪律：不新增理论大章；所有数字来自真实运行；教学人为设计的错误明确标注 Teaching Bug / Deliberate Exercise。

---

## 一、这一轮改了什么（总览）

| # | 交付物 | 类型 | 状态 |
| --- | --- | --- | --- |
| 1 | Guided Lab 渲染系统（`:::lab` / `:::step` / 14 种 step 子块 / `:::hint` / `:::solution`） | 站点基础设施（G0） | ✅ 交互版 + 静态版双端渲染 |
| 2 | Guided Build 进度系统（step 三态 + Learned/Implemented/Ran/Explained 四态 + self-check） | 站点基础设施（G0） | ✅ localStorage（扩展原进度 key，非另造系统） |
| 3 | `js/app.js` 渲染器 + 交互逻辑 + 首页三入口卡片 | 站点功能 | ✅ jsdom headless 冒烟 31 项全过 |
| 4 | `css/style.css` Guided Lab 样式（含移动端 / 深色模式） | 样式 | ✅ 复用现有 CSS 变量体系 |
| 5 | `projects/log-analyzer/starter/` | Guided Build starter（G1） | ✅ 初始 41 failed → 实现后 41 passed |
| 6 | `projects/hf-mini-lab/starter/` | Guided Build starter（G2） | ✅ 初始 38 failed → 实现后 38 passed |
| 7 | `projects/llm-eval/starter/` | Guided Build starter（G3） | ✅ 初始 77 failed + 2 passed → 实现后 79 passed |
| 8 | 第 25 / 26 / 27 章改写为 Guided Build（保证原 Learn 内容不丢） | 内容 | ✅ 10 / 13 / 15 个 Step |
| 9 | 第 24 章 + 首页升级（三入口 / 路线分段 / 状态一致性） | 内容 + 站点 | ✅ |
| 10 | `tools/validate-guided.js`（131 项门禁）+ CI starter 红灯 job | 工程门禁 | ✅ |
| 11 | `tools/validate-jobs.js` 修复 tests/ 下 `__pycache__` 导致 EISDIR 崩溃 | 真实 bug 修复 | ✅ 本地先跑 pytest 再跑门禁不再崩 |

**结构变化一句话**：以前是「读课程 → 看一个做好的项目」；现在是三层——
**Learn（懂）→ Guided Build（亲手做）→ Reference（对照完整工程）**。

---

## 二、Guided Steps 清单（新增教学内容）

### G1 · 第 25 章 Python Engineering → `log-analyzer`

| Step | 主题 | 变绿命令 → 结果 |
| --- | --- | --- |
| 0 | 准备环境与第一次运行 | `pytest -q` → **41 failed**（真实记录） |
| 1 | 读取日志文件（pathlib / encoding） | `pytest -q tests/test_step1_load.py` → 5 passed |
| 2 | 解析第一条日志（dataclass / typing / 正则） | `test_step2_parse.py` → 8 passed |
| 3 | 现实日志没有这么干净（脏行 / 未知字段 / 坏值） | `test_step3_messy.py` → 6 passed |
| 4 | 统计训练结果（聚合指标） | `test_step4_stats.py` → 6 passed |
| 5 | step/loss 错位 bug（先预测 550，再修复到 1000） | `test_step5_alignment.py` → 3 passed |
| 6 | 变成 CLI（argparse / --json / --warnings） | `test_step6_cli.py` → 4 passed |
| 7 | logging 与退出码（可恢复 vs 致命） | `test_step7_logging.py` → 6 passed |
| 8 | 写你自己的 3 个边界测试 | `test_step8_edge_cases.py` → 3 passed（学生自己写） |
| 9 | 最终验收与复盘（Checkpoint A 口试 5 题） | `pytest -q` → 41 passed |

### G2 · 第 26 章 HuggingFace → `hf-mini-lab`

| Step | 主题 | 变绿命令 → 结果 |
| --- | --- | --- |
| 0 | 环境与模型选择（为什么 0.5B） | `pytest -q` → **38 failed**（真实记录） |
| 1 | Tokenizer（encode / decode / pad 兜底） | `test_step1_tokenizer.py` → 3 passed |
| 2 | Chat Template（先错误直喂，再对比正确渲染） | `test_step2_chat_template.py` → 5 passed |
| 3 | 加载模型（先预测参数量与内存） | `test_step3_model.py` → 3 passed |
| 4 | logits（先预测 shape：batch / seq / vocab） | `test_step4_logits.py` → 2 passed |
| 5 | Batch Generation（left/right padding 问题） | `test_step5_generate.py` → 3 passed |
| 6 | JSONL Instruction Dataset（load / split） | `test_step6_data.py` → 4 passed |
| 7 | Response-only Loss（第一版不 mask，观察后果） | `test_step7_labels.py` → 5 passed |
| 8 | LoRA（r / alpha / target_modules / 0.1% 参数量） | `test_step8_lora.py` → 2 passed |
| 9 | 真正训练（collate + 训练循环） | `test_step9_train.py` → 3 passed |
| 10 | 保存和重载 adapter（干净实例） | `test_step10_save_load.py` → 3 passed |
| 11 | PEFT 就地注入 bug（真实踩坑复现） | `test_step11_peft_trap.py` → 2 passed |
| 12 | Base vs Tuned 评测 + experiment report | `test_step12_evaluate.py` → 3 passed；`run_lab.py` 全流程 |

### G3 · 第 27 章 Capstone 1 → `llm-eval`

| Step | 主题 | 变绿命令 → 结果 |
| --- | --- | --- |
| 0 | Starter：77 个测试红给你看 | `pytest -q` → **77 failed, 2 passed**（真实记录） |
| 1 | Choice Parser（基本格式 → 鲁棒格式） | `test_step1a_parser_basic.py` → 5；`test_step1b_parser_robust.py` → 15 |
| 2 | Metrics（accuracy / EM / F1 / nan 边界） | `test_step2_metrics.py` → 12 passed |
| 3 | EvalTask（C3 → XCOPA 四件套） | `test_step3a_c3_task.py` → 6；`test_step3b_xcopa_task.py` → 4 |
| 4 | Mock ModelAdapter（先不碰真实模型） | `test_step4_mock_adapter.py` → 4 passed |
| 5 | Runner（Task → Adapter → Parser → Score） | `test_step5_runner.py` → 4 passed |
| 6 | Bad Case（error_type 结构化分类） | `test_step6_badcase.py` → 3 passed |
| 7 | HuggingFace Adapter（接回第 26 章） | `test_step7_hf_adapter.py` → 2 passed |
| 8 | Cache（key 少参数的 Teaching Bug → 修复） | `test_step8_cache.py` → 7 passed |
| 9 | API Adapter（429/5xx 可重试，400/401 致命） | `test_step9_api_adapter.py` → 5 passed |
| 10 | Async + Semaphore（真的并发且不超限） | `test_step10_async.py` → 3 passed |
| 11 | Retry（指数退避；FatalAdapterError 不重试） | `test_step11_retry.py` → 3 passed |
| 12 | Reports（results.json / summary.md / badcases.jsonl） | `test_step12_reports.py` → 4 passed |
| 13 | CLI 收口 + 真实数据（fetch_data / --adapter hf） | `test_step13_cli.py` → 2 passed；`pytest -q` → 79 passed |
| 14 | 分析结果（Final Checkpoint 8 题 + analysis.md） | 无代码；产出 Portfolio Output |

---

## 三、Starter 与 Solution 的位置

| 项目 | Starter（学生写） | Reference Solution（对照） | 初始 / 完成（真实运行） |
| --- | --- | --- | --- |
| log-analyzer | `projects/log-analyzer/starter/` | `projects/log-analyzer/` | `41 failed` → `41 passed` |
| hf-mini-lab | `projects/hf-mini-lab/starter/` | `projects/hf-mini-lab/` | `38 failed` → `38 passed`（实现验证用临时 overlay；真实 Qwen 端到端由 `run_lab.py` 验证） |
| llm-eval | `projects/llm-eval/starter/` | `projects/llm-eval/` | `77 failed, 2 passed` → `79 passed` |

三个 starter 均可 `pip install -r requirements.txt && pytest -q` 直接运行；
各自带独立 `pytest.ini`（`testpaths = tests`），父项目测试不会被 starter 干扰（反向亦然）。

---

## 四、真实运行过的验证（本轮实测）

### 4.1 Python 测试

```
projects/log-analyzer/starter    → 41 failed in 0.13s        （初始状态，符合设计）
projects/hf-mini-lab/starter     → 38 failed in 26.07s       （初始状态，符合设计）
projects/llm-eval/starter        → 77 failed, 2 passed       （初始状态，符合设计）

projects/log-analyzer            → 14 passed                 （参考实现未受影响）
projects/hf-mini-lab             → 11 passed                 （参考实现未受影响）
projects/llm-eval                → 32 passed                 （参考实现未受影响）
```

starter 的「实现后全绿」由两轮独立验证确认：编写 starter 时用参考实现 overlay 在临时目录逐项跑绿
（41 / 38 / 79 passed），且 CI 新增 `guided-starters` job 反向断言「初始必须为红」。

### 4.2 站点

```
node tools/build-static.js       → 32 页面构建成功，0 容器残留
node tools/validate-static.js    → 32 个静态页全部通过
node tools/validate-content.js   → 32 章 / 84 demos 通过
node tools/validate-batch2.js    → 45 项回归护栏通过
node tools/validate-jobs.js      → 199 项通过
node tools/validate-portfolio.js → 50 项通过
node tools/validate-guided.js    → 131 项通过
```

交互版（jsdom headless 冒烟，31/31 通过）：Guided Lab 渲染（10/13/15 steps）、
step 三态切换与持久化、四态徽章、Ran/Explained self-check、Solution/Hint 默认折叠、
打开 Solution 不改变完成状态、首页卡片三入口与进度联动、搜索能命中 Step 标题。

浏览器验证口径：以上为 headless DOM 级验证；移动端与深色模式通过 CSS 媒体查询/变量实现，
未在真实移动设备上人工复核（诚实标注）。

---

## 五、Teaching Bug 与真实踩坑对照表（全部逐条标注）

| # | 位置 | 内容 | 标注 |
| --- | --- | --- | --- |
| 1 | 第 25 章 Step 3 | KV 正则漏 `/` 导致 `tokens/s` 永远解析失败、吞吐统计静默为空（pytest 抓出） | **真实踩坑**（项目开发记录） |
| 2 | 第 25 章 Step 5 | 「所有 step」与「所有 loss」按下标对齐 → warning 行（有 step 无 loss）导致错位，best_step 得到 550（正确 1000） | **真实踩坑 + Deliberate Exercise**：bug 是开发时 pytest 真实抓出的；starter 中刻意复现，验证脚本确认 naive 实现确实得到 550 |
| 3 | 第 26 章 Step 4 | `logits.shape[-1] ≥ tokenizer.vocab_size`（151936 vs 151643），断言 `==` 会失败 | **真实踩坑**（项目开发记录） |
| 4 | 第 26 章 Step 7 | transformers 新版 `apply_chat_template(tokenize=True)` 返回 BatchEncoding，`list(encoded)` 拿到 key 列表 | **真实踩坑**（CI 曾真实失败） |
| 5 | 第 26 章 Step 11 | PEFT 就地注入：`get_peft_model` / `PeftModel.from_pretrained` 改造传入对象，base 与 tuned loss Δ=0.0000 | **真实踩坑**（项目开发记录） |
| 6 | 第 27 章 Step 8 | cache key 只含 model+prompt，改 `max_new_tokens`/`temperature` 命中旧答案 | **Deliberate Exercise**（社区常见错误；starter 测试强制 params 进 key） |
| 7 | 第 27 章 Step 8 | 空响应写入缓存 → 一次网络抖动永久污染结果 | **Deliberate Exercise**（测试明确拦截） |
| 8 | 第 27 章 Step 11 | 400/401 被重试无意义；用 FatalAdapterError 区分 | **Deliberate Exercise** |

原则：凡是真实开发记录中出现的标「真实踩坑」；为教学人为加入的标 Deliberate Exercise / Teaching Bug。
不虚构「我们真实踩过」。

---

## 六、哪些还未迁移（诚实清单）

以下三个 Capstone 仍然只有「Lab + Reference Solution」，**尚未**获得 starter 与 Guided Steps：

| 项目 | 章节 | 现状 | 备注 |
| --- | --- | --- | --- |
| rag-service | 28-29 | 参考实现 + 真实评测数据完整；Guided Build 未迁移 | 课程内已有 chunk/BM25/vector/eval 的 Lab |
| sft-lora | 30 | 参考实现 + 真实实验记录完整；Guided Build 未迁移 | 有 48+12 数据与 Base–Best–Final 评测 |
| inference-benchmark | 31 | 参考实现 + CPU 实测完整；Guided Build 未迁移 | CUDA 部分 NOT EXECUTED ON CUDA |

站点与第 24 章中这些项目统一标注「🔄 迁移中 / 下一轮迁移」——
这是**当前真实状态**，不是过期文字；Checkpoint D/E 的通过标准暂以现有 Lab + 参考实现为准。

---

## 七、下一轮：RAG / SFT / Infra 如何迁移（沿用本套模板）

模板已经固定，迁移工作 = 写 starter + 写 Step（不再动渲染器与进度系统）：

1. **rag-service starter（Checkpoint D）**：
   documents → chunk → BM25 → dense retrieval → evaluation → hybrid → reranker → generation → citations → FastAPI；
   重点加入「系统失败在哪一层」：Case A Recall@k 低 → retrieval；Case B Recall 高但回答错 → generation；
   Case C 答案对但 citation 错 → citation layer。现有 841 chunks / 22 条标注查询的真实评测数据保留为指导基线。
2. **sft-lora starter（Checkpoint B 延伸）**：
   数据切分 → response-only mask → LoRA 配置 → 训练 → best/final checkpoint 选择 → 同一 harness 评测（接第 27 章）
   → bad case → experiment.md。第 26 章 starter 已覆盖一半流程，迁移时直接复用其 Step 结构。
3. **inference-benchmark starter（Checkpoint E）**：
   device-aware 计时 → profiler 算子表 → SDPA 对比 → torch.compile 反例 → serving 压测客户端；
   CUDA / vLLM 部分继续 `NOT EXECUTED ON CUDA`，starter 测试必须是 CPU 可跑的。

每套迁移的验收标准与本轮相同：starter 初始红灯（CI 断言）→ 分步测试 → starter README 的 Step 表 →
章节 Step（goal/write/run/fail/hint/solution/checkpoint/explain）→ `validate-guided.js` 门禁扩展一行配置。

---

## 八、破坏性变更检查

- 未删除任何原有内容：第 25/26/27 章的原「Learn」讲稿全部保留（移至 25.3 / 26.3 / 27.3 参考手册 + Step 内嵌知识盒）；
- 未修改任何参考实现的**行为**（新增 `pytest.ini` 为测试发现范围约束，父项目测试计数不变且全绿）；
- 进度系统为**扩展**：仍使用 `llm-course-progress` key，旧数据自动迁移（read/lab/project 保留，新增 guided 字段）；
- 老章节、搜索、quiz、demo 回归全部通过（见第四节）；
- 未引入任何前端框架 / 后端 / 数据库；Guided Build 状态仅存 localStorage。
