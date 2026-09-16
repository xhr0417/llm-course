> **本章定位**：第二批收尾模块。第 3 章讲的是**经典 ML 评估**（Accuracy/Precision/Recall/F1/过拟合）；本章专门讲 **LLM 特有**的评估体系，回答：**模型到底有没有变好？** 以及——benchmark 分数到底说明什么、不说明什么。
>
> 跨章闭环：Contamination（23.13）与数据管线第 18 章直接对应。

:::note 代码类型约定（Build / Systems 章节统一）
- 【Runnable】可直接运行（关键逻辑已在本课程验证脚本中实测）
- 【Skeleton】工程骨架：逻辑完整，需要自备数据/环境
:::

## 23.1 Evaluation Pipeline：评估也是一条流水线

:::unfold 先懂直觉
「跑个 benchmark」不是一个数，而是一条流水线：模型给出原始输出 → 用模板套出 prompt → 生成 → 解析出答案 → 和标准答案比对 → 汇总成指标。**任何一环出错，分数都会失真**——这是本章反复强调的核心。
:::

```
Model
  ↓  Dataset（题目 + 标准答案）
  ↓  Prompt Template（few-shot / zero-shot / 指令格式）
  ↓  Generation（采样参数：temperature、max_tokens）
  ↓  Parser（从输出里抽出「答案」）
  ↓  Metric（EM / F1 / Accuracy / pass@k / judge）
  ↓  Report（分数 + 置信区间 + 失败样本）
```

:::demo eval-pipeline 交互：点击每一环看它在做什么、错在哪会怎样
:::

## 23.2 Perplexity：与预训练 loss 直接相连

$$
\text{PPL} = e^{\text{Loss}}
$$

| Loss | PPL | 含义 |
| --- | --- | --- |
| 2.0 | 7.39 | 平均在 ~7 个候选间犹豫 |
| 3.0 | 20.09 | 更不确定 |

:::warning PPL 的两个使用边界
1. **不同 tokenizer 之间不可直接比较**（token 粒度不同 → 每步难度不同，第 21 章已讲）；
2. **PPL 低 ≠ 下游任务好**：它衡量「预测文本」的能力，与指令遵循、推理、安全性无直接关系。
:::

## 23.3 Exact Match：解析器决定分数

:::unfold 先懂直觉
EM 要求输出与标准答案**完全一致**（规范化后）。问题是：模型很少只输出一个答案。
:::

```
标准答案：42
模型输出：The answer is 42.

直接比较：Exact Match = 0
解析后比较（抽取"42"）：Exact Match = 1
```

**结论**：metric 与 parser 是一体的。报告 EM 时必须说明规范化规则（大小写、空白、标点、是否抽取答案）。

:::demo em-f1 交互：EM 与 F1 计算器
编辑「标准答案」与「模型输出」，实时看规范化后的 Exact Match 与 token 级 F1——体会 parser 对分数的影响。
:::

## 23.4 F1：QA 类任务的部分给分

:::unfold 先懂直觉
抽取式问答（SQuAD 风格）里，答案常常是「一段话里的一段」。完全一致要求太严格，于是用 **token 级 F1** 给部分分。
:::

$$
P = \frac{|\text{预测} \cap \text{标准}|}{|\text{预测}|}, \qquad
R = \frac{|\text{预测} \cap \text{标准}|}{|\text{标准}|}, \qquad
F_1 = \frac{2PR}{P + R}
$$

**算例**：标准「苹果公司位于库比蒂诺」，预测「苹果公司位于美国库比蒂诺」：

- 交集 = {苹果公司, 位于, 库比蒂诺} = 3 token
- P = 3/4，R = 3/3 → F1 = 2·0.75·1/(1.75) ≈ 0.857

## 23.5 选择题准确率与随机基线

:::unfold 先懂直觉
选择题（MMLU / C-Eval / C3 / XCOPA）只看选项：Accuracy = 答对比例。但**必须对照随机基线**——4 选项 = 25%，2 选项 = 50%。不看基线的分数没有意义。
:::

| Benchmark | 类型 | 随机基线 | 说明 |
| --- | --- | --- | --- |
| MMLU | 4 选 1（英文多学科） | 25% | 知识广度 |
| C-Eval | 4 选 1（中文多学科） | 25% | 中文知识 |
| C3 | 中文阅读理解（多选） | 25% | 中文理解 |
| XCOPA | 2 选 1（因果常识） | 50% | 因果推理 |

:::note 一个真实的小模型案例（本项目，非 SOTA）
用本课程路线训练的小模型在中文评测上的实测结果：

| 任务 | 分数 | 随机基线 | 相对基线 |
| --- | --- | --- | --- |
| C3 | 40% | 25% | +15pt（有信号，但仍弱） |
| XCOPA | 55% | 50% | +5pt（接近随机，因果推理很弱） |

**怎么读这张表**：C3 高于随机基线说明模型学到了部分中文理解能力；XCOPA 只高 5 个点，说明因果常识几乎没学会。这正是「benchmark 分数要看相对基线 + 看任务组成」的实例——**不要拿小模型的分数去对标论文 SOTA**。
:::

:::demo mcq-baseline 交互：分数 vs 随机基线
拖动分数滑块，看它相对不同基线（25% / 50%）的位置——同样的 40%，在不同任务里的意义完全不同。
:::

## 23.6 pass@k：代码任务为什么要多次采样

:::unfold 先懂直觉
HumanEval 这类代码题：模型可能一次写错，但多采样几次有几率写对。**pass@k = 采样 k 次里至少有一次通过的概率**。
:::

无偏估计（采 n 个样本、c 个通过）：

$$
\text{pass@}k = 1 - \frac{\binom{n-c}{k}}{\binom{n}{k}}
$$

**直觉读法**：n=10、c=3 时 pass@1 = 0.3，而 pass@10 = 1（只要 10 个样本里有一个对，就算通过）。k 越大，数字越乐观——所以报告必须写清 k 与采样温度。

:::demo pass-at-k 交互：n / c / k 计算器
拖动采样数 n、通过数 c、k，实时看 pass@k 的变化，理解「k 越大越乐观」。
:::

## 23.7 数学评测：GSM8K / MATH

:::unfold 先懂直觉
数学题要求「解出答案」，但模型输出的是整段推理解答——不能拿整段做 EM。标准做法是**抽取最终答案**再比对。
:::

| 做法 | 说明 |
| --- | --- |
| 抽取 `\boxed{}` 或 `#### 42` 格式 | 多数模型被训练输出固定格式 |
| 数值规范化 | `42` / `42.0` / `$42` 视为相同 |
| 只判最终答案 | CoT 过程不计分（unless process reward） |

:::warning 常见的数学评测陷阱
- 格式依赖：模型答案对但格式不对 → 被误判为错（parser 问题，不是能力问题）；
- 答案泄漏：训练集含原题（contamination）→ 分数虚高（见 23.13）；
- 用 exact match 比整段 CoT → 几乎所有模型都是 0 分。
:::

## 23.8 Instruction Following：另一类能力

:::unfold 先懂直觉
有些评测不考「知识」，而考「听不听指令」：例如 IFEval 的「回答必须三句话、每句以 A 开头」。这类任务的分数与事实正确性**无关**。
:::

```
指令："列出三个水果，每条以数字开头，且不出现苹果二字。"
→ 检查：格式约束是否全部满足（可程序化验证）
```

**意义**：instruction following 反映「可用性」——一个知识很全但不听指令的模型，工程上很难用。

## 23.9 LLM-as-a-Judge：开放式回答怎么评

:::unfold 先懂直觉
开放式回答没有唯一 ground truth（「写一首关于秋天的诗」）。所以用强模型当裁判：给回答打 helpfulness / correctness / style 等维度分。
:::

| 已知偏差 | 表现 | 缓解 |
| --- | --- | --- |
| **位置偏差** | 偏爱 A 或 B 位置 | 交换顺序评两次 |
| **长度/啰嗦偏差** | 偏爱更长的回答 | 长度控制/对照实验 |
| **自我偏好** | 偏爱同族模型的输出 | 换不同裁判模型 |
| **提示敏感** | rubric 措辞改变结论 | 固定并公开 rubric |

:::demo judge-bias 交互：位置偏差演示
同一对回答，「A 在前」与「B 在前」各评一次——点「交换顺序」看裁判结论是否会翻转。
:::

## 23.10 Pairwise Evaluation：A vs B 比绝对分更稳

:::unfold 先懂直觉
让裁判打 1~10 分：不同裁判的标准不一致。改成「A 和 B 哪个更好」：相对判断往往更稳定、更适合比较模型。
:::

| | 绝对打分 | Pairwise |
| --- | --- | --- |
| 输出 | 7 分 | A 胜 |
| 稳定性 | 差（量表漂移） | 好 |
| 聚合 | 平均分 | 胜率（可做 Elo/BT） |
| 风险 | 分数不可比 | 平局处理、位置偏差 |

> 这与第 22 章的偏好数据一脉相承：**相对比较**是 RLHF/DPO 偏好数据的基础形式。

## 23.11 Human Evaluation：什么时候必须用人

:::unfold 先懂直觉
Benchmark 和裁判模型都有盲区。关键决策（上线、安全）依然需要人类评估——但要做得「可复现」。
:::

| 原则 | 做法 |
| --- | --- |
| 盲评 | 不告诉评估者哪个是哪个模型 |
| 随机化 | 顺序随机（对应位置偏差） |
| 规则明确 | rubric 写清楚评分标准 |
| 一致性 | 多人标注时报告 inter-annotator agreement（一致性） |

## 23.12 Prompt Sensitivity：同一模型，分数会飘

:::unfold 先懂直觉
同一模型同一题：few-shot 示例换一换、指令措辞换一换、选项顺序换一换——分数可能明显变化。**所以评估必须固定模板，并报告模板。**
:::

```
Prompt A: "请选择正确答案："      → 65%
Prompt B: "Answer with the letter." → 58%
Prompt C: 5-shot 示例             → 71%
```

> 报告分数时不写 prompt 模板 = 无法复现 = 无法比较。

## 23.13 Contamination：与数据管线闭环

:::unfold 先懂直觉
如果评测集的题目（甚至答案）出现在预训练数据里，模型可能「背过」，分数虚高。这在第 18 章叫 **benchmark decontamination**——数据管线的第 ⑧ 站。
:::

```
Benchmark sample → normalize → n-gram / MinHash 匹配
  → 命中：从训练数据中移除该文档
```

| 症状 | 可能原因 |
| --- | --- |
| 小模型在某 benchmark 分数异常高 | 疑似污染（或题目泄漏进训练集） |
| benchmark 与训练语料高度重合 | 去污染流程缺失 |

> 把本章和第 18 章连起来看：**评测有效性是数据工程的职责之一**。

## 23.14 置信区间：别只看一个数

:::unfold 先懂直觉
「准确率 70%」在 n=20 和 n=10000 时的可信度完全不同。样本越少，随机波动越大，需要报告**置信区间**。
:::

:::math 标准误（二项分布）
$$
\text{SE} = \sqrt{\frac{p(1-p)}{n}}
$$

95% 置信区间近似：$p \pm 1.96 \times \text{SE}$。

**算例**：p=0.70
- n=20：SE = √(0.7×0.3/20) ≈ 0.102 → 区间 ≈ [0.50, 0.90]（±20pt！）
- n=1000：SE ≈ 0.0145 → 区间 ≈ [0.67, 0.73]（±3pt）
:::

:::demo ci-slider 交互：样本量与置信区间
拖动样本量滑块，观察同一分数下 95% 置信区间如何收窄——小样本的「提升」可能只是噪声。
:::

## 23.15 Statistical Significance：72.0% vs 72.3%

:::unfold 先懂直觉
两个模型分差 0.3 个百分点，可能完全在噪声范围内。判断「谁真的更好」需要显著性检验（如配对 bootstrap / 二项检验），且要说明检验方法与样本量。
:::

| 不要 | 要 |
| --- | --- |
| 「B 比 A 高 0.3%，所以 B 更好」 | 「B − A = 0.3pt，n=1000 时 95% CI 含 0 → 无显著差异」 |

## 23.16 Evaluation Harness：为什么要统一

:::unfold 先懂直觉
不同论文的分数常常不可比：prompt 不同、few-shot 数不同、parser 不同、采样参数不同。**Harness**（如 lm-evaluation-harness 类工具）把 dataset / prompt / generation / parser / metric 全部固定成标准流程。
:::

> 本课程不教安装；要记住的是：**看到任何分数，先问「用什么 harness、什么模板、什么 parser」**。

## 23.17 Failure Case Analysis：分数之外

:::unfold 先懂直觉
一个数字不能告诉你模型「哪里不会」。工程上必须做**失败样本分类**，才能指导下一步数据/训练方向。
:::

| 失败类型 | 例子 | 对应改进 |
| --- | --- | --- |
| 事实错误 | 张冠李戴 | 数据质量/知识更新 |
| 推理错误 | 步骤对、结论错 | 推理数据 / RLVR |
| 格式问题 | 答案对但解析不出 | 指令微调 / 格式规范 |
| 指令不遵循 | 少给了一条 | IF 数据 |
| 语言混杂 | 中文问题英文答 | 语言配比 |
| 长上下文失败 | 长文档里找不到答案 | 上下文扩展 / 检索 |

:::fold 工程里怎么用（失败样本记录模板）
```jsonl
{"task": "c3", "id": 152, "question": "……", "gold": "B", "pred": "D",
 "failure_type": "reasoning_error", "note": "定位到关键句但推理方向反了"}
{"task": "ppl_eval", "id": "doc-88", "loss": 6.8, "failure_type": "long_context",
 "note": "跨 2k token 的指代没有连上"}
```
:::

## 23.18 Mini Evaluation Lab：给 Small LLM 做一次评测

:::unfold 目标
用你在第 13 章亲手训练的 TinyLM，跑一次**两种指标**的评测：困惑度 + 选择题准确率，并输出结构化结果。**本节代码已实际运行验证。**
:::

```python
# 类型：【Runnable】依赖：torch（+ 你的 TinyLM 定义与 tokenizer）
import json, math, torch
import torch.nn.functional as F

def evaluate_ppl(model, dataset, device="cpu"):
    """困惑度：e^平均交叉熵（注意：只能和同 tokenizer 比较）"""
    model.eval()
    losses = []
    with torch.no_grad():
        for x, y in dataset:
            logits = model(x[None].to(device))
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), y[None].to(device).view(-1))
            losses.append(loss.item())
    mean = sum(losses) / len(losses)
    return {"loss": mean, "ppl": math.exp(mean)}

def evaluate_mcq(model, items, device="cpu"):
    """选择题：比较各选项 continuation 的平均 log 概率，取最高"""
    model.eval()
    correct = 0
    log = []
    with torch.no_grad():
        for it in items:
            scores = {}
            for opt, text in it["options"].items():
                ids = torch.tensor(it["prompt_ids"] + text["ids"])
                logp = F.log_softmax(model(ids[None].to(device))[0], dim=-1)
                start = len(it["prompt_ids"])
                s = sum(logp[i - 1, ids[i]].item() for i in range(start, len(ids)))
                scores[opt] = s / max(1, len(ids) - start)     # 长度归一
            pred = max(scores, key=scores.get)
            ok = pred == it["answer"]
            correct += ok
            log.append({"id": it["id"], "gold": it["answer"], "pred": pred, "ok": ok})
    acc = correct / max(1, len(items))
    return {"accuracy": acc, "n": len(items), "random_baseline": 0.25, "log": log}

# —— 用本项目小模型的真实结果演示输出格式（数字来自实际评测）——
if __name__ == "__main__":
    results = {
        "c3":    {"accuracy": 0.40, "random_baseline": 0.25, "note": "中文阅读理解（4选1）"},
        "xcopa": {"accuracy": 0.55, "random_baseline": 0.50, "note": "因果常识（2选1）"},
    }
    with open("results.json", "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(json.dumps(results, ensure_ascii=False, indent=2))
```

**验收**：输出 `results.json`：

```json
{
  "c3":    { "accuracy": 0.40, "random_baseline": 0.25, "note": "中文阅读理解（4选1）" },
  "xcopa": { "accuracy": 0.55, "random_baseline": 0.50, "note": "因果常识（2选1）" }
}
```

> 这些数字来自本项目 Small LLM 的真实评测（非课程虚构、也非 SOTA）。报告时必须写清：任务、随机基线、样本量、prompt 模板、parser——否则无法复现。

:::key 本章必须记住
| 概念 | 一句话 |
| --- | --- |
| Eval Pipeline | Model→Dataset→Template→Generation→Parser→Metric，任一环失真 |
| PPL | e^Loss；不能跨 tokenizer 比；低 PPL ≠ 好对话 |
| EM / F1 | parser 决定分数；QA 常用 token 级 F1 |
| 选择题 | 必须对照随机基线（25% / 50%） |
| pass@k | 1 − C(n−c,k)/C(n,k)；k 越大越乐观 |
| Judge | 位置/长度/自我偏好偏差，需交换顺序与固定 rubric |
| Pairwise | 比绝对打分更稳；偏好数据的基础 |
| 置信区间 | SE=√(p(1−p)/n)；小样本的分数波动巨大 |
| Contamination | 与数据管线闭环：去污染保障评测有效性 |
| Harness | 固定流程才有可比分数；报告要带模板与 parser |
:::

:::quiz
某模型在 C3（4 选 1）上 40%、XCOPA（2 选 1）上 55%，哪个结论更合理？

A. C3 提升更大（+15pt vs +5pt 相对基线）
B. XCOPA 更好，因为 55% > 40%
C. 两个分数都不能解读
D. C3 是过拟合

答案: A
解析: 必须看相对随机基线的增量：C3 高 15 个百分点（有信号），XCOPA 只高 5 个百分点（接近随机，因果推理基本没学会）。绝对分数不可跨任务比较。
:::

:::quiz
关于 pass@k，说法正确的是？

A. 和 pass@1 一样
B. k 越大分数越乐观：只要 k 次采样中有一次通过就算通过
C. 不需要采样，直接算
D. 只能用于数学题

答案: B
解析: pass@k 衡量「采样 k 次至少一次通过」的概率，常用无偏估计 1 − C(n−c,k)/C(n,k)。k 越大数字越乐观，报告必须写清 k、n 与采样温度。
:::

:::quiz
为什么「70% 准确率」在 n=20 与 n=1000 时意义不同？

A. 没有不同
B. n=20 时 95% 置信区间约 [50%, 90%]，随机波动极大；n=1000 时区间约 [67%, 73%]
C. n 越大分数越低
D. 只与模型大小有关

答案: B
解析: 二项分布标准误 SE=√(p(1−p)/n) 随样本量减小而增大。小样本下所谓「提升」可能完全在噪声范围内——报告分数必须带样本量与置信区间。
:::

:::related
依赖 | 第 3 章 经典评估, 第 21 章 PPL, 第 18 章 去污染
用于 | 模型选型, 训练迭代决策, RLHF 的偏好数据设计
:::
