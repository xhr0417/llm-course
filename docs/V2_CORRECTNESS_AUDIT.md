# V2 第一批 · 技术正确性审校报告（V2 Correctness Audit）

> 范围：V2 新增 6 章（11 PyTorch / 12-13 Build Small LLM / 14 Scaling Laws / 15 GPU / 16 Distributed）+ 受影响的既有章节（17 训练显存、18 Pretrain/SFT、19 RL）+ `js/demos-systems.js`。
> 方法：静态审查 → 逐项修复 → **实际运行验证**（PyTorch 2.8.0 CPU，32 项测试）→ 数值复算（Node 脚本）→ 浏览器交互验证 → 重新构建静态页。
> 原则：数学恒等 / 硬件公开规格 / 教学假设 **三类数字明确区分**。

---

## 一、修复的问题（共 24 项）

### A. 代码逻辑类（Build 章节）

| # | 文件 | 原问题 | 为什么错 | 修复 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| 1 | 12-build-llm-1.md (Lab 3) | RoPE 验证用 4 个**不同**随机向量比较 dot(q[8],k[6]) 与 dot(q[5],k[3]) | 相对位置性质要求**同一内容向量** q₀/k₀ 在不同位置旋转；4 个独立随机向量的点积相同纯属巧合（实为错误逻辑） | 改为固定 q₀/k₀，`rope_at(q0,8)·rope_at(k0,6)` vs `rope_at(q0,5)·rope_at(k0,3)`，并加不同相对距离的反例；补充「容易写错的测试」警告框 | `validate.py` 实测：Δ=2 两组点积完全相等（14.621965），Δ=4 不同（14.648063）✅ |
| 2 | 13-build-llm-2.md (Lab 9) | 梯度累积：`step` 只在 `if (step+1)%accum==0` 内 +1 → step 恒为 0，**条件永远不成立、永不更新参数**（死循环） | 把「micro-batch 计数」与「参数更新计数」混为一个变量 | 明确区分 `micro_step`（每 batch +1）与 `global_step`（每次更新 +1）；lr/eval/ckpt 全部基于 global_step；loss 日志改为滑动均值；checkpoint 同时记录两个计数器；补充「真实 bug」警告框 | `validate.py`：accum=4 时前 3 个 micro-step 参数不变、第 4 步更新；累积结果与「等权平均单步更新」完全一致 ✅ |
| 3 | 13-build-llm-2.md (Lab 13) | SFT 计算 loss 时 `logits` 与 `labels` **同位置**对齐，缺少 next-token shift | GPT 的 logits[t] 预测 token t+1；不 shift 等于让模型学「用位置 t 预测 token t」（错位） | 加入 `shift_logits = logits[:, :-1]` / `shift_labels = labels[:, 1:]`；并用手算表说明「最后一个 prompt 位置的 logits 预测回答首 token」；保留错误示范作对照 | `validate.py`：手工逐位计算 == `F.cross_entropy(shift, ignore_index=-100)`（4.743428 vs 4.743428）✅；同时验证未 shift 的写法确实错位 |
| 4 | 13-build-llm-2.md (Lab 13) | `before/after` 两次 generate 都发生在训练后，比较无意义 | 无对照 | 把 `before = generate(...)` 移到 SFT 之前，训练后生成 `after` 再对比 | 代码走查 + 静态页渲染检查 ✅ |
| 5 | 13-build-llm-2.md (Lab 14) | DPO 的 `sequence_logprob` 写法晦涩（双重 transpose + 链式 gather），且未验证；GRPO 块未明确标注伪代码 | 教学代码若不实测，错误比缺失更危险 | DPO 重写为**逐行带 shape 注释的可运行版本**，并注明「已实测」；补充「为什么是对的」自查要点；GRPO 明确标注【Pseudo-code】 | `validate.py`：`sequence_logprob` 与手工 gather 求和逐位一致（-9.579985）；策略==参考时 DPO loss = ln2 = 0.693147 ✅ |

### B. 数学 / 数值类（Scaling / GPU）

| # | 文件 | 原问题 | 为什么错 | 修复 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| 6 | 14-scaling-laws.md | 表中 GPT-3 = 3.15e23、Chinchilla = 5.9e23，正文却写「Chinchilla 在**更小算力**下全面超越 GPT-3」——自相矛盾 | Chinchilla 的训练 FLOPs 实际**高于** GPT-3；论文的真实论证是「同预算下更优配比」与「更少参数达到更好效果」 | 重写对比：加入 Gopher（5.04e23）作为「同量级预算对照」；分 3 个层次说明（vs Gopher / vs GPT-3 / compute-optimal 分析），修正结论措辞为「用少得多的**参数**达到更好效果」 | Node 复算：6ND → 3.15e23 / 5.04e23 / 5.88e23 ✅ |
| 7 | 14-scaling-laws.md | 「D/N ≈ 20」缺少边界，易被读成永恒定律 | 它来自论文特定设定（数据、tokenizer、架构、只优化训练成本） | 加警告框：列出推理成本 / 数据质量 / tokenizer / 架构四类影响因素，明确「参考起点而非教条」 | 文案走查 ✅ |
| 8 | 14-scaling-laws.md | MFU 公式写成 `MFU = 实际 FLOPs/s × 6ND / 峰值`——量纲错误 | 6ND 与「FLOPs/s」相乘是 FLOPs²/s，无意义 | 修正为 `MFU = (6ND/T) / (N_gpu·P_peak)`，附量纲表、真实数字算例、HFU 对比说明；计算器与正文公式对齐验证 | Node 复算：C=8.4e22，T=8.90 天，实际 109.2 TFLOPS/卡，MFU=35% ✅（与设定闭环） |
| 9 | 15-gpu.md | 「CPU 训练需 **260 万年**」——数量级错误 | 8.4e22/1e12 = 8.4e10 秒 ≈ 2662 年，差了约 1000 倍 | 修正为「约 2660 年」，并明确标注「CPU 1 TFLOPS 为教学假设」 | Node 复算：2662 年 ✅ |
| 10 | 15-gpu.md | LayerNorm 算例：AI=2.5（只算读）、内存 16μs、计算时间 0.0003μs | 两处错：① 未计入**写出**流量；② 84e6/312e12 = 0.269μs（差了 1000 倍） | 改为：流量 67MB（读+写）、AI=1.25、内存下界 33μs、计算 0.27μs；标注「理想下界估算（假设 100% 带宽）」 | Node 复算：67.1MB / AI 1.25 / 32.9μs / 0.269μs ✅ |
| 11 | 15-gpu.md | AI 表数值口径不一（如加法 0.08=FP32 口径、LayerNorm 0.5 与算例 2.5 冲突） | 混用了不同精度/不同读写假设 | 统一口径（bf16、读+写），重算全部条目并标注为「教学量级近似」；同步更新 roofline 演示数值 | 表 ↔ 演示 ↔ 算例三方一致 ✅ |
| 12 | 16-distributed.md vs 17 | 第 16 章 ZeRO 用 16 bytes/参数，第 17 章说 18 bytes/参数，无解释 | 两章口径不同（梯度是否 FP32）且未声明 | 两章都加显式口径说明：16B = bf16 参数+梯度+fp32 主权重+m/v（ZeRO 论文口径）；18B = 梯度保留 FP32。禁止混用；演示同步标注 | 文案 + 演示双向核对 ✅ |
| 13 | 16-distributed.md | 「每卡通信量 ≈2S」没有定义是发送、收发还是全网流量 | 三种口径差异大，易误导 | 拆成三行口径表：每卡发送 ≈2S、收发合计 ≈4S、全网总流量 ≈2(N−1)S；补充「为什么能扩展 vs 网络总流量瓶颈」 | Node 复算：N=1024 时每卡发送 = 1.998S ✅ |
| 14 | 16-distributed.md | Tree AllReduce 写成 `≈2S·logN/N`（错误公式） | Tree 的每卡流量同样约 2S，优势在**延迟 O(logN)** 而非流量 | 改为正确表述：流量同量级、延迟 O(logN)，适合小消息；补充「小消息看延迟、大消息看带宽」 | 文献口径核对 ✅ |
| 15 | 16-distributed.md | ZeRO 通信列写成「1×/不变/不变/前向反向都要 all-gather」（不准确） | ZeRO 论文结论：ZeRO-1 ≈1.5×、ZeRO-2 ≈1×、ZeRO-3 ≈1.5× | 修正为 1×/1.5×/1×/1.5×，并注明口径来源 | ZeRO 论文对照 ✅ |
| 16 | 16-distributed.md | 「FSDP 就是 PyTorch 原生的 ZeRO-3」 | 二者思想相同但实现细节有差异 | 改为「思想与 ZeRO-3 相同（分片方式/prefetch/混合策略有差异）」；策略表从「等价」改为「概念上对应」 | 文案走查 ✅ |
| 17 | 16-distributed.md | PP 气泡公式与 TP 通信次数未声明假设 | 公式只对经典调度成立 | PP 加【假设条件】（1F1B、非 interleaved、忽略通信）；TP 标注「Megatron 经典实现未开 SP」，并说明 SP 变体差异 | 文案走查 ✅ |
| 18 | 16-distributed.md | 「通信占比目标 <15%」写得像硬标准 | 是经验值 | 改为「经验目标（非硬标准）」 | 文案走查 ✅ |

### C. 表述精度 / 一致性类

| # | 文件 | 原问题 | 修复 |
| --- | --- | --- | --- |
| 19 | 11-pytorch.md | 「view **要求内存连续**」（过度简化） | 改为准确表述：view 要求 **stride 与新形状兼容**；给出正/反例代码（transpose 后 view 失败、reshape 成功）；说明实操口诀 |
| 20 | manifest.json | 第 17 章描述承诺「FP8 / loss scaling / 梯度累积 / checkpointing」而正文缺失；第 19 章承诺「preference data / Bradley-Terry / DPO / RLVR」而正文缺失 | ① 第 19 章描述改回实际内容，并注明「DPO 最小实现见第 13 章 Lab 14」；② 第 17 章补一个**桥梁小节**（13.5 梯度累积与激活检查点 + FP8 简报，约 50 行），使描述与正文一致 |
| 21 | 15-gpu.md | 引用「见第 19 章 FlashAttention」——第 19 章实为 RL，且 FlashAttention 章节尚未上线 | 改为「FlashAttention 章节将在第二批上线」；related 同步修正 |
| 22 | 全仓库 | 20 章重编号后的「第 X 章」引用核查（40+ 处） | 逐条核对：仅发现第 21 项错误并修复，其余引用均指向正确章节；新增交叉引用（19 章 → 13 章 Lab 14） |
| 23 | 6 个新章节 | 代码块未区分可运行性 | 每章加入【Runnable / Skeleton / Pseudo-code】约定框；关键代码块加类型标注（DPO Runnable、GRPO Pseudo-code、训练循环 Skeleton 等） |
| 24 | js/demos-systems.js | chinchilla 演示可能被误认为论文精确曲线；scaling-calculator 措辞「Chinchilla 最优」过于绝对；roofline 数值与正文不一致；zero-stages 缺口径说明 | 四处同步修正（演示免责声明 + 文案 + 数值 + 口径），已在浏览器中逐项验证 |

---

## 二、实际运行测试（32 项，全部 PASS）

环境：`Python 3.9.6 + PyTorch 2.8.0 (CPU)`，验证脚本位于临时目录（不进入仓库）。
配置：`vocab=128, d_model=32, layers=2, heads=4, seq_len=16`（除参数量核对用 256/6/32000）。

| # | 测试 | 结果 |
| --- | --- | --- |
| 1 | RMSNorm 形状不变 | PASS |
| 2 | RMSNorm 输出 RMS≈1（最大偏差 2.26e-06） | PASS |
| 3 | RoPE 相同相对距离点积相同（修复后逻辑） | PASS（14.621965 = 14.621965） |
| 4 | RoPE 不同相对距离点积不同（反例） | PASS（14.648063） |
| 5 | 批量 apply_rope 与逐向量版本一致 | PASS |
| 6 | Attention 形状 [B,H,S,D] 往返 | PASS |
| 7 | **因果性**（改末尾不影响前面，max diff = 0） | PASS |
| 8 | 注意力权重行和为 1 | PASS |
| 9 | mask 后未来位置权重为 0 | PASS |
| 10 | SwiGLU 参数量 ≈ 8d²（实际 8.25d²） | PASS |
| 11 | Block 参数量 ≈ 12d²（实际 12.26d²） | PASS |
| 12 | TinyLM 输出 [B,S,V] | PASS |
| 13 | 参数量公式核对：13.01M vs 公式 12.91M（+0.77%） | PASS |
| 14 | 初始 loss ≈ ln(V)（4.825 vs 4.852） | PASS |
| 15 | backward 产生非零梯度 | PASS |
| 16 | optimizer.step 后 20 组参数变化 | PASS |
| 17 | 整模型因果性（max diff = 0） | PASS |
| 18 | **梯度累积 = 等权平均单步更新** | PASS |
| 19 | accum=4 时前 3 个 micro-step 不更新 | PASS |
| 20 | checkpoint 保存/加载后输出一致 | PASS |
| 21 | checkpoint 含 step 字段 | PASS |
| 22 | 生成输出长度正确 | PASS |
| 23 | 贪心生成可复现 | PASS |
| 24 | **KV Cache 输出 == 全量重算**（max diff 8.94e-08） | PASS |
| 25 | cache 长度随步增长 | PASS |
| 26 | SFT shift 后恰有 2 个有效 loss 位置 | PASS |
| 27 | **SFT 手工 loss == torch（4.743428）** | PASS |
| 28 | 未 shift 的写法被证实错位 | PASS |
| 29 | **DPO sequence_logprob == 手工（-9.579985）** | PASS |
| 30 | 策略==参考时 DPO loss = ln2 | PASS |
| 31 | Loss Mask：prompt 位置贡献被排除 | PASS |
| 32 | RoPE 只作用于 Q/K（V 不受影响，结构检查） | PASS |

---

## 三、数值复算（Node 脚本，逐项核对）

| 原文公式/算例 | 复算结果 | 是否修正 |
| --- | --- | --- |
| CPU 训练时间 8.4e22 / 1e12 | 8.4e10 s = **2662 年** | ✅ 已修（原写 260 万年） |
| LayerNorm [8,512,4096] bf16 | 流量 67.1MB；AI=1.25；内存 32.9μs；计算 0.269μs | ✅ 已修（原 2.5 / 16μs / 0.0003μs） |
| MFU 算例（7B×2T，1000×A100，35%） | 8.40e22 FLOPs；8.90 天；109.2 TFLOPS/卡；MFU 闭环 35% | ✅ 已修（原公式量纲错误） |
| Chinchilla 三方 FLOPs | GPT-3 3.15e23；Gopher 5.04e23；Chinchilla 5.88e23 | ✅ 已修（原表述矛盾） |
| ZeRO 显存（7B，8 卡，16B 口径） | 112 / 38.5 / 26.3 / 14.0 GB | ✅ 确认（与演示一致） |
| Chinchilla 教学拟合最优点 | 各预算 D/N = 20.0；C=5.88e23 → N*=70.1B，D*=1399B | ✅ 确认（与 headline 对齐，已标注为教学拟合） |
| Ring AllReduce 每卡发送量 | N=8 → 1.75S；N=1024 → 1.998S | ✅ 确认（≈2S） |
| TinyLM 参数量公式 | 实际 13.01M vs 公式 12.91M（+0.77%，来源：d_ff 按 64 对齐） | ✅ 确认（正文已说明「误差 <1%」，d=32 级别的偏差已由测试注明） |

---

## 四、Systems Demo 验证（浏览器实测）

| 演示 | 状态 | 验证内容 |
| --- | --- | --- |
| scaling-calculator | **FIXED** | FLOPs 量级修正（6·N·D·1e18）；「Chinchilla 最优」→「经典参考(20N)」+ 非硬规则说明；slider 边界无 NaN；7B/1.4T/1024 卡 → 6.1 天 |
| chinchilla-curve | **FIXED** | 拟合参数改为教学值并校准 D*/N*=20；输出加「⚠️ 教学简化拟合，非原论文精确复现」；预算 10^19–10^25 全部正常 |
| roofline | **FIXED** | 算子 AI 值与正文表格统一（0.2/1.0/1.0/1.3/10/60/200）；输出加「教学近似」声明；点选 LayerNorm 判定 Memory-bound 正确 |
| allreduce-ring | **PASS** | 6 步动画完整走完；4 卡/4 块状态合并逻辑与教科书算法一致；文案含「每卡通信 ≈2S」正确表述 |
| zero-stages | **FIXED** | 增加口径说明（16 bytes/参数、不含 activations、与第 17 章 18B 口径的差异）；滑块无 NaN |

---

## 五、仍然存在的教学简化（已全部在页面显式标注）

| 简化 | 位置 | 说明 |
| --- | --- | --- |
| C ≈ 6ND 是近似 | 第 14 章 | 忽略 attention 的 O(S²) 项、embedding、非矩阵乘算子；对小模型/长序列需修正 |
| Chinchilla 演示曲线为教学拟合 | 第 14 章 + 演示 | 非论文 Figure 4 的精确复现；论文原值见附录 Table A9 |
| D/N ≈ 20 为经典参考 | 第 14 章 | 受推理成本/数据质量/tokenizer/架构影响，非硬规则 |
| Roofline 的 AI 值为量级近似 | 第 15 章 + 演示 | 不同实现差异大，仅用于判断瓶颈方向 |
| A100 规格 | 第 15 章 | BF16 312 TFLOPS 为 **dense、不含稀疏**；带宽 2039 GB/s 为 80GB HBM2e 版本 |
| 存储层次延迟（~400 cycles 等） | 第 15 章 | 数量级示意，随架构变化 |
| CPU 1 TFLOPS 为教学假设 | 第 15 章 | 用于数量级直觉，不代表真实 CPU 训练性能 |
| ZeRO 显存不含 activations | 第 16 章 + 演示 | 只统计 model states；实际显存还要加激活与临时缓冲 |
| Ring AllReduce 忽略延迟/启动开销 | 第 16 章 | 带宽口径；真实性能受链路质量与消息大小影响 |
| PP 气泡公式的调度假设 | 第 16 章 | 仅对经典 1F1B（非 interleaved）成立 |
| 参数量公式 ±1% | 第 12 章 | d_ff 按 64 对齐导致小模型偏差更大（已在测试报告中注明） |
| LLaMA-3 / Qwen 的 token 数 | 第 14 章 | 来自公开技术报告，非本文复现 |

---

## 六、结论

- **发现技术问题：24 处**（代码逻辑 5 / 数学数值 13 / 表述一致性 6）
- **已修复：24 处**（100%），其中 5 处代码问题全部经 PyTorch 实测
- **实际运行验证：32 项全部 PASS**（含梯度累积、KV Cache、SFT shift、DPO 四项高风险逻辑）
- **数值复算：8 组全部核对**（含此前发现的 3 处数量级/量纲错误）
- **Systems 演示：5 个全部通过浏览器交互验证**（4 个 FIXED，1 个 PASS）
- **遗留：上述 12 项教学简化**，均已在页面明确标注，不构成事实错误

**第一批 V2 可以进入第二批升级**（Data Pipeline → FlashAttention/Triton → Inference Systems → LLM Evaluation），前提是第二批继续遵守本报告确立的三类数字规范（数学恒等 / 硬件规格 / 教学假设）。

---

# Correctness Pass 2

> 目标：修掉 Pass 1 之后仍残留的渲染问题、代码 bug、复杂度表述错误与编号不一致。
> 本轮同样遵循：正确性 > 可运行性 > 一致性 > 表达 > 新增内容。
> 新增工具：`tools/validate-static.js`（静态渲染自动检查）。

## 一、本轮发现并修复的问题（16 项，全部修复）

| # | 类别 | 文件 | 原问题 | 修复 | 验证 |
| --- | --- | --- | --- | --- | --- |
| 1 | **渲染** | 13-build-llm-2.md | Lab 9 警告框附近有一条**孤立闭合围栏**（上次编辑遗留），导致其后的 `:::note` / `:::fold` 被吞进 `<pre><code>`，静态页大面积损坏 | 删除孤立围栏；全仓库扫描 20 个文件确保围栏全部配对 | 新脚本 `validate-static.js`：0 容器残留 / 0 fence 错位；浏览器实测「第一次训练应该期待什么」以 box 正常渲染、未进 pre ✅ |
| 2 | **代码** | 13-build-llm-2.md | loss 日志：累加的是 `loss.item()`（= L/accum），却除以 `50*accum` → 显示值偏小 accum 倍 | 拆分 `raw_loss`（日志用）与 `loss = raw_loss/accum`（backward 用）；日志除以 `50*accum` | 验证脚本 5a/5b：正确公式还原 2.0；反例复现 0.5（=2/4）✅ |
| 3 | **代码** | 13-build-llm-2.md | `while global_step < max_steps` 内层 for 不会中途停止 → max_steps 到达后仍跑完当前 epoch | 更新后 `if global_step >= max_steps: stop=True; break` | 验证脚本 4：max_steps=3、accum=2 → optimizer.step 恰好 3 次、micro=6 立即停止 ✅ |
| 4 | **代码** | 13-build-llm-2.md + 11-pretrain-sft.md | warmup 第一步 `lr_at(0) = 0` → 第一次更新无参数变化（ch18 的 LambdaLR 同样存在，构造时即以 step=0 调用） | 统一采用方案 A：Build 章用 `lr_at(global_step+1)`；ch18 的 `lr_lambda` 加 `step+1` 并加警告框说明两种约定 | 验证脚本 6：第一次更新 lr = base/warmup = 0.01（>0）✅ |
| 5 | **数学/代码** | 12-build-llm-1.md、10-modern-llm.md、demos-llm.js | RMSNorm 的 eps 加在根号**外**（`x/(√E[x²]+ε)`），与论文/官方实现（eps 在根号内）不符 | 代码改 `x * rsqrt(E[x²]+ε)`；公式改 `x/√(RMS²+ε)`；对比代码加「❌常见错误写法」；演示同步 | 验证脚本 1a：与 `torch.nn.RMSNorm` 输出 max diff = 0；1b：错误写法在大 eps 下 diff=1.53（可见差异）✅ |
| 6 | **代码** | 11-pytorch.md、13-build-llm-2.md | `TokenDataset.__len__` 少 1（`N-S-1`），最后一个合法窗口永远取不到 | 改为 `N - seq_len`，并加 N=10/S=4 自测 | 验证脚本 2a/2b：len=6，最后样本 x=[5..8]、y=[6..9] ✅ |
| 7 | **复杂度** | 10-modern-llm.md、13-build-llm-2.md、07-transformer.md、demos-llm.js | 「KV Cache 让 decode 每步 O(1)、总计算 O(n²)→O(n)」——**严重过度简化**：有缓存时注意力分数仍随上下文线性增长 | 全部改写：明确拆分「省掉的（prefix 投影/FFN/Norm 重算）」与「没省的（新 Query × 历史 K，每步 O(t·d)）」；给出每步成本对比公式；补充显存带宽视角；quiz、面试答案、演示文案全部同步 | 浏览器 grep 验证 4 个文件的新表述；quiz 答案已同步 ✅ |
| 8 | **测量** | 13-build-llm-2.md | CUDA 计时未同步（测到的是入队时间）、无 warmup、单次测量；标题「完整生成速度对比」过度承诺 | 改为 `torch.cuda.synchronize()` + warmup + 3 次取 min + `time.perf_counter`；改名「Attention-only 教学 microbenchmark」并注明不等同端到端 serving benchmark | 验证脚本 12/13：CPU 回退路径正常结束；**CUDA 路径标记 NOT EXECUTED（本机无 CUDA）** |
| 9 | **表述** | 13-build-llm-2.md | CachedAttention 无 RoPE，可能被误当「完整 LLM inference 实现」 | docstring 明确列出省略项：RoPE、position index、GQA 映射、mask；说明真实实现需缓存这些状态 | 静态页渲染检查 ✅ |
| 10 | **编号** | 13-efficient.md / 11-pretrain-sft.md / 12-rl-grpo.md / 13-build-llm-2.md | 文件内仍是旧编号（13.x / 11.x / 12.x / 13.x） | 全部同步为用户可见编号：17.1–17.9 / 18.1–18.16 / 19.1–19.10；「13.x 全课验收」→「13.8」 | grep 验证：17×9、18×16、19×10；浏览器 TOC 正常 ✅ |
| 11 | **表述** | 15-gpu.md | 来源不明的术语「GEMM『9』/ 理论峰值 ~100%」 | 删除，替换为标准概念：GEMM 的 M/N/K、Tensor Core 对齐条件、Tile 大小、occupancy、算术强度；占比数字标注为经验值 | 浏览器验证「无 GEMM 9」且新概念存在 ✅ |
| 12 | **表述** | 15-gpu.md | 「FlashAttention 把 HBM 流量从 O(S²) 降到 O(S)」——无假设的过度简化 | 改为「不在 HBM 中物化完整 S×S 矩阵、显著减少 HBM↔SRAM 搬运；计算复杂度仍 O(S²)」，精确 I/O 分析留到第二批 | 浏览器验证新 quiz 文案 ✅ |
| 13 | **表述** | 15-gpu.md、10-modern-llm.md | 绝对化措辞：「唯一 compute-bound 主力」「所有高性能 kernel」「唯一途径」「质量几乎无损」 | 改为「通常/主要…之一」；GQA 改为「实验表明质量损失很小（具体随配置变化）」 | 浏览器验证 ✅ |
| 14 | **口径** | 13-efficient.md | 18 bytes/param 缺框架差异说明 | 新增「口径说明（16 vs 18）」：现代框架可能用 bf16 梯度（16）/无独立 master weights；18 是保守教学估算 | 浏览器验证 ✅ |
| 15 | **表述** | 13-efficient.md | 「激活显存下降 k 倍」易误导（仿佛总显存也降 k 倍） | 改为「单次 micro-batch 的激活约按比例缩小；参数/梯度/优化器状态/缓冲不降，总显存不会整体下降 k 倍」 | 浏览器验证 ✅ |
| 16 | **工程** | tools/ | 「build 成功 ≠ 页面正确」缺少自动检查 | 新增 `tools/validate-static.js`：检查未解析容器、fence 残留、`<pre><code>` 包裹组件、占位符、LaTeX 残留、正文量下限、章节文件齐全、index 目录 | 运行通过：20/20 静态页 ✅ |

## 二、Pass 2 实际运行测试（14 项全部 PASS）

环境：Python 3.9.6 + PyTorch 2.8.0（CPU）；另加静态验证与浏览器验证。

| # | 测试 | 结果 |
| --- | --- | --- |
| 1a | RMSNorm 与 `torch.nn.RMSNorm` 数值一致（eps 在根号内） | PASS（max diff = 0） |
| 1b | 反例验证：「eps 在根号外」与标准实现有可见差异 | PASS（diff = 1.53） |
| 2a | TokenDataset 长度 = N−S（N=10,S=4 → 6） | PASS |
| 2b | 最后一个合法窗口 x=[5..8], y=[6..9] | PASS |
| 3 | 梯度累积：micro 40 / optimizer.step 10 / global 10 三者一致 | PASS |
| 4 | max_steps=3, accum=2 → 恰好 3 次更新并立即停止 | PASS |
| 5a | loss 日志公式还原 raw loss（累加 raw ÷ (50·accum)） | PASS（2.0） |
| 5b | 反例：累加缩放 loss 再除 (50·accum) 会小 accum 倍 | PASS（复现 0.5） |
| 6 | warmup 第一次更新 lr = base/warmup > 0 | PASS（0.01） |
| 7 | SFT shift + loss mask 手工核对 | PASS（4.665315 == 4.665315） |
| 8 | DPO 不变量：策略==参考 → loss = ln2 | PASS（0.693147） |
| 9 | RoPE 相对位置：Δ=2 相同、Δ=4 不同 | PASS |
| 12 | KV Cache benchmark 代码可运行（warmup+sync+min） | PASS（CPU 3.50ms vs 2.90ms，**仅供代码正确性**） |
| 13 | CPU 环境 benchmark 正常结束、不影响构建 | PASS |

**CUDA benchmark：NOT EXECUTED ON CUDA**（本机无 CUDA 设备；只验证了代码静态正确与 CPU 回退路径。GPU 数值结论请勿引用本机结果。）

## 三、静态渲染与浏览器验证

| 检查 | 结果 |
| --- | --- |
| `validate-static.js`（20 页：容器残留/fence/`<pre>`组件/占位符/正文量） | ✅ 全部通过 |
| build-llm-2 页：note 未进 `<pre>`、以 box 渲染、fold 正常、字面 `:::` 残留 = 0 | ✅ |
| 全站回归：20 章 / 65 demos / 340 quizOptions / **0 console error** | ✅ |
| 被修改的演示（norm-compare、kv-cache）文案与数值 | ✅ |
| GPU / Scaling / Distributed / Efficient 页关键修正点抽查 | ✅ |

## 四、Pass 2 遗留的教学简化（已标注，不属错误）

1. KV Cache 复杂度：课程现在使用「每步 O(d²) + O(t·d)」的教学分解；精确的端到端 serving 性能模型（批处理、带宽竞争）留到第二批 Inference Systems。
2. FlashAttention：只保留「不物化 S×S 矩阵、减少 HBM 搬运」的正确边界，精确 I/O complexity 公式留到第二批。
3. Roofline AI 表、GPU 延迟数字：量级近似（页面已标注）。
4. KV Cache benchmark 为单层注意力 microbenchmark，非端到端生成 benchmark（页面已标注）。
5. 16 vs 18 bytes/参数：两种口径均有效，页面已明确假设条件。

## 五、结论

- **Pass 2 发现 16 项问题，修复 16 项（100%）**；其中 6 项为代码逻辑/数值 bug（均有实测）、3 项为复杂度/表述纠错、1 项为渲染回归、1 项为工程工具缺口。
- 新增的 `validate-static.js` 使「构建成功但页面损坏」这类回归在流程上被自动拦截。
- **第一批 V2 可以正式冻结**：所有已知技术错误已修复，14 项 Python 测试 + 静态验证 + 全站浏览器回归全部通过；唯一未执行项为 CUDA benchmark（已明确标注 NOT EXECUTED）。
- 可以进入第二批：Data Pipeline → FlashAttention/Triton → Inference Systems → LLM Evaluation。
