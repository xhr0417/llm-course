# V2 Batch 2 完成报告（V2_BATCH2_AUDIT）

> 范围：Phase A（第一批封板）+ Phase B（第二批四个核心模块）。
> 发布门禁：`build → validate-static → validate-content → rsync / push`（任一失败禁止上线）。

---

## 一、Phase A：第一批封板（3/3 完成）

| 项 | 内容 | 结果 |
| --- | --- | --- |
| **A1** Mixed Precision 表述统一 | `content/13-efficient.md` 重构为「经典 FP16 模型（master weights + GradScaler）」与「现代 BF16/AMP（通常无 scaler；存储取决于 optimizer/FSDP/DeepSpeed）」两节；代码拆分为 FP16（带 GradScaler）与 BF16（不带）两个示例；16/18 bytes 明确标注为「假设下的估算」 | ✅ |
| **A2** Activation Checkpointing 修正 | 删除 `O(√L) ~ O(1)` 与「固定 +30%」表述；改为「更少激活显存 ↔ 更多重算」的定性 trade-off + 影响收益的 5 类因素（策略/层数/结构/长度/框架） | ✅ |
| **A3** validate-static 接入发布流程 | `tools/publish.sh` 与 `tools/deploy-github.sh` 均改为：build → **validate-static** → **validate-content**（新增）→ 发布；任一步失败 `set -e` 立即终止 | ✅ |

**第一批正式冻结**：两轮 Correctness Pass + 本轮 Phase A 后，不再扩写既有 17 章（1-17 章）。

---

## 二、Phase B：第二批四个核心模块

| 模块 | 章节 id / num | 文件 | 新增 Demo |
| --- | --- | --- | --- |
| Pretraining Data Engineering | `data-pipeline` / 18 | `18-data-pipeline.md` | 6 个：`data-pipeline` / `exact-dedup` / `minhash-lab` / `mixture-calculator` / `packing-demo` / `dataloader-timeline` |
| FlashAttention + Triton | `flash-attention` / 19 | `19-flash-attention.md` | 4 个：`attention-io` / `tiling` / `online-softmax` / `triton-block` |
| Inference Systems | `inference` / 20 | `20-inference.md` | 7 个：`serving-pipeline` / `prefill-decode` / `batching-viz` / `paged-attention` / `prefix-cache` / `spec-decoding` / `serving-metrics` |
| LLM Evaluation | `llm-eval` / 23 | `23-llm-eval.md` | 6 个：`eval-pipeline` / `em-f1` / `pass-at-k` / `judge-bias` / `ci-slider` / `mcq-baseline` |

**结构变化（保持 id/path/progress 不变，仅调整展示编号与分组）**：

- 新分组：第四部分 · 服务 (Serve)、第六部分 · 评估 (Evaluate)；
- 原「训练与对齐」顺延为第五部分；`pretrain-sft` 18→21、`rl-grpo` 19→22（**badge 与内部小节编号同步，id/URL/localStorage 进度不受影响**，由 `tools/validate-content.js` 校验一致性）；
- `00-map.md` 重写为六段式路线 + 三层定位（Core Prerequisite / CS336 Bridge / Systems Extension）。

**新增 Demo 计 23 个**（全部通过浏览器交互验证；全站现为 88 个挂载点）。

---

## 三、实际运行验证

### 3.1 章节 Lab 实测（CPU，`validate3.py`，17/17 PASS；Correctness Pass 后更新）

数据管线 Lab 采用 **continuous stream + EOS + 定长切块（drop_last）**；语义不变量成为回归护栏：

| # | 测试 | 结果 |
| --- | --- | --- |
| 1 | 数据管线 Lab：normalize + exact dedup（5→4 篇） | PASS |
| 2 | BPE tokenizer 训练（vocab 317，`<|endoftext|>` 正常） | PASS |
| 3 | **流长 = Σ文档 token + 每篇 1 EOS**（105 = 101 + 4） | PASS |
| 4 | **每个完整块 = seq_len(16)**（6 块） | PASS |
| 5 | **EOS 数 = 文档数 = 4**（每篇恰好一个真实边界标记） | PASS |
| 6 | **无相邻 EOS**（未用 EOS 做填充） | PASS |
| 7 | **drop_last 语义**：丢弃量 = 流长 % 16 = 9 | PASS |
| 8 | 章节实测数字护栏（流 105 / 6 块 / 丢 9） | PASS |
| 9 | manifest 报告 `dropped_remainder_tokens: 9` | PASS |
| 10 | shard 读回 token 数一致（96） | PASS |
| 11 | 分块 attention == **naive 分解** attention（max diff 4.44e-16，FP64） | PASS |
| 12 | 不同 tile 尺寸结果一致 | PASS |
| 13 | Online softmax 手算 == 一次性 softmax（[1,2]+[3,4]） | PASS |
| 14 | pass@k 公式（n=10,c=3 → 0.3 / 0.9167 / 1.0） | PASS |
| 15 | pass@k 边界：n=1,c=0 → 0；n=1,c=1 → 1 | PASS |
| 16 | pass@k 约束：k>n 时 clamp 到 n（UI 禁止 k>n 配置） | PASS |
| 17 | 置信区间 SE（n=20 ≈ 0.102，n=1000 ≈ 0.0145） | PASS |

### 3.2 浏览器实测

| 项 | 结果 |
| --- | --- |
| 4 个新章节：23/23 demos 初始化、0 演示错误 | ✅ |
| 交互：25 次按钮点击 + 26 次滑块拖动 | ✅ 0 异常 |
| 深度验证：online-softmax 收敛到「与一次性 softmax 一致」、pass@k 输出正确 | ✅ |
| 全站回归：24 章 / 88 demos / 388 quiz 选项 / **0 console error** | ✅ |
| `validate-static.js`：24/24 静态页（容器残留 0 / fence 错位 0 / 正文完整） | ✅ |
| `validate-content.js`：manifest / 容器配平 / demo 注册 / 编号一致 | ✅ |

### 3.3 GPU 代码：NOT EXECUTED

| 代码 | 状态 |
| --- | --- |
| Triton vector add / Triton softmax（第 19 章） | **NOT EXECUTED ON CUDA**（当前环境无 GPU；标记为 Runnable on CUDA） |
| benchmark 模板（warmup + synchronize + 多次测量） | 仅静态正确性验证 |
| 分块 attention（第 19 章 Lab） | ✅ CPU 实测（数学正确性） |

**本课程未给出任何「FlashAttention 快 N 倍」的具体数字**——加速比取决于序列长度、head 维度、硬件与实现，需要读者在目标硬件上按规范 benchmark 自测。

---

## 四、数字分类（Systems 纪律）

### A. 数学结果（可推导验证）

- 6ND 算力估算、Ring AllReduce 通信量 2(N−1)/N·S、online softmax 修正因子、pass@k 无偏估计、SE=√(p(1−p)/n)、drop_last 不变量（丢弃量 = 流长 % seq_len）。

### B. 公开硬件/论文事实（注明条件）

- A100：BF16 dense 312 TFLOPS、HBM 2039 GB/s、108 SM（80GB HBM2e 版本）；
- Chinchilla / Kaplan / Gopher / GPT-3 的参数量与 token 数（论文公开值）；
- ZeRO 通信量 1×/1.5×/1×/1.5×（ZeRO 论文口径）；
- LLaMA-2/LLaMA-3/Qwen2.5 的训练 token 量（技术报告公开值）。

### C. 教学模拟假设（页面已标注）

| 位置 | 标注 |
| --- | --- |
| Serving 指标模拟器（`serving-metrics`） | 「教学模型，非硬件 benchmark」（decode 步时、prefill/tokenize/sample 系数均为假设；TTFT 三项口径 = 首波/平均/末波） |
| 数据管线流量估算（`attention-io`） | 「教学量级估算」 |
| judge 偏差演示（`judge-bias`） | 「教学模拟，非真实裁判输出」 |
| MinHash demo（`minhash-lab`） | 64 个教学哈希（真实系统用 128~256） |
| dataloader 时间线 | 「教学模拟」 |
| Roofline AI 表 | 「教学量级近似」 |

---

## 五、Known Limitations（第二批）

1. **Triton / CUDA 代码未执行**：本环境无 GPU；代码为工程参考实现，需在 CUDA 环境验证。
2. **Serving 模拟器是教学模型**：用于建立「参数 → 指标」的直觉，不是真实性能预测；真实 serving 涉及调度细节、显存带宽竞争、kernel 实现差异。
3. **Speculative Decoding 只讲直觉**：接受/拒绝的概率正确性证明未展开（留待专题）。
4. **量化只建立连接**：未展开校准/精度分析（规划为 P1 专题）。
5. **数据管线 Lab 是 mini 版本**：不含真实 Common Crawl 抽取、分布式 MinHash、去污染流水线（工程实现参考概念与流程）。
6. **评测 Lab 的分数来自本项目 Small LLM 的真实小规模评测**：C3 40%、XCOPA 55%——页面已明确为**描述性结果**（「非 SOTA、非课程虚构」），且**未给样本量与置信区间前不做显著性结论**；Wald 区间在小样本/极端 p 下不适用（已标注 Wilson / exact / paired bootstrap 替代）。

---

## 六、当前课程的剩余重要缺口（按优先级）

| 优先级 | 缺口 | 说明 |
| --- | --- | --- |
| P1 | **CUDA 环境的 kernel 实测** | 为 Triton 章节补一份在真实 GPU 上按规范 benchmark 的结果（需 GPU 环境） |
| P1 | **MoE / 长上下文 / Reasoning 专题** | 现代架构与推理模型的深化 |
| P1 | **系统化量化专题** | 校准、per-channel、KV 量化、精度-速度 trade-off |
| P2 | RAG / Agent / MCP / 多模态 / 安全 | 明确为选修专题，不抢主线 |
| P2 | 分布式训练的进阶（序列并行/上下文并行细节） | 现版本已覆盖到选型层面 |

---

## 七、Batch 2 Correctness Pass（第二批修正轮）

第二轮上线后针对「技术事实 / 演示状态 / 统计措辞 / 发布可靠性」的修正轮（不新增章节、不扩写主题）：

| 项 | 修改 | 验证 |
| --- | --- | --- |
| 1. 数据管线语义 | 第 18 章 18.13/18.14 重写：**文档边界（EOS/mask/loss mask）与空间利用（pad/concat+chunk/packing）拆成两个正交问题**；Lab 由 `pack_documents`（EOS 当填充）改为 **`build_token_stream` + `chunk_stream`（drop_last）**；明确「EOS 不在数学上阻止跨文档 attention」 | Lab 重跑：流 105 / 6 块 / 丢 9 / EOS 4 / 无相邻 EOS；17 项测试全过 |
| 2. 交叉引用 | 修正第 18 章开篇（→ 第 21 章）、去污染「见 18.9」、`13-build-llm-2.md` 的 packing 引用；新增校验器**「见 X.Y」编号存在性 +「第 X 章」manifest 存在性**自动检查 | `validate-content.js`（引用扫描 9 处全部有效） |
| 3. FlashAttention 术语 | 「标准 attention/softmax」→ **naive（eager 分解）**；新增 SDPA dispatch 说明；19.6 明确 **「exact」≠「bitwise 相同」**（FP16/BF16 下数值差可 >4e-3）；Lab 结论限定为 FP64/CPU 教学验证 | `validate-batch2.js` 术语护栏 |
| 4. TTFT 定义 | 第 20 章重写：**prefill 的最后一个 prompt 位置直接产出第一个生成 token 的 logits，不需要额外一次 decode**；TTFT ≈ T_queue + T_tokenize + T_prefill + T_sample + T_stream；修正「示例 = prefill + 一步 decode」 | 浏览器深度验证 + 静态护栏 |
| 5. Serving 模拟器 | `serving-metrics` 增加 tokenize/sample 项，输出**首波 / 平均 / 末波 TTFT 三个口径**与波数推导；明确教学模型声明 | 浏览器验证（首波/平均口径 + 无旧公式） |
| 6. prefill-decode 状态 bug | render() 改为纯渲染，state 只在 handler 修改；重置回到 Prefill；Decode 计数 0 → 1 → 2（修复每点一次 +2 的跳号） | 浏览器断言：0/1/2 逐步通过 |
| 7. pass@k 约束 | demo 硬性 clamp **k ≤ n**（n 变小时 k 同步收缩）；直觉文案改为「只有 k = n 且 c > 0 时 pass@n = 1」；补充边界测试 | 浏览器：k=20/n=3 → clamp 到 pass@3；n=1,c=0 → 0% |
| 8. judge 偏差演示 | 改为**真实双评分模型**（quality + 位置加成 + 长度加成），胜负由 s1 vs s2 比较得出；交换顺序展示结论翻转 | 浏览器：初始一致 → 交换后不一致（机制演示正确） |
| 9. 评测措辞 | C3/XCOPA 改为**描述性结果**（不因 +15pt/+5pt 声称「学到/没学到」）；Wald 区间标注边界 + Wilson/exact/paired bootstrap 替代；quiz 同步改写 | 静态护栏 + 浏览器 |
| 10. 发布可靠性 | `publish.sh` 移除 `git push … || true`（假成功），服务器与 GitHub 状态**分别报告**，任一失败 `exit 1`；门禁加入 `validate-batch2.js` | 代码审查 + 门禁全跑 |
| 11. 回归护栏 | 新增 `tools/validate-batch2.js`（**45 项静态检查**：语义/术语/公式/演示/发布脚本）；`validate-content.js` 增加引用与脚本加载检查 | 45/45 PASS |

---

## 八、结论

1. **Phase A 三项全部完成**，第一批（1-17 章）**正式冻结**。
2. 第二批新增 **4 章 / 23 个交互演示 / 2 个可运行 Lab（数据管线、分块注意力）**，主线为 Data → Kernel → Serve → Evaluate。
3. 代码实际运行：**17 项 Lab 测试全部 PASS**（CPU）；GPU 代码明确标注 **NOT EXECUTED ON CUDA**。
4. 发布门禁：`build → validate-static → validate-content → validate-batch2 → publish`；**构建成功但页面损坏/内容错误/回归破坏无法再被发布**，且 GitHub push 失败不再被吞掉。
5. 全站验收：**24 章 / 88 demos / 388 quiz / 0 console error**；Correctness Pass 浏览器深度验证（prefill-decode 0→1→2、serving TTFT 三口径、pass@k clamp、judge 双评分）全部通过。
6. **第二批（18/19/20/23）在 Correctness Pass 后正式冻结**；后续只做「发现事实错误才修」级别的最小补丁，不再扩写第二批主题。
