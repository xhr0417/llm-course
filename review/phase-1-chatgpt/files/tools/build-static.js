#!/usr/bin/env node
/**
 * 静态化构建脚本
 * 把 content/*.md 渲染为服务端可直接读取的 HTML 页面（爬虫 / AI 抓取 / 无 JS 环境可用）。
 *
 * 用法（在项目根目录）：
 *   node tools/build-static.js
 *
 * Markdown 渲染统一由 js/renderer.js 提供；本脚本只负责静态模式、页面模板和发布产物。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const marked = require(path.join(ROOT, "vendor", "marked.min.js"));
const katex = require(path.join(ROOT, "vendor", "katex", "katex.js"));
const rendererModule = require(path.join(ROOT, "js", "renderer.js"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "manifest.json"), "utf8"));
const tracksConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "tracks.json"), "utf8"));
const renderer = rendererModule.create({
  marked: marked,
  katex: katex,
  mode: "static",
  catalog: { chapters: manifest.chapters, tracks: tracksConfig.tracks }
});
const referencesConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "references.json"), "utf8"));
const SITE_NAME = manifest.title || "大模型知识体系";
const SITE_URL = "https://llm.xhr0417.cn";

const escapeHtml = renderer.escapeHtml;

function pageTemplate(chapter, index, bodyHtml) {
  const previous = manifest.chapters[index - 1];
  const next = manifest.chapters[index + 1];
  const navTop = '<div class="static-nav">' +
    (previous ? '<a href="' + previous.id + '.html">← ' + escapeHtml(previous.title) + "</a>" : "<span></span>") +
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
    '<link rel="stylesheet" href="../css/course.css">\n' +
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
    '  <span style="color:var(--text-faint);font-size:13px">第 ' + escapeHtml(chapter.num || (index + 1)) + " 章</span>\n" +
    '  <span class="spacer"></span>\n' +
    '  <a href="../index.html#/' + chapter.id + '">🎮 交互版（含动画演示与测验）</a>\n' +
    "</header>\n" +
    '<main class="static-wrap">\n' +
    navTop +
    '<div class="static-banner">你正在浏览<strong>静态阅读版</strong>（无 JavaScript 也可阅读，便于搜索与 AI 抓取）。' +
    '交互演示与答题功能请前往 <a href="../index.html#/' + chapter.id + '">交互版</a>。</div>\n' +
    '<div class="chapter-head">' +
    '<div class="chapter-eyebrow">第 ' + escapeHtml(chapter.num || (index + 1)) + " 章 · " + escapeHtml(chapter.group || "") + "</div>" +
    '<h1 class="chapter-title">' + escapeHtml(chapter.title) + "</h1>" +
    (chapter.desc ? '<p class="chapter-desc">' + escapeHtml(chapter.desc) + "</p>" : "") +
    (chapter.source ? '<p class="chapter-source">对应课件：' + escapeHtml(chapter.source) + "</p>" : "") +
    "</div>\n" +
    '<div class="md">\n' + bodyHtml + "</div>\n" +
    navTop +
    '<div class="static-banner">本章完。原始 Markdown：<a href="../content/' + chapter.file + '">content/' + chapter.file + "</a></div>\n" +
    "</main>\n</body>\n</html>\n";
}

function referenceTemplate(reference, chapter, bodyHtml) {
  return "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n" +
    '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    "<title>" + escapeHtml(reference.title) + " · " + escapeHtml(SITE_NAME) + "</title>\n" +
    '<meta name="description" content="' + escapeHtml(reference.desc) + '">\n' +
    '<link rel="canonical" href="' + SITE_URL + "/chapters/reference-" + reference.id + '.html">\n' +
    '<link rel="stylesheet" href="../vendor/katex/katex.min.css">\n<link rel="stylesheet" href="../css/style.css">\n' +
    '<link rel="stylesheet" href="../css/course.css">\n' +
    "<style>" +
    "  .static-wrap{max-width:880px;margin:0 auto;padding:20px 20px 90px;}" +
    "  .static-top{position:sticky;top:0;z-index:10;background:var(--bg-panel);border-bottom:1px solid var(--border);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;}" +
    "  .static-top a{color:var(--text-soft);text-decoration:none;font-size:13.5px;}" +
    "  .static-top a:hover{color:var(--accent-text);}" +
    "  .static-top .spacer{margin-left:auto;}" +
    "  .static-nav{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:26px 0;padding-top:18px;border-top:1px solid var(--border);}" +
    "  .static-nav a{color:var(--accent-text);text-decoration:none;font-size:13.5px;}" +
    "  .static-banner{margin:18px 0 8px;padding:10px 14px;border-radius:10px;background:var(--accent-soft);color:var(--accent-text);font-size:13px;}" +
    "</style>\n</head>\n<body>\n" +
    '<header class="static-top"><strong>' + escapeHtml(SITE_NAME) + '</strong><span class="spacer"></span>' +
    '<a href="' + chapter.id + '.html">← 返回第 ' + escapeHtml(chapter.num) + ' 章</a><a href="../index.html">回到交互版首页</a></header>\n' +
    '<main class="static-wrap"><div class="static-nav"><a href="' + chapter.id + '.html">← 返回主线</a><a href="../index.html">回到交互版首页</a></div>' +
    '<div class="static-banner">这是按需查阅的参考手册，不是主线必读内容。</div>' +
    '<div class="chapter-head"><div class="chapter-eyebrow">参考手册 · 第 ' + escapeHtml(chapter.num) + ' 章</div>' +
    '<h1 class="chapter-title">' + escapeHtml(reference.title) + '</h1><p class="chapter-desc">' + escapeHtml(reference.desc) +
    '</p></div><div class="md">' + bodyHtml + '</div><div class="static-nav"><a href="' + chapter.id + '.html">← 返回主线</a><a href="../index.html">回到交互版首页</a></div></main>\n</body>\n</html>\n';
}

function main() {
  const outDir = path.join(ROOT, "chapters");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let built = 0;
  let totalMath = 0;
  manifest.chapters.forEach(function (chapter, index) {
    const markdown = fs.readFileSync(path.join(ROOT, "content", chapter.file), "utf8");
    const html = renderer.renderMarkdown(markdown, chapter.id);
    totalMath += (html.match(/katex/g) || []).length;
    fs.writeFileSync(path.join(outDir, chapter.id + ".html"), pageTemplate(chapter, index, html));
    built++;
  });
  referencesConfig.references.forEach(function (reference) {
    const chapter = manifest.chapters.find(function (item) { return item.id === reference.chapter; });
    if (!chapter) throw new Error("参考手册未找到所属章节：" + reference.chapter);
    const markdown = fs.readFileSync(path.join(ROOT, "content", reference.file), "utf8");
    const html = renderer.renderMarkdown(markdown, "reference/" + reference.id);
    fs.writeFileSync(path.join(outDir, "reference-" + reference.id + ".html"), referenceTemplate(reference, chapter, html));
  });

  /* index.html 注入静态目录（不含 JS 也能看到并点进各章） */
  const indexPath = path.join(ROOT, "index.html");
  let indexHtml = fs.readFileSync(indexPath, "utf8");
  const start = "<!-- STATIC-INDEX-START -->";
  const end = "<!-- STATIC-INDEX-END -->";
  const tocHtml = start + "\n" +
    '      <div class="chapter-head">\n' +
    '        <h1 class="chapter-title">' + escapeHtml(SITE_NAME) + " · 静态目录</h1>\n" +
    '        <p class="chapter-desc">交互版首页是「我的学习」，当前主线从 Attention 开始。共 ' + manifest.chapters.length + ' 章教材仍可查阅。下方链接为静态阅读版（无需 JavaScript）；完整交互体验请直接浏览本页。</p>\n' +
    "      </div>\n" +
    '      <div class="md">\n' +
    "        <h2>章节目录</h2>\n        <ol>\n" +
    manifest.chapters.map(function (chapter) {
      return '          <li><a href="chapters/' + chapter.id + '.html">' + escapeHtml(chapter.title) + "</a>" +
        (chapter.desc ? " — " + escapeHtml(chapter.desc) : "") + "</li>";
    }).join("\n") +
    "\n        </ol>\n" +
    "      </div>\n      " + end;
  if (indexHtml.indexOf(start) !== -1 && indexHtml.indexOf(end) !== -1) {
    indexHtml = indexHtml.replace(new RegExp(start + "[\\s\\S]*?" + end), tocHtml);
  }
  fs.writeFileSync(indexPath, indexHtml);

  /* content/projects.json —— 项目清单（首页/校验器共用，避免硬编码过期） */
  const projectsDir = path.join(ROOT, "projects");
  const projectEntries = [];
  if (fs.existsSync(projectsDir)) {
    fs.readdirSync(projectsDir).filter(function (name) {
      const full = path.join(projectsDir, name);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "README.md"));
    }).forEach(function (name) {
      const testsDir = path.join(projectsDir, name, "tests");
      let testFunctions = 0;
      if (fs.existsSync(testsDir)) {
        fs.readdirSync(testsDir).filter(function (file) { return file.endsWith(".py"); }).forEach(function (file) {
          const source = fs.readFileSync(path.join(testsDir, file), "utf8");
          testFunctions += (source.match(/def test_/g) || []).length;
        });
      }
      projectEntries.push({ name: name, testFunctions: testFunctions });
    });
  }
  fs.writeFileSync(path.join(ROOT, "content", "projects.json"),
    JSON.stringify({ count: projectEntries.length, projects: projectEntries }, null, 2) + "\n");

  /* sitemap.xml */
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['  <url><loc>' + SITE_URL + '/</loc><lastmod>' + today + "</lastmod><priority>1.0</priority></url>"]
    .concat(manifest.chapters.map(function (chapter) {
      return "  <url><loc>" + SITE_URL + "/chapters/" + chapter.id + ".html</loc><lastmod>" + today + "</lastmod><priority>0.8</priority></url>";
    })).concat(referencesConfig.references.map(function (reference) {
      return "  <url><loc>" + SITE_URL + "/chapters/reference-" + reference.id + ".html</loc><lastmod>" + today + "</lastmod><priority>0.5</priority></url>";
    }));
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") + "\n</urlset>\n");

  fs.writeFileSync(path.join(ROOT, "robots.txt"),
    "User-agent: *\nAllow: /\n\nSitemap: " + SITE_URL + "/sitemap.xml\n");

  const llms = [SITE_NAME, "", "> " + (manifest.chapters[0].desc || "大模型知识体系交互式教程"), "",
    "静态阅读页（HTML，可直接抓取）："].join("\n") + "\n" +
    manifest.chapters.map(function (chapter) {
      return "- [" + chapter.title + "](" + SITE_URL + "/chapters/" + chapter.id + ".html): " + (chapter.desc || "");
    }).join("\n") + "\n\n参考手册：\n" + referencesConfig.references.map(function (reference) {
      return "- [" + reference.title + "](" + SITE_URL + "/chapters/reference-" + reference.id + ".html): " + reference.desc;
    }).join("\n") + "\n\n原始 Markdown：\n" +
    manifest.chapters.map(function (chapter) {
      return "- [" + chapter.file + "](" + SITE_URL + "/content/" + chapter.file + ")";
    }).join("\n") + "\n";
  fs.writeFileSync(path.join(ROOT, "llms.txt"), llms);

  console.log("✅ 静态化完成");
  console.log("   章节页：" + built + " 个 → chapters/*.html");
  console.log("   KaTeX 渲染：" + totalMath + " 处");
  console.log("   额外产物：sitemap.xml / robots.txt / llms.txt / index.html 静态目录");
}

if (require.main === module) main();

module.exports = {
  renderMarkdown: renderer.renderMarkdown,
  renderContainer: renderer.renderContainer,
  renderContent: renderer.renderContent,
  extractContainers: renderer.extractContainers,
  BOX_META: renderer.BOX_META
};
