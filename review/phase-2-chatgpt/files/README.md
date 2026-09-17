# LLM Course

**从 Transformer 原理，到训练、推理系统，再到一条个人动手主线。**

🌐 在线课程：**[llm.xhr0417.cn](https://llm.xhr0417.cn/)**（镜像：[GitHub Pages](https://xhr0417.github.io/llm-course/)）

📚 **32 Chapters** · 当前入口「我的学习」· 岗位路线仅作查阅分组

这是一套中文交互式大模型课程：每章包含正文、交互演示和测验。网站按一条个人学习主线组织：**小模型学习实验室 → 技术声明核验助手 / 单 Agent → 算法或 Infra 专项**。六个旧作业目录仍在仓库中，但已退出必修，不是当前要完成的项目。课程不伪造实验结果，未在 CUDA 上执行的内容会明确标注 `NOT EXECUTED ON CUDA`。

## 从哪里开始

打开课程首页的 [我的学习](https://llm.xhr0417.cn/#/)，当前任务是 **小模型学习实验室—Attention**。页面会给出要读的教材小节、在空文件里先写单头再写多头的步骤，以及如何检查结果。本站不代写核心算法。

教材、交互演示和搜索仍可用：

- [浏览全部章节](https://llm.xhr0417.cn/#/catalog)
- 章节中的“按需查阅”入口会打开独立的参考手册，不占主线阅读路径
- [直接阅读静态章节页](chapters/)

旧的 `#/projects` 书签会打开说明页，提示这些作业已退出主线。三条岗位路线（Track A / Track B / Track C）仍可作为查阅分组打开，配置在 [`content/tracks.json`](content/tracks.json)，但它们不是当前主线，也不要求完成六个旧作业。

## 3 分钟运行

```bash
git clone https://github.com/xhr0417/llm-course.git
cd llm-course
python3 -m http.server 8000
```

浏览器打开 <http://127.0.0.1:8000>。课程网站是静态站，不需要安装前端依赖。打开首页即可看到当前 Attention 任务。

## 仓库中仍保留的项目目录（可选参考，非当前作业）

六个旧作业目录已退出主导航和必修流程，物理目录暂留，待后续审计后再删除。下面的链接只供对照历史实现，**不要当作现在要做的作业**，也不要进入各目录下的 `starter/` 当主线练习。

| 目录 | 对应教材章 | 说明 |
| --- | --- | --- |
| [log-analyzer](projects/log-analyzer/) | 25 | 历史参考：Python 工程 CLI |
| [hf-mini-lab](projects/hf-mini-lab/) | 26 | 历史参考：HuggingFace / LoRA 工作流 |
| [llm-eval](projects/llm-eval/) | 27 | 历史参考：Mini Evaluation Harness |
| [rag-service](projects/rag-service/) | 29 | 历史参考：检索、精排和 RAG 服务 |
| [sft-lora](projects/sft-lora/) | 30 | 历史参考：SFT / LoRA 实验闭环 |
| [inference-benchmark](projects/inference-benchmark/) | 31 | 历史参考：推理性能分析 |

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

完整 CI 仍会运行残留参考代码的 Python 单测和 RAG Docker 构建（目录删除前的正确性核对），**不再**要求 starter 初始红灯。见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。

## 课程原则

- 实验数字来自真实运行；没有执行过的环境明确标注。
- 六个旧作业及其 starter 已退出必修；不要为了过旧测试把它们接回主线。
- 学习进度和测验答案只保存在当前浏览器，不上传。旧 Guided 记录若还在，含义不变。
- 课程正文源文件在 `content/`，静态阅读页适合无 JavaScript 环境、搜索引擎和 AI 工具抓取。
