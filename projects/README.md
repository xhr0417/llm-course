# Projects —— Job-Ready Track 的真实项目

这里是本课程「能跑起来」的部分：每个目录都是**真实可运行**的工程，而不是网页上的代码片段。

| 项目 | 对应章节 | 技术栈 | 验证状态 |
| --- | --- | --- | --- |
| [`log-analyzer/`](log-analyzer/) | 25 Python Engineering | 纯标准库 + pytest | ✅ 14 个测试通过（本机实测） |
| [`hf-mini-lab/`](hf-mini-lab/) | 26 HuggingFace | transformers + peft + torch | ✅ 10 个测试通过；Qwen2.5-0.5B-Instruct CPU 上完整跑通（训练 loss 2.64→1.31） |

## 项目标准（每个项目都满足）

```
<project>/
├── README.md            # Quick Start + 设计说明
├── requirements.txt     # 依赖
├── src/<package>/       # 源码（可 import）
├── tests/               # pytest 测试
├── scripts/ 或 configs/ # 入口 / 配置
└── samples/ 或 data/    # 小样例数据
```

## 运行方式

```bash
cd projects/<project>
pip install -r requirements.txt
# 按 README 的 Quick Start 执行
```

## 纪律

- **不伪造实验数据**：README 与课程页面中的数字均来自真实运行；未在 CUDA 上执行的代码会明确标注 `NOT EXECUTED ON CUDA`。
- **单卡/CPU 优先**：默认模型与数据规模以「学生能在一台普通机器上跑完」为准。
- **代码可读优先**：不引入过度设计（无工厂、无依赖注入框架、无微服务），目标是第一段实习能讲清楚的工程。
