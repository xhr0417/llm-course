# Job-Ready Track · Batch 4 & 5 完成报告（Capstone 3/4 + 全 Track 收尾）

> Batch 4：Real SFT / LoRA Experiment（`projects/sft-lora/`）
> Batch 5：GPU / Inference Profiling Lab（`projects/inference-benchmark/`）
> 纪律：全部数字真实运行；无 GPU 部分明确 NOT EXECUTED。

---

## 一、Batch 4 交付（Capstone 3 · SFT/LoRA）

| 项 | 内容 |
| --- | --- |
| 数据 | 48 train / 12 val（指令 messages）+ 20 条 QA 评测集，全部自制 |
| 训练 | response-only loss + grad accum(4) + clip + warmup/余弦 + val 记录 |
| 产物 | adapter / losses.csv / badcases.jsonl / experiment.md（自动报告） |
| 评测 | 同一套 harness（Capstone 1，含新增 `--peft-adapter`）：base vs tuned |
| 测试 | **14/14 通过** |

**真实结果**（Qwen2.5-0.5B，CPU 469s）：

```
train loss：3.8878 → 1.4638（final@150）
val loss：2.8677@30 → 2.7301@60（best，已保存 adapter_best）→ 3.2947@150（adapter_final）
三路评测：held-out loss base 3.7565 / best 2.7301 / final 3.2947；QA F1 base 20.2% / best 24.4% / final 22.5%；EM 全 0
bad cases：20 条（全部 partial）
```

**核心教学结论**：
1. train loss 降 ≠ 变好（val 从 step 60 起上升）→ 本轮已实现 **best checkpoint 保存**，final 作为反例保留，并做 Base/Best/Final 三路对比；
2. SFT 教格式不教知识（真实输出对比：风格迁移成功、内容仍常错）；
3. 公平对比三前提：同一 held-out / 同一模板 / 干净加载的 base（PEFT 就地注入陷阱）。

## 二、Batch 5 交付（Capstone 4 · Profiling Lab）

| 项 | 内容 |
| --- | --- |
| 工具 | timer（CUDA Event/同步）、profiler 算子表、attention benchmark、compile 对比、serving 压测客户端 |
| 报告 | results/*.csv + analysis.md 自动生成（含「GPU 预期行为（待验证）」与「未执行清单」） |
| vLLM | runbook（命令 + 四问 + 记录模板）→ **NOT EXECUTED ON CUDA** |
| 测试 | **15/15 通过** |

**真实结果**（CPU）：

```
Attention (seq 2048)：naive 19.57 ms → SDPA 7.20 ms；内存口径为「理论中间张量 128MB→0 + 独立子进程 RSS（310.3→185.4MB）」（见 JOB_READY_CORRECTNESS_AUDIT）
伸缩性：naive 1024→2048 = 3.53×（理论 4×）
Profiler：bmm 66.4% + softmax 23.3% = 90% 时间
torch.compile：0.249 → 0.345 ms（0.72×，更慢，编译 3.3s）→ 「compile 不是信仰」
Serving 客户端（mock）：并发 4 时 TPOT 不变、TTFT 4.4→851ms（排队而非计算慢）
```

## 三、Job-Ready Track 总览（1-5 全部完成）

| Batch | 内容 | 项目 | 验证 |
| --- | --- | --- | --- |
| 1 | Python 工程 + HuggingFace | log-analyzer / hf-mini-lab | 14 + 10 测试 |
| 2 | Eval Harness（Checkpoint C） | llm-eval | 29 用例（含真实 C3/XCOPA 评测） |
| 3 | RAG + RAG Service（Checkpoint D） | rag-service | 27 用例（含真实检索/生成评测） |
| 4 | SFT/LoRA 实验 | sft-lora | 14 测试（含真实训练 + harness 对比） |
| 5 | Profiling Lab（Checkpoint E） | inference-benchmark | 10 测试（CPU 实测 + CUDA 待验证） |

**Checkpoint A-E 全部交付** ✅（见第 24 章表格）。

**项目门禁**（validate-jobs）：**149 项检查**，包括每个项目的测试数与 README 声明一致性、反伪造实验规模、项目引用完整性。

**全站验收**：**32 章 / 93 demos / 420 quiz / 0 console error**；浏览器验收（首页 Track A/B/C、三级进度、全部新演示）通过。

## 四、Known Limitations（本批 + 全 Track）

1. **生成模型统一为 0.5B**：生成质量受模型规模限制；评测/工程方法论不受影响；
2. **SFT 已实现 best/final 双 checkpoint**；三路对比显示本 run 中 best val 同时是 best QA F1（单次观察，不构成普遍规律）；
3. **CUDA 相关实验未执行**：profiling（GPU 侧）、vLLM benchmark、Triton kernel——命令与模板齐全，NOT EXECUTED 标注一致；
4. **RAG faithfulness 未自动化**：当前靠引用校验 + 人工检查；
5. **单种子实验**：SFT 未做多 seed 均值；检索评测集 22 条（doc 级）；
6. **官方 C3/XCOPA 完整测试集未跑**：教学切片 + 明确标注。

## 五、后续可选方向（不属本 Track 承诺范围）

- Triton / CUDA kernel 深化（需 GPU）；
- 量化独立专题（校准/精度分析）；
- MoE / 长上下文 / Reasoning 深化；
- DPO/GRPO 端到端实验（复用 sft-lora 的框架与 harness）。
