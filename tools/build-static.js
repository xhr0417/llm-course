#!/usr/bin/env node
/**
 * 静态化构建脚本
 * 把 content/*.md 渲染为服务端可直接读取的 HTML 页面（爬虫 / AI 抓取 / 无 JS 环境可用）。
 *
 * 用法（在项目根目录）：
 *   node tools/build-static.js
 *
 * 产物：
 *   chapters/<id>.html   每章一个静态页（含全部正文、KaTeX 公式、折叠答案、静态版测验）
 *   sitemap.xml          站点地图
 *   robots.txt           允许抓取 + 指向 sitemap
 *   llms.txt             面向 AI 工具的索引（标题 + 摘要 + 原始 markdown 链接）
 *   index.html           注入静态版章节目录（位于 <!-- STATIC-INDEX-START/END --> 之间）
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const marked = require(path.join(ROOT, "vendor", "marked.min.js"));
const katex = require(path.join(ROOT, "vendor", "katex", "katex.js"));

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "manifest.json"), "utf8"));
const SITE_NAME = manifest.title || "大模型知识体系";
const SITE_URL = "https://llm.xhr0417.cn";

/* ================= 工具 ================= */
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ================= 渲染管线（与 js/app.js 保持一致，含嵌套容器修复） ================= */
function renderMarkdown(md) {
  const ctx = { containers: [], protected: [] };
  let prepared = extractContainers(md, ctx);
  prepared = extractProtected(prepared, ctx);
  let html = marked.parse(prepared);
  html = restoreProtected(html, ctx);
  html = restoreContainers(html, ctx);
  return html;
}

const CT_RE = /^:::([a-zA-Z-]+)(?:\s+(.*))?$/;
function extractContainers(md, ctx) {
  const lines = String(md).split("\n");
  const stack = [];
  const out = [];
  function pushLine(line) {
    if (stack.length) stack[stack.length - 1].lines.push(line);
    else out.push(line);
  }
  function closeTop() {
    const node = stack.pop();
    const content = node.lines.join("\n");
    const idx = ctx.containers.length;
    ctx.containers.push({ kind: node.kind, title: node.title, content: content });
    pushLine("@@CT" + idx + "@@");
  }
  lines.forEach(function (line) {
    const m = CT_RE.exec(line.trim());
    if (m) { stack.push({ kind: m[1].toLowerCase(), title: (m[2] || "").trim(), lines: [] }); return; }
    if (line.trim() === ":::") { if (stack.length) closeTop(); else out.push(line); return; }
    pushLine(line);
  });
  while (stack.length) closeTop();
  return out.join("\n");
}

function stash(ctx, type, content) {
  ctx.protected.push({ type: type, content: content });
  return "@@PH" + (ctx.protected.length - 1) + "@@";
}
function extractProtected(md, ctx) {
  md = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (m, lang, code) {
    return stash(ctx, "CODE", '<pre><code class="lang-' + escapeHtml(lang) + '">' + escapeHtml(code.replace(/\n$/, "")) + "</code></pre>");
  });
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, function (m, tex) { return stash(ctx, "DM", tex.trim()); });
  md = md.replace(/\$([^$\n]+?)\$/g, function (m, tex) { return stash(ctx, "IM", tex.trim()); });
  return md;
}
function renderInline(tex) {
  try {
    return '<span class="math-inline">' + katex.renderToString(tex, { displayMode: false, throwOnError: false }) + "</span>";
  } catch (e) { return "<code>" + escapeHtml(tex) + "</code>"; }
}
function renderDisplay(tex) {
  try {
    return '<div class="math-display">' + katex.renderToString(tex, { displayMode: true, throwOnError: false }) + "</div>";
  } catch (e) { return "<pre>" + escapeHtml(tex) + "</pre>"; }
}
function getStash(ctx, idx) {
  const entry = ctx.protected[idx];
  if (!entry) return "";
  if (entry.type === "CODE") return entry.content;
  if (entry.type === "DM") return renderDisplay(entry.content);
  return renderInline(entry.content);
}
const PH_PATTERN = "@@PH(\\d+)@@";
function restoreProtected(html, ctx) {
  html = html.replace(new RegExp("<p>\\s*" + PH_PATTERN + "\\s*</p>", "g"), function (m, i) {
    return getStash(ctx, parseInt(i, 10));
  });
  html = html.replace(new RegExp(PH_PATTERN, "g"), function (m, i) {
    return getStash(ctx, parseInt(i, 10));
  });
  return html;
}

const BOX_META = {
  intuition: { icon: "💡", title: "一句话直觉", cls: "box-intuition" },
  math: { icon: "🧮", title: "数学", cls: "box-math" },
  engineering: { icon: "🔧", title: "工程实践", cls: "box-engineering" },
  warning: { icon: "⚠️", title: "容易混淆", cls: "box-warning" },
  interview: { icon: "🎯", title: "面试常问", cls: "box-interview" },
  example: { icon: "📌", title: "具体例子", cls: "box-example" },
  note: { icon: "📘", title: "提示", cls: "box-note" },
  key: { icon: "🔑", title: "本节必须记住", cls: "box-key" }
};

/* 知识关联标签 -> 静态页链接 */
const TOPIC_LINKS = {
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
  "Checkpoint": "job-ready", "实习路线": "job-ready", "能力矩阵": "job-ready"
};

function renderContent(content, ctx, chapterId) {
  if (content.indexOf("@@CT") === -1) return renderMarkdown(content);
  const parts = content.split(/(@@CT\d+@@)/);
  let html = "";
  parts.forEach(function (part) {
    const m = /^@@CT(\d+)@@$/.exec(part);
    if (m) {
      const child = ctx.containers[parseInt(m[1], 10)];
      if (child) html += renderContainer(child, ctx, chapterId);
    } else if (part.trim()) {
      html += renderMarkdown(part);
    }
  });
  return html;
}

function renderContainer(node, ctx, chapterId) {
  if (!node) return "";
  const kind = node.kind, title = node.title, content = node.content;

  if (kind === "demo") {
    const parts = title.split(/\s+/);
    const demoName = parts[0] || "";
    const demoTitle = parts.slice(1).join(" ") || demoName;
    const caption = content.trim() ? renderContent(content, ctx, chapterId) : "";
    return '<div class="demo-block">' +
      '<div class="demo-head">🎮 ' + escapeHtml(demoTitle) + '<span class="demo-tag">交互演示 · 静态阅读版</span></div>' +
      (caption ? '<div class="demo-caption">' + caption +
        '<p><a class="static-link" href="../index.html#/' + escapeHtml(chapterId) + '">在交互版中打开这个演示 →</a></p>' +
        "</div>" : '<div class="demo-caption"><p><a class="static-link" href="../index.html#/' + escapeHtml(chapterId) + '">在交互版中打开这个演示 →</a></p></div>') +
      "</div>";
  }

  if (kind === "quiz") return renderQuizStatic(content);

  if (kind === "shapeflow") return renderShapeFlowStatic(content);

  if (kind === "related") return renderRelatedStatic(content);

  if (kind === "fold" || kind === "unfold") {
    const open = kind === "unfold" ? " open" : "";
    return '<details class="fold"' + open + "><summary>" + escapeHtml(title || "展开") + "</summary>" +
      '<div class="fold-body">' + renderContent(content, ctx, chapterId) + "</div></details>";
  }
  if (kind === "answer") {
    return '<details class="answer"><summary>' + escapeHtml(title || "查看答案") + "</summary>" +
      '<div class="answer-body">' + renderContent(content, ctx, chapterId) + "</div></details>";
  }
  const meta = BOX_META[kind] || { icon: "📄", title: "说明", cls: "box-note" };
  return '<div class="box ' + meta.cls + '">' +
    '<div class="box-title">' + meta.icon + " " + escapeHtml(title || meta.title) + "</div>" +
    '<div class="box-body">' + renderContent(content, ctx, chapterId) + "</div></div>";
}

function renderQuizStatic(content) {
  const lines = String(content).split("\n");
  const question = [], options = [];
  let answer = null, explain = [];
  let mode = "q";
  lines.forEach(function (line) {
    const t = line.trim();
    const opt = /^([A-H])[.、)]\s*(.+)$/.exec(t);
    if (opt && mode !== "e") { mode = "o"; options.push({ key: opt[1], text: opt[2] }); return; }
    const ans = /^答案[:：]\s*([A-H])/.exec(t);
    if (ans) { answer = ans[1]; mode = "a"; return; }
    const exp = /^解析[:：]\s*(.*)$/.exec(t);
    if (exp) { mode = "e"; if (exp[1]) explain.push(exp[1]); return; }
    if (mode === "q") question.push(line);
    else if (mode === "e") explain.push(line);
  });
  if (!options.length || !answer) return "<div class=\"box box-warning\"><div class=\"box-body\">" + escapeHtml(content) + "</div></div>";
  const qHtml = renderMarkdown(question.join("\n")).replace(/^<p>|<\/p>\s*$/g, "");
  const eHtml = renderMarkdown(explain.join("\n")).replace(/^<p>|<\/p>\s*$/g, "");
  return '<div class="quiz">' +
    '<div class="quiz-head"><span>📝 小测验</span></div>' +
    '<div class="quiz-question">' + qHtml + "</div>" +
    '<div class="quiz-options">' +
    options.map(function (o) {
      return '<div class="quiz-option"><span class="quiz-key">' + o.key + "</span><span>" + escapeHtml(o.text) + "</span></div>";
    }).join("") +
    "</div>" +
    '<details class="fold"><summary>显示答案与解析</summary><div class="fold-body">' +
    "<p><strong>正确答案：" + escapeHtml(answer) + "</strong></p>" + eHtml +
    "</div></details>" +
    "</div>";
}

function renderShapeFlowStatic(content) {
  const rows = String(content).trim().split("\n").filter(function (l) { return l.trim(); });
  let html = '<div class="shapeflow">';
  rows.forEach(function (line) {
    const segs = line.split("→");
    html += '<div class="shape-row">';
    segs.forEach(function (seg, si) {
      if (si > 0) html += '<span class="shape-arrow">→</span>';
      const parts = seg.split("×");
      parts.forEach(function (part, pi) {
        if (pi > 0) html += '<span class="shape-op">×</span>';
        const m = /^\s*(.+?)\s*\[(.+?)\]\s*(.*)$/.exec(part);
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

function renderRelatedStatic(content) {
  const rows = String(content).trim().split("\n").filter(function (l) { return l.trim(); });
  let html = '<div class="related"><div class="related-title">🔗 知识关联</div>';
  rows.forEach(function (line) {
    const m = /^(.+?)\s*[|｜]\s*(.+)$/.exec(line);
    if (!m) return;
    html += '<div class="related-row"><span class="related-label">' + escapeHtml(m[1].trim()) + "</span>";
    m[2].split(/[,，、]/).forEach(function (tag) {
      tag = tag.trim();
      if (!tag) return;
      const ch = TOPIC_LINKS[tag];
      if (ch) html += '<a class="tag" href="' + ch + '.html">' + escapeHtml(tag) + "</a>";
      else html += '<span class="tag">' + escapeHtml(tag) + "</span>";
    });
    html += "</div>";
  });
  html += "</div>";
  return html;
}

function restoreContainers(html, ctx) {
  html = html.replace(new RegExp("<p>\\s*@@CT(\\d+)@@\\s*</p>", "g"), function (m, i) {
    return renderContainer(ctx.containers[parseInt(i, 10)], ctx, ctx.chapterId);
  });
  html = html.replace(/@@CT(\d+)@@/g, function (m, i) {
    return renderContainer(ctx.containers[parseInt(i, 10)], ctx, ctx.chapterId);
  });
  return html;
}

/* ================= 静态页模板 ================= */
function pageTemplate(chapter, idx, bodyHtml, toc) {
  const prev = manifest.chapters[idx - 1];
  const next = manifest.chapters[idx + 1];
  const navTop = '<div class="static-nav">' +
    (prev ? '<a href="' + prev.id + '.html">← ' + escapeHtml(prev.title) + "</a>" : "<span></span>") +
    '<a href="../index.html" class="static-home">🏠 回到交互版首页</a>' +
    (next ? '<a href="' + next.id + '.html">' + escapeHtml(next.title) + " →</a>" : "<span></span>") +
    "</div>";

  return "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    "<title>" + escapeHtml(chapter.title) + " · " + escapeHtml(SITE_NAME) + "</title>\n" +
    (chapter.desc ? '<meta name="description" content="' + escapeHtml(chapter.desc) + '">\n' : "") +
    '<link rel="canonical" href="' + SITE_URL + "/chapters/" + chapter.id + '.html">\n' +
    '<link rel="stylesheet" href="../vendor/katex/katex.min.css">\n' +
    '<link rel="stylesheet" href="../css/style.css">\n' +
    "<style>\n" +
    "  .static-wrap { max-width: 880px; margin: 0 auto; padding: 20px 20px 90px; }\n" +
    "  .static-top { position: sticky; top: 0; z-index: 10; background: var(--bg-panel); border-bottom: 1px solid var(--border); padding: 10px 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }\n" +
    "  .static-top a { color: var(--text-soft); text-decoration: none; font-size: 13.5px; }\n" +
    "  .static-top a:hover { color: var(--accent-text); }\n" +
    "  .static-top .crumb { font-weight: 700; color: var(--text); font-size: 14px; }\n" +
    "  .static-top .spacer { margin-left: auto; }\n" +
    "  .static-banner { margin: 18px 0 8px; padding: 10px 14px; border-radius: 10px; background: var(--accent-soft); color: var(--accent-text); font-size: 13px; }\n" +
    "  .static-banner a { color: var(--accent-text); font-weight: 700; }\n" +
    "  .static-nav { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 26px 0; padding-top: 18px; border-top: 1px solid var(--border); }\n" +
    "  .static-nav a { color: var(--accent-text); text-decoration: none; font-size: 13.5px; }\n" +
    "  .static-nav a.static-home { color: var(--text-soft); }\n" +
    "  .quiz-option { cursor: default; }\n" +
    "</style>\n" +
    "</head>\n<body>\n" +
    '<header class="static-top">\n' +
    '  <span class="crumb">' + escapeHtml(SITE_NAME) + "</span>\n" +
    '  <span style="color:var(--text-faint);font-size:13px">第 ' + escapeHtml(chapter.num || (idx + 1)) + " 章</span>\n" +
    '  <span class="spacer"></span>\n' +
    '  <a href="../index.html#/' + chapter.id + '">🎮 交互版（含动画演示与测验）</a>\n' +
    "</header>\n" +
    '<main class="static-wrap">\n' +
    navTop +
    '<div class="static-banner">你正在浏览<strong>静态阅读版</strong>（无 JavaScript 也可阅读，便于搜索与 AI 抓取）。' +
    '交互演示与答题功能请前往 <a href="../index.html#/' + chapter.id + '">交互版</a>。</div>\n' +
    '<div class="chapter-head">' +
    '<div class="chapter-eyebrow">第 ' + escapeHtml(chapter.num || (idx + 1)) + " 章 · " + escapeHtml(chapter.group || "") + "</div>" +
    '<h1 class="chapter-title">' + escapeHtml(chapter.title) + "</h1>" +
    (chapter.desc ? '<p class="chapter-desc">' + escapeHtml(chapter.desc) + "</p>" : "") +
    (chapter.source ? '<p class="chapter-source">对应课件：' + escapeHtml(chapter.source) + "</p>" : "") +
    "</div>\n" +
    '<div class="md">\n' + bodyHtml + "</div>\n" +
    navTop +
    '<div class="static-banner">本章完。原始 Markdown：<a href="../content/' + chapter.file + '">content/' + chapter.file + "</a></div>\n" +
    "</main>\n" +
    "</body>\n</html>\n";
}

/* ================= 构建主流程 ================= */
const outDir = path.join(ROOT, "chapters");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let built = 0, totalMath = 0;
manifest.chapters.forEach(function (ch, idx) {
  const md = fs.readFileSync(path.join(ROOT, "content", ch.file), "utf8");
  const ctx = { containers: [], protected: [], chapterId: ch.id };
  let prepared = extractContainers(md, ctx);
  prepared = extractProtected(prepared, ctx);
  let html = marked.parse(prepared);
  html = restoreProtected(html, ctx);
  html = restoreContainers(html, ctx);
  totalMath += (html.match(/katex/g) || []).length;
  const page = pageTemplate(ch, idx, html);
  fs.writeFileSync(path.join(outDir, ch.id + ".html"), page);
  built++;
});

/* index.html 注入静态目录（不含 JS 也能看到并点进各章） */
const indexPath = path.join(ROOT, "index.html");
let indexHtml = fs.readFileSync(indexPath, "utf8");
const START = "<!-- STATIC-INDEX-START -->";
const END = "<!-- STATIC-INDEX-END -->";
const tocHtml = START + "\n" +
  '      <div class="chapter-head">\n' +
  '        <h1 class="chapter-title">' + escapeHtml(SITE_NAME) + " · 静态目录</h1>\n" +
  '        <p class="chapter-desc">Knowledge Track（懂）+ Job-Ready Track（能做）：从 深度学习基础 走到 GRPO / LoRA / 混合精度，再用真实项目完成第一段 AI 实习的作品集（projects/ 目录）。共 ' + manifest.chapters.length + ' 章。下方链接为静态阅读版（无需 JavaScript）；完整交互体验请直接浏览本页。</p>\n' +
  "      </div>\n" +
  '      <div class="md">\n' +
  "        <h2>章节目录</h2>\n        <ol>\n" +
  manifest.chapters.map(function (ch) {
    return '          <li><a href="chapters/' + ch.id + '.html">' + escapeHtml(ch.title) + "</a>" +
      (ch.desc ? " — " + escapeHtml(ch.desc) : "") + "</li>";
  }).join("\n") +
  "\n        </ol>\n" +
  "      </div>\n" +
  "      " + END;
if (indexHtml.indexOf(START) !== -1 && indexHtml.indexOf(END) !== -1) {
  indexHtml = indexHtml.replace(new RegExp(START + "[\\s\\S]*?" + END), tocHtml);
} else {
  indexHtml = indexHtml.replace(
    '<div class="loading">正在加载…</div>',
    tocHtml + '\n      <div class="loading">正在加载交互版…</div>'
  );
}
fs.writeFileSync(indexPath, indexHtml);

/* sitemap.xml */
const today = new Date().toISOString().slice(0, 10);
const urls = ['  <url><loc>' + SITE_URL + '/</loc><lastmod>' + today + "</lastmod><priority>1.0</priority></url>"]
  .concat(manifest.chapters.map(function (ch) {
    return "  <url><loc>" + SITE_URL + "/chapters/" + ch.id + ".html</loc><lastmod>" + today + "</lastmod><priority>0.8</priority></url>";
  }));
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.join("\n") + "\n</urlset>\n");

/* robots.txt */
fs.writeFileSync(path.join(ROOT, "robots.txt"),
  "User-agent: *\nAllow: /\n\nSitemap: " + SITE_URL + "/sitemap.xml\n");

/* llms.txt（面向 AI 工具的索引） */
const llms = [SITE_NAME, "", "> " + (manifest.chapters[0].desc || "大模型知识体系交互式教程"), "",
  "静态阅读页（HTML，可直接抓取）："].join("\n") + "\n" +
  manifest.chapters.map(function (ch) {
    return "- [" + ch.title + "](" + SITE_URL + "/chapters/" + ch.id + ".html): " + (ch.desc || "");
  }).join("\n") + "\n\n原始 Markdown：\n" +
  manifest.chapters.map(function (ch) {
    return "- [" + ch.file + "](" + SITE_URL + "/content/" + ch.file + ")";
  }).join("\n") + "\n";
fs.writeFileSync(path.join(ROOT, "llms.txt"), llms);

console.log("✅ 静态化完成");
console.log("   章节页：" + built + " 个 → chapters/*.html");
console.log("   KaTeX 渲染：" + totalMath + " 处");
console.log("   额外产物：sitemap.xml / robots.txt / llms.txt / index.html 静态目录");
