#!/usr/bin/env node
/**
 * 内容源校验（content/*.md + manifest + demos 注册）
 * 目标：防明显错误（不做复杂 parser）
 *
 * 检查项：
 *   1. manifest：文件存在、id/num 唯一
 *   2. 容器配平（:::xxx 与 :::）
 *   3. 围栏配对（``` 数量为偶数）
 *   4. demo 挂载：名字已注册（js/demos-*.js）、无重复注册、无空名字
 *   5. 章节标题编号与 manifest 的 num 一致（## 11.1 应属于第 11 章）
 *   6. related 块格式（`标签 | a, b, c`）
 *   7. build-static.js 中 TOPIC_LINKS 的链接目标必须是合法章节 id
 *
 * 用法：node tools/validate-content.js
 * 退出码：0 = 通过；1 = 有问题
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
let errors = 0;
function fail(msg) { console.log("❌ " + msg); errors++; }

/* ---------- 读取 manifest ---------- */
const manifest = JSON.parse(fs.readFileSync(path.join(CONTENT, "manifest.json"), "utf8"));
const ids = new Set();
const nums = new Map();
manifest.chapters.forEach(ch => {
  if (ids.has(ch.id)) fail(`manifest: 重复 id "${ch.id}"`);
  ids.add(ch.id);
  if (nums.has(ch.num)) fail(`manifest: 重复 num "${ch.num}"（${ch.title} 与 ${nums.get(ch.num)}）`);
  nums.set(ch.num, ch.title);
  if (!fs.existsSync(path.join(CONTENT, ch.file))) fail(`manifest: 缺少文件 ${ch.file}`);
});

/* ---------- 收集已注册 demo ---------- */
const registered = new Map(); // name -> file
fs.readdirSync(path.join(ROOT, "js")).filter(f => /^demos-.*\.js$/.test(f)).forEach(f => {
  const src = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
  const re = /LC\.demos\["([^"]+)"\]\s*=/g;
  let m;
  while ((m = re.exec(src))) {
    if (registered.has(m[1])) fail(`demo 重复注册："${m[1]}"（${registered.get(m[1])} 与 ${f}）`);
    registered.set(m[1], f);
  }
});

/* ---------- 逐文件检查 ---------- */
const mdFiles = fs.readdirSync(CONTENT).filter(f => f.endsWith(".md"));

/* ---------- 收集全部标题编号（用于「见 X.Y」引用检查） ---------- */
const headingIndex = new Set();
mdFiles.forEach(f => {
  const md = fs.readFileSync(path.join(CONTENT, f), "utf8");
  const re = /^##\s+(\d+\.\d+)/gm;
  let m;
  while ((m = re.exec(md))) headingIndex.add(m[1]);
});

mdFiles.forEach(f => {
  const md = fs.readFileSync(path.join(CONTENT, f), "utf8");
  const ch = manifest.chapters.find(c => c.file === f);
  const chNum = ch ? ch.num : null;

  // 2. 容器配平
  const opens = (md.match(/^:::[a-zA-Z-]+/gm) || []).length;
  const closes = (md.match(/^:::\s*$/gm) || []).length;
  if (opens !== closes) fail(`${f}: 容器不配平（opens=${opens} closes=${closes}）`);

  // 3. 围栏配对
  const fences = (md.match(/^\s*```/gm) || []).length;
  if (fences % 2 !== 0) fail(`${f}: 代码围栏数量为奇数（${fences}）`);

  // 4. demo 挂载
  const demoRe = /^:::demo\s*([^\s]*)\s*(.*)$/gm;
  let dm;
  while ((dm = demoRe.exec(md))) {
    const name = dm[1];
    if (!name) fail(`${f}: :::demo 缺少名字`);
    else if (!registered.has(name)) fail(`${f}: demo "${name}" 未在 js/demos-*.js 中注册`);
  }

  // 5. 章节标题编号与 manifest num 一致
  if (chNum !== null) {
    const headingRe = /^##\s+(\d+)\.(\d+)\s/gm;
    let hm;
    const seen = new Set();
    while ((hm = headingRe.exec(md))) {
      seen.add(hm[1]);
    }
    seen.forEach(n => {
      if (n !== chNum) fail(`${f}: 小节编号 ${n}.x 与 manifest 章节号 ${chNum} 不一致`);
    });
  }

  // 6. related 块格式
  const relatedRe = /^:::related\s*\n([\s\S]*?)^:::\s*$/gm;
  let rm;
  while ((rm = relatedRe.exec(md))) {
    rm[1].split("\n").filter(l => l.trim()).forEach(line => {
      if (!/^\s*\S+\s*[|｜]\s*.+$/.test(line)) fail(`${f}: related 行格式非法："${line.slice(0, 40)}"`);
    });
  }

  // 7. 「见 X.Y」引用必须真实存在（不误报 整句里的版本号如 0.16.11 / 1.96；只匹配 见/参见 后的编号）
  const seeRe = /(?:见|参见)\s*(\d+\.\d+)/g;
  let sm;
  while ((sm = seeRe.exec(md))) {
    const target = sm[1];
    // 排除小数（如 1.96、0.22）与版本号：仅当整数部分在 0..99 且小数部分存在时才算章节引用
    const [a, b] = target.split(".").map(Number);
    if (a >= 0 && a <= 24 && b >= 1 && !headingIndex.has(target)) {
      fail(`${f}: 引用了不存在的章节小节「见 ${target}」`);
    }
  }

  // 8. 「第 X 章」引用必须存在于 manifest
  const chRe = /第\s*(\d+)\s*章/g;
  let cm;
  while ((cm = chRe.exec(md))) {
    const n = cm[1];
    if (!nums.has(n)) fail(`${f}: 引用了不存在的章节「第 ${n} 章」`);
  }
});

/* ---------- 9. index.html 必须加载全部 demos-*.js ---------- */
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
fs.readdirSync(path.join(ROOT, "js")).filter(f => /^demos-.*\.js$/.test(f)).forEach(f => {
  if (!indexHtml.includes("js/" + f)) fail(`index.html: 未加载 js/${f}（文件存在但浏览器不会执行）`);
});

/* ---------- 10. TOPIC_LINKS 目标合法性（build-static.js） ---------- */
const bs = fs.readFileSync(path.join(ROOT, "tools", "build-static.js"), "utf8");
const topicBlock = /const TOPIC_LINKS = \{([\s\S]*?)\};/.exec(bs);
if (topicBlock) {
  const linkRe = /"([^"]+)":\s*"([^"]+)"/g;
  let lm;
  while ((lm = linkRe.exec(topicBlock[1]))) {
    const target = lm[2];
    if (!ids.has(target)) fail(`build-static.js: TOPIC_LINKS["${lm[1]}"] 指向不存在的章节 id "${target}"`);
  }
} else {
  fail("build-static.js: 未找到 TOPIC_LINKS");
}

/* ---------- 汇总 ---------- */
console.log("");
if (errors === 0) {
  console.log(`✅ 内容校验通过：${manifest.chapters.length} 章 / ${registered.size} 个已注册 demo / ${mdFiles.length} 个内容文件`);
} else {
  console.log(`❌ 内容校验发现 ${errors} 个问题`);
}
process.exit(errors ? 1 : 0);
