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

  /* ================= Progress ================= */
  function loadProgress() {
    try { state.progress = JSON.parse(localStorage.getItem("llm-course-progress") || "{}"); }
    catch (e) { state.progress = {}; }
  }
  function saveProgress() {
    localStorage.setItem("llm-course-progress", JSON.stringify(state.progress));
  }
  function updateProgressUI() {
    var done = state.chapters.filter(function (c) { return state.progress[c.id]; }).length;
    var total = state.chapters.length;
    els.progressText.textContent = done + " / " + total;
    els.progressFill.style.width = total ? (done / total * 100) + "%" : "0%";
    els.nav.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("done", !!state.progress[item.getAttribute("data-id")]);
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
    "量化": "efficient", "显存估算": "efficient"
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
    var isDone = !!state.progress[ch.id];

    var head = '<div class="chapter-head">' +
      '<div class="chapter-eyebrow">第 ' + escapeHtml(ch.num || (idx + 1)) + " 章 · " + escapeHtml(ch.group || "") + "</div>" +
      '<h1 class="chapter-title">' + escapeHtml(ch.title) + "</h1>" +
      (ch.desc ? '<p class="chapter-desc">' + escapeHtml(ch.desc) + "</p>" : "") +
      '<div class="chapter-meta">' +
        '<button class="btn ' + (isDone ? "done" : "primary") + '" id="markRead">' +
          (isDone ? "✓ 已读完（点击取消）" : "标记本章已读") +
        "</button>" +
        (ch.source ? '<span class="chapter-source">对应课件：' + escapeHtml(ch.source) + "</span>" : "") +
      "</div></div>";

    var body = '<div class="md" id="mdBody">' + renderMarkdown(state.contentCache[ch.id]) + "</div>";

    var footer = '<div class="chapter-footer">' +
      (prev ? '<a class="footer-link prev" href="#/' + prev.id + '"><span class="fl-label">← 上一章</span><span class="fl-title">' + escapeHtml(prev.title) + "</span></a>" : "<span></span>") +
      (next ? '<a class="footer-link next" href="#/' + next.id + '"><span class="fl-label">下一章 →</span><span class="fl-title">' + escapeHtml(next.title) + "</span></a>" : "<span></span>") +
      "</div>";

    els.content.innerHTML = head + body + footer;

    // mark-read button
    var btn = document.getElementById("markRead");
    btn.addEventListener("click", function () {
      if (state.progress[ch.id]) delete state.progress[ch.id];
      else state.progress[ch.id] = true;
      saveProgress();
      updateProgressUI();
      var done = !!state.progress[ch.id];
      btn.classList.toggle("done", done);
      btn.classList.toggle("primary", !done);
      btn.textContent = done ? "✓ 已读完（点击取消）" : "标记本章已读";
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
        (state.progress[ch.id] ? ' <span style="color:var(--green)">✓</span>' : "") +
        "</span></a>";
    }).join("");

    var html = '<div class="chapter-head">' +
      '<div class="chapter-eyebrow">LLM 学习路线 · 共 ' + total + " 章</div>" +
      '<h1 class="chapter-title">大模型知识体系 · 本地课程</h1>' +
      '<p class="chapter-desc">从 深度学习基础 一路走到 GRPO / LoRA / 混合精度，把 9 份课件串成一条完整主线。每章配有交互演示、算例、代码、误区与自测。</p>' +
      "</div>" +
      '<div class="callout key"><div class="callout-title">主线一句话</div><p>输入数据 → Tokenizer → Embedding → Transformer → Logits → Softmax → P(next token)；训练 = 前向传播 → 算 Loss → 反向传播 → 算梯度 → Optimizer 更新参数。</p></div>' +
      '<div class="md"><h2>章节目录</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px">' + cards + "</div>" +
      '<h2>怎么用这套课程</h2><ul>' +
      "<li>按顺序读：从第 1 章开始，每章末尾有「下一章」。</li>" +
      "<li>每个核心知识点按「先懂直觉 → 再看数学 → 工程里怎么用」三级展开，先读直觉。</li>" +
      "<li>遇到 <strong>🎮 交互演示</strong> 一定要动手拖一拖滑块——这是这套课程区别于普通笔记的地方。</li>" +
      "<li>每章末尾有 <strong>📝 小测验</strong> 和 <strong>🎯 面试常问</strong>，用来检查是否真的学会。</li>" +
      "<li>按 <strong>/</strong> 搜索任意知识点（如 GRPO、RoPE、交叉熵）。</li>" +
      "</ul></div>" +
      '<div class="chapter-footer"><span></span><a class="footer-link next" href="#/' + (state.chapters[0] ? state.chapters[0].id : "") + '"><span class="fl-label">开始学习 →</span><span class="fl-title">' + (state.chapters[0] ? escapeHtml(state.chapters[0].title) : "") + "</span></a></div>";

    els.content.innerHTML = html;
    els.tocNav.innerHTML = "";
    window.scrollTo({ top: 0 });
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
