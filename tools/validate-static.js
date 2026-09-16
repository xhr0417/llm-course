#!/usr/bin/env node
/**
 * 静态页渲染验证：检查 chapters/*.html 是否真正正确渲染
 * （「build 成功」≠「页面正确」——本脚本补上这一环）
 *
 * 用法：node tools/validate-static.js
 * 退出码：0 = 全部通过；1 = 发现问题
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CHAPTERS = path.join(ROOT, "chapters");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "manifest.json"), "utf8"));

let errors = 0;
let warnings = 0;

function fail(file, msg) { console.log(`❌ ${file}: ${msg}`); errors++; }
function warn(file, msg) { console.log(`⚠️  ${file}: ${msg}`); warnings++; }

// 未解析的容器标记（构建管线应全部替换掉）
const CONTAINER_RE = /:::(note|warning|quiz|fold|unfold|key|interview|related|shapeflow|demo|intuition|math|engineering|example|answer|lab|step|goal|why|files|predict|write|run|expect|fail|inspect|bug|hint|solution|checkpoint|explain|where)\b/g;

const files = fs.readdirSync(CHAPTERS).filter(f => f.endsWith(".html"));
console.log(`检查 ${files.length} 个静态页（manifest 共 ${manifest.chapters.length} 章）\n`);

// 0. 每个 manifest 章节都应有对应文件
manifest.chapters.forEach(ch => {
  if (!fs.existsSync(path.join(CHAPTERS, ch.id + ".html"))) fail(ch.id, "缺少静态页文件");
});

files.forEach(f => {
  const html = fs.readFileSync(path.join(CHAPTERS, f), "utf8");

  // 1. 未解析的 ::: 容器
  const containers = html.match(CONTAINER_RE) || [];
  if (containers.length) {
    const kinds = [...new Set(containers)].join(", ");
    fail(f, `存在未解析容器标记：${kinds}`);
  }

  // 2. Markdown 围栏残留（正文里出现字面 ``` 行）
  const fenceLines = (html.match(/^\s*```/gm) || []).length;
  if (fenceLines) fail(f, `存在残留 Markdown 围栏 ${fenceLines} 处`);

  // 3. <pre><code> 中包裹了教学组件（上一轮的真实 bug）
  const preCodeBlocks = html.match(/<pre><code[\s\S]*?<\/code><\/pre>/g) || [];
  preCodeBlocks.forEach((block, i) => {
    if (block.includes('<div class="box') || block.includes('class="chapter-head"') || block.includes('class="quiz"')) {
      fail(f, `第 ${i + 1} 个 <pre><code> 中包裹了教学组件（fence 错位）`);
    }
  });

  // 4. 占位符残留
  const ph = (html.match(/@@(CT|PH)\d+@@/g) || []).length;
  if (ph) fail(f, `存在未替换占位符 ${ph} 处`);

  // 5. 原始 LaTeX 残留（先剔除 KaTeX 的 MathML annotation——它本来就保存 TeX 源码）
  const htmlNoAnn = html.replace(/<annotation[\s\S]*?<\/annotation>/g, "");
  const rawTex = (htmlNoAnn.match(/\\+(frac|approx|times|sum_|alpha|beta)\b/g) || []).length;
  if (rawTex > 5) warn(f, `疑似未渲染 LaTeX 残留 ${rawTex} 处`);

  // 6. 正文量下限（防止「页面几乎是空的」）
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 1500) fail(f, `正文过短（${text.length} 字符），可能渲染中断`);

  // 7. 结构完整性
  if (!html.includes('class="chapter-title"')) fail(f, "缺少章节标题结构");
  if (!html.includes('class="static-nav"')) warn(f, "缺少章节间导航");
});

// 8. index.html 的静态目录
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const tocLinks = (indexHtml.match(/chapters\/[a-z0-9-]+\.html/g) || []).length;
if (tocLinks < manifest.chapters.length) fail("index.html", `静态目录链接不足（${tocLinks}/${manifest.chapters.length}）`);

console.log(`\n${"=".repeat(56)}`);
if (errors === 0) {
  console.log(`✅ 全部通过：${files.length} 个静态页无容器残留 / 无 fence 错位 / 正文完整`);
  if (warnings) console.log(`（${warnings} 条警告）`);
} else {
  console.log(`❌ 发现 ${errors} 个错误、${warnings} 条警告`);
}
process.exit(errors ? 1 : 0);
