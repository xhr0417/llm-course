#!/usr/bin/env node
/**
 * Guided Build Track 门禁（G0/G1/G2/G3）：
 *   A. 渲染器一致性：app.js 与 build-static.js 都注册了全部 Guided 容器
 *   B. 真实渲染冒烟：lab/step/hint/solution 渲染正确、无占位符残留
 *   C. 三个 Guided 章节：lab 存在、step 数量符合设计、每步有目标/你来做/运行/验收/解释
 *   D. Starter 结构：可安装 / 有 pytest.ini / 有分步测试 / README 声明初始红灯
 *   E. Reference Solution 未被削弱：父项目 src + tests 仍在
 *   F. 第 24 章与首页包含 Learn / Guided Build / Reference 三入口
 *   G. CI 包含 starter「初始必须 fail」job
 *
 * 用法：node tools/validate-guided.js
 * 退出码：0 = 通过；1 = 有问题
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let checks = 0, errors = 0;
function fail(msg) { console.log("❌ " + msg); errors++; }
function mustHave(label, cond) { checks++; if (!cond) fail(label); }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const renderer = require(path.join(ROOT, "tools", "build-static.js"));

/* ---------- 配置：三个 Guided 章节的期望 step 数 ---------- */
const GUIDED_CHAPTERS = [
  { id: "python-engineering", file: "content/25-python-engineering.md", steps: 10, project: "log-analyzer" },
  { id: "huggingface", file: "content/26-huggingface.md", steps: 13, project: "hf-mini-lab" },
  { id: "capstone-eval", file: "content/27-capstone-eval.md", steps: 15, project: "llm-eval" },
];
const GUIDED_KINDS = ["lab", "step", "goal", "why", "files", "predict", "write", "run",
  "expect", "fail", "inspect", "bug", "hint", "solution", "checkpoint", "explain"];

/* ---------- A. 渲染器一致性 ---------- */
const appSrc = read("js/app.js");
const buildSrc = read("tools/build-static.js");
const PARITY_MARKERS = [
  '"lab"', '"step"', '"hint"', '"solution"',
  "box-write", "box-checkpoint", "box-run", "box-fail", "box-predict", "box-explain",
  "guided-lab", "guided-step", "gl-progress", "data-lab-id", "data-step-id",
];
PARITY_MARKERS.forEach((marker) => {
  mustHave(`js/app.js 渲染器缺少 "${marker}"（与 build-static.js 不一致）`, appSrc.includes(marker));
  mustHave(`tools/build-static.js 渲染器缺少 "${marker}"（与 app.js 不一致）`, buildSrc.includes(marker));
});

/* ---------- B. 真实渲染冒烟 ---------- */
const SMOKE = [
  "# 标题",
  "",
  ":::lab 冒烟测试 Lab",
  "goal: 验证渲染",
  "project: projects/demo/starter",
  "",
  ":::step 1 第一步",
  ":::goal",
  "目标内容",
  ":::",
  ":::write",
  "写代码：`a = 1`",
  ":::",
  ":::hint 提示一",
  "这是 hint 正文",
  ":::",
  ":::solution",
  "```python",
  "print('hi')",
  "```",
  ":::",
  ":::checkpoint",
  "测试变绿",
  ":::",
  ":::",
  "",
  ":::step 2 第二步",
  ":::run",
  "```bash",
  "pytest -q",
  "```",
  ":::",
  ":::explain",
  "- 为什么？",
  ":::",
  ":::",
  ":::",
].join("\n");
const smokeHtml = renderer.renderMarkdown(SMOKE, "smoke");
mustHave("冒烟渲染：缺少 guided-lab", smokeHtml.includes('class="guided-lab"'));
mustHave("冒烟渲染：缺少 guided-step 数量 2", (smokeHtml.match(/guided-step/g) || []).length >= 2);
mustHave("冒烟渲染：缺少 gs-num", smokeHtml.includes("gs-num"));
mustHave("冒烟渲染：缺少 box-write", smokeHtml.includes("box-write"));
mustHave("冒烟渲染：缺少 box-run", smokeHtml.includes("box-run"));
mustHave("冒烟渲染：缺少 box-checkpoint", smokeHtml.includes("box-checkpoint"));
mustHave("冒烟渲染：缺少 box-explain", smokeHtml.includes("box-explain"));
mustHave("冒烟渲染：hint 应为折叠块", /<details class="hint">/.test(smokeHtml));
mustHave("冒烟渲染：solution 应为折叠块", /<details class="solution">/.test(smokeHtml));
mustHave("冒烟渲染：Solution 不应默认展开", !/<details class="solution" open/.test(smokeHtml) && !/<details open class="solution"/.test(smokeHtml));
mustHave("冒烟渲染：不应残留 ::: 容器标记", !/:::/.test(smokeHtml));
mustHave("冒烟渲染：不应残留 @@CT 占位符", !/@@(CT|PH)\d+@@/.test(smokeHtml));
mustHave("冒烟渲染：lab meta 行未被当作正文", !smokeHtml.includes("goal: 验证渲染"));

/* ---------- C. Guided 章节 ---------- */
function parseTree(md) {
  const ctx = { containers: [], protected: [] };
  renderer.extractContainers(md, ctx);
  const children = (content) => {
    const out = [];
    const re = /@@CT(\d+)@@/g;
    let m;
    while ((m = re.exec(content))) out.push(parseInt(m[1], 10));
    return out;
  };
  return { containers: ctx.containers, children: children };
}
GUIDED_CHAPTERS.forEach(({ id, file, steps, project }) => {
  if (!fs.existsSync(path.join(ROOT, file))) { fail(`缺少章节文件 ${file}`); return; }
  const md = read(file);
  const tree = parseTree(md);
  const labs = tree.containers.map((c, i) => ({ c: c, i: i })).filter((x) => x.c.kind === "lab");
  mustHave(`${file}: 缺少 :::lab 容器`, labs.length >= 1);
  if (!labs.length) return;
  const lab = labs[0].c;
  const stepIdx = tree.children(lab.content).filter((i) => tree.containers[i].kind === "step");
  mustHave(`${file}: step 数量不符（期望 ${steps}，实际 ${stepIdx.length}）`, stepIdx.length === steps);
  const kindCount = {};
  let hintTotal = 0;
  stepIdx.forEach((i) => {
    const kinds = tree.children(tree.containers[i].content).map((j) => tree.containers[j].kind);
    kinds.forEach((k) => { kindCount[k] = (kindCount[k] || 0) + 1; });
    if (kinds.indexOf("hint") !== -1) hintTotal++;
  });
  mustHave(`${file}: goal 覆盖不足（${kindCount.goal || 0}/${steps}）`, (kindCount.goal || 0) >= steps - 1);
  mustHave(`${file}: write 覆盖不足（${kindCount.write || 0}/${steps}）`, (kindCount.write || 0) >= steps - 2);
  mustHave(`${file}: run 覆盖不足（${kindCount.run || 0}/${steps}）`, (kindCount.run || 0) >= steps - 2);
  mustHave(`${file}: checkpoint 覆盖不足（${kindCount.checkpoint || 0}/${steps}）`, (kindCount.checkpoint || 0) >= steps - 1);
  mustHave(`${file}: explain 覆盖不足（${kindCount.explain || 0}/${steps}）`, (kindCount.explain || 0) >= steps - 1);
  mustHave(`${file}: 无 :::solution 折叠参考实现`, (kindCount.solution || 0) >= 1);
  mustHave(`${file}: hint 覆盖不足（${hintTotal}/${steps} 步含 hint）`, hintTotal >= Math.floor(steps * 0.7));
  mustHave(`${file}: 未引用 starter（projects/${project}/starter）`, md.includes(`projects/${project}/starter`));
  mustHave(`${file}: 缺少 Reference Solution 章节`, /Reference Solution|参考实现/.test(md));
  const manifest = JSON.parse(read("content/manifest.json"));
  const ch = manifest.chapters.find((c) => c.id === id);
  mustHave(`manifest ${id} 应标记 lab+project`, !!ch && ch.lab === true && ch.project === true);

  /* ---------- D. Starter 结构 ---------- */
  const starter = `projects/${project}/starter`;
  ["README.md", "requirements.txt", "pytest.ini", "src", "tests"].forEach((f) => {
    mustHave(`${starter}/${f} 缺失`, fs.existsSync(path.join(ROOT, starter, f)));
  });
  const starterReadme = path.join(ROOT, starter, "README.md");
  if (fs.existsSync(starterReadme)) {
    const txt = fs.readFileSync(starterReadme, "utf8");
    mustHave(`${starter}/README.md 未声明初始红灯状态（应写明 N failed）`, /\d+\s*(个)?\s*failed|failed/i.test(txt));
    mustHave(`${starter}/README.md 未提示参考实现在上一级（../）`, /\.\.\//.test(txt));
    mustHave(`${starter}/README.md 未说明这是 starter / 学生要自己实现`, /starter|自己实现|你来写/i.test(txt));
  }
  const testsDir = path.join(ROOT, starter, "tests");
  if (fs.existsSync(testsDir)) {
    const files = fs.readdirSync(testsDir).filter((f) => f.endsWith(".py"));
    mustHave(`${starter}/tests 缺少分步测试文件（test_step*.py）`, files.some((f) => /^test_step/.test(f)));
    const all = files.map((f) => fs.readFileSync(path.join(testsDir, f), "utf8")).join("\n");
    mustHave(`${starter}/tests 没有任何 def test_`, /def test_/.test(all));
  }
  const srcDir = path.join(ROOT, starter, "src");
  if (fs.existsSync(srcDir)) {
    let pyCount = 0;
    (function walk(d) {
      fs.readdirSync(d).forEach((f) => {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (f.endsWith(".py")) pyCount++;
      });
    })(srcDir);
    mustHave(`${starter}/src 下没有 .py 源码`, pyCount > 0);
  }
  /* pytest.ini 必须锁 testpaths，防止父项目 pytest 递归收集 starter 测试 */
  const ini = path.join(ROOT, starter, "pytest.ini");
  if (fs.existsSync(ini)) {
    mustHave(`${starter}/pytest.ini 缺少 testpaths = tests`, /testpaths\s*=\s*tests/.test(fs.readFileSync(ini, "utf8")));
  }
  const parentIni = path.join(ROOT, `projects/${project}/pytest.ini`);
  mustHave(`projects/${project}/pytest.ini 缺失（防止 pytest 误收集 starter/tests）`,
    fs.existsSync(parentIni) && /testpaths\s*=\s*tests/.test(fs.readFileSync(parentIni, "utf8")));

  /* ---------- E. Reference Solution 未被削弱 ---------- */
  mustHave(`projects/${project}/src 缺失（Reference Solution 不应被删除）`, fs.existsSync(path.join(ROOT, `projects/${project}/src`)));
  mustHave(`projects/${project}/tests 缺失（Reference Solution 不应被删除）`, fs.existsSync(path.join(ROOT, `projects/${project}/tests`)));
});

/* ---------- F. 三入口 ---------- */
const ch24 = read("content/24-job-ready.md");
["Learn", "Guided Build", "Reference"].forEach((entry) => {
  mustHave(`content/24-job-ready.md 缺少项目三入口「${entry}」`, ch24.includes(entry));
});
mustHave("content/24-job-ready.md 缺少 Guided Build 进度说明", /Guided Build/.test(ch24));
const ch25 = read("content/25-python-engineering.md");
mustHave("第 25 章缺少三级学习模式说明（Learn / Guided Build / Reference）",
  /Learn/.test(ch25) && /Guided Build/.test(ch25) && /Reference/.test(ch25));

/* ---------- G. CI ---------- */
const ci = read(".github/workflows/ci.yml");
mustHave("CI 缺少 guided-starters job（starter 初始状态必须为红灯）", ci.includes("guided-starters"));
mustHave("CI validators 未运行 validate-guided.js", ci.includes("validate-guided.js"));

/* ---------- 汇总 ---------- */
console.log("");
if (errors === 0) console.log(`✅ Guided Build 门禁通过：${checks} 项检查（3 个 Guided Lab / starter 结构 / 渲染器一致性）`);
else console.log(`❌ Guided Build 门禁失败：${errors} / ${checks} 项`);
process.exit(errors ? 1 : 0);
