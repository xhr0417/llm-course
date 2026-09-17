# LLM Course

**从 Transformer 原理，到训练、推理系统，再到真实 AI 工程项目。**

🌐 在线课程：**[llm.xhr0417.cn](https://llm.xhr0417.cn/)**（镜像：[GitHub Pages](https://xhr0417.github.io/llm-course/)）

📚 **32 Chapters** · 🧪 **6 Runnable Projects** · **Track A / Track B / Track C**

这是一套中文交互式大模型课程：每章包含正文、交互演示和测验。网站按一条个人学习主线组织，当前入口是「我的学习」。六个可运行项目目录仍在仓库中，但已退出主导航和主要学习入口。课程不伪造实验结果，未在 CUDA 上执行的内容会明确标注 `NOT EXECUTED ON CUDA`。

## 从哪里开始

打开课程首页的 [我的学习](https://llm.xhr0417.cn/#/)，当前任务是 **小模型学习实验室—Attention**。页面会给出要读的教材小节、在空文件里先写单头再写多头的步骤，以及如何检查结果。本站不代写核心算法。

教材、交互演示和搜索仍可用：

- [浏览全部章节](https://llm.xhr0417.cn/#/catalog)
- 章节中的“按需查阅”入口会打开独立的参考手册，不占主线阅读路径
- [直接阅读静态章节页](chapters/)

旧的 `#/projects` 书签会打开说明页，提示这些作业已退出主线。三条岗位路线（Track A / Track B / Track C）仍可作为查阅分组打开，配置在 [`content/tracks.json`](content/tracks.json)，但它们不是当前主线。

## 3 分钟运行

```bash
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
python3 -m http.server 8000
```

浏览器打开 <http://127.0.0.1:8000>。课程网站是静态站，不需要安装前端依赖。打开首页即可看到当前 Attention 任务。

## 仓库中仍保留的项目目录

六个作业目录已退出主导航和主要学习入口，物理目录暂留，待后续审计。若仍要查看旧 Guided Build，分层是：

1. **Learn**：课程正文和参考手册。
2. **Guided Build**：从不完整 starter 开始，按步骤实现并运行测试。
3. **Reference**：完成后再对照完整工程和实验报告。

目录：

| 项目 | 入口章节 | 说明 |
| --- | --- | --- |
| [log-analyzer](projects/log-analyzer/) | 25 | Python 工程 CLI |
| [hf-mini-lab](projects/hf-mini-lab/) | 26 | HuggingFace / LoRA 工作流 |
| [llm-eval](projects/llm-eval/) | 27 | Mini Evaluation Harness |
| [rag-service](projects/rag-service/) | 29 | 检索、精排和 RAG 服务 |
| [sft-lora](projects/sft-lora/) | 30 | SFT / LoRA 实验闭环 |
| [inference-benchmark](projects/inference-benchmark/) | 31 | 推理性能分析 |

## 本地开发

源码和发布产物的关系：

```text
content/*.md + content/manifest.json
        │
        ├── 浏览器交互版：index.html + js/
        └── 静态阅读版：chapters/*.html
```

`chapters/`、`sitemap.xml`、`llms.txt`、`robots.txt` 和 `dist/` 是构建产物，不要手动编辑。Markdown 渲染统一由 [`js/renderer.js`](js/renderer.js) 提供，静态构建和浏览器使用同一套管线。发布脚本只把 `dist/` 同步到服务器。

如果需要在服务器运行模型或实验，先看[环境与工作流手册](docs/ENVIRONMENT_AND_WORKFLOW.md)，再参考[环境快照](docs/environment.txt)。核心原则只有一句：**代码提交 Git，大数据集、模型缓存、checkpoint 和密钥留在本机或服务器。**

## 发布前检查

```bash
node tools/build-static.js
node tools/build-dist.js
node --test tools/test-course.js
node tools/validate-static.js
node tools/validate-content.js
node tools/validate-guided.js
```

完整 CI 还会运行项目 Python 单测、starter 初始红灯断言和 RAG Docker 构建，见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。

## 课程原则

- 实验数字来自真实运行；没有执行过的环境明确标注。
- starter 初始失败是刻意设计，全部通过才表示 Guided Build 完成。
- 学习进度、测验答案和 Guided self-check 只保存在当前浏览器，不上传。
- 课程正文源文件在 `content/`，静态阅读页适合无 JavaScript 环境、搜索引擎和 AI 工具抓取。
