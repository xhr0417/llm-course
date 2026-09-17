#!/usr/bin/env node
/**
 * Portfolio / 文案一致性（轻量）：
 *   1. 根 README 章节数与 manifest 一致；六个旧目录若被点名，必须标明非当前作业
 *   2. projects/README.md 覆盖仍在磁盘上的目录，并声明已退出主线
 *   3. 第 24 章不允许残留「下一批」类 stale wording
 *   4. 第 0 章体现当前动手主线与查阅分组，而不是「必须做完 Job-Ready 六项目」
 *   5. 不允许旧的 stale 数字（79 个 demo 等）出现在第 0 章
 *   6. 残留项目 README 仍须有可复现入口（目录删除前的文档正确性）
 *
 * 已移除（不再适用）：
 *   - 根 README / projects/README 必须写 “N Runnable Projects”
 *     ——那是把六个旧作业当产品卖点。
 *   - 根 README 必须把 Track A/B/C 写成主产品三条线（现仅作查阅，仍可出现文字）。
 *   - 第 0 章必须写 “Job-Ready Track（24-31）” 双主线。
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

const OLD_PROJECTS = ["log-analyzer", "hf-mini-lab", "llm-eval", "rag-service", "sft-lora", "inference-benchmark"];

/* ---------- 真实状态 ---------- */
const manifest = JSON.parse(read("content/manifest.json"));
const chapterCount = manifest.chapters.length;
const projectsJson = JSON.parse(read("content/projects.json"));
const projectDirs = fs.readdirSync(path.join(ROOT, "projects"))
  .filter(f => fs.statSync(path.join(ROOT, "projects", f)).isDirectory() && fs.existsSync(path.join(ROOT, "projects", f, "README.md")));

mustHave(`content/projects.json 项目数(${projectsJson.count}) 与 projects/ 目录数(${projectDirs.length}) 不一致`,
         projectsJson.count === projectDirs.length);
mustHave("content/projects.json 应标明 archived（目录暂留、非当前作业）",
         projectsJson.status === "archived");

/* ---------- 1. 根 README ---------- */
mustHave("根 README.md 不存在", fs.existsSync(path.join(ROOT, "README.md")));
const rootReadme = read("README.md");

const chaptersClaim = rootReadme.match(/(\d+)\s+Chapters/);
mustHave("根 README 缺少 “N Chapters” 声明", !!chaptersClaim);
if (chaptersClaim) {
  mustHave(`根 README 声明 ${chaptersClaim[1]} 章，manifest 实际 ${chapterCount} 章`,
           parseInt(chaptersClaim[1], 10) === chapterCount);
}
mustHave("根 README 仍把六个目录写成当前 Runnable Projects 产品",
         !/\d+\s+Runnable Projects/.test(rootReadme));
mustHave("根 README 未说明六个目录已退出必修 / 非当前作业",
         /非当前作业|已退出/.test(rootReadme));
OLD_PROJECTS.forEach(name => {
  if (rootReadme.includes(name)) {
    mustHave(`根 README 提到 ${name} 但未标明可选/历史/非当前作业`,
             /可选参考|历史参考|非当前作业|已退出/.test(rootReadme));
  }
});
mustHave("根 README 缺少 NOT EXECUTED 诚实标注说明", /NOT EXECUTED/.test(rootReadme));
mustHave("根 README 缺少环境快照引用 docs/environment.txt", rootReadme.includes("docs/environment.txt"));

/* ---------- 2. projects/README.md ---------- */
const projReadme = read("projects/README.md");
projectDirs.forEach(name => {
  mustHave(`projects/README.md 未列出项目 ${name}`, projReadme.includes(name));
});
mustHave("projects/README.md 仍把目录写成当前 Runnable Projects 作业集",
         !/\d+\s+Runnable Projects/.test(projReadme));
mustHave("projects/README.md 未声明已退出主线 / 非当前作业",
         /已退出主线|非当前作业/.test(projReadme));
mustHave("projects/README.md 缺少测试口径说明（test functions / pytest cases）",
         /test functions/.test(projReadme) && /pytest cases/.test(projReadme));

/* ---------- 3. 第 24 章 stale wording ---------- */
const ch24 = read("content/24-job-ready.md");
mustHave('content/24-job-ready.md 残留「下一批」表述', !ch24.includes("下一批"));
mustHave("content/24-job-ready.md 未包含 Track C", ch24.includes("Track C"));
mustHave("content/24-job-ready.md 仍把 Guided Build / starter 当必修",
         !/下载 starter/.test(ch24) && !/starter 的测试全部/.test(ch24));

/* ---------- 4/5. 第 0 章 ---------- */
const ch00 = read("content/00-map.md");
mustHave('content/00-map.md 残留「暂不展开」对 RAG 的表述', !/RAG[^\n]*暂不展开/.test(ch00));
mustHave('content/00-map.md 残留「未来的 vLLM/profiling」表述', !/未来的[^\n]*(vLLM|profiling)/.test(ch00));
mustHave("content/00-map.md 未写当前动手主线（小模型学习实验室）", /小模型学习实验室/.test(ch00));
mustHave("content/00-map.md 未展示 Track A/B/C 查阅分组", /Track A/.test(ch00) && /Track B/.test(ch00) && /Track C/.test(ch00));
mustHave("content/00-map.md 仍把 Job-Ready 六项目写成必修平行主线",
         !/每一章绑定一个可运行项目/.test(ch00));
mustHave("content/00-map.md 残留旧 demo 数字（79 个）", !/79\s*个/.test(ch00));

/* ---------- 6. 每个残留项目 README 可复现入口 ---------- */
projectDirs.forEach(name => {
  const readme = fs.readFileSync(path.join(ROOT, "projects", name, "README.md"), "utf8");
  mustHave(`projects/${name}/README.md 缺少 Quick Start`, /Quick Start/i.test(readme));
  mustHave(`projects/${name}/README.md 缺少可运行命令（python/pytest/docker）`,
           /(python\s|pytest|docker\s)/.test(readme));
  mustHave(`projects/${name}/README.md 缺少测试数量声明（N 个测试函数）`, /\d+[ \t]*个测试函数/.test(readme));
});

/* ---------- 汇总 ---------- */
console.log("");
if (errors === 0) console.log(`✅ Portfolio 一致性门禁通过：${checks} 项检查（${chapterCount} 章 / ${projectDirs.length} 个残留目录）`);
else console.log(`❌ Portfolio 门禁失败：${errors} / ${checks} 项`);
process.exit(errors ? 1 : 0);
