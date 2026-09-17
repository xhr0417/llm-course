# 升级方案 V2：从「原理课程」到「CS336 前置 + 中文交互式 LLM Systems 教材」

> 本文件是 Phase 0（现状分析）+ Phase 1（改造方案）的完整输出，Phase 2 按此执行。

---

## 一、Phase 0：当前系统理解

### 1.1 系统架构（已验证）

```
llm-course-site/
├── content/*.md           14 章内容源（7,888 行）← 唯一需要维护的内容
├── content/manifest.json  章节清单（id/标题/分组/描述）← 导航与搜索的数据源
├── js/app.js              渲染管线：容器解析 → 代码/公式保护 → marked → KaTeX → 交互接线
│                          + 哈希路由 / 搜索 / 进度 / 主题
├── js/demos-*.js          51 个交互演示（按主题分 5 个文件注册）
├── css/style.css          设计系统（浅蓝紫 + 深浅色）
├── tools/build-static.js  静态阅读版构建（14 章 HTML + sitemap/robots/llms.txt）
├── tools/publish.sh       一键发布（静态化 → 自有服务器 → GitHub 镜像）
└── index.html             SPA 外壳 + 静态目录（SEO 用）
```

**自定义块语法（内容作者接口）**：
`:::unfold/:::fold`（直觉/折叠）、`:::demo <name> <标题>`、`:::quiz`、
`:::shapeflow`、`:::related`、`:::interview` + 嵌套 `:::answer`、
`:::intuition/:::math/:::engineering/:::warning/:::example/:::note/:::key`、表格 / 代码块 / `$公式$`。

### 1.2 当前内容盘点

| 分组 | 章节 | 行数 | 定位 |
| --- | --- | --- | --- |
| 基础 | 1-4 章（basics/optimizers/evaluation/stability） | 1,644 | 数学与训练基础 |
| 序列 | 5-6 章（rnn/nlp） | 1,037 | 历史演化 + NLP 前置 |
| 架构 | 7-10 章（transformer/bert/gpt/modern-llm） | 3,625 | 核心原理（7 章 2,087 行，已极强） |
| 工程 | 11-13 章（pretrain-sft/rl-grpo/efficient） | 1,444 | 训练流程 + 强化学习 + 高效微调 |

### 1.3 最强的部分（必须保留）

1. **第 7 章 Transformer**：25 小节 / 15 个交互演示 / 39 题面试库 / 全手算链路，已超过普通教材。
2. **交互演示体系**：51 个 demo、统一挂载协议（`data-demo`）、离线可用、按钮/滑块全部可达。
3. **渲染管线**：容器语法 + 嵌套折叠 + 公式保护，作者体验好；静态构建直接复用同一管线。
4. **学习闭环**：直觉→数学→工程三级折叠 + 误区 + 面试 + 测验 + 进度，教学法完整。

### 1.4 最关键的缺口（对照 CS336 前置）

| 缺口 | 现状 | 后果 |
| --- | --- | --- |
| **手写实现** | 只有零散代码块 | 会看公式但写不出模型 |
| **Scaling Laws** | 无 | 不理解「为什么这样配置训练」 |
| **GPU 与性能模型** | 无（仅散落在个别章节） | 学不动 FlashAttention / 分布式 |
| **训练显存系统化** | 13 章有基础，不完整 | 说不清"显存花在哪" |
| **分布式训练** | 完全空白 | 无法进入 systems 方向 |
| **推理系统** | KV Cache 散在 10 章 | 没有 prefill/decode/continuous batching 全貌 |
| **数据工程** | 11 章有一节 | 没有 pipeline 级理解 |
| **现代评测** | 只有传统 ML 指标 | 不知道 benchmark 说明什么 |
| **Post-training 全景** | 12 章偏 GRPO 单点 | 缺 preference/RM/DPO/RLVR 图谱 |

---

## 二、Phase 1：升级后主线（Understand → Build → Scale → Serve → Align）

### 2.1 章节操作表（KEEP / EXPAND / MERGE / MOVE / ADD）

| 操作 | 章节 | 说明 |
| --- | --- | --- |
| **KEEP** | 0-10 全部保留 | 0 章重写为主线路标；7 章冻结（不再膨胀）；5/8 章冻结（历史与前置） |
| **MOVE** | 7.15 的内容定位改为「导读」 | 深度 KV Cache/FlashAttention 内容迁往 Serve/Scale 新章，原节保留指针 |
| **ADD** | 12 PyTorch for LLM | P0-1：读懂并写出 small LLM 代码 |
| **ADD** | 13-14 Build Your Own Small LLM（上/下） | P0-2：14 个 Lab 贯穿式项目 |
| **ADD** | 15 Scaling Laws / Compute | P0-4 |
| **ADD** | 16 GPU Fundamentals + Profiling | P0-6 |
| **ADD** | 17 Distributed Training | P0-8 |
| **ADD**（下一批） | 18 Data Pipeline / 19 FlashAttention+Triton / 20 Inference Systems / 21 LLM Evaluation | P0-3、P0-7、P0-9、P0-10 |
| **EXPAND** | 13 efficient → 「训练显存、混合精度与微调」 | P0-5：显存构成 / FP8 / loss scaling / 梯度累积 / activation checkpointing |
| **EXPAND** | 12 rl-grpo → 「Post-training 全景」 | P0-11：preference data / BT / DPO / RLVR / reward hacking |
| **MERGE** | 3 evaluation 保持现状 | 现代评测放新章，避免破坏已有链接 |

### 2.2 升级后的完整结构（目标形态）

```
第一部分 · 理解 Understand（0-10 章，保留）
第二部分 · 构建 Build（11-13 → 新编号）
  12 PyTorch for LLM
  13 Build Your Own Small LLM（上）组件篇：Lab 1-7
  14 Build Your Own Small LLM（下）训练篇：Lab 8-14
第三部分 · 扩展 Scale
  15 Scaling Laws / Compute
  16 GPU Fundamentals + Profiling
  17 Distributed Training
  18 Pretraining Data Pipeline      （下一批）
  19 FlashAttention + Triton        （下一批）
  20 训练显存与高效微调（原 13 章扩展）
第四部分 · 服务 Serve
  21 Inference Systems              （下一批）
第五部分 · 对齐 Align
  22 训练生命周期：Pretrain 与 SFT（原 11 章）
  23 Post-training 全景（原 12 章扩展）
  24 LLM Evaluation                 （下一批）
```

### 2.3 优先级与批次

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| **第一批** | PyTorch for LLM、Build Small LLM 上/下、Scaling Laws、GPU Fundamentals、Distributed Training | 本次实施 |
| 第二批 | Data Pipeline、FlashAttention/Triton、Inference Systems、LLM Evaluation、Post-training 全景化、训练显存扩展 | 后续 |
| 第三批 | 图文增强、MoE/Long Context/Reasoning 等 P1 | 后续 |

### 2.4 「图文并茂」的具体方案（每章强制）

对每个核心知识点按序组织：**问题 → 直觉 → 例子 → 定义 → 公式（逐项）→ Shape → 数值例子 → 结构图 → 代码 → 工程意义 → Trade-off → 误区 → 面试 → Quiz**，其中：

- **结构图/流程图**：用 HTML/CSS 静态图（如 GPU 存储层次、并行化布局、Ring AllReduce 环）
- **曲线图**：Canvas 绘制（如 isoFLOP 曲线、Roofline）
- **交互 demo**：新增 `js/demos-systems.js`（本批 5 个）：
  `scaling-calculator`（算力/时间/MFU 计算器）、`chinchilla-curve`（最优配比曲线）、
  `roofline`（算术强度→瓶颈判断）、`allreduce-ring`（环形通信分步动画）、`zero-stages`（ZeRO 显存对比）
- **复用既有**：构建篇直接引用现成 demo（bpe / rope / layernorm / attention / causal-mask 等），不重复造轮子

### 2.5 工程约束（遵守）

- 只改 `content/*.md`、`manifest.json`、`js/*`、`index.html`；不手改 `chapters/*.html`
- 构建产物一律由 `tools/build-static.js` 重新生成
- 所有资源本地化，不引入 CDN；沿用现有块语法与 demo 挂载协议
- 完成后：`bash tools/publish.sh` 一键发布（自建服务器 + GitHub 镜像）

---

## 三、验收标准（第一批）

1. 6 个新章节上线，主线图表（0 章）更新为五段式
2. 每章含：结构图/表格 ≥ 3、数值例子 ≥ 2、代码 ≥ 2、面试框、quiz、related
3. 新 demo 全部可交互且移动端可点
4. 全书 0 控制台错误；静态构建 + 双端发布成功
5. 学习者完成第一批后能够：读懂并手写 small LLM、估算训练算力与时间、判断算子瓶颈、说清四种并行方案的适用场景
