#!/usr/bin/env node
/**
 * Guided 渲染门禁 + 旧作业流程不得回到教材。
 *
 * 保留（仍有意义）：
 *   A. 浏览器与静态构建共用 js/renderer.js
 *   B. lab/step/hint/solution 渲染冒烟（渲染器仍支持这些原语，供日后主线步骤复用）
 *
 * 已移除（不再适用）：
 *   C. 第 25/26/27 章必须有固定步数、必须引用旧 starter 目录
 *      ——旧 Guided Build 已退出教学流程，不能再把步骤数绑成必修。
 *   D. starter 目录结构 / 初始红灯 README
 *      ——不再要求学生完成 starter；目录暂留到阶段 5，不在此当作业门禁。
 *   E. 「Reference Solution 不得削弱」作为教学完成条件
 *      ——残留代码正确性改由 python-unit 等检查，不把「必须当作业对照」写进教材门禁。
 *   F. 第 24/25 章必须出现 Learn / Guided Build / Reference 三入口
 *      ——三入口是旧作业分层，已改为查阅 + 可选参考。
 *   G. CI 必须包含 guided-starters 红灯 job
 *      ——starter 初始失败不再是教学设计。
 *
 * 新增：
 *   C'. 主线教材不得再出现 cd/lab 指向六个旧 starter
 *   G'. CI 不得再断言 starter「初始必须 fail」
 *
 * 用法：node tools/validate-guided.js
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

const OLD_STARTERS = [
  "projects/log-analyzer/starter",
  "projects/hf-mini-lab/starter",
  "projects/llm-eval/starter",
];

/* ---------- A. 渲染器一致性 ---------- */
const rendererSrc = read("js/renderer.js");
const buildSrc = read("tools/build-static.js");
const PARITY_MARKERS = [
  '"lab"', '"step"', '"hint"', '"solution"', '"where"',
  "box-write", "box-checkpoint", "box-run", "box-fail", "box-predict", "box-explain", "box-where",
  "guided-lab", "guided-step", "gl-progress", "data-lab-id", "data-step-id",
];
PARITY_MARKERS.forEach((marker) => {
  mustHave(`js/renderer.js 渲染器缺少 "${marker}"`, rendererSrc.includes(marker));
});
mustHave("build-static.js 未复用 js/renderer.js", buildSrc.includes('path.join(ROOT, "js", "renderer.js")'));

/* ---------- B. 真实渲染冒烟 ---------- */
const SMOKE = [
  "# 标题",
  "",
  ":::lab 冒烟测试 Lab",
  "goal: 验证渲染",
  "project: projects/demo/starter",
  "",
  ":::where",
  "机器：🖥 Mac / ☁ Linux Server",
  "Repo Root：运行 `pwd` 确认",
  ":::",
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
  ":::run 🖥 Mac / ☁ Server",
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
mustHave("冒烟渲染：缺少 box-where 执行环境块", smokeHtml.includes("box-where") && smokeHtml.includes("where-row"));
mustHave("冒烟渲染：where 的 key:value 未正确分行", smokeHtml.includes("where-k"));
mustHave("冒烟渲染：run 盒子未保留「运行 · 位置标签」", smokeHtml.includes("运行 · 🖥 Mac / ☁ Server"));
mustHave("冒烟渲染：hint 应为折叠块", /<details class="hint">/.test(smokeHtml));
mustHave("冒烟渲染：solution 应为折叠块", /<details class="solution">/.test(smokeHtml));
mustHave("冒烟渲染：Solution 不应默认展开", !/<details class="solution" open/.test(smokeHtml) && !/<details open class="solution"/.test(smokeHtml));
mustHave("冒烟渲染：不应残留 ::: 容器标记", !/:::/.test(smokeHtml));
mustHave("冒烟渲染：不应残留 @@CT 占位符", !/@@(CT|PH)\d+@@/.test(smokeHtml));
mustHave("冒烟渲染：lab meta 行未被当作正文", !smokeHtml.includes("goal: 验证渲染"));

/* ---------- C'. 主线教材不得再把旧 starter 当操作指南 ---------- */
const TEACHING_FILES = [
  "content/00-map.md",
  "content/24-job-ready.md",
  "content/25-python-engineering.md",
  "content/26-huggingface.md",
  "content/27-capstone-eval.md",
  "content/28-rag-engineering.md",
  "content/29-capstone-rag.md",
  "content/30-capstone-sft.md",
  "content/31-capstone-infra.md",
  "content/references/25-python-engineering.md",
  "content/references/26-huggingface.md",
  "content/learning-plan.json",
  "js/pages.js",
];
const cdStarter = /cd\s+projects\/(?:log-analyzer|hf-mini-lab|llm-eval|rag-service|sft-lora|inference-benchmark)\/starter/;
const labMetaStarter = /project:\s*projects\/(?:log-analyzer|hf-mini-lab|llm-eval)\/starter/;
TEACHING_FILES.forEach((file) => {
  if (!fs.existsSync(path.join(ROOT, file))) { fail(`缺少 ${file}`); return; }
  const md = read(file);
  mustHave(`${file} 仍含 cd …/starter（旧作业操作）`, !cdStarter.test(md));
  mustHave(`${file} 仍含 lab meta 指向旧 starter`, !labMetaStarter.test(md));
  OLD_STARTERS.forEach((starter) => {
    const mentioned = md.includes(starter);
    if (!mentioned) return;
    const allowed = /不是当前作业|非当前作业|不要.*starter|已退出/.test(md);
    mustHave(`${file} 提到 ${starter} 但未标明非当前作业`, allowed);
  });
});

["content/25-python-engineering.md", "content/26-huggingface.md", "content/27-capstone-eval.md"].forEach((file) => {
  const md = read(file);
  mustHave(`${file} 仍含 :::lab（旧 Guided Build 作业块）`, !/(^|\n):::lab\s/.test(md));
});

/* ---------- G'. CI 不得再要求 starter 红灯 ---------- */
const ci = read(".github/workflows/ci.yml");
mustHave("CI 仍包含 guided-starters job（starter 红灯已退出教学）", !/^\s+guided-starters\s*:/m.test(ci));
mustHave("CI 仍包含 guided-hf-full job（含模型 starter 红灯已退出教学）", !/^\s+guided-hf-full\s*:/m.test(ci));
mustHave("CI validators 未运行 validate-guided.js", ci.includes("validate-guided.js"));

/* ---------- 汇总 ---------- */
console.log("");
if (errors === 0) console.log(`✅ Guided 门禁通过：${checks} 项检查（渲染器一致性 / 冒烟 / 旧 starter 不得回到教材）`);
else console.log(`❌ Guided 门禁失败：${errors} / ${checks} 项`);
process.exit(errors ? 1 : 0);
