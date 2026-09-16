# 第 26 章 · HuggingFace for LLM Engineering：从 0 跑通一个真正的 LLM Workflow

:::intuition 一句话
你已经知道 Transformer 内部长什么样（第 7 章）——现在要**亲手**用工业生态跑一个真正的 LLM workflow：加载 Qwen、渲染 Chat Template、看 logits、批量生成、构造 response-only loss、注入 LoRA、训练、保存、重载、对比评测。
:::

:::warning 本章代码全部真实运行过
模型：`Qwen/Qwen2.5-0.5B-Instruct`（CPU，fp32）。页面中的数字（形状、参数量、loss、生成结果）都来自 [`projects/hf-mini-lab/`](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab) 的实测输出。
tests 用 tiny 模型（`trl-internal-testing/tiny-Qwen2ForCausalLM-2.5`）保证速度；最终实验用真实 Qwen 模型。
:::

:::warning 这一章的模式：Learn → Guided Build → Reference
| 层级 | 你获得什么 | 在哪里 |
| --- | --- | --- |
| **Level 1 · Learn** | Tokenizer / Chat Template / logits / generate / LoRA 的原理与工程细节 | 26.3 参考手册 + 各 Step 知识盒 |
| **Level 2 · Guided Build** | 不完整的 starter + 13 步任务 + 38 个分步测试 | `projects/hf-mini-lab/starter/`（26.2 Lab） |
| **Level 3 · Reference Solution** | 完整实验工程（做完后再对照） | `projects/hf-mini-lab/`（26.4） |

**完成的定义**：starter 的 38 个测试全绿 + 用真实 Qwen 模型跑完 `run_lab.py` 得到你自己的 report.md + 能回答 Step 12 的复盘问题。
:::

## 26.1 本章怎么学

这一章不是「读一遍 API 文档」，而是把一个真实 LLM 工程的每一层**亲手写出来**：

```
Step 0   环境与第一次 pytest（38 failed）
Step 1   Tokenizer：encode / decode
Step 2   Chat Template：先跑错的方式，再对比正确渲染
Step 3   加载模型：先预测参数量与内存，再验证
Step 4   logits：先预测 shape，再看真实张量（连接第 9 章）
Step 5   批量生成：两个不同长度的 prompt → padding 问题
Step 6   JSONL 数据：load / split / map
Step 7   Response-only loss：第一版不做 mask，观察 prompt 也参与 loss 的后果
Step 8   LoRA：r / alpha / target_modules，打印可训练参数占比
Step 9   真正训练：短训练，记录 loss
Step 10  保存与重载 adapter：必须用干净模型实例
Step 11  PEFT 就地注入 bug（本项目真实踩过的坑）
Step 12  Base vs Tuned 评测：产出你自己的 experiment report
```

每个 Step 的循环都是：**预测 → 你来写 → 运行 → （失败）→ 观察 → 修复 → 测试 → 解释**。

## 26.2 项目：hf-mini-lab（Guided Build）

**项目目标**：用 Qwen2.5-0.5B-Instruct 在 CPU 上完整走一遍
**加载 → Chat Template → logits → 批量生成 → response-only mask → LoRA 训练 → 保存 → 重载 → 评测对比 → 实验报告**。

参考实现的真实运行记录（你做完后会得到自己的数字）：

```
模型：Qwen/Qwen2.5-0.5B-Instruct | 494.0M 参数 | float32 | cpu
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%
训练 loss：2.6364 → 1.3052（60 步，batch 2，lr 2e-4，16 条样本）
held-out response-only loss：base=3.8168 → tuned=3.6102（Δ=-0.2065）
用时：60.2s（CPU）| pytest：11 passed
```

:::lab hf-mini-lab · Guided Build
goal: 亲手实现完整 HF workflow：tokenizer → chat template → logits → generate → labels → LoRA → train → save/load → 评测报告
project: projects/hf-mini-lab/starter
effort: 3–5 小时（每个 Step 10–30 分钟）
prereq: 第 7/9/17 章概念 + 第 25 章工程习惯；能装 torch/transformers/peft（CPU 即可）
deliverable: 38 测试全绿 + 用真实 Qwen 跑出的 outputs/ 实验报告（adapter + report.md）

:::where
机器：pytest（tiny 模型）🖥 Mac / ☁ Server 都可以；真实 Qwen 实验（Step 12 的 run_lab）☁ Server 优先
执行纪律：`pip install` 和 `pytest` 必须在同一台机器上执行；换机器要重新装依赖
Repo Root：你 clone 的 llm-course 目录（`pwd` 确认）
Starter：projects/hf-mini-lab/starter（你写代码的地方）
Reference：projects/hf-mini-lab（完整实现 + run_lab.py，做完再对照）
模型缓存：**不在 repo**——HuggingFace 缓存目录（`echo $HF_HOME` 查看；要放大盘先 export HF_HOME）
大文件：模型权重 ~2GB 默认进缓存；repo 里只放代码 / 小数据 / 小报告
GitHub：先 `git status`；模型、缓存、outputs 不动，只提交 src/ tests/ configs/ data/ 等小文件
:::

:::step 0 环境与模型选择
:::goal
在一台明确的机器上把 starter 跑起来，看到 38 failed——并且选好本章使用的模型。
:::

:::why
HF 生态第一个工程决策不是代码，而是**模型选择**：参数量决定了你的显存/内存、加载时间和实验可行性。
本章全程用 `Qwen/Qwen2.5-0.5B-Instruct`：中文能力好、0.5B 在 CPU 上可跑、有完整的 ChatML 模板。
不要换成更大的模型——第一段实习的项目标准是「别人能复现」，不是「参数越大越厉害」。

本章和第 25 章的「在哪台机器 / 哪个目录执行」规则完全一样（如果你跳过了第 25 章：
先读它 Step 0 的心智模型，或看文档 [docs/ENVIRONMENT_AND_WORKFLOW.md](https://github.com/xhr0417/llm-course/blob/main/docs/ENVIRONMENT_AND_WORKFLOW.md)）。
本章多出来的一件事是：**模型文件不放在 repo 里，而是下载进 HuggingFace 缓存**——见下方知识盒。
:::

:::note 模型文件下载到哪里？（第一次接触一定会问）
运行 `from_pretrained(...)` 时，模型进入 **HuggingFace 缓存目录**，不是 `projects/hf-mini-lab/`：

- 查看缓存位置：`echo $HF_HOME`（为空则使用默认用户缓存目录）；
- 想把缓存放到大盘（例如服务器）：`export HF_HOME=~/models/huggingface`（路径要先存在且有写权限）；
- 下载前先看磁盘：`df -h`（剩余空间）、`du -sh ~/models 2>/dev/null`（已占用）。

因此你跑完实验后 `git status` 不应该、也不会看到模型权重——它们不在 repo 里，不需要提交。
:::

:::files
starter/
├── README.md            # Step → 测试表（先读）
├── requirements.txt     # torch / transformers / peft / datasets / pytest
├── configs/lora_sft.json
├── data/sft_mini.jsonl  # 20 条教学数据（16 train / 4 eval）
├── src/hf_lab/          # ← 你要写代码的地方
└── tests/               # 38 个测试，按 Step 拆成 12 个文件
:::

:::run 🖥 Mac / ☁ Linux Server（tiny 测试任选一台；真实 Qwen 实验见 Step 12）
```bash
# 【确认你在哪】提示符 yourname@MacBook ~ % = Mac；user@ubuntu:~$ = 服务器
hostname
pwd

# 【回到 repo root】已有 clone 的情况（还没有 clone 就按根 README Quick Start 做一次）
cd "$(git rev-parse --show-toplevel)"
pwd

# 【进入 starter】
cd projects/hf-mini-lab/starter
pwd        # 必须以 llm-course/projects/hf-mini-lab/starter 结尾；不是就先别继续

# 【装依赖 + 第一次运行】在哪台机器跑 pytest，就在哪台机器装
pip install -r requirements.txt
pytest -q
```
:::

:::expect
```
38 failed
```
（真实记录：本课程实测 `38 failed in ~30s`；首次运行会下载 tiny 测试模型（几 MB，进 HF 缓存），之后走本地缓存。）
:::

:::fail
- 没有网络 / 下载失败 → 先单独跑 `python -c "from transformers import AutoTokenizer; AutoTokenizer.from_pretrained('trl-internal-testing/tiny-Qwen2ForCausalLM-2.5')"` 定位网络问题；
- 想跳过模型测试先写代码 → `RUN_MODEL_TESTS=0 pytest -q`（7 failed / 31 skipped，仍然是红）；
- 显存/内存不够 → 确认你用的是 tiny 模型跑测试；真实 Qwen 0.5B fp32 需要约 2GB 内存。
:::

:::hint Hint 1
CPU 完全够用：0.5B fp32 约 2GB 内存，加载约 3 秒，60 步 LoRA 训练约 1 分钟。
:::

:::hint Hint 2
测试和最终实验用的是两个模型：
- 测试：tiny 模型（秒级）；
- 实验：`run_lab.py` 默认 Qwen2.5-0.5B-Instruct。
不要为了让测试快而把 run_lab 改成 tiny——那只能验证流程，得不到真实数字。
:::

:::checkpoint
你知道本章为什么选 0.5B 模型，并且看到了 38 failed 的完整清单。
:::

:::explain
- 为什么「模型选择」是 LLM 工程的第一个决策？参数量、精度（fp32/fp16）、设备（CPU/GPU）分别影响什么？
- 模型文件下载到了哪里？为什么 `git status` 里看不到它们、也不需要提交？
- 你现在运行 `pytest` 的这台机器是 Mac 还是服务器？如果 Step 12 要在另一台机器跑真实实验，需要做什么准备？
:::
:::

:::step 1 Tokenizer：encode / decode
:::goal
实现 `load_tokenizer()`：加载 Qwen 的 tokenizer，处理 `pad_token` 缺失，并验证 encode/decode 往返。
:::

:::why
Tokenizer 是模型与文本之间的唯一接口。第 6 章你亲手训过 BPE；工业生态里直接加载现成的——
但两个坑必须处理：**很多 LLM 没有 pad_token**；**词表大小和你想的不一样**。
:::

:::files
要改的文件：`src/hf_lab/loading.py`（函数 `load_tokenizer`）
:::

:::note Tokenizer 三件套
| 概念 | 作用 | 常见错误 |
| --- | --- | --- |
| `padding` | 把不同长度的序列补到等长（batch 推理必需） | 不设 `pad_token`（很多 LLM 默认没有 pad） |
| `truncation` | 超长序列截断 | 不截断 → 显存爆炸 |
| `attention_mask` | 标记哪些位置是真实 token（1）/ padding（0） | 忘记传给模型 → 模型 attend 到 pad |

Qwen 的实测值：`vocab=151643`，`pad=<|endoftext|>`（用 `tokenizer.pad_token = tokenizer.eos_token` 兜底，这是标准做法）。
:::

:::write
**你来写**（`loading.py`）：

- TODO 1：`AutoTokenizer.from_pretrained(model_name)`；
- TODO 2：`if tokenizer.pad_token is None: tokenizer.pad_token = tokenizer.eos_token`；
- TODO 3：`logger.info` 打印 vocab 与 pad（调试时的第一手信息）。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step1_tokenizer.py
```
:::

:::expect
```
3 passed
```
:::

:::fail
- `AttributeError: pad_token` 相关 → 你跳过了 None 检查；
- encode/decode 往返失败 → 注意 `add_special_tokens=False` 时往返才严格相等（测试用的就是它）。
:::

:::hint Hint 1
`tokenizer("你好，世界", add_special_tokens=False)["input_ids"]` 是 encode；
`tokenizer.decode(ids)` 是 decode。
:::

:::hint Hint 2
`pad_token_id` 在 batch 编码时用来填充。Qwen 默认没有 pad——这是「事实」，不是 bug，
所以第一步就要处理它，否则 Step 5 的批量生成会静默出错。
:::

:::solution
```python
def load_tokenizer(model_name: str):
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    logger.info("tokenizer 加载完成：vocab=%d pad=%s", tokenizer.vocab_size, tokenizer.pad_token)
    return tokenizer
```
:::

:::checkpoint
`pytest -q tests/test_step1_tokenizer.py` → 3 passed。你能解释为什么 Qwen 需要 pad_token 兜底。
:::

:::explain
- padding / truncation / attention_mask 分别解决什么问题？
- 为什么 `decode(encode(x)) == x` 在 `add_special_tokens=True` 时可能不成立？
:::
:::

:::step 2 Chat Template：先看错误做法，再对比正确渲染
:::goal
实现 `render_chat()` 与 `show_template()`；亲手对比「直接把 user 文本喂 tokenizer」和「apply_chat_template」的区别。
:::

:::why
模型看到的不是 `{"role": "user"}` 这种字典——**模板把它渲染成一段带特殊 token 的文本**。
训练数据是这样，推理时也必须这样。如果格式不一致，分布偏移，模型可能答非所问、不停顿、或复读。
:::

:::files
要改的文件：`src/hf_lab/chat.py`（`render_chat` / `show_template`）
:::

:::predict
先预测，再运行（两个实验都要做）：
```python
# 错误做法的预览（你在 python REPL 里跑）
plain = tokenizer("什么是过拟合？")["input_ids"]
print(len(plain))

# 正确做法
text = tokenizer.apply_chat_template(
    [{"role": "user", "content": "什么是过拟合？"}],
    tokenize=False, add_generation_prompt=True,
)
print(repr(text))
```
问题：正确的渲染文本会比 `plain` 长多少？多出来的 token 是什么？
:::

:::note Qwen 的 ChatML 模板（实测渲染结果）
```
<|im_start|>system
You are Qwen, created by Alibaba Cloud. You are a helpful assistant.<|im_end|>
<|im_start|>user
什么是过拟合？<|im_end|>
<|im_start|>assistant
```
`add_generation_prompt=True` 的作用：末尾补上 `<|im_start|>assistant\n`，告诉模型「该你说了」。

**工程纪律：永远用 `apply_chat_template`，不要手拼 ChatML 字符串。**
:::

:::write
**你来写**（`chat.py`）：

- TODO 1：`render_chat(tokenizer, messages, add_generation_prompt=True)`——
  `apply_chat_template(messages, tokenize=False, add_generation_prompt=...)`；
- TODO 2：`show_template(tokenizer, messages)`——打印 messages、渲染后文本（`repr`）、前 40 个 token ids；
- TODO 3：自己在终端运行一次 `show_template`，把「错误做法 vs 正确做法」的 token 数对比记下来。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step2_chat_template.py
python -c "
from hf_lab.loading import load_tokenizer
from hf_lab.chat import show_template
tok = load_tokenizer('trl-internal-testing/tiny-Qwen2ForCausalLM-2.5')
show_template(tok, [{'role':'user','content':'你好'}])
"
```
:::

:::expect
```
5 passed
```
以及终端里真正的模板文本与 token ids。
:::

:::fail
- 找不到 `<|im_start|>user` → 你可能用了错误的 tokenize 参数（本函数必须 `tokenize=False`）；
- 渲染结果没有结尾的 assistant 标记 → `add_generation_prompt` 没传或传了 False（默认必须是 True）。
:::

:::hint Hint 1
`apply_chat_template` 的三种用法要分清：
`tokenize=False` 返回字符串（本步）；`tokenize=True` 返回 ids；`return_dict=True` 返回可喂给模型的 dict。
:::

:::hint Hint 2
测试会断言渲染文本以 `<|im_start|>assistant` 结尾（去掉尾部空白后）——
如果失败，把 `repr(text)` 打印出来看看尾部到底有什么。
:::

:::solution
```python
def render_chat(tokenizer, messages, add_generation_prompt: bool = True) -> str:
    return tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=add_generation_prompt
    )
```
:::

:::checkpoint
5 passed，并且你能展示「直接 tokenizer(text)」的 ids 与「模板渲染后」的 ids 的差异。
:::

:::explain
- 如果推理时少拼一个 `<|im_end|>`，模型的行为可能怎么变化？
- 为什么说「手拼特殊 token」是工程事故的常见来源？
:::
:::

:::step 3 加载模型：先预测参数量与内存量级
:::goal
实现 `load_model()`；先预测 Qwen2.5-0.5B 的参数量和 fp32 内存，再看真实值。
:::

:::why
参数量 → 内存/显存 → 你能不能用这台机器做实验。这是第 14 章显存估算的日常应用，
也是面试里「你怎么选模型」的标准回答起点。
:::

:::files
要改的文件：`src/hf_lab/loading.py`（函数 `load_model`）
:::

:::predict
动手前先算（写在纸上）：
1. 「0.5B」模型的参数量大概是多少？（到百万为止）
2. fp32 每个参数 4 字节 → 权重需要多少内存？
3. 加载需要多久？（你可以先猜 1 秒 / 10 秒 / 1 分钟）

参考实测：`494.0M 参数`，fp32 权重约 2GB，CPU 加载约 3 秒。
:::

:::note dtype 与设备的三个选择
```python
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-0.5B-Instruct",
    dtype=torch.float32,       # 或 bfloat16 / float16（第 17 章）
)
model.to("cpu")                # 或 "cuda" / device_map="auto"
```
| 参数 | 含义 | 注意 |
| --- | --- | --- |
| `dtype` | 权重精度 | fp32 精确但费内存；bf16 训练推理常用 |
| `device_map` | 多设备分配（`"auto"` 自动切分） | 单卡小模型不需要 |
| `trust_remote_code` | 允许执行仓库自带代码 | 不要无脑 True：那是在执行第三方代码 |
:::

:::write
**你来写**（`loading.py`）：

- TODO 1：用 `_DTYPES` 把字符串 dtype 映射成 torch dtype；
- TODO 2：`AutoModelForCausalLM.from_pretrained(model_name, dtype=torch_dtype)`；
- TODO 3：`model.to(device)` + `model.eval()`；
- TODO 4：统计参数量并 `logger.info` 打印（`sum(p.numel() for p in model.parameters())`）。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step3_model.py
```
:::

:::expect
```
3 passed
```
测试用 tiny 模型验证「eval 模式 / 参数量 / 设备 / dtype」；真实数字请看 Step 12 的 run_lab 输出。
:::

:::fail
- `eval()` 相关失败 → 加载完必须切评估模式（dropout 等行为在训练/推理不同）；
- dtype 不是 float32 → 检查 `_DTYPES` 映射是否真的用上了。
:::

:::hint Hint 1
`next(model.parameters()).device` 可以拿到模型所在设备；
`sum(p.numel() for p in model.parameters())` 是参数量。
:::

:::hint Hint 2
`model.eval()` 对评估是必须的：它关闭 Dropout、固定 LayerNorm 行为。
忘记它会让你的 eval loss 每次都不一样。
:::

:::solution
```python
def load_model(model_name: str, dtype: str = "float32", device: str = "cpu"):
    torch_dtype = _DTYPES.get(dtype, torch.float32)
    model = AutoModelForCausalLM.from_pretrained(model_name, dtype=torch_dtype)
    model.to(device)
    model.eval()
    n_params = sum(p.numel() for p in model.parameters())
    logger.info("模型加载完成：%s | %.1fM 参数 | %s | %s", model_name, n_params / 1e6, dtype, device)
    return model
```
:::

:::checkpoint
3 passed；你的参数量预测和实测（tiny 模型）对齐，并知道真实 Qwen 是 494.0M。
:::

:::explain
- 0.5B fp32 与 bf16 的权重内存分别是多少？训练时还要额外占什么（优化器状态、梯度、激活）？
- 为什么 `model.eval()` 影响评测结果的稳定性？
:::
:::

:::step 4 logits：先预测 shape，再看张量
:::goal
实现 `next_token_logits()`；先预测形状，再运行真实模型验证——把第 9 章的符号和工业代码对上。
:::

:::why
`logits[0, -1]` 就是「下一个 token 的未归一化分数」，softmax 之后就是概率分布。
第 9 章推的每一个符号，在工业代码里就是这个张量——这是从「学过」到「用过」的关键一步。
:::

:::files
要改的文件：`src/hf_lab/chat.py`（函数 `next_token_logits`）
:::

:::predict
如果 `input_ids` 的形状是 `(1, 27)`、vocab 约 150k，`logits` 应该是什么 shape？
先写答案，再运行。
:::

:::note 实测输出（Qwen2.5-0.5B）
```
input_ids: (1, 27) → logits: (1, 27, 151936)
最后一位置 top-5 token id: [151644, 151645, 151657, 151658, 68728]
```
形状是 `[batch, seq, vocab]`。注意 detail：`logits.shape[-1] = 151936` 而 `tokenizer.vocab_size = 151643`——
输出维度是 `config.vocab_size`，可能因并行/对齐被 pad 到更大。**不要假设两者相等**（测试用 `>=` 断言，这是真实踩过的坑）。
:::

:::write
**你来写**（`chat.py`）：

- TODO 1：`apply_chat_template(messages, tokenize=True, return_dict=True, return_tensors="pt")` 得到模型输入；
- TODO 2：`model(**enc).logits` 返回 logits 张量；
- TODO 3：确保函数返回 shape 为 `(1, seq, vocab)` 的张量。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step4_logits.py
```
:::

:::expect
```
2 passed
```
:::

:::fail
- 返回值是 `CausalLMOutput` 而不是张量 → 忘了 `.logits`；
- seq 维度对不上 → 你用了 `tokenize=False` 的文本再手动编码，两段 token 数可能不同；
- vocab 断言失败 → 你写了 `==`（应该 `>=`，见知识盒）。
:::

:::hint Hint 1
`return_dict=True, return_tensors="pt"` 之后可以直接 `model(**enc)`；
注意 `enc` 里通常还带 `attention_mask`，一起传进去。
:::

:::hint Hint 2
想验证「下一个 token」的语义：对 `logits[0, -1]` 做 topk 看 id，再 `tokenizer.decode` 出来——
你会看到「你好」之后模型最想接的词。
:::

:::solution
```python
def next_token_logits(tokenizer, model, messages):
    enc = tokenizer.apply_chat_template(
        messages, tokenize=True, return_dict=True, return_tensors="pt"
    )
    with torch.no_grad():
        logits = model(**enc).logits
    return logits
```
:::

:::checkpoint
2 passed；你能解释三个维度的含义，并说出为什么 vocab 维可能大于词表。
:::

:::explain
- `logits[0, -1]` 与 `logits[0, 5]` 分别是什么含义？
- 为什么评测代码里要 `torch.no_grad()`？
:::
:::

:::step 5 批量生成：两个不同长度的 prompt 引出 padding 问题
:::goal
实现 `batch_generate()`：让两个不同长度的 prompt 组成 batch，处理 padding 对齐，并只解码新 token。
:::

:::why
单条推理浪费算力；真实评测/服务都要批量。batch 的第一步就是「变长序列补到等长」——
补在哪一侧，直接决定 decoder-only 模型的生成结果对不对。这是最容易被忽视、又一定会在面试里被问的细节。
:::

:::files
要改的文件：`src/hf_lab/chat.py`（函数 `batch_generate`）
:::

:::predict
两个 prompt：「什么是学习率？」（短）和「什么是 KV Cache？请详细解释。」（长）。
组成 batch 后：
1. 短的那条会被补 PAD 到和长的一样长——PAD 补在左边还是右边？
2. 生成时从哪个位置开始解码？如果补在右边，会不会把 PAD 当成 prompt 的一部分？
先写下你的答案，再看知识盒。
:::

:::note left padding vs right padding
```
right padding（训练常用）       left padding（decoder 推理常用）
[问题A tokens][PAD][PAD]       [PAD][PAD][问题A tokens]
[问题B tokens][问题B tokens]   [问题B tokens][问题B tokens]
                 ↑ 生成从这里开始？错位          ↑ 生成从末尾开始 → 对齐
```
decoder-only 推理惯例是 **left padding**：
```python
tokenizer.padding_side = "left"        # 关键一行
batch = tokenizer(chats, return_tensors="pt", padding=True, truncation=True)
output = model.generate(**batch, max_new_tokens=..., do_sample=False, pad_token_id=tokenizer.pad_token_id)
generated = output[:, batch["input_ids"].shape[1]:]     # 只取新生成的 token
```
实测：`left pad shape: (2, 7)`——两个不同长度的 prompt 被补齐到 7，
每个序列的**最后一个位置**都是真实的 prompt 末尾，生成从这里开始才对。
:::

:::write
**你来写**（`chat.py`）：

- TODO 1：`tokenizer.padding_side = "left"`；
- TODO 2：对每个 prompt 先 `render_chat`，再整批 `tokenizer(chats, return_tensors="pt", padding=True, truncation=True, max_length=512)`；
- TODO 3：`model.generate(**batch, max_new_tokens=..., do_sample=False, pad_token_id=tokenizer.pad_token_id)`；
- TODO 4：切片 `output[:, batch["input_ids"].shape[1]:]` 再 `batch_decode(..., skip_special_tokens=True)`。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step5_generate.py
```
:::

:::expect
```
3 passed
```
:::

:::fail
- 生成的回答里包含问题本身（复读）→ 你忘了切片，把 prompt 也 decode 出来了；
- 输出里混着 `<|im_end|>` 之类 → 忘了 `skip_special_tokens=True`；
- 生成结果里出现奇怪的重复 → padding_side 不是 left，PAD 参与了注意力。
:::

:::hint Hint 1
`batch["input_ids"].shape[1]` 是 batch 编码后的序列长度（含 padding），新 token 从这里开始。
:::

:::hint Hint 2
`generate` 的 `pad_token_id` 必须显式传——否则很多模型会警告或行为不一致。
:::

:::solution
```python
def batch_generate(tokenizer, model, prompts, max_new_tokens: int = 64):
    tokenizer.padding_side = "left"
    chats = [render_chat(tokenizer, [{"role": "user", "content": p}]) for p in prompts]
    batch = tokenizer(chats, return_tensors="pt", padding=True, truncation=True, max_length=512)
    batch = {k: v.to(model.device) for k, v in batch.items()}
    with torch.no_grad():
        output = model.generate(
            **batch, max_new_tokens=max_new_tokens,
            do_sample=False, pad_token_id=tokenizer.pad_token_id,
        )
    generated = output[:, batch["input_ids"].shape[1]:]
    return tokenizer.batch_decode(generated, skip_special_tokens=True)
```
:::

:::checkpoint
3 passed；你能画出 left/right padding 的差异图并解释为什么推理用 left。
:::

:::explain
- 训练为什么常用 right padding，而 decoder-only 推理用 left padding？（提示：teacher forcing 的位置对齐 vs 生成起点）
- `do_sample=False` 对应第 9 章的哪种解码策略？
:::
:::

:::step 6 加载 JSONL Instruction Dataset
:::goal
实现 `load_jsonl()` 与 `split_dataset()`：读入指令数据、按 split 字段切分（没有字段时随机兜底）。
:::

:::why
SFT 的数据格式就是 `messages` 列表。第 25 章的 JSONL 知识在这里第一次用于真实 LLM 数据；
「训练/评估怎么切分」直接决定你后面的对比评测是否可信。
:::

:::files
要改的文件：`src/hf_lab/data.py`（`load_jsonl` / `split_dataset`）
:::

:::note 数据长这样（data/sft_mini.jsonl，20 条：16 train / 4 eval）
```json
{"split": "train", "messages": [{"role": "user", "content": "用一句话解释什么是过拟合。"}, {"role": "assistant", "content": "过拟合是模型把训练数据的噪声也记住了，导致在新数据上表现变差。"}]}
```
切分纪律：
- 数据**自带** `split` 字段 → 尊重它（教学数据这样设计，保证 eval 是 held-out）；
- 没有该字段 → 按 `eval_ratio` 随机切分，**seed 必须固定**（可复现是实验的基本要求）。
:::

:::write
**你来写**（`data.py`）：

- TODO 1：`load_jsonl(path)`——逐行 `json.loads`，跳过空行；
- TODO 2：`split_dataset(rows, eval_ratio=0.25, seed=0)`——优先按行内 `split` 字段；否则 `random.Random(seed)` 洗牌切分；
- TODO 3：返回的**元素是 `row["messages"]`**，不是整行 dict。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step6_data.py
```
:::

:::expect
```
4 passed
```
:::

:::fail
- 返回长度不是 16/4 → 你把整行 dict 当成元素了，或没走到 split 字段分支；
- 随机兜底不可复现 → 用了全局 `random.shuffle` 而不是 `random.Random(seed)`。
:::

:::hint Hint 1
判断「是否所有行都有 split」：`all("split" in row for row in rows)`。
:::

:::hint Hint 2
随机兜底时先浅拷贝再洗牌（别改调用方的列表），切出前 `n_eval = max(1, int(len(rows) * eval_ratio))` 条做 eval。
:::

:::solution
```python
def split_dataset(rows, eval_ratio: float = 0.25, seed: int = 0):
    if rows and all("split" in row for row in rows):
        train = [row["messages"] for row in rows if row["split"] == "train"]
        eval_ = [row["messages"] for row in rows if row["split"] == "eval"]
        return train, eval_
    rng = random.Random(seed)
    shuffled = rows[:]
    rng.shuffle(shuffled)
    n_eval = max(1, int(len(shuffled) * eval_ratio))
    return [r["messages"] for r in shuffled[n_eval:]], [r["messages"] for r in shuffled[:n_eval]]
```
:::

:::checkpoint
4 passed；你能解释「为什么必须尊重数据自带 split」。
:::

:::explain
- 如果 eval 数据混进了 train，你的 held-out loss 会怎么变化？结论会怎么错？
- 为什么随机切分要固定 seed？seed 变了影响什么？
:::
:::

:::step 7 Response-only Loss：第一版不做 mask，观察后果
:::goal
实现 `build_labels()` / `encode_batch()`：用 `-100` 掩掉 prompt，只让 assistant 回复参与 loss。
:::

:::why
SFT 的关键问题：**user 的话要不要算 loss？**
不算。训练目标是「学会怎么回答」，不是「学会怎么提问」。如果不 mask，
prompt 也参与 loss，模型会花容量去预测用户输入——这正是很多「SFT 没效果」的原因之一。
（第 21 章 Loss Mask 的工程实现就是这 10 行代码。）
:::

:::files
要改的文件：`src/hf_lab/data.py`（`build_labels` / `encode_batch`）
:::

:::predict
先做这个实验（顺序很重要）：
```python
# 第一版：不做 mask
input_ids = tokenizer.apply_chat_template(messages, tokenize=True)
labels = list(input_ids)          # TODO: 这里还没 mask！
supervised = len(labels)          # 全部 token 参与 loss
```
问题：现在 user prompt 也参与 loss 吗？如果 assistant 有 25 个 token、整句 62 个 token，
参与 loss 的应该是 25 还是 62？为什么？
:::

:::note 正确做法：prompt 前缀全部置 -100
```python
input_ids = tokenizer.apply_chat_template(messages, tokenize=True)
prompt_ids = tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True)
labels = list(input_ids)
labels[:len(prompt_ids)] = [-100] * len(prompt_ids)     # 掩掉 prompt（含 assistant 头部）
```
- `-100` 是 PyTorch 交叉熵的 `ignore_index`（第 21 章讲过）；
- 边界要对齐「未移位」的位置（transformers 内部会对 labels 左移一位，掩码不要自己移）；
- 实测：首条训练样本 `62 token`，其中参与 loss 的 assistant token = `25`。
- 兼容性回归：transformers 新版 `apply_chat_template(tokenize=True)` 返回 `BatchEncoding`（dict），
  旧版返回 `list`——starter 已给出 `_as_ids` 兼容 helper（这是本项目 CI 真实失败过一次的坑）。
:::

:::write
**你来写**（`data.py`）：

- TODO 1：`build_labels`——构造完整 input_ids 与 prompt 长度，把 labels 前缀置 `-100`；
- TODO 2：用 `_as_ids` 统一两种返回形态；
- TODO 3：`encode_batch`——逐条 `build_labels` 后截断到 `max_length`。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step7_labels.py
```
:::

:::fail
- `supervised == len(labels)` → 你还没 mask（测试会明确报出）；
- 最后一个 label 是 -100 → 你的 prompt 长度多算了（回复的最后 token 必须参与 loss）；
- BatchEncoding 兼容测试失败 → 没有用 `_as_ids`。
:::

:::hint Hint 1
prompt 长度用 `messages[:-1] + add_generation_prompt=True` 单独编码一次得到——
它等于「assistant 回复从哪个 token 开始」。
:::

:::hint Hint 2
先打印 `sum(1 for x in labels if x != -100)` 与总长度；
62 / 25 是参考实现第一样本的实测值（tiny 模型的 token 数不同，看比例）。
:::

:::solution
```python
def build_labels(tokenizer, messages):
    input_ids = _as_ids(tokenizer.apply_chat_template(messages, tokenize=True))
    prompt_ids = _as_ids(tokenizer.apply_chat_template(
        messages[:-1], tokenize=True, add_generation_prompt=True
    ))
    labels = list(input_ids)
    n_prompt = len(prompt_ids)
    labels[:n_prompt] = [-100] * n_prompt
    return input_ids, labels
```
:::

:::checkpoint
5 passed；你能说出参与 loss 的 token 数，并解释「第一版不做 mask 会发生什么」。
:::

:::explain
- 为什么 `-100` 是「忽略」而不是「loss = 0」？
- 如果数据里有 system 角色，它应该参与 loss 吗？
:::
:::

:::step 8 LoRA：r / alpha / target_modules 与可训练参数占比
:::goal
实现 `make_lora_model()`；配置 r / alpha / target_modules，并打印「可训练参数 / 总参数」。
:::

:::why
全量微调 0.5B 模型在 CPU 上不可行；LoRA 只训练千分之一的参数——
这是第 17 章的理论在工程里的真实量级。面试必问：你的 r 是多少？注入哪几层？为什么？
:::

:::files
要改的文件：`src/hf_lab/train.py`（函数 `make_lora_model`）
:::

:::note LoRA 三个超参（本实验配置 configs/lora_sft.json）
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
| 超参 | 作用 | 常见选择 |
| --- | --- | --- |
| `r` | 低秩维度（容量） | 4–64；越大容量越强、参数越多 |
| `lora_alpha` | 缩放系数（通常 2r） | 16–32 |
| `target_modules` | 注入哪些层 | q_proj/v_proj 起步；全 Linear 更强更贵 |
:::

:::write
**你来写**（`train.py`）：

- TODO 1：根据 cfg 构造 `LoraConfig`（r / lora_alpha / lora_dropout / target_modules / task_type）；
- TODO 2：`get_peft_model(model, lora_cfg)` 并返回；
- TODO 3：自己确认「注入后哪些参数 requires_grad」——用一行 Python 打印。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step8_lora.py
```
:::

:::expect
```
2 passed
```
:::

:::fail
- 可训练参数占比 ≥ 10% → 你可能漏了 LoRA 注入或者 target_modules 写错层名；
- `KeyError` / 目标层不存在 → Qwen 的线性层名是 `q_proj` / `v_proj`（不是 `query`）。
:::

:::hint Hint 1
打印占比：`sum(p.numel() for p in m.parameters() if p.requires_grad) / sum(p.numel() for p in m.parameters())`。
:::

:::hint Hint 2
注意：`get_peft_model` 是「就地注入」——这个事实会在 Step 11 变成一个大坑，先记住它。
:::

:::solution
```python
def make_lora_model(model, cfg):
    lora_cfg = LoraConfig(
        r=cfg.lora_r,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=cfg.target_modules,
        task_type="CAUSAL_LM",
    )
    return get_peft_model(model, lora_cfg)
```
:::

:::checkpoint
2 passed；你知道 0.5B 模型 LoRA 可训练参数的占比量级（0.1%）。
:::

:::explain
- `r` 从 8 加到 16，可训练参数大概怎么变？效果一定更好吗？
- 为什么 `target_modules` 通常包含 q_proj / v_proj，而不只是 q_proj？
:::
:::

:::step 9 真正训练：短训练，记录 loss
:::goal
实现 `_collate()` 与 `train_lora()`：手工 collate（padding + -100）→ AdamW → 60 步训练 → 记录 losses。
:::

:::why
Trainer 很方便，但「自己写一遍训练循环」是理解 SFT 的唯一方式：
loss 是怎么算的、谁在更新、梯度只流进哪些参数。你的 loss 曲线还是你实验报告的第一张图。
:::

:::files
要改的文件：`src/hf_lab/train.py`（`_collate` / `train_lora`）
:::

:::note collate：batch 里三样东西都要对齐
- `input_ids`：短序列补 `pad_token_id`；
- `attention_mask`：真实 token 为 1，补位为 0；
- `labels`：补位（以及 prompt 部分）置 `-100`。
:::

:::write
**你来写**（`train.py`）：

- TODO 1：`_collate`——逐条 pad 到 batch 最大长度，返回三个张量；
- TODO 2：`train_lora`——`torch.manual_seed(cfg.seed)`、只优化 `requires_grad` 的参数、`zero_grad → forward → backward → step`；
- TODO 3：每 `log_every` 步打印 loss；训练结束 `model.eval()`；
- TODO 4：返回 `TrainResult(losses, trainable_params, total_params)`。
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step9_train.py
```
:::

:::expect
```
3 passed
```
:::

:::fail
- loss 是 NaN → 学习率过大或 labels 全是 -100（一个 batch 里没有任何 assistant token）；
- `RuntimeError: element 0 of tensors does not require grad` → 你把优化器建在了全部参数上或忘了 LoRA 注入；
- loss 完全不下降 → 检查 labels 是否真的对齐了 input_ids。
:::

:::hint Hint 1
batch 的构造：按 `cfg.batch_size` 循环采样（`samples[(cursor + i) % len(samples)]`），
这样小数据集也能跑满 max_steps。
:::

:::hint Hint 2
优化器只传可训练参数：`torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg.learning_rate)`。
:::

:::solution
```python
def _collate(batch_ids, batch_labels, pad_id):
    max_len = max(len(ids) for ids in batch_ids)
    input_ids, labels, attention = [], [], []
    for ids, labs in zip(batch_ids, batch_labels):
        pad_n = max_len - len(ids)
        input_ids.append(ids + [pad_id] * pad_n)
        labels.append(labs + [-100] * pad_n)
        attention.append([1] * len(ids) + [0] * pad_n)
    return torch.tensor(input_ids), torch.tensor(labels), torch.tensor(attention)
```
:::

:::checkpoint
3 passed；你在本地跑过 ≥ 10 步训练并看到 loss 数值（不要求下降到某个值——只要求你记录事实）。
:::

:::explain
- 为什么 loss 是 `CausalLMOutput.loss` 而不是你手算？（提示：内部已处理 shift + ignore_index）
- 训练 60 步的 loss 下降能证明模型「变好了」吗？（对照第 23 章）
:::
:::

:::step 10 保存和重载 adapter：必须用干净模型实例
:::goal
实现 `save_adapter()` 与 `load_adapter()`；验证保存产物能被重新加载，并理解 base / adapter / merged 的区别。
:::

:::why
训练产物必须是可交付、可复现的：别人拿到你的 adapter（几 MB）应该能复现你的模型。
而「重载」也是评测的前提——只有重新加载的模型才能证明保存真的成功。
:::

:::files
要改的文件：`src/hf_lab/train.py`（`save_adapter`）、`src/hf_lab/loading.py`（`load_adapter`）
:::

:::note base / adapter / merged 三者
| 产物 | 大小（0.5B 例子） | 用途 |
| --- | --- | --- |
| base model | ~2GB（fp32）/ ~1GB（bf16） | 原始权重 |
| **adapter**（LoRA） | **几 MB ~ 几十 MB** | 训练产物；分享/切换成本极低 |
| merged model | 同 base 大小 | 合并后推理不带 PEFT 依赖 |
:::

:::write
**你来写**：

- TODO 1（`train.py`）：`save_adapter`——`mkdir` + `model.save_pretrained(out)` + `cfg.save(out / "config.json")`；
- TODO 2（`loading.py`）：`load_adapter(base_model, adapter_dir)`——`PeftModel.from_pretrained(base_model, adapter_dir)`；
- TODO 3：自己想清楚——重载时传入的 `base_model` 应该是一个怎样的对象？
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step10_save_load.py
```
:::

:::expect
```
3 passed
```
:::

:::fail
- 找不到 `adapter_model.safetensors` → 保存的是普通模型而不是 PeftModel；
- 重载后测试说「找不到 LoRA 模块」 → `load_adapter` 没有真的包上 PeftModel；
- 重载用了同一个 base 对象 → 下一个 Step 就是为你准备的。
:::

:::hint Hint 1
保存目录会包含 `adapter_config.json` + `adapter_model.safetensors` 两个关键文件。
:::

:::hint Hint 2
「干净模型实例」= **重新调用一次 `load_model(...)`**，而不是复用刚才训练用的那个对象。
:::

:::solution
```python
def save_adapter(model, output_dir: str, cfg) -> None:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(out)
    cfg.save(out / "config.json")
```

```python
def load_adapter(base_model, adapter_dir):
    from peft import PeftModel
    return PeftModel.from_pretrained(base_model, adapter_dir)
```
:::

:::checkpoint
3 passed；你能说出 adapter 与 base 的大小差异以及为什么 adapter 是最重要的交付物。
:::

:::explain
- 为什么重载验证是「保存成功」的唯一证据？
- merged 模型适合什么场景？为什么大多数团队仍然交付 adapter？
:::
:::

:::step 11 PEFT 就地注入 bug：一个真实踩过的坑
:::goal
亲手复现并理解：为什么「用同一个 model 变量当 base 基线」会得到错误的评测结果。
:::

:::why
这是本 Lab 最重要的一步。它不涉及任何新 API，只关于一个事实：
`get_peft_model(model)` 会**就地改造传入的对象**。理解不了它，你的 base vs tuned 对比会得出「Δ=0.0000」的荒谬结论，
而且你还以为实验成功了。
:::

:::bug 真实踩坑（项目开发记录，非虚构）
训练后拿同一个 `model` 变量当「base 基线」评测，测出来的其实是**带 adapter 的模型**——
base 与 tuned 的 loss 完全相同（Δ=0.0000），差点写进报告。
正确做法：基线评测用**另一次干净加载**的模型。
:::

:::files
要改的文件：无新增实现——用测试验证你对第 10 步完成后的代码是否理解正确；
如测试失败，回到 `make_lora_model` / `load_adapter` 检查。
:::

:::predict
先预测，再运行：
```python
base = AutoModelForCausalLM.from_pretrained(TINY_MODEL)   # 干净模型
print(sum(p.numel() for n, p in base.named_parameters() if p.requires_grad and "lora_" in n))  # ？
make_lora_model(base, cfg)                                 # 注入 LoRA
print(sum(p.numel() for n, p in base.named_parameters() if p.requires_grad and "lora_" in n))  # ？
```
两个 print 的结果分别是什么？如果你之后直接用 `base` 当基线评测，会发生什么？
:::

:::run 🎮 Mac / Server
```bash
pytest -q tests/test_step11_peft_trap.py
```
:::

:::expect
```
2 passed
```
- 第 1 个测试：注入后**原对象** `base` 的 LoRA 参数从 0 变为 > 0（就地修改的证明）；
- 第 2 个测试：正确模式 = 加载两个干净模型（一个给 adapter、一个当基线）。
:::

:::fail
- 测试通不过说明你对「谁被改造了」还有误解——把两个模型的 `named_parameters()` 名字打印出来对比。
:::

:::hint Hint 1
对象有没有被原地修改？用 `id()` 和 `named_parameters()` 各验证一次。
:::

:::hint Hint 2
正确模式的伪代码：
```python
tuned_base = load_model(name)                     # 给 adapter
tuned_model = load_adapter(tuned_base, out_dir)
clean_base = load_model(name)                     # 给基线（新对象！）
base_eval = eval_loss(clean_base, ...)
tuned_eval = eval_loss(tuned_model, ...)
```
:::

:::solution
```python
# 正确基线评测模式（run_lab.py [7/8] 的写法）
tuned_base = load_model(cfg.model_name, dtype=cfg.dtype, device=cfg.device)
tuned_model = PeftModel.from_pretrained(tuned_base, cfg.output_dir)
clean_base = load_model(cfg.model_name, dtype=cfg.dtype, device=cfg.device)

base_eval = eval_loss(clean_base, tokenizer, eval_samples, cfg.max_length)
tuned_eval = eval_loss(tuned_model, tokenizer, eval_samples, cfg.max_length)
```
:::

:::checkpoint
2 passed；你能向面试官解释这个 bug 的触发条件和修复方式（30 秒内说清）。
:::

:::explain
- 「就地注入」的设计动机是什么？如果你要在同一进程里评测 5 个 adapter 而不爆内存，会怎么组织对象生命周期？
- 如果不做 Step 11 的验证，Δ=0.0000 会如何误导你的实验结论？
:::
:::

:::step 12 Base vs Tuned Evaluation：产出你的实验报告
:::goal
实现 `eval_loss()` / `compare_generation()` / `build_report()`；用真实 Qwen 模型跑完整实验，写出你自己的 report.md。
:::

:::why
从「训练完了」到「实验有结论」，中间隔着一次公平的评测：同一批 held-out、同一 mask、同一解码策略、
干净加载的 base。这一步是你交付物的最后一块拼图——也是简历上那个项目的证据。
:::

:::files
要改的文件：`src/hf_lab/evaluate.py`；这一行命令是一次完整实验：`python scripts/run_lab.py`
:::

:::write
**你来写**（`evaluate.py`）：

- TODO 1：`eval_loss`——逐条计算 held-out 样本的 response-only loss 取平均（逐条避免 padding 干扰，labels 全 -100 的样本跳过，无样本返回 nan）；
- TODO 2：`compare_generation`——同一组 prompt，base 与 tuned 各自贪心生成，返回 `[{prompt, base, tuned}]`；
- TODO 3：`build_report`——markdown 实验报告（模型、数据、LoRA 配置、可训练参数、loss、生成对比、已知限制）。
:::

:::run ☁ Server 优先（Mac 也能跑；首次会下载约 2GB 权重，先进 HF 缓存）
```bash
# 【当前目录】.../llm-course/projects/hf-mini-lab/starter
pwd

# 【先看磁盘】模型权重约 2GB（fp32）+ 缓存开销；服务器上尤其先确认
df -h .

# 【单元测试】
pytest -q tests/test_step12_evaluate.py
pytest -q                                    # 全量：38 passed

# 【真实 Qwen 实验】CPU 约 1 分钟；模型下载进 HF 缓存，不进 repo
python scripts/run_lab.py
```
:::

:::note 跑完 experimental 之后你会多出哪些文件？会不会把 repo 撑爆？
- 模型权重 → HuggingFace 缓存（`echo $HF_HOME` 查看），**不在 repo**；
- 实验产物 → `outputs/lab_run/`（几 MB：adapter + report.md + losses.json，已被 gitignore）；
- `git status` 应该只显示你修改的源码文件——如果看到几十 GB 的东西，先停下来检查 `.gitignore`。
:::

:::expect
```
3 passed
... 38 passed
```
`run_lab.py` 结束时会打印报告并写出：
```
outputs/lab_run/adapter_config.json、adapter_model.safetensors、config.json、losses.json、report.md
```
参考实现的真实结果（你的数字会有差异，这是正常的）：
```
模型：Qwen/Qwen2.5-0.5B-Instruct | 494.0M 参数 | float32 | cpu
LoRA 可训练参数：540,672 / 494,573,440 = 0.1093%
训练 loss：2.6364 → 1.3052（60 步，batch 2，lr 2e-4）
held-out response-only loss：base=3.8168 → tuned=3.6102（Δ=-0.2065）
```
:::

:::fail
- `eval_loss` 返回 nan → 所有样本的 labels 都被截断到全 -100（检查 `max_length` 与数据长度）；
- Δ 正好等于 0.0000 → 你踩了 Step 11 的坑：基线不是干净加载的；
- 跑完 CPU 时间明显超过几分钟 → 确认没把 max_steps 调大或模型换大。
:::

:::hint Hint 1
`eval_loss` 逐条计算：单条 `model(input_ids=..., labels=...)`，累加 `float(out.loss)`。
:::

:::hint Hint 2
`build_report` 不用追求漂亮，先保证信息完整：模型名、数据量、超参、loss 两行、生成对比、已知限制——
这就是「实验报告」在面试里的全部要求。
:::

:::solution
```python
def eval_loss(model, tokenizer, samples, max_length: int = 256) -> float:
    model.eval()
    total, count = 0.0, 0
    with torch.no_grad():
        for messages in samples:
            ids, labels = build_labels(tokenizer, messages)
            ids, labels = ids[:max_length], labels[:max_length]
            if all(label == -100 for label in labels):
                continue
            out = model(input_ids=torch.tensor([ids]), labels=torch.tensor([labels]))
            total += float(out.loss)
            count += 1
    return total / count if count else float("nan")
```
:::

:::note 最终交付物（Portfolio Output）
完成后你的实验目录里应该有**你自己跑出来的**：

```
outputs/lab_run/
├── adapter_config.json          # LoRA 配置（r / alpha / target_modules）
├── adapter_model.safetensors    # 几 MB 的 adapter —— 最重要的交付物
├── losses.json                  # 你的训练 loss 曲线数据
└── report.md                    # 模型 / 数据 / 超参 / base-vs-tuned / 已知限制
```

**如果你要把它写进简历**，你必须能解释：LoRA 为什么只训练 0.1% 参数（A）、
response-only mask 怎么构造（B）、为什么基线必须干净加载（C）、
以及你训练 loss 与 held-out loss 的数字各自说明什么、不能说明什么（D）。
:::

:::checkpoint
38 passed + `run_lab.py` 产出你的 report.md + 以下问题**不看代码**回答：
1. `apply_chat_template` 生成的文本长什么样？`add_generation_prompt` 做了什么？
2. 为什么 decoder-only 推理用 left padding？
3. response-only loss 的 mask 是怎么构造的？为什么 prompt 部分置 `-100`？
4. LoRA 可训练参数为什么只有 0.1%？`target_modules` 选的是哪两层？
5. base 和 tuned 的 loss 怎么公平比较？（同一批 held-out + 同一 mask + 干净加载的 base）
:::

:::explain
这 5 题就是 Checkpoint B 的口试清单。任何一题卡住 → 回到对应 Step 重读。
:::

:::solution 查看参考实现（完成后对照）
完整实现：`projects/hf-mini-lab/src/hf_lab/` + `scripts/run_lab.py`。
重点对照三个地方：
1. `data.build_labels` 的掩码边界；
2. `train.train_lora` 的 collate 与优化器参数过滤；
3. `run_lab.py` [7/8] 的「两次干净加载」模式。
:::
:::
:::

## 26.3 Learn 参考手册：HuggingFace 工程细节（做项目时回来查）

### 26.3.1 Tokenizer：模型与文本之间的唯一接口

第 6 章你亲手训过 BPE。工业生态里不需要自己训——用 `AutoTokenizer` 加载现成的：

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")

ids = tokenizer("你好，世界")["input_ids"]          # encode
tokenizer.decode(ids)                                # decode → '你好，世界'
```

实测输出：`vocab=151643`，`pad=<|endoftext|>`。三个必须理解的概念：

| 概念 | 作用 | 常见错误 |
| --- | --- | --- |
| `padding` | 把不同长度的序列补到等长（batch 推理必需） | 不设 `pad_token`（很多 LLM 默认没有 pad） |
| `truncation` | 超长序列截断 | 不截断 → 显存爆炸 |
| `attention_mask` | 标记哪些位置是真实 token（1）/ padding（0） | 忘记传给模型 → 模型 attend 到 pad |

### 26.3.2 Chat Template：最容易被忽视的工程细节

模型看到的不是 `{"role": "user"}` 这种字典——**模板把它渲染成一段带特殊 token 的文本**。
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

### 26.3.3 AutoModelForCausalLM：三个参数看住显存

| 参数 | 含义 | 注意 |
| --- | --- | --- |
| `dtype` | 权重精度 | fp32 精确但费显存；bf16 训练推理常用 |
| `device_map` | 多设备分配（`"auto"` 自动切分） | 单卡小模型不需要 |
| `trust_remote_code` | 允许执行仓库自带代码 | ⚠️ **不要无脑 True**：这是在执行第三方代码 |

实测：0.5B 模型 fp32 加载后 `494.0M 参数`，CPU 加载约 3 秒。参数量 × 精度字节（0.494B × 4 ≈ 2GB 内存）——这就是第 14 章显存估算的日常应用。

### 26.3.4 logits：回到第 9 章

本项目实测：

```
input_ids: (1, 27) → logits: (1, 27, 151936)
```

`[batch, seq, vocab]`——第 9 章推的每一个符号，在工业代码里就是这个张量。`logits[0, -1]` 就是「下一个 token 的未归一化分数」，softmax 之后就是概率分布。

:::note 注意 detail：`logits.shape[-1] = 151936` 而 `tokenizer.vocab_size = 151643`
输出维度是 `config.vocab_size`，可能因并行/对齐被 pad 到更大。**不要假设两者相等**——这是写测试时真实踩到的坑（断言 `==` 失败，改为 `>=`）。
:::

### 26.3.5 generate：参数与第 9 章数学的对应

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

### 26.3.6 批量推理与 left padding

:::demo padding-side 交互：left vs right padding
切换 padding 方向，观察不同长度的 prompt 在 batch 中的对齐方式，以及生成位置是否一致。
:::

```python
tokenizer.padding_side = "left"        # decoder-only 推理惯例
batch = tokenizer(chats, return_tensors="pt", padding=True, truncation=True)
```

实测：`left pad shape: (2, 7)`，两个不同长度的 prompt 被补齐到 7；左对齐保证每个序列的**最后一个位置**都是真实的 prompt 末尾。

### 26.3.7 datasets：数据在生态里长什么样

```python
from datasets import Dataset

ds = Dataset.from_list(rows)                    # 或 load_dataset("json", data_files=...)
ds = ds.map(lambda ex: {"text": render(ex["messages"])})
ds = ds.filter(lambda ex: len(ex["text"]) > 10)
ds = ds.shuffle(seed=0)
split = ds.train_test_split(test_size=0.25, seed=0)
```

实测：2 条样本 `map` + `filter` 全部正常。注意 `map` 是**逐样本函数**——不要在 `map` 里加载模型（它会被每个样本调用一次）。

### 26.3.8 Data Collator：变长数据如何拼成 batch

LLM 的 batch 需要三样东西对齐：`input_ids` / `labels` / `attention_mask`。padding 规则：

- `input_ids`：短序列补 `pad_token_id`；
- `attention_mask`：真实 token 为 1，补位为 0；
- `labels`：补位和 prompt 部分都置 `-100`（交叉熵忽略）。

**response-only loss（SFT 的关键）**：只有 assistant 回复参与 loss，prompt 不参与。连接第 21 章 Loss Mask。

### 26.3.9 PEFT / LoRA：接通第 17 章

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

### 26.3.10 save / load：base / adapter / merged 三者的区别

| 产物 | 大小（0.5B 例子） | 用途 |
| --- | --- | --- |
| base model | ~2GB（fp32）/ ~1GB（bf16） | 原始权重 |
| **adapter**（LoRA） | **几 MB ~ 几十 MB** | 训练产物；分享/切换成本极低 |
| merged model | 同 base 大小 | 合并后推理不带 PEFT 依赖，速度略快 |

本实验保存的就是 adapter（`outputs/lab_run/adapter_model.safetensors` + `adapter_config.json`）。

## 26.4 Level 3 · Reference Solution（完整实验工程）

:::unfold 目标
用 Qwen2.5-0.5B-Instruct 在 CPU 上完整走一遍：加载 → Chat Template → logits → 批量生成 → response-only mask → LoRA 训练 → 保存 → 重载 → 评测对比 → 自动生成实验报告。
:::

**项目位置**：[`projects/hf-mini-lab/`](https://github.com/xhr0417/llm-course/tree/main/projects/hf-mini-lab)

```bash
cd projects/hf-mini-lab
pip install -r requirements.txt
python scripts/run_lab.py          # 完整实验（CPU 约 1 分钟）
pytest -q                          # 11 passed
```

**生成对比**（held-out 问题，贪心解码，真实输出）：

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
└── tests/test_lab.py         # 11 个测试函数
```

:::note Checkpoint B 的验收问题
完成后你应能回答：
- `apply_chat_template` 生成的文本长什么样？`add_generation_prompt` 做了什么？
- 为什么 decoder-only 推理用 left padding？
- response-only loss 的 mask 是怎么构造的？为什么 prompt 部分置 `-100`？
- LoRA 可训练参数为什么只有 0.1%？`target_modules` 选的是哪两层？
- base 和 tuned 的 loss 怎么公平比较？（同一批 held-out + 同一 mask + 干净加载的 base）
:::

## 26.5 面试复盘：HuggingFace / 微调

1. `AutoTokenizer` 的 `padding` 和 `truncation` 分别解决什么问题？
2. Chat Template 错了会发生什么？为什么不能手拼特殊 token？
3. `logits.shape` 三个维度分别是什么？最后一维为什么可能大于词表？
4. `temperature=0` 和 `do_sample=False` 是什么关系？
5. 什么是 response-only loss？训练时为什么要 mask 掉 prompt？
6. LoRA 的 `r`、`alpha`、`target_modules` 分别影响什么？可训练参数占比怎么算？
7. base / adapter / merged 三种产物怎么选？
8. 为什么「训练 loss 下降」不代表「模型变好了」？（对照第 23 章评测）
9. **（新版）** leftover padding 与 mask：left padding 的 batch 里，最后一个位置一定是真实 token 吗？为什么？
10. **（新版）** 描述 PEFT 就地注入 bug：怎么触发、怎么发现（Δ=0.0000 之外还有别的信号吗）、怎么修复。

:::quiz
你用 `PeftModel.from_pretrained(base, adapter_dir)` 重新加载了微调模型，准备与 base 做对比评测。以下哪种做法是正确的？

A. 直接评测 `base` 变量（它没被训练过，应该是干净的）
B. 重新加载一份干净模型作为 base 评测，因为 `from_pretrained` 已就地改造了 `base`
C. 只测 tuned，不测 base
D. 把 base 和 tuned 的 loss 四舍五入到小数点后一位再比较

答案: B
解析: PEFT 是就地注入——`base` 变量引用的模型对象已被装上 LoRA 包装器，直接评测会得到与 tuned 相同的结果（Δ=0.0000），这正是本项目真实踩过的坑（Step 11）。必须用另一次干净加载的模型当基线。
:::

:::key 本章必须记住
| 站点 | 核心结论 |
| --- | --- |
| 学习模式 | Learn（手册）→ Guided Build（starter 13 步）→ Reference（完整实验工程） |
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
