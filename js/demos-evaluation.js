/* ============================================================
   LC — 交互演示 (LLM Evaluation)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, button = LC.button;

  /* ============================================================
     1. Evaluation Pipeline
     ============================================================ */
  LC.demos["eval-pipeline"] = function (root) {
    var stages = [
      { name: "Model", desc: "被测模型（版本、精度、推理配置都要记录）。" },
      { name: "Dataset", desc: "题目 + 标准答案。注意数据版本与样本量——置信区间依赖它（23.14）。" },
      { name: "Prompt Template", desc: "zero-shot / few-shot / 指令格式。换模板分数会变（23.12）：必须固定并公开。" },
      { name: "Generation", desc: "采样参数：temperature / top-p / max_tokens。argmax 与采样结果不同，必须写清。" },
      { name: "Parser", desc: "从输出里抽出答案：正则 / boxed / 选项匹配。EM 类指标的分数高度依赖 parser（23.3）。" },
      { name: "Metric", desc: "EM / F1 / Accuracy / pass@k / Judge。不同指标回答不同问题。" },
      { name: "Report", desc: "分数 + 随机基线 + 置信区间 + 失败样本。缺了这些，分数不可复现、不可比较。" }
    ];
    var sel = 2;
    var view = h("div"), out = LC.readout();
    function render() {
      view.innerHTML = "";
      var flow = h("div", { class: "demo-chips" });
      stages.forEach(function (s, i) {
        var c = h("span", { class: "chip" + (i === sel ? " on" : ""), text: s.name });
        c.addEventListener("click", function () { sel = i; render(); });
        flow.appendChild(c);
        if (i < stages.length - 1) flow.appendChild(h("span", { style: "color:var(--text-faint)", text: "→" }));
      });
      view.appendChild(flow);
      view.appendChild(LC.panel(stages[sel].name, [h("div", { class: "stat-line", text: stages[sel].desc })]));
      out.textContent = "评估流水线的每一环都会影响最终分数。点击各阶段查看「错在哪会怎样」。";
    }
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     2. EM 与 F1 计算器
     ============================================================ */
  LC.demos["em-f1"] = function (root) {
    var gold = "苹果公司位于库比蒂诺";
    var pred = "苹果公司位于美国库比蒂诺";
    var view = h("div"), out = LC.readout();

    function norm(s) {
      return s.toLowerCase().replace(/[，。！？、,.!?"'\s]/g, "");
    }
    function tokens(s) {
      // 中文按字、英文按词（教学简化）
      return s.match(/[a-zA-Z0-9]+|[\u4e00-\u9fa5]/g) || [];
    }
    function render() {
      var em = norm(gold) === norm(pred) ? 1 : 0;
      var g = tokens(norm(gold)), p = tokens(norm(pred));
      var gs = {}, ps = {};
      g.forEach(function (t) { gs[t] = (gs[t] || 0) + 1; });
      p.forEach(function (t) { ps[t] = (ps[t] || 0) + 1; });
      var inter = 0;
      Object.keys(ps).forEach(function (t) { inter += Math.min(gs[t] || 0, ps[t]); });
      var P = p.length ? inter / p.length : 0;
      var R = g.length ? inter / g.length : 0;
      var F1 = (P + R) ? 2 * P * R / (P + R) : 0;

      view.innerHTML = "";
      view.appendChild(LC.bars([
        { label: "Exact Match", value: em, max: 1, text: em ? "1（完全一致）" : "0（不完全一致）", color: em ? "green" : "red" },
        { label: "Token F1", value: F1, max: 1, text: (F1 * 100).toFixed(1) + "%", color: "green" },
        { label: "Precision", value: P, max: 1, text: (P * 100).toFixed(1) + "%", color: "dim" },
        { label: "Recall", value: R, max: 1, text: (R * 100).toFixed(1) + "%", color: "dim" }
      ], { max: 1 }));
      out.textContent =
        "规范化：去空白/标点/大小写 → \"" + norm(gold) + "\" vs \"" + norm(pred) + "\"\n" +
        "交集 token = " + inter + "，标准 " + g.length + " 个，预测 " + p.length + " 个\n\n" +
        "EM = " + em + "（严格指标，parser 一改就变）\nF1 = " + (F1 * 100).toFixed(1) + "%（部分给分，QA 常用）\n\n" +
        "试着改文本：删掉「美国」看 F1 如何上升、EM 如何变成 1——体会 parser/规范化对分数的影响。";
    }
    function input(label, val, onChange) {
      var inp = h("input", { class: "demo-num", style: "width:260px", value: val });
      inp.addEventListener("input", function () { onChange(inp.value); render(); });
      return h("label", { class: "demo-control", style: "margin-right:12px" }, [h("span", { class: "demo-label", text: label }), inp]);
    }
    root.appendChild(h("div", { class: "demo-controls" }, [
      input("标准答案", gold, function (v) { gold = v; }),
      input("模型输出", pred, function (v) { pred = v; })
    ]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     3. pass@k 计算器
     ============================================================ */
  LC.demos["pass-at-k"] = function (root) {
    var n = 10, c = 3, k = 1;
    var view = h("div"), out = LC.readout();

    function logC(a, b) { // ln C(a, b)
      if (b < 0 || b > a) return -Infinity;
      var s = 0;
      for (var i = 0; i < b; i++) s += Math.log(a - i) - Math.log(i + 1);
      return s;
    }
    function passAtK(n, c, k) {
      if (n - c < k) return 1;
      return 1 - Math.exp(logC(n - c, k) - logC(n, k));
    }
    function render() {
      var p1 = c / n;
      var pk = passAtK(n, c, k);
      view.innerHTML = "";
      view.appendChild(LC.bars([
        { label: "pass@1（= c/n）", value: p1, max: 1, text: (p1 * 100).toFixed(1) + "%", color: "dim" },
        { label: "pass@" + k, value: pk, max: 1, text: (pk * 100).toFixed(1) + "%", color: "green" }
      ], { max: 1 }));
      out.textContent =
        "n = " + n + " 个样本，其中 c = " + c + " 个通过\n" +
        "pass@1 = " + (p1 * 100).toFixed(1) + "%\n" +
        "pass@" + k + " = 1 − C(n−c, k)/C(n, k) = " + (pk * 100).toFixed(1) + "%\n\n" +
        "直觉：k 越大，只要 n 个样本里有一个对的就算通过 → 分数越乐观。\n" +
        "所以引用 pass@k 数字时必须写明 k、n 与采样温度。\n\n" +
        (n - c < k ? "当前 n−c < k：数学上 pass@" + k + " 必然为 100%（存在通过样本时）。" : "");
    }
    var nS = LC.slider("采样数 n", 1, 100, 1, n, function (v) { n = Math.round(v); c = Math.min(c, n); cS.set(c); render(); });
    var cS = LC.slider("通过数 c", 0, 100, 1, c, function (v) { c = Math.round(Math.min(v, n)); cS.set(c); render(); });
    var kS = LC.slider("k", 1, 20, 1, k, function (v) { k = Math.round(v); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [nS.el, cS.el, kS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     4. Judge 位置偏差
     ============================================================ */
  LC.demos["judge-bias"] = function (root) {
    var order = 0; // 0: A在前 1: B在前
    var view = h("div"), out = LC.readout();
    var ANS_A = "光合作用把光能转化为化学能，储存在葡萄糖中。";
    var ANS_B = "光合作用就是植物把阳光变成能量的过程，它是植物生长的关键，也是地球上几乎所有生命能量的源头，非常重要。";
    function render() {
      var first = order === 0 ? { name: "回答 A", text: ANS_A } : { name: "回答 B", text: ANS_B };
      var second = order === 0 ? { name: "回答 B", text: ANS_B } : { name: "回答 A", text: ANS_A };
      view.innerHTML = "";
      view.appendChild(LC.panel("裁判视角（只看得到两个回答与顺序）", [
        h("div", { class: "stat-line", html: "<b>位置 1：</b>" + first.text }),
        h("div", { class: "stat-line", html: "<b>位置 2：</b>" + second.text })
      ]));
      // 教学模拟：judge 有「偏爱更长回答」+「偏爱位置1」的偏见
      var len1 = first.text.length, len2 = second.text.length;
      var posBonus = 0.15;
      var score1 = posBonus + (len1 > len2 ? 0.25 : 0);
      var winner = score1 >= 0.15 ? "位置 1" : "位置 2";
      view.appendChild(LC.panel("裁判结论（教学模拟：带长度偏好 + 位置偏好）", [
        h("div", { class: "stat-line", html: "胜者：<b>" + winner + "</b>（位置 1 分数加成 +0.15；更长回答再 +0.25）" }),
        h("div", { class: "stat-line", text: order === 0 ? "→ B 在位置 2 时反而输了" : "→ 交换后 B 到了位置 1，结论可能翻转" })
      ]));
      out.textContent =
        (order === 0 ? "当前顺序：A 在前。" : "当前顺序：B 在前（已交换）。") + "\n\n" +
        "同一对回答，交换顺序后裁判结论可能改变——这就是 position bias。\n" +
        "缓解方法：两个顺序各评一次，取一致结论；或用 pairwise + 统计聚合。\n" +
        "⚠️ 上面的打分是教学模拟，用于演示偏差机制，非真实裁判输出。";
    }
    var toggle = button("交换 A/B 顺序", function () { order = 1 - order; render(); }, "primary");
    root.appendChild(h("div", { class: "demo-controls" }, [toggle, button("重置顺序", function () { order = 0; render(); })]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     5. 置信区间 vs 样本量
     ============================================================ */
  LC.demos["ci-slider"] = function (root) {
    var p = 0.70, n = 100;
    var cv = LC.canvas(560, 180);
    var ctx = cv.getContext("2d");
    var out = LC.readout();
    function draw() {
      var W = 560, H = 180;
      ctx.clearRect(0, 0, W, H);
      var se = Math.sqrt(p * (1 - p) / n);
      var lo = Math.max(0, p - 1.96 * se), hi = Math.min(1, p + 1.96 * se);
      function X(v) { return 60 + v * (W - 90); }
      // 轴
      ctx.strokeStyle = "rgba(128,140,160,.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(60, 120); ctx.lineTo(W - 30, 120); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "11px -apple-system";
      [0, 0.25, 0.5, 0.75, 1].forEach(function (t) { ctx.fillText((t * 100) + "%", X(t) - 10, 140); });
      // 区间
      ctx.fillStyle = "rgba(47,111,237,.18)";
      ctx.fillRect(X(lo), 50, X(hi) - X(lo), 40);
      ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(lo), 70); ctx.lineTo(X(hi), 70); ctx.stroke();
      // 点
      ctx.fillStyle = "#2f6fed";
      ctx.beginPath(); ctx.arc(X(p), 70, 6, 0, 7); ctx.fill();
      ctx.fillStyle = "#5b6472"; ctx.font = "12.5px -apple-system";
      ctx.fillText("观测分数 " + (p * 100).toFixed(1) + "%", X(p) - 44, 34);
      ctx.fillText("95% CI ≈ [" + (lo * 100).toFixed(1) + "%, " + (hi * 100).toFixed(1) + "%]（±" + ((hi - lo) / 2 * 100).toFixed(1) + "pt）", 60, 168);
    }
    function update() {
      draw();
      var se = Math.sqrt(p * (1 - p) / n);
      out.textContent =
        "p = " + (p * 100).toFixed(1) + "%，n = " + n + "\n" +
        "SE = √(p(1−p)/n) = " + se.toFixed(4) + "\n" +
        "95% CI ≈ p ± 1.96×SE = ±" + (1.96 * se * 100).toFixed(1) + " pt\n\n" +
        (n < 100 ? "样本很小时区间极宽：这里 ±" + (1.96 * se * 100).toFixed(0) + "pt——所谓的模型「提升」可能完全在噪声里。" :
         "样本增大后区间收窄：结论更可信。") + "\n\n" +
        "工程含义：报告分数必须带样本量与置信区间；比较两个模型要看区间是否重叠（第 23.15 节）。";
    }
    var pS = LC.slider("观测准确率 p", 0.5, 1, 0.01, p, function (v) { p = v; update(); });
    var nS = LC.slider("样本量 n", 10, 5000, 10, n, function (v) { n = Math.round(v); update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [pS.el, nS.el]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     6. 分数 vs 随机基线
     ============================================================ */
  LC.demos["mcq-baseline"] = function (root) {
    var score = 40;
    var task = 0; // 0: 4选1(C3) 1: 2选1(XCOPA)
    var view = h("div"), out = LC.readout();
    function render() {
      var base = task === 0 ? 25 : 50;
      var rel = score - base;
      view.innerHTML = "";
      view.appendChild(LC.bars([
        { label: (task === 0 ? "C3（4选1）" : "XCOPA（2选1）") + " 随机基线", value: base, max: 100, text: base + "%", color: "dim" },
        { label: "模型分数", value: score, max: 100, text: score + "%", color: rel > 10 ? "green" : rel > 0 ? "amber" : "red" },
        { label: "超出基线", value: Math.max(0, rel), max: 100, text: (rel > 0 ? "+" : "") + rel.toFixed(0) + " pt", color: "green" }
      ], { max: 100 }));
      out.textContent =
        "同一个分数（" + score + "%）在不同任务里的意义完全不同：\n" +
        "· C3（4选1，基线 25%）：超出 " + (score - 25) + " pt → " + (score - 25 > 10 ? "有信号" : "信号较弱") + "\n" +
        "· XCOPA（2选1，基线 50%）：超出 " + (score - 50) + " pt → " + (score - 50 > 10 ? "有信号" : "接近随机") + "\n\n" +
        "（本项目小模型真实结果：C3 40%（+15pt）、XCOPA 55%（+5pt）——后者说明因果推理基本没学会。）\n\n" +
        "规则：**任何选择题分数都必须写在随机基线旁边**，否则不可解读。";
    }
    var sS = LC.slider("模型分数（%）", 10, 100, 1, score, function (v) { score = Math.round(v); render(); });
    var group = LC.buttonGroup(["C3（4选1）", "XCOPA（2选1）"], function (i) { task = i; render(); });
    root.appendChild(group.el);
    root.appendChild(h("div", { class: "demo-controls" }, [sS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
