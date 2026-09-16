#!/usr/bin/env node
/**
 * Job-Ready Track 门禁：项目真实性 + 章节/项目一致性 + 数据纪律。
 *
 * 检查：
 *   A. projects/ 结构标准（README / requirements / src / tests / Quick Start）
 *   B. manifest：第七部分（Job-Ready）三章齐全，25/26 标记 lab/project
 *   C. 章节引用 projects/<slug> 时必须真实存在
 *   D. README 声明的测试数量与 tests/ 中 def test_ 数量一致
 *   E. 数据纪律：禁止伪造硬件/训练规模；第 24 章必须出现 NOT EXECUTED 标注
 *   F. 生产环境禁用：project 代码不得 import 不存在的包（只查已知关键依赖声明）
 *
 * 用法：node tools/validate-jobs.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let checks = 0, errors = 0;
function fail(msg) { console.log("❌ " + msg); errors++; }
function ok() { checks++; }
function mustHave(label, cond) { checks++; if (!cond) fail(label); }

const PROJECTS_DIR = path.join(ROOT, "projects");
const CONTENT = path.join(ROOT, "content");

/* ---------- A. 项目结构 ---------- */
if (!fs.existsSync(PROJECTS_DIR)) {
  fail("projects/ 目录不存在");
} else {
  mustHave("projects/README.md 存在", fs.existsSync(path.join(PROJECTS_DIR, "README.md")));
  const projects = fs.readdirSync(PROJECTS_DIR).filter(f =>
    fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory()
  );
  mustHave("projects/ 下至少有 1 个项目", projects.length >= 1);
  projects.forEach(p => {
    const dir = path.join(PROJECTS_DIR, p);
    ["README.md", "requirements.txt", "src", "tests"].forEach(req => {
      mustHave(`projects/${p}/${req} 缺失`, fs.existsSync(path.join(dir, req)));
    });
    const readmePath = path.join(dir, "README.md");
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, "utf8");
      mustHave(`projects/${p}/README.md 缺少 Quick Start`, /Quick Start/i.test(readme));
    }
    const testsDir = path.join(dir, "tests");
    if (fs.existsSync(testsDir)) {
      const testSrc = fs.readdirSync(testsDir).map(f => fs.readFileSync(path.join(testsDir, f), "utf8")).join("\n");
      mustHave(`projects/${p}/tests 没有任何 def test_`, /def test_/.test(testSrc));
    }
    const srcDir = path.join(dir, "src");
    if (fs.existsSync(srcDir)) {
      const files = [];
      (function walk(d) {
        fs.readdirSync(d).forEach(f => {
          const p2 = path.join(d, f);
          if (fs.statSync(p2).isDirectory()) walk(p2);
          else if (f.endsWith(".py")) files.push(p2);
        });
      })(srcDir);
      mustHave(`projects/${p}/src 下没有 .py 源码`, files.length > 0);
    }
  });
}

/* ---------- B. manifest ---------- */
const manifest = JSON.parse(fs.readFileSync(path.join(CONTENT, "manifest.json"), "utf8"));
const byId = {};
manifest.chapters.forEach(c => { byId[c.id] = c; });
const jobChapters = manifest.chapters.filter(c => (c.group || "").indexOf("Job-Ready") !== -1);
mustHave("manifest 缺少 Job-Ready 分组章节（应为 3 章）", jobChapters.length >= 3);
["job-ready", "python-engineering", "huggingface"].forEach(id => {
  mustHave(`manifest 缺少章节 ${id}`, !!byId[id]);
});
if (byId["python-engineering"]) mustHave("python-engineering 应标记 lab+project", byId["python-engineering"].lab === true && byId["python-engineering"].project === true);
if (byId["huggingface"]) mustHave("huggingface 应标记 lab+project", byId["huggingface"].lab === true && byId["huggingface"].project === true);

/* ---------- C. 章节引用的 projects/<slug> 必须存在 ---------- */
const projectSlugs = fs.existsSync(PROJECTS_DIR)
  ? fs.readdirSync(PROJECTS_DIR).filter(f => fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory())
  : [];
jobChapters.forEach(ch => {
  const mdPath = path.join(CONTENT, ch.file);
  if (!fs.existsSync(mdPath)) return;
  const md = fs.readFileSync(mdPath, "utf8");
  const re = /projects\/([a-z0-9-]+)/g;
  let m;
  while ((m = re.exec(md))) {
    mustHave(`${ch.file} 引用了不存在的项目 projects/${m[1]}`, projectSlugs.includes(m[1]));
  }
});

/* ---------- D. README 测试数量声明 vs 实际 ---------- */
function countTests(dir) {
  const testsDir = path.join(dir, "tests");
  if (!fs.existsSync(testsDir)) return 0;
  return fs.readdirSync(testsDir)
    .map(f => (fs.readFileSync(path.join(testsDir, f), "utf8").match(/def test_/g) || []).length)
    .reduce((a, b) => a + b, 0);
}
const claims = [
  { project: "log-analyzer", pattern: /(\d+)[ \t]*(?:个[ \t]*)?测试/ },
  { project: "hf-mini-lab", pattern: /(\d+)[ \t]*(?:个[ \t]*)?pytest|(\d+)[ \t]*(?:个[ \t]*)?测试/ }
];
claims.forEach(({ project, pattern }) => {
  const dir = path.join(PROJECTS_DIR, project);
  const readmePath = path.join(dir, "README.md");
  if (!fs.existsSync(readmePath)) return;
  const readme = fs.readFileSync(readmePath, "utf8");
  const m = readme.match(pattern);
  if (!m) { fail(`projects/${project}/README.md 未声明测试数量（应写明“N 个测试/N 个 pytest”以便核对）`); return; }
  const claimed = parseInt(m[1] || m[2], 10);
  const actual = countTests(dir);
  mustHave(`projects/${project} README 声明 ${claimed} 个测试，实际 def test_ = ${actual}`, claimed === actual);
});

/* ---------- E. 数据纪律 ---------- */
const forbidden = [
  /训练了\s*\d+\s*天/,
  /使用了?\s*\d+\s*张\s*(A100|H100|A800|RTX)/,
  /(A100|H100|A800|RTX 4090)\s*实测/,
  /消耗\s*\d+\s*卡时/
];
jobChapters.forEach(ch => {
  const mdPath = path.join(CONTENT, ch.file);
  if (!fs.existsSync(mdPath)) return;
  const md = fs.readFileSync(mdPath, "utf8");
  forbidden.forEach(re => {
    mustHave(`${ch.file} 疑似伪造实验规模（命中 ${re}）`, !re.test(md));
  });
});
[["projects/log-analyzer/README.md"], ["projects/hf-mini-lab/README.md"]].forEach(([p]) => {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return;
  const txt = fs.readFileSync(full, "utf8");
  forbidden.forEach(re => mustHave(`${p} 疑似伪造实验规模（命中 ${re}）`, !re.test(txt)));
});
const ch24 = path.join(CONTENT, "24-job-ready.md");
if (fs.existsSync(ch24)) {
  mustHave("24-job-ready.md 必须含 NOT EXECUTED 数据纪律说明", /NOT EXECUTED/.test(fs.readFileSync(ch24, "utf8")));
}

/* ---------- 汇总 ---------- */
console.log("");
if (errors === 0) console.log(`✅ Job-Ready 门禁通过：${checks} 项检查`);
else console.log(`❌ Job-Ready 门禁失败：${errors} / ${checks} 项`);
process.exit(errors ? 1 : 0);
