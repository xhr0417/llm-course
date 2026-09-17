这页是第 26 章的查阅区。主线页面保留工作流地图与历史实测；这里集中放 API 细节、工程陷阱和面试复盘。完整 SFT/LoRA 实验记录在第 30 章。不要把旧 Guided Build 当当前作业。

## 26.3 Learn 参考手册：HuggingFace 工程细节

### 26.3.1 Tokenizer：模型与文本之间的唯一接口

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")
ids = tokenizer("你好，世界", add_special_tokens=False)["input_ids"]
text = tokenizer.decode(ids)
```

| 概念 | 作用 | 常见错误 |
| --- | --- | --- |
| `padding` | 把不同长度的序列补到等长 | 没有设置 `pad_token` |
| `truncation` | 截断超长序列 | 不截断导致显存或上下文溢出 |
| `attention_mask` | 标记真实 token 与 padding | 忘记传给模型 |

Qwen 没有 pad token 时，通常用 `tokenizer.pad_token = tokenizer.eos_token` 兜底。模型文件进入 HuggingFace 缓存，不进入 repo。

### 26.3.2 Chat Template

模型看到的不是 `{"role": "user"}` 字典，而是模板渲染后的特殊 token 文本：

```python
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)
```

:::demo chat-template 交互：messages → 渲染文本 → token
切换模型模板格式（ChatML / Llama），观察特殊 token 如何包裹每轮对话。
:::

工程纪律：永远用 `apply_chat_template`，不要手拼 ChatML。推理和训练必须使用一致的模板。

### 26.3.3 AutoModelForCausalLM 与显存

```python
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-0.5B-Instruct",
    dtype=torch.float32,
)
model.to("cpu")
model.eval()
```

0.5B fp32 权重约 2GB。`dtype` 决定精度和内存，`device_map` 决定设备分配，`trust_remote_code` 不应无脑开启。

### 26.3.4 logits 与 generate

`logits` 形状是 `[batch, seq, vocab]`，`logits[0, -1]` 是下一个 token 的分数。输出维度可能大于 `tokenizer.vocab_size`，不要用相等断言。

```python
with torch.no_grad():
    logits = model(**enc).logits

output = model.generate(
    **enc,
    max_new_tokens=64,
    do_sample=False,
    pad_token_id=tokenizer.pad_token_id,
)
```

### 26.3.5 批量推理与 left padding

:::demo padding-side 交互：left vs right padding
切换 padding 方向，观察不同长度的 prompt 在 batch 中的对齐方式，以及生成位置是否一致。
:::

decoder-only 模型批量推理通常使用 left padding：

```python
tokenizer.padding_side = "left"
batch = tokenizer(chats, return_tensors="pt", padding=True, truncation=True)
output = model.generate(**batch, pad_token_id=tokenizer.pad_token_id)
generated = output[:, batch["input_ids"].shape[1]:]
```

生成结果只解码新增 token，不要把 prompt 一起解码。

### 26.3.6 数据与 Data Collator

SFT batch 中必须同步构造三项：

- `input_ids`：短序列补 `pad_token_id`；
- `attention_mask`：真实 token 为 1，补位为 0；
- `labels`：padding 和 prompt 部分置 `-100`。

`-100` 是 PyTorch 交叉熵的 `ignore_index`，因此 response-only loss 只训练 assistant 回复。数据 split 要尊重已有的 `split` 字段；随机兜底必须固定 seed。

### 26.3.7 PEFT / LoRA：算法方向的延伸

LoRA 的 `r`、`alpha`、`dropout` 和 `target_modules` 都是实验配置，不存在对所有任务都最优的一组值。Qwen2.5-0.5B 的起步配置通常只训练约 0.1% 参数。

```python
lora_cfg = LoraConfig(
    r=8,
    lora_alpha=16,
    lora_dropout=0.0,
    target_modules=["q_proj", "v_proj"],
    task_type="CAUSAL_LM",
)
peft_model = get_peft_model(model, lora_cfg)
```

详细的 response-only loss、训练曲线、best/final checkpoint 和 Base–Best–Final 公平评测，进入[第 30 章 SFT / LoRA 实验](#/capstone-sft)。第 26 章只保留让你跑通生态和理解接口所需的最小闭环。

### 26.3.8 save / load：base、adapter、merged

| 产物 | 用途 |
| --- | --- |
| base model | 原始权重，体积最大 |
| adapter | LoRA 训练产物，适合交付和切换 |
| merged model | 合并后推理，不依赖 PEFT，但体积接近 base |

PEFT 会就地改造传入的模型对象。Base vs tuned 评测必须重新加载一份干净 base：

```python
tuned_base = load_model(name)
tuned_model = PeftModel.from_pretrained(tuned_base, adapter_dir)
clean_base = load_model(name)
```

## 26.4 可选参考实现（非当前作业）

完整工程：[projects/hf-mini-lab](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab)

```bash
# 仅在你明确要对照历史实现时使用
cd projects/hf-mini-lab
pip install -r requirements.txt
python scripts/run_lab.py
pytest -q
```

**生成对比**（held-out 问题，贪心解码，参考实现的真实输出）：

```
Q: 用一句话解释什么是 LayerNorm。
- base ： LayerNorm 是一种在深度学习中用于处理输入数据的标准化方法，它通过将每个样本的均值和方差进行归一化来减少模型中的梯度爆炸或消失问题，...
- tuned： LayerNorm 调整输入向量的均值和方差，使其分布近似于正态分布，从而消除层内各参数对输出噪声的影响。

Q: 用一句话解释什么是数据去重。
- base ： 数据去重是指从一组数据中去除重复的记录，确保每个数据项都是唯一的。...
- tuned： 数据去重就是消除前后一致的记录，让结果集更加干净和独立。
```

能看到 tuned 输出更接近训练数据的「一句话解释」风格；16 条样本 / 60 步只够验证流程，不构成能力结论。

参考实现用于对照「工作流每一层写在哪」，不是当前 starter 作业。完整算法实验记录请读第 30 章。

## 26.5 面试复盘：HuggingFace / 微调

1. `padding`、`truncation` 和 `attention_mask` 分别解决什么问题？
2. Chat Template 错了会发生什么？为什么不能手拼特殊 token？
3. `logits.shape` 的三个维度分别是什么？最后一维为什么可能大于词表？
4. `temperature`、`top_p` 和 `do_sample` 如何影响生成？
5. response-only loss 为什么要把 prompt 置为 `-100`？
6. LoRA 的 `r`、`alpha` 和 `target_modules` 分别影响什么？
7. 为什么 Base vs tuned 评测必须使用干净加载的 base？
8. 训练 loss 下降为什么不等于模型在 held-out 上变好？
9. left padding 的 batch 里，最后一个位置一定是真实 token 吗？为什么？
10. PEFT 就地注入 bug：怎么触发、除 Δ=0.0000 外还有什么发现信号、怎么修复？

:::quiz
你用 `PeftModel.from_pretrained(base, adapter_dir)` 重新加载了微调模型，准备与 base 做对比评测。以下哪种做法是正确的？

A. 直接评测 `base` 变量（它没被训练过，应该是干净的）
B. 重新加载一份干净模型作为 base 评测，因为 `from_pretrained` 已就地改造了 `base`
C. 只测 tuned，不测 base
D. 把 base 和 tuned 的 loss 四舍五入到小数点后一位再比较

答案: B
解析: PEFT 是就地注入——`base` 变量引用的模型对象已被装上 LoRA 包装器，直接评测会得到与 tuned 相同的结果（Δ=0.0000），这是当时真实踩过的坑。必须用另一次干净加载的模型当基线。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| Tokenizer | pad / truncate / attention_mask 三件套 |
| Chat Template | 永远用 `apply_chat_template` |
| 批量推理 | decoder-only 通常用 left padding |
| SFT | prompt 置 `-100`，只计算 response loss |
| LoRA | adapter 是最重要的轻量交付物 |
| 评测 | 同一 held-out、同一模板、干净 base |
:::

:::related
依赖 | 第 6 章 Tokenizer, 第 9 章 GPT, 第 17 章 LoRA, 第 21 章 Loss Mask
用于 | 第 30 章 SFT / LoRA 实验记录, 第 27 章评测分层
:::
