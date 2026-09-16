(function () {
  "use strict";

  var state = {
    manifest: null,
    chapters: [],
    currentId: null,
    contentCache: {},
    plainIndex: {},
    progress: {},
    tocObserver: null
  };

  var els = {
    nav: document.getElementById("chapterNav"),
    content: document.getElementById("content"),
    tocNav: document.getElementById("tocNav"),
    tocPanel: document.getElementById("tocPanel"),
    progressText: document.getElementById("progressText"),
    progressFill: document.getElementById("progressFill"),
    searchInput: document.getElementById("searchInput"),
    searchResults: document.getElementById("searchResults"),
    searchList: document.getElementById("searchList"),
    searchSummary: document.getElementById("searchSummary"),
    closeSearch: document.getElementById("closeSearch"),
    themeToggle: document.getElementById("themeToggle"),
    menuToggle: document.getElementById("menuToggle"),
    sidebar: document.getElementById("sidebar"),
    overlay: document.getElementById("overlay"),
    backTop: document.getElementById("backTop"),
    resetProgress: document.getElementById("resetProgress")
  };

  /* ================= Theme ================= */
  function initTheme() {
    var saved = localStorage.getItem("llm-course-theme");
    var theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }
  els.themeToggle.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("llm-course-theme", next);
  });

  /* ================= Progress（三级：阅读 / Lab / 项目） ================= */
  var PROGRESS_KEYS = ["read", "lab", "project"];
  function migrateProgress(raw) {
    var out = {};
    Object.keys(raw || {}).forEach(function (id) {
      var v = raw[id];
      if (v === true) out[id] = { read: true };
      else if (v && typeof v === "object") {
        out[id] = {};
        PROGRESS_KEYS.forEach(function (k) { if (v[k]) out[id][k] = true; });
      }
    });
    return out;
  }
  function loadProgress() {
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem("llm-course-progress") || "{}"); }
    catch (e) { raw = {}; }
    var needsWrite = Object.keys(raw).some(function (id) { return raw[id] === true; });
    state.progress = migrateProgress(raw);
    if (needsWrite) saveProgress();
  }
  function saveProgress() {
    localStorage.setItem("llm-course-progress", JSON.stringify(state.progress));
  }
  function isRead(id) { return !!(state.progress[id] && state.progress[id].read); }
  function countKey(key) {
    return state.chapters.filter(function (c) { return state.progress[c.id] && state.progress[c.id][key]; }).length;
  }
  function updateProgressUI() {
    var done = countKey("read");
    var total = state.chapters.length;
    var labTotal = state.chapters.filter(function (c) { return c.lab; }).length;
    var projTotal = state.chapters.filter(function (c) { return c.project; }).length;
    els.progressText.textContent = done + " / " + total +
      (labTotal ? " · Lab " + countKey("lab") + "/" + labTotal : "") +
      (projTotal ? " · 项目 " + countKey("project") + "/" + projTotal : "");
    els.progressFill.style.width = total ? (done / total * 100) + "%" : "0%";
    els.nav.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("done", isRead(item.getAttribute("data-id")));
    });
  }
  els.resetProgress.addEventListener("click", function () {
    if (confirm("确定要重置所有学习进度吗？")) {
      state.progress = {};
      saveProgress();
      updateProgressUI();
    }
  });

  /* ================= Quiz state ================= */
  function loadQuizState() {
    try { return JSON.parse(localStorage.getItem("llm-course-quiz") || "{}"); }
    catch (e) { return {}; }
  }
  function saveQuizState(st) {
    localStorage.setItem("llm-course-quiz", JSON.stringify(st));
  }

  /* ================= Markdown pipeline ================= */
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderMarkdown(md) {
    var ctx = { containers: [], protected: [] };
    var prepared = extractContainers(md, ctx);
    prepared = extractProtected(prepared, ctx);
    var html = marked.parse(prepared);
    html = restoreProtected(html, ctx);
    html = restoreContainers(html, ctx);
    return html;
  }

  /* ---- container extraction (supports nesting) ---- */
  var CT_RE = /^:::([a-zA-Z-]+)(?:\s+(.*))?$/;
  function extractContainers(md, ctx) {
    var lines = String(md).split("\n");
    var stack = [];
    var out = [];
    function pushLine(line) {
      if (stack.length) stack[stack.length - 1].lines.push(line);
      else out.push(line);
    }
    function closeTop() {
      var node = stack.pop();
      var content = node.lines.join("\n");
      var idx = ctx.containers.length;
      ctx.containers.push({ kind: node.kind, title: node.title, content: content });
      var ph = "@@CT" + idx + "@@";
      pushLine(ph);
    }
    lines.forEach(function (line) {
      var m = CT_RE.exec(line.trim());
      if (m) {
        stack.push({ kind: m[1].toLowerCase(), title: (m[2] || "").trim(), lines: [] });
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

  /* ---- code + math protection ---- */
  function stash(ctx, type, content) {
    ctx.protected.push({ type: type, content: content });
    return "@@PH" + (ctx.protected.length - 1) + "@@";
  }
  function extractProtected(md, ctx) {
    md = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (m, lang, code) {
      return stash(ctx, "CODE", '<pre><code class="lang-' + escapeHtml(lang) + '">' + escapeHtml(code.replace(/\n$/, "")) + "</code></pre>");
    });
    md = md.replace(/\$\$([\s\S]+?)\$\$/g, function (m, tex) {
      return stash(ctx, "DM", tex.trim());
    });
    md = md.replace(/\$([^$\n]+?)\$/g, function (m, tex) {
      return stash(ctx, "IM", tex.trim());
    });
    return md;
  }
  var PH_PATTERN = "@@PH(\\d+)@@";
  function getStash(ctx, idx) {
    var entry = ctx.protected[idx];
    if (!entry) return "";
    if (entry.type === "CODE") return entry.content;
    if (entry.type === "DM") return renderDisplay(entry.content);
    return renderInline(entry.content);
  }
  function restoreProtected(html, ctx) {
    html = html.replace(new RegExp("<p>\\s*" + PH_PATTERN + "\\s*</p>", "g"), function (m, i) {
      return getStash(ctx, parseInt(i, 10));
    });
    html = html.replace(new RegExp(PH_PATTERN, "g"), function (m, i) {
      return getStash(ctx, parseInt(i, 10));
    });
    return html;
  }
  function renderInline(tex) {
    try {
      return '<span class="math-inline">' + katex.renderToString(tex, { displayMode: false, throwOnError: false }) + "</span>";
    } catch (e) {
      return "<code>" + escapeHtml(tex) + "</code>";
    }
  }
  function renderDisplay(tex) {
    try {
      return '<div class="math-display">' + katex.renderToString(tex, { displayMode: true, throwOnError: false }) + "</div>";
    } catch (e) {
      return "<pre>" + escapeHtml(tex) + "</pre>";
    }
  }

  /* ---- container rendering ---- */
  var BOX_META = {
    intuition: { icon: "💡", title: "一句话直觉", cls: "box-intuition" },
    math: { icon: "🧮", title: "数学", cls: "box-math" },
    engineering: { icon: "🔧", title: "工程实践", cls: "box-engineering" },
    warning: { icon: "⚠️", title: "容易混淆", cls: "box-warning" },
    interview: { icon: "🎯", title: "面试常问", cls: "box-interview" },
    example: { icon: "📌", title: "具体例子", cls: "box-example" },
    note: { icon: "📘", title: "提示", cls: "box-note" },
    key: { icon: "🔑", title: "本节必须记住", cls: "box-key" }
  };

  function restoreContainers(html, ctx) {
    html = html.replace(new RegExp("<p>\\s*@@CT(\\d+)@@\\s*</p>", "g"), function (m, i) {
      return renderContainer(ctx.containers[parseInt(i, 10)], ctx);
    });
    html = html.replace(/@@CT(\d+)@@/g, function (m, i) {
      return renderContainer(ctx.containers[parseInt(i, 10)], ctx);
    });
    return html;
  }

  /* 渲染容器内容：先把属于同一 ctx 的子容器占位符替换成已渲染的 HTML，
     其余片段按 markdown 渲染。这样嵌套容器（如 interview 里的 answer）才能正确展开。 */
  function renderContent(content, ctx) {
    if (content.indexOf("@@CT") === -1) return renderMarkdown(content);
    var parts = content.split(/(@@CT\d+@@)/);
    var html = "";
    parts.forEach(function (part) {
      var m = /^@@CT(\d+)@@$/.exec(part);
      if (m) {
        var child = ctx.containers[parseInt(m[1], 10)];
        if (child) html += renderContainer(child, ctx);
      } else if (part.trim()) {
        html += renderMarkdown(part);
      }
    });
    return html;
  }

  function renderContainer(node, ctx) {
    if (!node) return "";
    var kind = node.kind, title = node.title, content = node.content;
    if (kind === "demo") {
      var parts = title.split(/\s+/);
      var demoName = parts[0] || "";
      var demoTitle = parts.slice(1).join(" ");
      var caption = content.trim() ? renderContent(content, ctx) : "";
      return '<div class="demo-block">' +
        '<div class="demo-head">🎮 ' + escapeHtml(demoTitle || demoName) + '<span class="demo-tag">交互演示</span></div>' +
        '<div class="demo" data-demo="' + escapeHtml(demoName) + '"></div>' +
        (caption ? '<div class="demo-caption">' + caption + "</div>" : "") +
        "</div>";
    }
    if (kind === "quiz") return renderQuiz(content);
    if (kind === "shapeflow") return renderShapeFlow(content);
    if (kind === "related") return renderRelated(content);
    if (kind === "fold" || kind === "unfold") {
      var open = kind === "unfold" ? " open" : "";
      return '<details class="fold"' + open + "><summary>" + escapeHtml(title || "展开") + "</summary>" +
        '<div class="fold-body">' + renderContent(content, ctx) + "</div></details>";
    }
    if (kind === "answer") {
      return '<details class="answer"><summary>' + escapeHtml(title || "查看答案") + "</summary>" +
        '<div class="answer-body">' + renderContent(content, ctx) + "</div></details>";
    }
    var meta = BOX_META[kind] || { icon: "📄", title: "说明", cls: "box-note" };
    return '<div class="box ' + meta.cls + '">' +
      '<div class="box-title">' + meta.icon + " " + escapeHtml(title || meta.title) + "</div>" +
      '<div class="box-body">' + renderContent(content, ctx) + "</div></div>";
  }

  /* ---- quiz ---- */
  function renderQuiz(content) {
    var lines = String(content).split("\n");
    var question = [], options = [], answer = null, explain = [];
    var mode = "q";
    lines.forEach(function (line) {
      var t = line.trim();
      var opt = /^([A-H])[.、)]\s*(.+)$/.exec(t);
      if (opt && mode !== "e") {
        mode = "o";
        options.push({ key: opt[1], text: opt[2] });
        return;
      }
      var ans = /^答案[:：]\s*([A-H])/.exec(t);
      if (ans) { answer = ans[1]; mode = "a"; return; }
      var exp = /^解析[:：]\s*(.*)$/.exec(t);
      if (exp) { mode = "e"; if (exp[1]) explain.push(exp[1]); return; }
      if (mode === "q") question.push(line);
      else if (mode === "e") explain.push(line);
    });
    if (!options.length || !answer) {
      return '<div class="box box-warning"><div class="box-title">⚠️ 测验格式错误</div><div class="box-body">' + escapeHtml(content) + "</div></div>";
    }
    var qHtml = renderMarkdown(question.join("\n"));
    var eHtml = renderMarkdown(explain.join("\n"));
    return '<div class="quiz" data-answer="' + escapeHtml(answer) + '">' +
      '<div class="quiz-head"><span>📝 小测验</span><span class="quiz-status"></span></div>' +
      '<div class="quiz-question">' + qHtml.replace(/^<p>|<\/p>\s*$/g, "") + "</div>" +
      '<div class="quiz-options">' +
      options.map(function (o) {
        return '<button class="quiz-option" data-key="' + o.key + '">' +
          '<span class="quiz-key">' + o.key + "</span><span>" + escapeHtml(o.text) + "</span></button>";
      }).join("") +
      "</div>" +
      '<div class="quiz-explain" hidden><strong>解析：</strong>' + eHtml.replace(/^<p>|<\/p>\s*$/g, "") + "</div>" +
      "</div>";
  }

  /* ---- shape flow ---- */
  function renderShapeFlow(content) {
    var rows = String(content).trim().split("\n").filter(function (l) { return l.trim(); });
    var html = '<div class="shapeflow">';
    rows.forEach(function (line) {
      var segs = line.split("→");
      html += '<div class="shape-row">';
      segs.forEach(function (seg, si) {
        if (si > 0) html += '<span class="shape-arrow">→</span>';
        var parts = seg.split("×");
        parts.forEach(function (part, pi) {
          if (pi > 0) html += '<span class="shape-op">×</span>';
          var m = /^\s*(.+?)\s*\[(.+?)\]\s*(.*)$/.exec(part);
          if (m) {
            html += '<span class="shape-part' + (si === segs.length - 1 ? " result" : "") + '">' +
              '<span class="shape-name">' + escapeHtml(m[1]) + "</span>" +
              '<span class="shape-dims">[' + escapeHtml(m[2]) + "]</span>" +
              (m[3] ? '<span class="shape-note">' + escapeHtml(m[3]) + "</span>" : "") +
              "</span>";
          } else if (part.trim()) {
            html += '<span class="shape-op">' + escapeHtml(part.trim()) + "</span>";
          }
        });
      });
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  /* ---- related topics ---- */
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
  function renderRelated(content) {
    var rows = String(content).trim().split("\n").filter(function (l) { return l.trim(); });
    var html = '<div class="related"><div class="related-title">🔗 知识关联</div>';
    rows.forEach(function (line) {
      var m = /^(.+?)\s*[|｜]\s*(.+)$/.exec(line);
      if (!m) return;
      html += '<div class="related-row"><span class="related-label">' + escapeHtml(m[1].trim()) + "</span>";
      m[2].split(/[,，、]/).forEach(function (tag) {
        tag = tag.trim();
        if (!tag) return;
        var ch = TOPIC_LINKS[tag];
        if (ch) html += '<a class="tag" href="#/' + ch + '">' + escapeHtml(tag) + "</a>";
        else html += '<span class="tag">' + escapeHtml(tag) + "</span>";
      });
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  /* ================= Data loading ================= */
  function loadManifest() {
    return fetch("content/manifest.json").then(function (r) { return r.json(); });
  }
  function fetchChapter(ch) {
    if (state.contentCache[ch.id]) return Promise.resolve(state.contentCache[ch.id]);
    return fetch("content/" + ch.file).then(function (r) {
      if (!r.ok) throw new Error("无法加载 " + ch.file);
      return r.text();
    }).then(function (text) {
      state.contentCache[ch.id] = text;
      return text;
    });
  }

  /* ================= Nav / TOC ================= */
  function renderNav() {
    var groups = [];
    state.chapters.forEach(function (ch) {
      var g = ch.group || "课程内容";
      var last = groups[groups.length - 1];
      if (!last || last.name !== g) { last = { name: g, items: [] }; groups.push(last); }
      last.items.push(ch);
    });
    var html = "";
    groups.forEach(function (g) {
      html += '<div class="nav-group-label">' + escapeHtml(g.name) + "</div>";
      g.items.forEach(function (ch) {
        html += '<a class="nav-item" data-id="' + ch.id + '" href="#/' + ch.id + '">' +
          '<span class="nav-num">' + escapeHtml(ch.num || "") + "</span>" +
          '<span class="nav-title">' + escapeHtml(ch.title) + "</span>" +
          '<svg class="nav-check" viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>' +
          "</a>";
      });
    });
    els.nav.innerHTML = html;
    updateProgressUI();
  }
  function renderToc(headings) {
    if (!headings.length) { els.tocNav.innerHTML = ""; return; }
    els.tocNav.innerHTML = headings.map(function (h) {
      return '<a class="toc-link lv' + h.level + '" href="#' + h.id + '" data-target="' + h.id + '">' + escapeHtml(h.text) + "</a>";
    }).join("");
  }
  function observeHeadings(headings) {
    if (state.tocObserver) state.tocObserver.disconnect();
    if (!headings.length) return;
    var links = els.tocNav.querySelectorAll(".toc-link");
    state.tocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          links.forEach(function (l) {
            l.classList.toggle("active", l.getAttribute("data-target") === id);
          });
        }
      });
    }, { rootMargin: "-70px 0px -70% 0px", threshold: 0 });
    headings.forEach(function (h) {
      var el = document.getElementById(h.id);
      if (el) state.tocObserver.observe(el);
    });
  }
  function setActiveNav(id) {
    els.nav.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-id") === id);
    });
  }

  /* ================= Chapter rendering ================= */
  function renderChapter(ch) {
    var idx = state.chapters.indexOf(ch);
    var prev = state.chapters[idx - 1];
    var next = state.chapters[idx + 1];
    if (!state.progress[ch.id]) state.progress[ch.id] = {};

    var toggles = [
      { key: "read", on: "✓ 已读完（点击取消）", off: "标记本章已读" }
    ];
    if (ch.lab) toggles.push({ key: "lab", on: "✓ Lab 已跑通（点击取消）", off: "标记 Lab 已跑通" });
    if (ch.project) toggles.push({ key: "project", on: "✓ 项目/Checkpoint 完成（点击取消）", off: "标记项目/Checkpoint 完成" });

    var head = '<div class="chapter-head">' +
      '<div class="chapter-eyebrow">第 ' + escapeHtml(ch.num || (idx + 1)) + " 章 · " + escapeHtml(ch.group || "") + "</div>" +
      '<h1 class="chapter-title">' + escapeHtml(ch.title) + "</h1>" +
      (ch.desc ? '<p class="chapter-desc">' + escapeHtml(ch.desc) + "</p>" : "") +
      '<div class="chapter-meta">' +
        toggles.map(function (t, i) {
          var active = !!(state.progress[ch.id] && state.progress[ch.id][t.key]);
          return '<button class="btn ' + (active ? "done" : "primary") + '" data-pkey="' + t.key + '">' +
            (active ? t.on : t.off) + "</button>";
        }).join("") +
        (ch.source ? '<span class="chapter-source">对应课件：' + escapeHtml(ch.source) + "</span>" : "") +
      "</div></div>";

    var body = '<div class="md" id="mdBody">' + renderMarkdown(state.contentCache[ch.id]) + "</div>";

    var footer = '<div class="chapter-footer">' +
      (prev ? '<a class="footer-link prev" href="#/' + prev.id + '"><span class="fl-label">← 上一章</span><span class="fl-title">' + escapeHtml(prev.title) + "</span></a>" : "<span></span>") +
      (next ? '<a class="footer-link next" href="#/' + next.id + '"><span class="fl-label">下一章 →</span><span class="fl-title">' + escapeHtml(next.title) + "</span></a>" : "<span></span>") +
      "</div>";

    els.content.innerHTML = head + body + footer;

    // 三级进度切换（阅读 / Lab / 项目）
    els.content.querySelectorAll("[data-pkey]").forEach(function (btn) {
      var key = btn.getAttribute("data-pkey");
      var def = toggles.filter(function (t) { return t.key === key; })[0];
      btn.addEventListener("click", function () {
        var p = state.progress[ch.id] || (state.progress[ch.id] = {});
        if (p[key]) delete p[key];
        else p[key] = true;
        saveProgress();
        updateProgressUI();
        var active = !!p[key];
        btn.classList.toggle("done", active);
        btn.classList.toggle("primary", !active);
        btn.textContent = active ? def.on : def.off;
      });
    });

    // headings + TOC
    var headings = [];
    els.content.querySelectorAll("#mdBody h2, #mdBody h3").forEach(function (h) {
      var text = h.textContent;
      var id = "sec-" + headings.length + "-" + text.replace(/[^\w\u4e00-\u9fa5]+/g, "-").slice(0, 40);
      h.id = id;
      headings.push({ id: id, text: text, level: h.tagName === "H2" ? 2 : 3 });
    });
    renderToc(headings);
    observeHeadings(headings);

    // quizzes: assign ids + restore state
    var quizState = loadQuizState();
    els.content.querySelectorAll(".quiz").forEach(function (q, i) {
      var qid = ch.id + "-q" + (i + 1);
      q.setAttribute("data-quiz-id", qid);
      var chosen = quizState[qid];
      if (chosen) applyQuizAnswer(q, chosen);
    });

    // interactive demos
    if (window.LC && window.LC.init) window.LC.init(els.content);

    window.scrollTo({ top: 0 });
  }

  function applyQuizAnswer(quiz, chosen) {
    var correct = quiz.getAttribute("data-answer");
    quiz.classList.add("answered");
    quiz.querySelectorAll(".quiz-option").forEach(function (o) {
      var k = o.getAttribute("data-key");
      if (k === correct) o.classList.add("correct");
      else if (k === chosen) o.classList.add("wrong");
    });
    var exp = quiz.querySelector(".quiz-explain");
    if (exp) exp.hidden = false;
    var st = quiz.querySelector(".quiz-status");
    if (st) {
      var ok = chosen === correct;
      st.textContent = ok ? "✓ 回答正确" : "✗ 正确答案：" + correct;
      st.className = "quiz-status " + (ok ? "ok" : "no");
    }
  }

  els.content.addEventListener("click", function (e) {
    var opt = e.target.closest(".quiz-option");
    if (!opt) return;
    var quiz = opt.closest(".quiz");
    if (!quiz || quiz.classList.contains("answered")) return;
    var chosen = opt.getAttribute("data-key");
    applyQuizAnswer(quiz, chosen);
    var qid = quiz.getAttribute("data-quiz-id");
    if (qid) {
      var st = loadQuizState();
      st[qid] = chosen;
      saveQuizState(st);
    }
  });

  function showHome() {
    var total = state.chapters.length;
    var cards = state.chapters.map(function (ch) {
      return '<a class="nav-item" style="display:flex;padding:10px 12px" href="#/' + ch.id + '">' +
        '<span class="nav-num">' + escapeHtml(ch.num || "") + "</span>" +
        '<span class="nav-title">' + escapeHtml(ch.title) +
        (isRead(ch.id) ? ' <span style="color:var(--green)">✓</span>' : "") +
        "</span></a>";
    }).join("");

    var trackCard = function (title, target, jobs, route) {
      return '<div style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;background:var(--bg-panel)">' +
        '<div style="font-weight:800;margin-bottom:6px">' + title + "</div>" +
        '<div style="font-size:12.5px;color:var(--text-soft);margin-bottom:8px">' + jobs + "</div>" +
        '<div style="font-size:12.5px;line-height:1.9;color:var(--text)">' + route + "</div>" +
        '<div style="margin-top:10px"><a class="tag" href="#/' + target + '">查看路线与 Checkpoint →</a></div>' +
        "</div>";
    };
    var chLink = function (label, id) { return '<a class="tag" href="#/' + id + '">' + label + "</a>"; };

    var jobSection = '<h2>我要找什么实习？</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:10px 0 4px">' +
      trackCard("Track A · AI 应用开发", "job-ready",
        "大模型应用开发 / AI 应用研发 / 大模型评测 / AI 平台 / LLM Engineer Intern",
        chLink("Python 工程", "python-engineering") + " → " + chLink("PyTorch", "pytorch") + " → " +
        chLink("Transformer", "transformer") + " → " + chLink("HuggingFace", "huggingface") + " → " +
        chLink("Evaluation", "llm-eval") + " → " + chLink("Capstone 1 · Eval Harness", "capstone-eval") + " → " + chLink("RAG 工程", "rag-engineering") + " → " + chLink("Capstone 2 · RAG Service", "capstone-rag") + " → <span style='color:var(--text-soft)'>SFT/算法方向见 Track B</span>") +
      trackCard("Track B · 大模型算法", "job-ready",
        "大模型算法 / 机器学习算法 / 模型训练与后训练实习",
        chLink("Transformer", "transformer") + " → " + chLink("Build Small LLM", "build-llm-1") + " → " +
        chLink("Data Pipeline", "data-pipeline") + " → " + chLink("Pretraining", "pretrain-sft") + " → " +
        chLink("HuggingFace", "huggingface") + " → " + chLink("SFT/LoRA", "efficient") + " → " +
        chLink("DPO/GRPO", "rl-grpo") + " → " + chLink("Evaluation", "llm-eval") + " → " + chLink("Capstone 3 · SFT/LoRA", "capstone-sft") + " → <span style='color:var(--text-soft)'>Experiment Design ✅</span>") +
      trackCard("Track C · AI Infra / ML Systems", "job-ready",
        "AI Infra / ML Systems / 大模型推理框架 / 性能工程实习",
        chLink("PyTorch", "pytorch") + " → " + chLink("GPU", "gpu") + " → " +
        chLink("FlashAttention/Triton", "flash-attention") + " → " + chLink("Distributed", "distributed") + " → " +
        chLink("Inference", "inference") + " → " + chLink("Capstone 4 · Profiling Lab", "capstone-infra") + " → <span style='color:var(--text-soft)'>vLLM Benchmark（需 CUDA）</span>") +
      "</div>" +
      '<div id="projectsCard" style="border:1px dashed var(--border);border-radius:12px;padding:12px 16px;margin:12px 0;font-size:13.5px">' +
      '<span style="font-weight:800">可运行项目</span> · <span style="color:var(--text-soft)">加载中…</span></div>' +
      '<p style="font-size:13px;color:var(--text-soft)">完整能力矩阵、Checkpoint 验收标准与四级学习标准见 ' +
      '<a class="tag" href="#/job-ready">第 24 章 · Job-Ready Track</a>。</p>';

    var guideSection = '<h2>现在应该学什么</h2>' +
      '<p style="font-size:13.5px">没有实习经历？按这条线走（约 8-10 周），完成后即可投递：</p>' +
      '<div style="font-size:13.5px;line-height:2.1">' +
      chLink("25 Python 工程", "python-engineering") + " → " + chLink("11 PyTorch", "pytorch") + " → " +
      chLink("07 Transformer", "transformer") + " → " + chLink("26 HuggingFace", "huggingface") + " → " +
      chLink("23 Evaluation", "llm-eval") + " → " + chLink("27 Capstone 1 · Eval Harness", "capstone-eval") + " → " + chLink("28 RAG 工程", "rag-engineering") + " → " + chLink("29 Capstone 2 · RAG Service", "capstone-rag") + " → <span style='color:var(--text-soft)'>开始投递</span>" +
      "</div>" +
      '<p style="font-size:13px;color:var(--text-soft)">之后按方向分叉：算法方向走 SFT/Data/后训练；Infra 方向走 GPU/FlashAttention/Distributed/Inference/Profiling。' +
      "学习进度按「阅读 / Lab / 项目」三级分别记录——读完 Markdown 只点亮第一级。</p>";

    var html = '<div class="chapter-head">' +
      '<div class="chapter-eyebrow">LLM 学习路线 · 共 ' + total + " 章</div>" +
      '<h1 class="chapter-title">大模型知识体系 · 本地课程</h1>' +
      '<p class="chapter-desc">Knowledge Track（懂）+ Job-Ready Track（能做）：从 深度学习基础 走到 GRPO / LoRA / 混合精度，再用真实项目做出第一段 AI 实习的作品集。</p>' +
      "</div>" +
      '<div class="callout key"><div class="callout-title">主线一句话</div><p>输入数据 → Tokenizer → Embedding → Transformer → Logits → Softmax → P(next token)；训练 = 前向传播 → 算 Loss → 反向传播 → 算梯度 → Optimizer 更新参数。</p></div>' +
      '<div class="md">' + jobSection + guideSection +
      '<h2>章节目录</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px">' + cards + "</div>" +
      '<h2>怎么用这套课程</h2><ul>' +
      "<li>求职优先：先看上面「我要找什么实习」，按对应 Track 的顺序补能力。</li>" +
      "<li>按顺序读：从第 1 章开始，每章末尾有「下一章」。</li>" +
      "<li>每个核心知识点按「先懂直觉 → 再看数学 → 工程里怎么用」三级展开，先读直觉。</li>" +
      "<li>遇到 <strong>🎮 交互演示</strong> 一定要动手拖一拖滑块——这是这套课程区别于普通笔记的地方。</li>" +
      "<li>Job-Ready 章节（24-31）配 <strong>projects/ 真实项目</strong>：clone 下来跑一遍、跑测试、改一处代码再跑——这才是「Ran」。</li>" +
      "<li>按 <strong>/</strong> 搜索任意知识点（如 GRPO、RoPE、Chat Template）。</li>" +
      "</ul></div>" +
      '<div class="chapter-footer"><span></span><a class="footer-link next" href="#/' + (state.chapters[0] ? state.chapters[0].id : "") + '"><span class="fl-label">开始学习 →</span><span class="fl-title">' + (state.chapters[0] ? escapeHtml(state.chapters[0].title) : "") + "</span></a></div>";

    els.content.innerHTML = html;
    els.tocNav.innerHTML = "";
    window.scrollTo({ top: 0 });

    // 项目清单动态加载（数字来自 content/projects.json，构建时扫描 projects/ 生成）
    fetch("content/projects.json").then(function (r) { return r.json(); }).then(function (data) {
      var el = document.getElementById("projectsCard");
      if (!el || !data || !data.projects) return;
      var chips = data.projects.map(function (p) {
        return '<span class="tag" style="margin:2px 4px 2px 0">' + escapeHtml(p.name) + "</span>";
      }).join("");
      el.innerHTML = '<span style="font-weight:800">' + data.count + " 个可运行项目</span>" +
        '（<a class="tag" href="https://github.com/xhr0417/llm-course/tree/main/projects" target="_blank" rel="noopener">projects/</a>）：' +
        chips +
        '<div style="font-size:12.5px;color:var(--text-soft);margin-top:6px">每个项目都含 README + requirements + src + tests；CPU 实测数字写在各自 README 中，未在 CUDA 执行的实验明确标注。</div>';
    }).catch(function () {
      var el = document.getElementById("projectsCard");
      if (el) el.innerHTML = '<span style="font-weight:800">可运行项目</span>：见仓库 projects/ 目录';
    });
  }

  function route() {
    var hash = location.hash.replace(/^#\/?/, "");
    if (!hash || hash === "" || hash === "home") {
      state.currentId = null;
      setActiveNav(null);
      showHome();
      closeSidebar();
      return;
    }
    var ch = state.chapters.find(function (c) { return c.id === hash; });
    if (!ch) {
      state.currentId = null;
      setActiveNav(null);
      showHome();
      return;
    }
    state.currentId = ch.id;
    setActiveNav(ch.id);
    closeSidebar();
    els.content.innerHTML = '<div class="loading">正在加载《' + escapeHtml(ch.title) + "》…</div>";
    fetchChapter(ch).then(function () {
      renderChapter(ch);
    }).catch(function (err) {
      els.content.innerHTML = '<div class="loading">加载失败：' + escapeHtml(err.message) + "</div>";
    });
  }

  /* ================= Search ================= */
  function mdToPlainText(md) {
    return md
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\$\$[\s\S]+?\$\$/g, " ")
      .replace(/\$[^$\n]+?\$/g, " ")
      .replace(/:::[a-zA-Z-]*.*$/gm, " ")
      .replace(/[#>*`|]/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }
  function buildSearchIndex() {
    return Promise.all(state.chapters.map(function (ch) {
      return fetchChapter(ch).then(function (text) {
        var sections = [];
        var lines = text.split("\n");
        var current = { title: ch.title, body: [] };
        lines.forEach(function (line) {
          var m = /^##\s+(.*)/.exec(line);
          if (m) {
            if (current.body.length) sections.push(current);
            current = { title: m[1], body: [] };
          } else if (!/^#{1,6}\s/.test(line)) {
            current.body.push(line);
          }
        });
        if (current.body.length) sections.push(current);
        state.plainIndex[ch.id] = sections.map(function (s) {
          return { title: s.title, text: mdToPlainText(s.body.join("\n")) };
        });
      });
    }));
  }
  function doSearch(query) {
    var q = query.trim().toLowerCase();
    if (!q) { closeSearchResults(); return; }
    var results = [];
    state.chapters.forEach(function (ch) {
      (state.plainIndex[ch.id] || []).forEach(function (s) {
        var titleHit = s.title.toLowerCase().indexOf(q) !== -1;
        var bodyIdx = s.text.toLowerCase().indexOf(q);
        if (titleHit || bodyIdx !== -1) {
          var snippet;
          if (bodyIdx !== -1) {
            var start = Math.max(0, bodyIdx - 45);
            var end = Math.min(s.text.length, bodyIdx + q.length + 75);
            snippet = (start > 0 ? "…" : "") + s.text.slice(start, end) + (end < s.text.length ? "…" : "");
          } else {
            snippet = s.text.slice(0, 110) + "…";
          }
          results.push({ chapter: ch, section: s.title, snippet: snippet });
        }
      });
    });
    els.searchResults.hidden = false;
    els.searchSummary.textContent = "找到 " + results.length + " 条与「" + query.trim() + "」相关的结果";
    if (!results.length) {
      els.searchList.innerHTML = '<div class="search-empty">没有找到相关内容，换个关键词试试？</div>';
      return;
    }
    els.searchList.innerHTML = results.slice(0, 60).map(function (r) {
      var hl = escapeHtml(r.snippet).replace(new RegExp(escapeRegExp(escapeHtml(query.trim())), "gi"), function (m) { return "<mark>" + m + "</mark>"; });
      return '<a class="search-hit" href="#/' + r.chapter.id + '">' +
        '<div class="hit-chapter">' + escapeHtml(r.chapter.title) + " · " + escapeHtml(r.section) + "</div>" +
        '<div class="hit-snippet">' + hl + "</div></a>";
    }).join("");
  }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function closeSearchResults() {
    els.searchResults.hidden = true;
    els.searchInput.value = "";
  }
  els.closeSearch.addEventListener("click", closeSearchResults);
  els.searchResults.addEventListener("click", function (e) {
    if (e.target === els.searchResults) closeSearchResults();
    if (e.target.closest(".search-hit")) closeSearchResults();
  });
  var searchTimer = null;
  els.searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    var v = els.searchInput.value;
    searchTimer = setTimeout(function () { doSearch(v); }, 160);
  });
  els.searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSearchResults();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== els.searchInput) {
      e.preventDefault();
      els.searchInput.focus();
    }
    if (e.key === "Escape") { closeSearchResults(); closeSidebar(); }
  });

  /* ================= Sidebar / misc ================= */
  function openSidebar() { els.sidebar.classList.add("open"); els.overlay.classList.add("show"); }
  function closeSidebar() { els.sidebar.classList.remove("open"); els.overlay.classList.remove("show"); }
  els.menuToggle.addEventListener("click", function () {
    els.sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
  });
  els.overlay.addEventListener("click", closeSidebar);

  window.addEventListener("scroll", function () {
    els.backTop.hidden = window.scrollY < 500;
  }, { passive: true });
  els.backTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ================= Boot ================= */
  initTheme();
  loadProgress();
  loadManifest().then(function (manifest) {
    state.manifest = manifest;
    state.chapters = manifest.chapters;
    document.title = manifest.title + " · 本地课程";
    renderNav();
    route();
    return buildSearchIndex();
  }).then(function () {
    window.addEventListener("hashchange", route);
  }).catch(function (err) {
    els.content.innerHTML = '<div class="loading">初始化失败：' + escapeHtml(err.message) + "<br>请确认通过本地服务器访问（python3 -m http.server），而不是直接双击打开 HTML。</div>";
  });
})();
