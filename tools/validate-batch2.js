#!/usr/bin/env node
/**
 * 第二批回归测试（Correctness Pass 护栏）
 * 目标：把「已经修过的错」钉死，防止未来改动把它改回去。
 *
 * 覆盖：
 *   A. 第 18 章：continuous stream + EOS + 定长切块（drop_last）语义
 *   B. 第 19 章：naive/eager 分解术语、exact ≠ bitwise、SDPA 说明
 *   C. 第 20 章：TTFT 定义（prefill 产出第一个生成 token 的 logits）、KV Cache 三种口径
 *   D. 第 23 章：描述性评测措辞、Wald 区间边界说明
 *   E. demos：prefill-decode 纯渲染、serving-metrics TTFT 三项口径、pass@k clamp、judge 双评分、data 演示措辞
 *   F. publish.sh：git push 失败必须退出非零（不再假成功）
 *
 * 用法：node tools/validate-batch2.js
 * 退出码：0 = 通过；1 = 有问题
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let checks = 0, errors = 0;

function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
function has(label, src, needle) {
  checks++;
  if (!src.includes(needle)) { console.log(`❌ ${label}：缺少 "${needle}"`); errors++; }
}
function notHas(label, src, needle) {
  checks++;
  if (src.includes(needle)) { console.log(`❌ ${label}：不应出现 "${needle}"`); errors++; }
}

/* ============ A. 第 18 章 ============ */
const ch18 = read("content/18-data-pipeline.md");
has("ch18", ch18, "build_token_stream");
has("ch18", ch18, "chunk_stream");
has("ch18", ch18, "drop_last");
has("ch18", ch18, "不存在相邻 EOS");
notHas("ch18", ch18, "pack_documents");
notHas("ch18", ch18, "EOS + pad");
// 章节实测数字必须还在（105 / 6 / 9）
has("ch18", ch18, "token 流总长 105");
has("ch18", ch18, "6 个定长块");
has("ch18", ch18, "Dropped final remainder: 9 tokens");

/* ============ B. 第 19 章 ============ */
const ch19 = read("content/19-flash-attention.md");
has("ch19", ch19, "eager 分解");
has("ch19", ch19, "bitwise");
has("ch19", ch19, "scaled_dot_product_attention");
notHas("ch19", ch19, "标准 attention");
notHas("ch19", ch19, "标准 softmax");
// 不把 Triton/GPU 结果说成已执行
has("ch19", ch19, "FP64");

/* ============ C. 第 20 章 ============ */
const ch20 = read("content/20-inference.md");
has("ch20", ch20, "Sample first token");
has("ch20", ch20, "不需要额外执行一次 decode");
has("ch20", ch20, "T_{queue}");
has("ch20", ch20, "\\sum_{i=1}^{B} S_i");
notHas("ch20", ch20, "prefill + first decode");
notHas("ch20", ch20, "几乎不空转");
notHas("ch20", ch20, "常见为 **compute-bound**");

/* ============ D. 第 23 章 ============ */
const ch23 = read("content/23-llm-eval.md");
has("ch23", ch23, "Wilson");
has("ch23", ch23, "描述性");
has("ch23", ch23, "k = n 且 c > 0");
notHas("ch23", ch23, "接近随机");
notHas("ch23", ch23, "有信号，但仍弱");

/* ============ E. demos ============ */
const demInfer = read("js/demos-inference.js");
// prefill-decode 的 render 必须纯渲染：state 只在 handler 修改
{
  const fn = demInfer.match(/LC\.demos\["prefill-decode"\] = function[\s\S]*?\n  \};/);
  checks++;
  if (!fn) { console.log("❌ demos-inference.js：找不到 prefill-decode demo"); errors++; }
  else {
    const body = fn[0];
    const renderBlock = body.match(/function render\(\)[\s\S]*?\n    \}\n/);
    if (!renderBlock || /gen\s*\+=\s*1|gen\+\+/.test(renderBlock[0])) {
      console.log("❌ prefill-decode：render() 内修改 gen（应为纯渲染，state 只在 handler 改）"); errors++;
    }
    if (!/gen\s*\+=\s*1/.test(body)) {
      console.log("❌ prefill-decode：handler 里应显式 gen += 1"); errors++;
    }
  }
}
has("demos-inference", demInfer, "首波");
has("demos-inference", demInfer, "平均 TTFT");
has("demos-inference", demInfer, "samplingMs");
notHas("demos-inference", demInfer, "TTFT ≈ prefill + 一步 decode");

const demEval = read("js/demos-evaluation.js");
has("demos-eval", demEval, "Math.min(k, n)");
has("demos-eval", demEval, "POS_BONUS");
has("demos-eval", demEval, "LEN_BONUS");
has("demos-eval", demEval, "s1 > s2");
notHas("demos-eval", demEval, "接近随机");

const demData = read("js/demos-data.js");
has("demos-data", demData, "Boundary + Chunk");
has("demos-data", demData, "drop_last");
notHas("demos-data", demData, "Boundary + Packing");

const demKernels = read("js/demos-kernels.js");
notHas("demos-kernels", demKernels, "标准");

/* ============ F. publish.sh ============ */
const pub = read("tools/publish.sh");
notHas("publish", pub, "|| true");
has("publish", pub, "GitHub push 失败");
has("publish", pub, "exit 1");
has("publish", pub, "validate-batch2.js");

/* ============ 汇总 ============ */
console.log("");
if (errors === 0) {
  console.log(`✅ 第二批回归测试通过：${checks} 项检查`);
} else {
  console.log(`❌ 第二批回归测试失败：${errors} / ${checks} 项`);
}
process.exit(errors ? 1 : 0);
