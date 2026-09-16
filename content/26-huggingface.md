# 第 26 章 · HuggingFace for LLM Engineering：用工业生态跑模型

:::intuition 一句话
你已经知道 Transformer 内部长什么样（第 7 章）——现在学习**真实世界怎么使用** Qwen / LLaMA / Mistral：一行加载模型，一行生成，几十行完成 LoRA 微调。
:::

:::warning 本章代码全部真实运行过
模型：`Qwen/Qwen2.5-0.5B-Instruct`（CPU，fp32）。页面中所有数字（形状、参数量、loss）都来自 [`projects/hf-mini-lab/`](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab) 的实测输出。
:::

## 26.1 Tokenizer：模型与文本之间的唯一接口

第 6 章你亲手训过 BPE。工业生态里不需要自己训——用 `AutoTokenizer` 加载现成的：

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")

ids = tokenizer("你好，世界")["input_ids"]          # encode
tokenizer.decode(ids)                                # decode → '你好，世界'
```

实测输出：`vocab=151643`，`pad=<|endoftext|>`。

三个必须理解的概念：

| 概念 | 作用 | 常见错误 |
| --- | --- | --- |
| `padding` | 把不同长度的序列补到等长（batch 推理必需） | 不设 `pad_token`（很多 LLM 默认没有 pad） |
| `truncation` | 超长序列截断 | 不截断 → 显存爆炸 |
| `attention_mask` | 标记哪些位置是真实 token（1）/ padding（0） | 忘记传给模型 → 模型 attend 到 pad |

```python
tokenizer.pad_token = tokenizer.eos_token       # Qwen 默认没有 pad，用 eos 顶替
```

## 26.2 Chat Template：最容易被忽视的工程细节

模型看到的不是 `{"role": "user"}` 这种字典——**模板把它渲染成一段带特殊 token 的文本**：

```python
messages = [{"role": "user", "content": "什么是过拟合？"}]

text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
```

本项目实测渲染结果（Qwen 的 ChatML 模板）：

```
<|im_start|>system
You are Qwen, created by Alibaba Cloud. You are a helpful assistant.<|im_end|>
<|im_start|>user
什么是过拟合？<|im_end|>
<|im_start|>assistant
```

:::demo chat-template 交互：messages → 渲染文本 → token
切换模型模板格式（ChatML / Llama），观察特殊 token 如何包裹每轮对话。
:::

:::warning 为什么 Chat Template 不对，模型能力会明显下降
模型在预训练/SFT 阶段见到的就是这种「带特殊 token 的文本」。推理时如果格式不一致（少一个 `<|im_end|>`、system 位置错、手动拼字符串拼错），分布就偏移了——模型可能答非所问、不停顿、或复读。

**工程纪律：永远用 `apply_chat_template`，不要手拼 ChatML 字符串。**
:::

`add_generation_prompt=True` 的作用：末尾补上 `<|im_start|>assistant\n`，告诉模型「该你说了」。

## 26.3 AutoModelForCausalLM：三个参数看住显存

```python
import torch
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-0.5B-Instruct",
    dtype=torch.float32,       # 或 bfloat16 / float16（第 17 章）
)
model.to("cpu")                # 或 "cuda" / device_map="auto"
```

| 参数 | 含义 | 注意 |
| --- | --- | --- |
| `dtype` | 权重精度 | fp32 精确但费显存；bf16 训练推理常用 |
| `device_map` | 多设备分配（`"auto"` 自动切分） | 单卡小模型不需要 |
| `trust_remote_code` | 允许执行仓库自带代码 | ⚠️ **不要无脑 True**：这是在执行第三方代码，只在信任来源且必要（如新架构未进 transformers）时使用 |

实测：0.5B 模型 fp32 加载后 `494.0M 参数`，CPU 加载约 3 秒。参数量 × 精度字节（0.494B × 4 ≈ 2GB 内存）——这就是第 14 章显存估算的日常应用。

## 26.4 logits：回到第 9 章

```python
probe = tokenizer.apply_chat_template(messages, tokenize=True, return_dict=True, return_tensors="pt")
logits = model(**probe).logits
```

本项目实测：

```
input_ids: (1, 27) → logits: (1, 27, 151936)
最后一位置 top-5 token id: [151644, 151645, 151657, 151658, 68728]
```

`[batch, seq, vocab]`——第 9 章推的每一个符号，在工业代码里就是这个张量。`logits[0, -1]` 就是「下一个 token 的未归一化分数」，softmax 之后就是概率分布。

:::note 注意 detail：`logits.shape[-1] = 151936` 而 `tokenizer.vocab_size = 151643`
输出维度是 `config.vocab_size`，可能因并行/对齐被 pad 到更大。**不要假设两者相等**——这是我们写测试时真实踩到的坑（断言 `==` 失败，改为 `>=`）。
:::

## 26.5 generate：参数与第 9 章数学的对应

```python
out = model.generate(**enc, max_new_tokens=64, do_sample=False)         # 贪心
out = model.generate(**enc, max_new_tokens=64, do_sample=True, temperature=0.7, top_p=0.9)
```

| 参数 | 对应第 9 章 | 作用 |
| --- | --- | --- |
| `do_sample=False` | argmax | 贪心，确定；评测/复现常用 |
| `temperature` | 概率分布锐化/平滑 | 越低越确定，越高越随机 |
| `top_p` | nucleus sampling | 只从累计概率 ≥ p 的最小集合采样 |
| `repetition_penalty` | 对已出现 token 降权 | 抑制复读 |
| `max_new_tokens` | 生成长度上限 | 不是「输出总长」，是新增 token 数 |

真机实测（贪心，0.5B，CPU 约 9.5 token/s）：

```
Q: 什么是学习率？
A: 在机器学习和深度学习中，学习率（learning rate）是一个重要的参数。它定义了模型更新权重的速率或幅度。...
```

## 26.6 批量推理与 left padding

单条推理浪费算力。batch 推理要处理「长度不一」：补到等长。

```
right padding（训练常用）       left padding（decoder 推理常用）
[问题A tokens][PAD][PAD]       [PAD][PAD][问题A tokens]
[问题B tokens][问题B tokens]   [问题B tokens][问题B tokens]
                 ↑ 生成从这里开始？错位          ↑ 生成从末尾开始 → 对齐
```

:::demo padding-side 交互：left vs right padding
切换 padding 方向，观察不同长度的 prompt 在 batch 中的对齐方式，以及生成位置是否一致。
:::

```python
tokenizer.padding_side = "left"        # decoder-only 推理惯例
batch = tokenizer(chats, return_tensors="pt", padding=True, truncation=True)
```

实测：`left pad shape: (2, 7)`，两个不同长度的 prompt 被补齐到 7；左对齐保证每个序列的**最后一个位置**都是真实的 prompt 末尾。

## 26.7 datasets：数据在生态里长什么样

```python
from datasets import Dataset

ds = Dataset.from_list(rows)                    # 或 load_dataset("json", data_files=...)
ds = ds.map(lambda ex: {"text": render(ex["messages"])})
ds = ds.filter(lambda ex: len(ex["text"]) > 10)
ds = ds.shuffle(seed=0)
split = ds.train_test_split(test_size=0.25, seed=0)
```

实测：2 条样本 `map` + `filter` 全部正常。注意 `map` 是**逐样本函数**——不要在 `map` 里加载模型（它会被每个样本调用一次）。

## 26.8 Data Collator：变长数据如何拼成 batch

LLM 的 batch 需要三样东西对齐：`input_ids` / `labels` / `attention_mask`。padding 规则：

- `input_ids`：短序列补 `pad_token_id`；
- `attention_mask`：真实 token 为 1，补位为 0；
- `labels`：补位和 prompt 部分都置 `-100`（交叉熵忽略）。

**response-only loss（SFT 的关键）**：只有 assistant 回复参与 loss，prompt 不参与。连接第 21 章 Loss Mask。

```python
input_ids = tokenizer.apply_chat_template(messages, tokenize=True)
prompt_ids = tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True)
labels = list(input_ids)
labels[:len(prompt_ids)] = [-100] * len(prompt_ids)     # 掩掉 prompt
```

实测：首条训练样本 `62 token`，其中参与 loss 的 assistant token = `25`。

## 26.9 PEFT / LoRA：接通第 17 章

```python
from peft import LoraConfig, get_peft_model

lora_cfg = LoraConfig(
    r=8, lora_alpha=16, lora_dropout=0.0,
    target_modules=["q_proj", "v_proj"],       # 注入哪些线性层
    task_type="CAUSAL_LM",
)
peft_model = get_peft_model(model, lora_cfg)
```

实测（Qwen2.5-0.5B）：

```
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%
```

**千分之一的可训练参数**——这就是第 17 章讲的 LoRA 在工程里的真实量级。

:::warning 真实的坑：PEFT 是「就地注入」
`get_peft_model(model)` 和 `PeftModel.from_pretrained(model, path)` 会**改造你传入的模型对象**（在目标层上包 LoRA 包装器）。

我们在项目里真实踩过：训练后拿同一个 `model` 变量当「base 基线」评测，测出来的其实是**带 adapter 的模型**——base 与 tuned 的 loss 完全相同（Δ=0.0000），差点写进报告。

正确做法：基线评测用**另一次干净加载**的模型：

```python
tuned_base = load_model(name)                      # 给 adapter
tuned_model = PeftModel.from_pretrained(tuned_base, out_dir)
clean_base = load_model(name)                      # 给基线
base_eval = eval_loss(clean_base, ...)             # 干净
tuned_eval = eval_loss(tuned_model, ...)           # 带 adapter
```
:::

## 26.10 save / load：base / adapter / merged 三者的区别

| 产物 | 大小（0.5B 例子） | 用途 |
| --- | --- | --- |
| base model | ~2GB（fp32）/ ~1GB（bf16） | 原始权重 |
| **adapter**（LoRA） | **几 MB ~ 几十 MB** | 训练产物；分享/切换成本极低 |
| merged model | 同 base 大小 | 合并后推理不带 PEFT 依赖，速度略快 |

本实验保存的就是 adapter（`outputs/lab_run/adapter_model.safetensors` + `adapter_config.json`），重新加载用：

```python
from peft import PeftModel
tuned = PeftModel.from_pretrained(load_model(name), "outputs/lab_run")
```

## 26.11 实战 Lab：hf-mini-lab（本课程已验证）

:::unfold 目标
用 Qwen2.5-0.5B-Instruct 在 CPU 上完整走一遍：加载 → Chat Template → logits → 批量生成 → response-only mask → LoRA 训练 → 保存 → 重载 → 评测对比 → 自动生成实验报告。
:::

**项目位置**：[`projects/hf-mini-lab/`](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab)

```bash
cd projects/hf-mini-lab
pip install -r requirements.txt
python scripts/run_lab.py          # 完整实验（CPU 约 1 分钟）
pytest -q
```

**实测结果**（真实运行记录）：

```
模型：Qwen/Qwen2.5-0.5B-Instruct | 494.0M 参数 | float32 | cpu
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%
训练 loss：2.6364 → 1.3052（60 步，batch 2，lr 2e-4，16 条样本）
held-out response-only loss：base=3.8168 → tuned=3.6102（Δ=-0.2065）
用时：60.2s（CPU）
pytest：10 passed
```

**生成对比**（held-out 问题，贪心解码）：

```
Q: 用一句话解释什么是 LayerNorm。
- base ： LayerNorm 是一种在深度学习中用于处理输入数据的标准化方法，它通过将每个样本的均值和方差进行归一化来减少模型中的梯度爆炸或消失问题，...
- tuned： LayerNorm 调整输入向量的均值和方差，使其分布近似于正态分布，从而消除层内各参数对输出噪声的影响。

Q: 用一句话解释什么是数据去重。
- base ： 数据去重是指从一组数据中去除重复的记录，确保每个数据项都是唯一的。...
- tuned： 数据去重就是消除前后一致的记录，让结果集更加干净和独立。
```

能看到 tuned 输出更接近训练数据的「一句话解释」风格——这就是 SFT 在真实模型上的效果。**但请注意**：16 条样本 / 60 步只够验证流程，不构成能力结论；正式实验需要更大数据、完整评测与 bad case 分析（Capstone 1 / 3）。

**项目结构**：

```text
hf-mini-lab/
├── configs/lora_sft.json     # dataclass + JSON 配置
├── data/sft_mini.jsonl       # 20 条教学数据（16 train / 4 eval）
├── src/hf_lab/
│   ├── config.py             # LabConfig dataclass
│   ├── loading.py            # tokenizer / model 加载
│   ├── chat.py               # Chat Template + left padding 批量生成
│   ├── data.py               # JSONL + response-only labels
│   ├── train.py              # 最小可读 LoRA 训练循环
│   └── evaluate.py           # eval loss + 生成对比
├── scripts/run_lab.py        # 8 步端到端 + 报告生成
└── tests/test_lab.py         # 10 个 pytest
```

:::note Checkpoint B 的验收问题
完成后你应能回答：
- `apply_chat_template` 生成的文本长什么样？`add_generation_prompt` 做了什么？
- 为什么 decoder-only 推理用 left padding？
- response-only loss 的 mask 是怎么构造的？为什么 prompt 部分置 `-100`？
- LoRA 可训练参数为什么只有 0.1%？`target_modules` 选的是哪两层？
- base 和 tuned 的 loss 怎么公平比较？（同一批 held-out + 同一 mask + 干净加载的 base）
:::

## 26.12 面试复盘：HuggingFace / 微调

1. `AutoTokenizer` 的 `padding` 和 `truncation` 分别解决什么问题？
2. Chat Template 错了会发生什么？为什么不能手拼特殊 token？
3. `logits.shape` 三个维度分别是什么？最后一维为什么可能大于词表？
4. `temperature=0` 和 `do_sample=False` 是什么关系？
5. 什么是 response-only loss？训练时为什么要 mask 掉 prompt？
6. LoRA 的 `r`、`alpha`、`target_modules` 分别影响什么？可训练参数占比怎么算？
7. base / adapter / merged 三种产物怎么选？
8. 为什么「训练 loss 下降」不代表「模型变好了」？（对照第 23 章评测）

:::quiz
你用 `PeftModel.from_pretrained(base, adapter_dir)` 重新加载了微调模型，准备与 base 做对比评测。以下哪种做法是正确的？

A. 直接评测 `base` 变量（它没被训练过，应该是干净的）
B. 重新加载一份干净模型作为 base 评测，因为 `from_pretrained` 已就地改造了 `base`
C. 只测 tuned，不测 base
D. 把 base 和 tuned 的 loss 四舍五入到小数点后一位再比较

答案: B
解析: PEFT 是就地注入——`base` 变量引用的模型对象已被装上 LoRA 包装器，直接评测会得到与 tuned 相同的结果（Δ=0.0000），这正是本项目真实踩过的坑。必须用另一次干净加载的模型当基线。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| Tokenizer | pad/truncate/attention_mask 三件套；Qwen 需手动设 pad_token |
| Chat Template | 永远用 `apply_chat_template`；格式错 = 分布偏移 |
| 加载 | dtype 控制显存；`trust_remote_code` 不要无脑开 |
| logits | [batch, seq, vocab]；输出维度可能 ≥ 词表 |
| generate | 参数对应第 9 章采样数学；评测用贪心 |
| 批量 | decoder 推理用 left padding |
| LoRA | 0.1% 参数量级；response-only loss 用 -100 掩 prompt |
| 陷阱 | PEFT 就地注入：基线必须干净加载 |
| 产物 | adapter 是最重要的交付物（几 MB） |
:::

:::related
依赖 | 第 6 章 Tokenizer, 第 9 章 GPT, 第 17 章 LoRA, 第 21 章 Loss Mask, 第 25 章 Python 工程
用于 | Capstone 1（Eval Harness）, Capstone 3（SFT/LoRA 实验）, 各类实习项目
:::
