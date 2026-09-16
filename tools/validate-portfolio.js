#!/usr/bin/env node
/**
 * Portfolio 一致性门禁（轻量）：
 *   1. 根 README 声明与真实状态一致（章节数 / 项目数 / 每个项目名）
 *   2. projects/README.md 覆盖全部项目目录
 *   3. 第 24 章不允许残留「下一批」类 stale wording
 *   4. 第 0 章不允许「RAG 暂不展开 / 未来的 profiling」类 stale 表述，且必须体现 24-31 两轨结构
 *   5. 不允许旧的 stale 数字（79 demos 等）出现在第 0 章
 *   6. 每个项目 README 必须能指向可复现入口（Quick Start + 至少一个运行命令）
 *
 * 用法：node tools/validate-portfolio.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let checks = 0, errors = 0;
function fail(msg) { console.log("❌ " + msg); errors++; }
function mustHave(label, cond) { checks++; if (!cond) fail(label); }

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/* ---------- 真实状态 ---------- */
const manifest = JSON.parse(read("content/manifest.json"));
const chapterCount = manifest.chapters.length;
const projectsJson = JSON.parse(read("content/projects.json"));
const projectDirs = fs.readdirSync(path.join(ROOT, "projects"))
  .filter(f => fs.statSync(path.join(ROOT, "projects", f)).isDirectory() && fs.existsSync(path.join(ROOT, "projects", f, "README.md")));

mustHave(`content/projects.json 项目数(${projectsJson.count}) 与 projects/ 目录数(${projectDirs.length}) 不一致`,
         projectsJson.count === projectDirs.length);

/* ---------- 1. 根 README ---------- */
mustHave("根 README.md 不存在", fs.existsSync(path.join(ROOT, "README.md")));
const rootReadme = read("README.md");

const chaptersClaim = rootReadme.match(/(\d+)\s+Chapters/);
mustHave("根 README 缺少 “N Chapters” 声明", !!chaptersClaim);
if (chaptersClaim) {
  mustHave(`根 README 声明 ${chaptersClaim[1]} 章，manifest 实际 ${chapterCount} 章`,
           parseInt(chaptersClaim[1], 10) === chapterCount);
}
const projectsClaim = rootReadme.match(/(\d+)\s+Runnable Projects/);
mustHave("根 README 缺少 “N Runnable Projects” 声明", !!projectsClaim);
if (projectsClaim) {
  mustHave(`根 README 声明 ${projectsClaim[1]} 个项目，projects/ 实际 ${projectDirs.length} 个`,
           parseInt(projectsClaim[1], 10) === projectDirs.length);
}
projectDirs.forEach(name => {
  mustHave(`根 README 未提及项目 ${name}`, rootReadme.includes(name));
});
["Track A", "Track B", "Track C"].forEach(t => {
  mustHave(`根 README 缺少 ${t}（三条岗位路线）`, rootReadme.includes(t));
});
mustHave("根 README 缺少 NOT EXECUTED 诚实标注说明", /NOT EXECUTED/.test(rootReadme));
mustHave("根 README 缺少环境快照引用 docs/environment.txt", rootReadme.includes("docs/environment.txt"));

/* ---------- 2. projects/README.md ---------- */
const projReadme = read("projects/README.md");
projectDirs.forEach(name => {
  mustHave(`projects/README.md 未列出项目 ${name}`, projReadme.includes(name));
});
mustHave('projects/README.md 缺少 “N Runnable Projects” 声明', /(\d+)\s+Runnable Projects/.test(projReadme));
mustHave("projects/README.md 缺少测试口径说明（test functions / pytest cases）",
         /test functions/.test(projReadme) && /pytest cases/.test(projReadme));

/* ---------- 3. 第 24 章 stale wording ---------- */
const ch24 = read("content/24-job-ready.md");
mustHave('content/24-job-ready.md 残留「下一批」表述（内容已全部交付）', !ch24.includes("下一批"));
mustHave("content/24-job-ready.md 未包含 Track C", ch24.includes("Track C"));

/* ---------- 4/5. 第 0 章 ---------- */
const ch00 = read("content/00-map.md");
mustHave('content/00-map.md 残留「暂不展开」对 RAG 的表述', !/RAG[^\n]*暂不展开/.test(ch00));
mustHave('content/00-map.md 残留「未来的 vLLM/profiling」表述', !/未来的[^\n]*(vLLM|profiling)/.test(ch00));
mustHave("content/00-map.md 未体现 Job-Ready Track（24-31）", /Job-Ready Track（24-31/.test(ch00) || /Job-Ready Track 24-31/.test(ch00));
mustHave("content/00-map.md 未展示 Track A/B/C", /Track A/.test(ch00) && /Track B/.test(ch00) && /Track C/.test(ch00));
mustHave("content/00-map.md 残留旧 demo 数字（79 个）", !/79\s*个/.test(ch00));

/* ---------- 6. 每个项目 README 可复现入口 ---------- */
projectDirs.forEach(name => {
  const readme = fs.readFileSync(path.join(ROOT, "projects", name, "README.md"), "utf8");
  mustHave(`projects/${name}/README.md 缺少 Quick Start`, /Quick Start/i.test(readme));
  mustHave(`projects/${name}/README.md 缺少可运行命令（python/pytest/docker）`,
           /(python\s|pytest|docker\s)/.test(readme));
  mustHave(`projects/${name}/README.md 缺少测试数量声明（N 个测试函数）`, /\d+[ \t]*个测试函数/.test(readme));
});

/* ---------- 汇总 ---------- */
console.log("");
if (errors === 0) console.log(`✅ Portfolio 一致性门禁通过：${checks} 项检查（${chapterCount} 章 / ${projectDirs.length} 项目）`);
else console.log(`❌ Portfolio 门禁失败：${errors} / ${checks} 项`);
process.exit(errors ? 1 : 0);
