(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CourseRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BOX_META = {
    intuition: { icon: "💡", title: "一句话直觉", cls: "box-intuition" },
    math: { icon: "🧮", title: "数学", cls: "box-math" },
    engineering: { icon: "🔧", title: "工程实践", cls: "box-engineering" },
    warning: { icon: "⚠️", title: "容易混淆", cls: "box-warning" },
    interview: { icon: "🎯", title: "面试常问", cls: "box-interview" },
    example: { icon: "📌", title: "具体例子", cls: "box-example" },
    note: { icon: "📘", title: "提示", cls: "box-note" },
    key: { icon: "🔑", title: "本节必须记住", cls: "box-key" },
    goal: { icon: "🎯", title: "本步目标", cls: "box-goal" },
    why: { icon: "❓", title: "为什么需要它", cls: "box-why" },
    files: { icon: "📁", title: "当前已有文件", cls: "box-files" },
    predict: { icon: "🔮", title: "先预测，再运行", cls: "box-predict" },
    write: { icon: "✍️", title: "现在你来做", cls: "box-write" },
    run: { icon: "▶️", title: "运行", cls: "box-run" },
    where: { icon: "📍", title: "执行环境与目录（先看这里）", cls: "box-where" },
    expect: { icon: "👀", title: "预期结果", cls: "box-expect" },
    fail: { icon: "🚨", title: "如果失败，观察这些", cls: "box-fail" },
    inspect: { icon: "🔍", title: "定位与修复", cls: "box-fail" },
    bug: { icon: "🐛", title: "Bug 记录", cls: "box-bug" },
    checkpoint: { icon: "✅", title: "本步验收（self-check）", cls: "box-checkpoint" },
    explain: { icon: "🗣️", title: "你应该能解释什么", cls: "box-explain" }
  };

  var TOPIC_LINKS = {
    "Self-Attention": "transformer", "Q/K/V": "transformer", "Multi-Head Attention": "transformer",
    "Causal Mask": "transformer", "LayerNorm": "transformer", "位置编码": "transformer", "FFN": "transformer",
    "Cross-Attention": "transformer", "Teacher Forcing": "transformer",
    "梯度下降": "basics", "反向传播": "basics", "Softmax": "basics", "交叉熵": "basics",
    "MLP": "basics", "激活函数": "basics", "MSE": "basics", "线性回归": "basics",
    "SGD": "optimizers", "Momentum": "optimizers", "Adam": "optimizers", "AdamW": "optimizers",
    "混淆矩阵": "evaluation", "Precision": "evaluation", "Recall": "evaluation", "F1": "evaluation",
    "Dropout": "evaluation", "L2 正则": "evaluation", "过拟合": "evaluation",
    "梯度消失": "stability", "梯度爆炸": "stability", "BatchNorm": "stability", "Residual": "stability",
    "权重初始化": "stability", "残差连接": "stability",
    "RNN": "rnn", "LSTM": "rnn", "GRU": "rnn", "Cell State": "rnn", "门控机制": "rnn", "BPTT": "rnn",
    "Tokenizer": "nlp", "BPE": "nlp", "BBPE": "nlp", "Embedding": "nlp", "Word2Vec": "nlp",
    "CBOW": "nlp", "Skip-Gram": "nlp", "子词切分": "nlp",
    "BERT": "bert", "MLM": "bert", "NSP": "bert", "[CLS]": "bert",
    "GPT": "gpt", "自回归生成": "gpt", "Next Token Prediction": "gpt", "Temperature": "gpt",
    "Top-K": "gpt", "Top-P": "gpt", "采样策略": "gpt",
    "KV Cache": "modern-llm", "GQA": "modern-llm", "MQA": "modern-llm", "RoPE": "modern-llm",
    "RMSNorm": "modern-llm", "Pre-Norm": "modern-llm", "Post-Norm": "modern-llm", "SwiGLU": "modern-llm",
    "SiLU": "modern-llm",
    "Pretrain": "pretrain-sft", "SFT": "pretrain-sft", "Loss Mask": "pretrain-sft",
    "Chat Template": "pretrain-sft", "Perplexity": "pretrain-sft", "MinHash": "pretrain-sft",
    "合成数据": "pretrain-sft", "数据配比": "pretrain-sft",
    "PPO": "rl-grpo", "GRPO": "rl-grpo", "KL 散度": "rl-grpo", "Reward Model": "rl-grpo",
    "Policy Ratio": "rl-grpo", "Clip": "rl-grpo", "On-policy": "rl-grpo",
    "LoRA": "efficient", "混合精度": "efficient", "FP16": "efficient", "BF16": "efficient",
    "量化": "efficient", "显存估算": "efficient",
    "pytest": "python-engineering", "argparse": "python-engineering", "dataclass": "python-engineering",
    "asyncio": "python-engineering", "logging": "python-engineering", "JSONL": "python-engineering",
    "pathlib": "python-engineering", "CLI": "python-engineering", "类型注解": "python-engineering",
    "AutoTokenizer": "huggingface", "HuggingFace": "huggingface", "PEFT": "huggingface",
    "generate()": "huggingface", "left padding": "huggingface", "Chat Template 实战": "huggingface",
    "Checkpoint": "job-ready", "实习路线": "job-ready", "能力矩阵": "job-ready",
    "Eval Harness": "capstone-eval", "评测工程": "capstone-eval", "bad case": "capstone-eval",
    "ModelAdapter": "capstone-eval", "并发评测": "capstone-eval",
    "RAG": "rag-engineering", "BM25": "rag-engineering", "Chunking": "rag-engineering",
    "Reranker": "rag-engineering", "Recall@k": "rag-engineering", "MRR": "rag-engineering",
    "nDCG": "rag-engineering", "Hybrid Retrieval": "rag-engineering",
    "FastAPI": "capstone-rag", "SSE": "capstone-rag", "Docker": "capstone-rag", "RAG Service": "capstone-rag",
    "SFT 实验": "capstone-sft", "best checkpoint": "capstone-sft", "实验报告": "capstone-sft",
    "profiler": "capstone-infra", "torch.profiler": "capstone-infra", "vLLM": "capstone-infra",
    "torch.compile": "capstone-infra", "TTFT 压测": "capstone-infra", "serving benchmark": "capstone-infra"
  };

  function create(options) {
    options = options || {};
    var marked = options.marked;
    var katex = options.katex;
    var mode = options.mode === "static" ? "static" : "interactive";
    var catalog = options.catalog || { chapters: [], tracks: [] };

    function escapeHtml(value) {
      return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function parseMarkdown(text) {
      if (!marked || typeof marked.parse !== "function") throw new Error("Markdown 渲染器未加载");
      return marked.parse(String(text));
    }

    function renderInline(tex) {
      try {
        return '<span class="math-inline">' + katex.renderToString(tex, { displayMode: false, throwOnError: false }) + "</span>";
      } catch (error) {
        return "<code>" + escapeHtml(tex) + "</code>";
      }
    }

    function renderDisplay(tex) {
      try {
        return '<div class="math-display">' + katex.renderToString(tex, { displayMode: true, throwOnError: false }) + "</div>";
      } catch (error) {
        return "<pre>" + escapeHtml(tex) + "</pre>";
      }
    }

    function stash(ctx, type, content) {
      ctx.protected.push({ type: type, content: content });
      return "@@PH" + (ctx.protected.length - 1) + "@@";
    }

    function extractProtected(md, ctx) {
      md = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (match, lang, code) {
        return stash(ctx, "CODE", '<pre><code class="lang-' + escapeHtml(lang) + '">' +
          escapeHtml(code.replace(/\n$/, "")) + "</code></pre>");
      });
      md = md.replace(/\$\$([\s\S]+?)\$\$/g, function (match, tex) { return stash(ctx, "DM", tex.trim()); });
      md = md.replace(/\$([^$\n]+?)\$/g, function (match, tex) { return stash(ctx, "IM", tex.trim()); });
      return md;
    }

    function getStash(ctx, index) {
      var entry = ctx.protected[index];
      if (!entry) return "";
      if (entry.type === "CODE") return entry.content;
      if (entry.type === "DM") return renderDisplay(entry.content);
      return renderInline(entry.content);
    }

    function restoreProtected(html, ctx) {
      var pattern = "@@PH(\\d+)@@";
      html = html.replace(new RegExp("<p>\\s*" + pattern + "\\s*</p>", "g"), function (match, index) {
        return getStash(ctx, parseInt(index, 10));
      });
      return html.replace(new RegExp(pattern, "g"), function (match, index) {
        return getStash(ctx, parseInt(index, 10));
      });
    }

    function extractContainers(md, ctx) {
      var lines = String(md).split("\n");
      var stack = [];
      var out = [];
      var containerPattern = /^:::([a-zA-Z-]+)(?:\s+(.*))?$/;

      function pushLine(line) {
        if (stack.length) stack[stack.length - 1].lines.push(line);
        else out.push(line);
      }

      function closeTop() {
        var node = stack.pop();
        var index = ctx.containers.length;
        ctx.containers.push({ kind: node.kind, title: node.title, content: node.lines.join("\n") });
        pushLine("@@CT" + index + "@@");
      }

      lines.forEach(function (line) {
        var match = containerPattern.exec(line.trim());
        if (match) {
          stack.push({ kind: match[1].toLowerCase(), title: (match[2] || "").trim(), lines: [] });
          return;
        }
        if (line.trim() === ":::") {
          if (stack.length) closeTop();
          else out.push(line);
          return;
        }
        pushLine(line);
      });
      while (stack.length) closeTop();
      return out.join("\n");
    }

    function renderPlainMarkdown(md) {
      var ctx = { protected: [] };
      return restoreProtected(parseMarkdown(extractProtected(md, ctx)), ctx);
    }

    function renderMarkdown(md, chapterId) {
      var ctx = { containers: [], protected: [], chapterId: chapterId || null, labCounter: 0, stepCounter: 0 };
      var prepared = extractContainers(String(md), ctx);
      prepared = extractProtected(prepared, ctx);
      var html = restoreProtected(parseMarkdown(prepared), ctx);
      return restoreContainers(html, ctx);
    }

    function renderContent(content, ctx) {
      if (content.indexOf("@@CT") === -1) return renderPlainMarkdown(content);
      return content.split(/(@@CT\d+@@)/).map(function (part) {
        var match = /^@@CT(\d+)@@$/.exec(part);
        if (match) return renderContainer(ctx.containers[parseInt(match[1], 10)], ctx);
        return part.trim() ? renderPlainMarkdown(part) : "";
      }).join("");
    }

    function renderLabNode(node, ctx) {
      var lines = String(node.content).split("\n");
      var meta = {};
      var rest = [];
      lines.forEach(function (line) {
        var match = /^(goal|project|solution|effort|prereq|deliverable|checkpoint)\s*[:：]\s*(.+)$/.exec(line.trim());
        if (match) meta[match[1].toLowerCase()] = match[2].trim();
        else rest.push(line);
      });
      ctx.labCounter = (ctx.labCounter || 0) + 1;
      var rows = [
        ["目标", meta.goal], ["Starter", meta.project], ["预计", meta.effort],
        ["前置", meta.prereq], ["交付", meta.deliverable], ["参考", meta.solution]
      ].filter(function (row) { return row[1]; }).map(function (row) {
        return '<div class="gl-meta-row"><span class="gl-meta-k">' + row[0] +
          '</span><span class="gl-meta-v">' + escapeHtml(row[1]) + "</span></div>";
      }).join("");
      var progress = mode === "static"
        ? '<div class="gl-progress"><div class="gl-note">Guided Build 的 step 进度与本步 self-check 在' +
          ' <a href="../index.html#/' + escapeHtml(ctx.chapterId || "") + '">交互版</a> 中记录（保存在你自己的浏览器里）。' +
          "静态阅读版只展示完整的构建路线。</div></div>"
        : '<div class="gl-progress"></div>';
      return '<section class="guided-lab" data-lab-id="lab' + ctx.labCounter + '"' +
        (ctx.chapterId ? ' data-chapter="' + escapeHtml(ctx.chapterId) + '"' : "") + ">" +
        '<div class="gl-head"><div class="gl-eyebrow">GUIDED BUILD · 一步一步亲手构建</div>' +
        '<div class="gl-title">' + escapeHtml(node.title || "Guided Build") + "</div>" +
        (rows ? '<div class="gl-meta">' + rows + "</div>" : "") + "</div>" + progress +
        '<div class="gl-body">' + renderContent(rest.join("\n"), ctx) + "</div></section>";
    }

    function renderStepNode(node, ctx) {
      var match = /^(\d+)[.、]?\s*(.*)$/.exec(node.title || "");
      var num = match ? match[1] : "";
      var title = match ? match[2] : (node.title || "Step");
      if (!num) {
        ctx.stepCounter = (ctx.stepCounter || 0) + 1;
        num = String(ctx.stepCounter);
      }
      var stepId = "s" + num;
      var foot = mode === "static" ? "" :
        '<div class="gs-foot"><span class="gs-hinttext">完成标准：在本地真实跑过本步测试（self-check，网站不验证）。</span>' +
        '<button class="gs-btn primary" data-gs-action="toggle">▶ 开始这一步</button></div>';
      var chip = mode === "static" ? "步骤 " + num : "○ 未开始";
      return '<section class="guided-step" data-step-id="' + escapeHtml(stepId) + '" data-state="todo">' +
        '<div class="gs-head"><span class="gs-num">' + escapeHtml(num) + "</span>" +
        '<h3 class="gs-title">' + escapeHtml(title) + '</h3><span class="gs-chip">' + chip + "</span></div>" +
        '<div class="gs-body">' + renderContent(node.content, ctx) + "</div>" + foot + "</section>";
    }

    function renderWhereNode(node) {
      var rows = String(node.content).trim().split("\n").filter(function (line) { return line.trim(); }).map(function (line) {
        var match = /^([^:：]{1,16})[:：]\s*(.+)$/.exec(line.trim());
        if (!match) return '<div class="where-row"><span class="where-v where-full">' + renderPlainMarkdown(line.trim()).replace(/^<p>\s*/, "").replace(/<\/p>\s*$/, "") + "</span></div>";
        return '<div class="where-row"><span class="where-k">' + escapeHtml(match[1].trim()) +
          '</span><span class="where-v">' + renderPlainMarkdown(match[2].trim()).replace(/^<p>\s*/, "").replace(/<\/p>\s*$/, "") + "</span></div>";
      }).join("");
      return '<div class="box box-where"><div class="box-title">📍 执行环境与目录（先看这里）</div>' +
        '<div class="box-body"><div class="where-rows">' + rows + "</div></div></div>";
    }

    function renderQuiz(content) {
      var lines = String(content).split("\n");
      var question = [], optionsList = [], answer = null, explain = [];
      var state = "question";
      lines.forEach(function (line) {
        var text = line.trim();
        var option = /^([A-H])[.、)]\s*(.+)$/.exec(text);
        if (option && state !== "explain") {
          state = "options";
          optionsList.push({ key: option[1], text: option[2] });
          return;
        }
        var answerMatch = /^答案[:：]\s*([A-H])/.exec(text);
        if (answerMatch) { answer = answerMatch[1]; state = "answer"; return; }
        var explainMatch = /^解析[:：]\s*(.*)$/.exec(text);
        if (explainMatch) { state = "explain"; if (explainMatch[1]) explain.push(explainMatch[1]); return; }
        if (state === "question") question.push(line);
        else if (state === "explain") explain.push(line);
      });
      if (!optionsList.length || !answer) {
        return '<div class="box box-warning"><div class="box-title">⚠️ 测验格式错误</div><div class="box-body">' +
          escapeHtml(content) + "</div></div>";
      }
      var questionHtml = renderPlainMarkdown(question.join("\n")).replace(/^<p>|<\/p>\s*$/g, "");
      var explainHtml = renderPlainMarkdown(explain.join("\n")).replace(/^<p>|<\/p>\s*$/g, "");
      if (mode === "static") {
        return '<div class="quiz"><div class="quiz-head"><span>📝 小测验</span></div>' +
          '<div class="quiz-question">' + questionHtml + '</div><div class="quiz-options">' +
          optionsList.map(function (option) {
            return '<div class="quiz-option"><span class="quiz-key">' + option.key + "</span><span>" +
              escapeHtml(option.text) + "</span></div>";
          }).join("") + '</div><details class="fold"><summary>显示答案与解析</summary><div class="fold-body">' +
          "<p><strong>正确答案：" + escapeHtml(answer) + "</strong></p>" + explainHtml +
          "</div></details></div>";
      }
      return '<div class="quiz" data-answer="' + escapeHtml(answer) + '"><div class="quiz-head"><span>📝 小测验</span>' +
        '<span class="quiz-status"></span></div><div class="quiz-question">' + questionHtml +
        '</div><div class="quiz-options">' + optionsList.map(function (option) {
          return '<button class="quiz-option" data-key="' + option.key + '"><span class="quiz-key">' + option.key +
            "</span><span>" + escapeHtml(option.text) + "</span></button>";
        }).join("") + '</div><div class="quiz-explain" hidden><strong>解析：</strong>' + explainHtml + "</div></div>";
    }

    function renderShapeFlow(content) {
      var rows = String(content).trim().split("\n").filter(function (line) { return line.trim(); });
      return '<div class="shapeflow">' + rows.map(function (line) {
        return '<div class="shape-row">' + line.split("→").map(function (segment, segmentIndex, segments) {
          var prefix = segmentIndex ? '<span class="shape-arrow">→</span>' : "";
          var parts = segment.split("×").map(function (part, partIndex) {
            var op = partIndex ? '<span class="shape-op">×</span>' : "";
            var match = /^\s*(.+?)\s*\[(.+?)\]\s*(.*)$/.exec(part);
            if (!match) return op + (part.trim() ? '<span class="shape-op">' + escapeHtml(part.trim()) + "</span>" : "");
            return op + '<span class="shape-part' + (segmentIndex === segments.length - 1 ? " result" : "") + '">' +
              '<span class="shape-name">' + escapeHtml(match[1]) + '</span><span class="shape-dims">[' +
              escapeHtml(match[2]) + "]</span>" + (match[3] ? '<span class="shape-note">' + escapeHtml(match[3]) + "</span>" : "") +
              "</span>";
          }).join("");
          return prefix + parts;
        }).join("") + "</div>";
      }).join("") + "</div>";
    }

    function renderRelated(content) {
      var rows = String(content).trim().split("\n").filter(function (line) { return line.trim(); });
      return '<div class="related"><div class="related-title">🔗 知识关联</div>' + rows.map(function (line) {
        var match = /^(.+?)\s*[|｜]\s*(.+)$/.exec(line);
        if (!match) return "";
        var tags = match[2].split(/[,，、]/).map(function (tag) {
          tag = tag.trim();
          if (!tag) return "";
          var chapter = TOPIC_LINKS[tag];
          if (!chapter) return '<span class="tag">' + escapeHtml(tag) + "</span>";
          if (mode === "static") return '<a class="tag" href="' + chapter + '.html">' + escapeHtml(tag) + "</a>";
          return '<a class="tag" href="#/' + chapter + '">' + escapeHtml(tag) + "</a>";
        }).join("");
        return '<div class="related-row"><span class="related-label">' + escapeHtml(match[1].trim()) +
          "</span>" + tags + "</div>";
      }).join("") + "</div>";
    }

    function routeHref(id) {
      return mode === "static" ? id + ".html" : "#/" + id;
    }

    function referenceHref(id) {
      return mode === "static" ? "reference-" + id + ".html" : "#/reference/" + id;
    }

    function chapterById(id) {
      return (catalog.chapters || []).find(function (chapter) { return chapter.id === id; }) || { id: id, title: id };
    }

    function renderRoutes(node) {
      var compact = String(node.title || "full").toLowerCase() === "compact";
      var tracks = catalog.tracks || [];
      return '<section class="course-routes ' + (compact ? "compact" : "full") + '"><div class="course-routes-head">' +
        '<span class="page-label">路线配置 · content/tracks.json</span><p>' +
        (compact ? "查阅分组由同一份配置生成；进入路线页后，下一课也沿用这份顺序。不是当前主线作业。" : "岗位查阅分组，不是当前主线。先看目标，再按顺序打开章节。") +
        "</p></div>" + tracks.map(function (track, index) {
          var items = track.chapters.map(chapterById);
          return '<article class="course-route"><header><span class="course-route-number">0' + (index + 1) +
            '</span><div><h3>' + escapeHtml(track.title) + '</h3><p>' + escapeHtml(track.description) +
            '</p>' + (track.roles ? '<p class="course-route-roles">岗位：' + escapeHtml(track.roles) + '</p>' : "") +
            '</div></header><p class="course-route-outcome"><strong>查阅范围：</strong>' + escapeHtml(track.outcome) +
            '</p><ol>' + items.map(function (chapter, chapterIndex) {
              return '<li><a href="' + routeHref(chapter.id) + '"><span>' + (chapterIndex + 1).toString().padStart(2, "0") +
                '</span>' + escapeHtml(chapter.shortTitle || chapter.title) + '</a></li>';
            }).join("") + "</ol></article>";
        }).join("") + "</section>";
    }

    function renderReferenceNode(node) {
      var id = String(node.title || "").trim();
      return '<div class="reference-note"><strong>按需查阅：</strong>' +
        '<a href="' + referenceHref(id) + '">' + escapeHtml(node.content.trim() || "打开本章参考手册") + "</a></div>";
    }

    function renderContainer(node, ctx) {
      if (!node) return "";
      var kind = node.kind, title = node.title, content = node.content;
      if (kind === "lab") return renderLabNode(node, ctx);
      if (kind === "step") return renderStepNode(node, ctx);
      if (kind === "where") return renderWhereNode(node);
      if (kind === "hint") return '<details class="hint"><summary>' + escapeHtml(title || "Hint") +
        '</summary><div class="fold-body">' + renderContent(content, ctx) + "</div></details>";
      if (kind === "solution") return '<details class="solution"><summary>' +
        escapeHtml(title || "查看参考实现（先自己做，再对照）") +
        '</summary><div class="fold-body"><p class="solution-note">参考实现用于对照，不是抄写目标；打开不会自动标记本步完成。</p>' +
        renderContent(content, ctx) + "</div></details>";
      if (kind === "demo") {
        var parts = title.split(/\s+/);
        var demoName = parts[0] || "";
        var demoTitle = parts.slice(1).join(" ") || demoName;
        var caption = content.trim() ? renderContent(content, ctx) : "";
        if (mode === "static") {
          var staticHref = "../index.html#/" + escapeHtml(ctx.chapterId || "");
          return '<div class="demo-block"><div class="demo-head">🎮 ' + escapeHtml(demoTitle) +
            '<span class="demo-tag">交互演示 · 静态阅读版</span></div>' +
            '<div class="demo-caption">' + (caption || "") + '<p><a class="static-link" href="' + staticHref +
            '">在交互版中打开这个演示 →</a></p></div></div>';
        }
        return '<div class="demo-block"><div class="demo-head">🎮 ' + escapeHtml(demoTitle) +
          '<span class="demo-tag">交互演示</span></div><div class="demo" data-demo="' + escapeHtml(demoName) +
          '"></div>' + (caption ? '<div class="demo-caption">' + caption + "</div>" : "") + "</div>";
      }
      if (kind === "quiz") return renderQuiz(content);
      if (kind === "shapeflow") return renderShapeFlow(content);
      if (kind === "related") return renderRelated(content);
      if (kind === "routes") return renderRoutes(node);
      if (kind === "reference") return renderReferenceNode(node);
      if (kind === "fold" || kind === "unfold") return '<details class="fold"' + (kind === "unfold" ? " open" : "") +
        '><summary>' + escapeHtml(title || "展开") + '</summary><div class="fold-body">' + renderContent(content, ctx) + "</div></details>";
      if (kind === "answer") return '<details class="answer"><summary>' + escapeHtml(title || "查看答案") +
        '</summary><div class="answer-body">' + renderContent(content, ctx) + "</div></details>";
      var meta = BOX_META[kind] || { icon: "📄", title: "说明", cls: "box-note" };
      var displayTitle = kind === "run" && title ? meta.title + " · " + title : (title || meta.title);
      return '<div class="box ' + meta.cls + '"><div class="box-title">' + meta.icon + " " + escapeHtml(displayTitle) +
        '</div><div class="box-body">' + renderContent(content, ctx) + "</div></div>";
    }

    function restoreContainers(html, ctx) {
      html = html.replace(new RegExp("<p>\\s*@@CT(\\d+)@@\\s*</p>", "g"), function (match, index) {
        return renderContainer(ctx.containers[parseInt(index, 10)], ctx);
      });
      return html.replace(/@@CT(\d+)@@/g, function (match, index) {
        return renderContainer(ctx.containers[parseInt(index, 10)], ctx);
      });
    }

    return {
      renderMarkdown: renderMarkdown,
      renderContainer: renderContainer,
      renderContent: renderContent,
      extractContainers: extractContainers,
      escapeHtml: escapeHtml,
      BOX_META: BOX_META,
      setCatalog: function (nextCatalog) {
        catalog = nextCatalog || { chapters: [], tracks: [] };
      }
    };
  }

  return { create: create };
});
