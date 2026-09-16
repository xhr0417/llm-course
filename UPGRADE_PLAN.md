# 网站升级计划（UPGRADE_PLAN）

> 目标：把 `llm-course-site/` 从「知识点笔记」升级为「可从零自学的大模型交互式教材」。
> 原则：不重做框架，保留现有视觉、导航、KaTeX、搜索、进度；重点扩充内容深度 + 增加交互可视化。

---

## 1. 当前网站架构

```
llm-course-site/
├── index.html              # 布局：顶栏 / 左侧章节导航 / 中间内容 / 右侧 TOC
├── css/style.css           # 设计变量（浅蓝紫）、深浅色主题、Markdown 排版、响应式
├── js/app.js               # 哈希路由、Markdown+KaTeX 渲染管线、搜索、进度、主题
├── vendor/
│   ├── katex/              # 本地 KaTeX（含字体，离线可用）
│   └── marked.min.js       # 本地 Markdown 解析器
└── content/
    ├── manifest.json       # 14 章清单（id / 标题 / 分组 / 课件来源）
    └── 00-map.md ... 13-efficient.md
```

技术栈：纯静态 HTML + CSS + 原生 JS，无构建步骤，`python3 -m http.server` 运行。

## 2. 当前内容问题

| 问题 | 表现 |
| --- | --- |
| 讲解薄 | 多数知识点只有「定义 + 1~2 公式 + 两三句话」，缺少 why/how |
| 无张量维度 | 全文几乎没有 shape 说明，初学者无法把公式与代码对应 |
| 无算例 | 公式只摆符号，没有「代数字算一遍」 |
| 无交互 | 没有任何可视化，梯度消失、Attention、KV Cache 等抽象概念全靠想象 |
| 无代码 | 缺少 PyTorch 最小实现与「公式 ↔ 代码」对照 |
| 无自测 | 没有误区、面试题、测验，无法检验是否真的学会 |
| 无关联 | 章节之间没有依赖/下游标签，知识是孤岛 |

## 3. 需要新增的组件（Phase 1）

### 3.1 Markdown 容器语法（由 app.js 预处理管线实现）

在现有「代码块 + 公式」保护管线之前，新增 `:::` 容器解析（支持嵌套）：

| 语法 | 渲染 | 用途 |
| --- | --- | --- |
| `:::intuition 标题` | 绿色框 | 一句话直觉 |
| `:::math 标题` | 紫色框 | 数学推导 |
| `:::engineering 标题` | 橙色框 | 工程实践 |
| `:::warning 标题` | 红色框 | 常见误区 |
| `:::interview 标题` | 黄色框 | 面试考点 |
| `:::example 标题` | 绿色框 | 具体例子 |
| `:::note / :::key` | 蓝 / 紫框 | 提示 / 必记 |
| `:::fold 标题` / `:::unfold 标题` | 折叠块 | 先懂直觉 / 再看数学 / 工程里怎么用 |
| `:::answer 标题` | 折叠答案 | 面试题答案 |
| `:::demo name 标题` | 交互演示挂载点 | 33 个交互组件 |
| `:::quiz` | 小测验 | 题目/选项/答案/解析 |
| `:::shapeflow` | Shape 流图 | 张量维度可视化 |
| `:::related` | 知识图谱标签 | 依赖 / 用于，可点击跳章 |

### 3.2 交互演示框架（js/demos*.js）

- 统一的 `window.LC` 命名空间 + 共享 helper（滑块、按钮、矩阵表、柱状图、热力图、SVG/Canvas 封装）。
- `LC.init(root)` 在每章渲染后扫描 `[data-demo]` 并初始化。
- 按主题拆分为 5 个文件，保持简单、可离线。

### 3.3 自测与进度

- Quiz：点击选项 → 判定 + 解析 + localStorage 记录（按章持久化，刷新后恢复）。
- 面试题：`<details>` 原生折叠，答案默认隐藏。

## 4. 需要修改的文件

| 文件 | 改动 |
| --- | --- |
| `index.html` | 引入 5 个 demos 脚本 |
| `css/style.css` | 追加教学组件样式（约 400 行），不动现有样式 |
| `js/app.js` | 重写渲染管线（容器解析、递归渲染、quiz 交互、demo 初始化、related 链接），保留路由/搜索/进度/主题 |
| `js/demos-core.js` | 新增：helper + 梯度下降 / Softmax / 交叉熵 / 梯度消失爆炸 / 混淆矩阵 / 优化器竞赛 |
| `js/demos-seq.js` | 新增：RNN 展开 / LSTM / GRU / BPE / Embedding |
| `js/demos-transformer.js` | 新增：Attention / QKV 矩阵 / 缩放 / MHA / Causal Mask / Transformer Block / BERT vs GPT |
| `js/demos-llm.js` | 新增：Next Token / Temperature / Top-K-P / KV Cache / MHA-MQA-GQA / RoPE / Norm 对比 / Pre-Post Norm / SwiGLU |
| `js/demos-training.js` | 新增：训练流水线 / Loss Mask / PPO-GRPO / Group Advantage / KL / LoRA / 混合精度 |
| `content/*.md` | 14 章全部重写扩充（保留全部原有知识点） |
| `content/manifest.json` | 更新章节描述 |
| `UPGRADE_PLAN.md` / `CONTENT_AUDIT.md` | 本计划 + 内容审计 |

## 5. 14 章分别扩充什么

| 章 | 主要扩充 | 新增可视化 |
| --- | --- | --- |
| 0 知识地图 | 使用说明、6 层逻辑、学习路径、全站导航 | 静态知识地图 |
| 1 基础 | 梯度下降/反向传播/Softmax/交叉熵 ★5 全文重写：推导、算例、shape、代码、误区 | 梯度下降、Softmax、交叉熵 |
| 2 优化器 | SGD/Momentum/Adam 公式逐项解释、Adam 完整算例、AdamW | 优化器竞赛 |
| 3 评估 | 指标算例（不平衡数据）、L2 推导、Dropout 训练/推理差异 | 混淆矩阵计算器 |
| 4 稳定 | 梯度连乘算例、Sigmoid 饱和推导、Kaiming/BN 计算示例、残差梯度推导 | 梯度消失/爆炸 |
| 5 RNN | RNN/LSTM/GRU ★5 重写：BPTT、门控逐步计算、手写 PyTorch、任务类型图 | RNN 展开、LSTM、GRU |
| 6 NLP | Tokenizer/BPE/Embedding ★5 重写：真实 BPE 算法、编码演示、参数量计算 | BPE 训练器、Embedding 空间 |
| 7 Transformer | Attention/QKV/缩放/MHA/Mask ★5 重写：数值算例、shape 全链路、手写实现 | Attention、QKV 矩阵、缩放、MHA、Causal Mask、Block 图 |
| 8 BERT | 三种 Embedding、MLM 概率推导、微调实践、与 GPT 对比 | BERT vs GPT |
| 9 GPT | 自回归分解、训练并行、采样策略全家桶 | Next Token、Temperature、Top-K/P |
| 10 现代架构 | KV Cache 显存计算、GQA、RoPE 旋转推导、RMSNorm 算例、SwiGLU | KV Cache、GQA、RoPE、Norm 对比、Pre/Post、SwiGLU |
| 11 Pretrain/SFT | 数据工程、MinHash、PPL、Chat Template、Loss Mask | 训练流水线、Loss Mask |
| 12 RL | PPO/GRPO 结构、ratio/clip 推导、KL 直觉、可验证奖励 | PPO vs GRPO、Group Advantage、KL |
| 13 高效训练 | 精度格式位分布、显存估算、LoRA 推导与参数量 | 混合精度计算器、LoRA |

## 6. 可视化组件与章节映射（33 个）

```
Ch1  gradient-descent  softmax  cross-entropy
Ch2  optimizer-race
Ch3  confusion-matrix
Ch4  vanishing-exploding
Ch5  rnn-unroll  lstm  gru
Ch6  bpe  embedding
Ch7  attention  qkv-matrix  scaling  mha  causal-mask  transformer-block  bert-vs-gpt
Ch9  next-token  temperature  top-k-p
Ch10 kv-cache  mha-gqa  rope  norm-compare  pre-post-norm  swiglu
Ch11 pipeline  loss-mask
Ch12 ppo-grpo  grpo-group  kl-divergence
Ch13 lora  mixed-precision
```

## 7. 实现顺序

1. **Phase 1**：CSS 组件样式 → demos 框架与全部演示 → app.js 渲染管线升级 → index.html。
2. **Phase 2**：重写 Ch1 / Ch5 / Ch6 / Ch7（核心四章，含 15 个演示）。
3. **Phase 3**：重写 Ch8 / Ch9 / Ch10。
4. **Phase 4**：重写 Ch11 / Ch12 / Ch13，扩充 Ch2 / Ch3 / Ch4，更新 Ch0。
5. **验收**：语法检查、渲染管线端到端测试、浏览器验证、生成 CONTENT_AUDIT.md。

## 8. 验收清单（对照用户要求）

- [ ] 14 章可正常打开，搜索 / KaTeX / 主题 / 进度 / 移动端正常
- [ ] 所有交互图纯本地（无 CDN），控制台无严重报错
- [ ] 每个 ★5 知识点：直觉 + 数学 + shape + 算例 + 图解 + 代码 + 误区 + 面试
- [ ] 每章 3~8 道测验，进度写入 localStorage
- [ ] 章末「知识关联」标签可点击跳转
- [ ] 生成 CONTENT_AUDIT.md 覆盖审计表
