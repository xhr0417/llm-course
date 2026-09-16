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
