/* ============================================================
   LC — 交互演示 (GPT 生成 / 现代 LLM 架构)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, svgRoot = LC.svgRoot, svgEl = LC.svgEl, button = LC.button, svgText = LC.svgText;

  function softmax(arr, T) {
    T = T || 1;
    var ex = arr.map(function (v) { return Math.exp(v / T); });
    var s = ex.reduce(function (a, b) { return a + b; }, 0);
    return ex.map(function (e) { return e / s; });
  }

  /* ============================================================
     Next Token Prediction
     ============================================================ */
  LC.demos["next-token"] = function (root) {
    var candidates = [
      { t: "Paris", z: 8.3 },
      { t: "London", z: 4.2 },
      { t: "Berlin", z: 3.8 },
      { t: "Rome", z: 3.1 },
      { t: "Madrid", z: 2.4 }
    ];
    var prompt = "The capital of France is";
    var stage = 0; // 0 logits, 1 probs, 2 generated
    var view = h("div");
    var out = LC.readout();

    function render() {
      var z = candidates.map(function (c) { return c.z; });
      var p = softmax(z);
      view.innerHTML = "";
      view.appendChild(h("div", { class: "demo-sub", html: '当前序列：<b>' + prompt + (stage === 2 ? " Paris" : "") + "</b>" }));
      if (stage === 0) {
        view.appendChild(LC.panel("① 模型输出 logits（未归一化分数）", [
          LC.bars(candidates.map(function (c, i) { return { label: c.t, value: c.z, max: 8.3, text: c.z.toFixed(1), color: "dim" }; }))
        ]));
        out.textContent = "模型对词表里每个 token 都给出一个 logit。logits 不是概率：可以为负、可以不和 1。\n下一步：softmax 变成概率。";
      } else if (stage === 1) {
        view.appendChild(LC.panel("② softmax(logits) = 概率分布", [
          LC.bars(candidates.map(function (c, i) { return { label: c.t, value: p[i], max: 1, text: (p[i] * 100).toFixed(1) + "%", color: "green" }; }))
        ]));
        out.textContent = "P(Paris | \"The capital of France is\") ≈ " + (p[0] * 100).toFixed(1) + "%\n概率和为 1。下一步：从分布中选择一个 token。";
      } else {
        view.appendChild(LC.panel("③ 采样结果", [
          h("div", { class: "stat-line", html: '选中：<b style="color:var(--green)">Paris</b>（此处用 greedy：概率最高）' }),
          h("div", { class: "stat-line", html: '新序列："' + prompt + ' <b>Paris</b>"' }),
          h("div", { class: "stat-line", text: "然后把新序列喂回模型，重复整个过程 → 自回归生成。" })
        ]));
        out.textContent = "这就是 GPT 生成的全部流程：前向 → logits → softmax → 选一个 → 拼回序列 → 再来一次。";
      }
      stageBtn.textContent = stage === 0 ? "计算 softmax →" : stage === 1 ? "选择下一个 token →" : "重新开始";
    }
    var stageBtn = button("计算 softmax →", function () {
      stage = stage === 2 ? 0 : stage + 1;
      render();
    }, "primary");
    root.appendChild(h("div", { class: "demo-controls" }, [stageBtn]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     Temperature
     ============================================================ */
  LC.demos["temperature"] = function (root) {
    var tokens = ["Paris", "London", "Berlin", "Rome", "Madrid"];
    var z = [4.0, 3.2, 2.8, 2.0, 1.2];
    var T = 1.0;
    var wrap = h("div");
    var out = LC.readout();

    function update() {
      var p = softmax(z, T);
      wrap.innerHTML = "";
      wrap.appendChild(LC.bars(tokens.map(function (t, i) {
        return { label: t, value: p[i], max: 1, text: (p[i] * 100).toFixed(1) + "%", color: T < 0.5 ? "red" : T > 1.5 ? "amber" : "green" };
      })));
      var maxP = Math.max.apply(null, p);
      out.textContent =
        "T = " + T.toFixed(2) + "   最大概率 = " + (maxP * 100).toFixed(1) + "%\n" +
        (T < 0.5 ? "温度低 → 分布尖锐，几乎总是选最高概率 token（确定性、保守、易重复）。" :
         T > 1.5 ? "温度高 → 分布平坦，低概率 token 也有机会被选中（多样性高、可能跑题）。" :
         "温度适中 → 在确定性和多样性之间平衡。");
    }
    var s = LC.slider("温度 T", 0.1, 2, 0.05, T, function (v) { T = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [
      s.el,
      button("T = 0.1（几乎 greedy）", function () { s.set(0.1); T = 0.1; update(); }),
      button("T = 1（原始分布）", function () { s.set(1); T = 1; update(); }),
      button("T = 2（更随机）", function () { s.set(2); T = 2; update(); })
    ]));
    root.appendChild(wrap);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     Top-K / Top-P
     ============================================================ */
  LC.demos["top-k-p"] = function (root) {
    var tokens = ["Paris", "London", "Berlin", "Rome", "Madrid", "Vienna", "Prague", "Oslo"];
    var z = [4.0, 3.2, 2.8, 2.0, 1.2, 0.6, 0.1, -0.4];
    var p = softmax(z);
    var mode = 0; // 0 全采样 1 greedy 2 top-k 3 top-p
    var K = 3, P = 0.9;
    var wrap = h("div");
    var out = LC.readout();

    function update() {
      var keep = new Array(tokens.length).fill(true);
      var desc = "";
      if (mode === 1) {
        var argmax = p.indexOf(Math.max.apply(null, p));
        keep = p.map(function (_, i) { return i === argmax; });
        desc = "Greedy：永远只选概率最高的 token（Paris）。稳定但缺乏多样性。";
      } else if (mode === 2) {
        var idx = p.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; });
        keep = p.map(function () { return false; });
        for (var i = 0; i < K && i < idx.length; i++) keep[idx[i].i] = true;
        desc = "Top-K：只保留概率最高的 K = " + K + " 个 token，其余概率置 0 后重新归一化。";
      } else if (mode === 3) {
        var idx2 = p.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; });
        keep = p.map(function () { return false; });
        var cum = 0;
        for (var j = 0; j < idx2.length; j++) {
          keep[idx2[j].i] = true;
          cum += idx2[j].v;
          if (cum >= P) break;
        }
        desc = "Top-P（nucleus）：按概率从高到低累加，保留累计概率 ≥ p = " + P + " 的最小集合。模型越确定，保留的 token 越少。";
      } else {
        desc = "全采样：所有 token 都保留（不做截断），低概率 token 也可能被选中。";
      }
      var kept = p.map(function (v, i) { return keep[i] ? v : 0; });
      var sum = kept.reduce(function (a, b) { return a + b; }, 0);
      var renorm = kept.map(function (v) { return sum > 0 ? v / sum : 0; });
      var keptCount = keep.filter(Boolean).length;
      wrap.innerHTML = "";
      wrap.appendChild(LC.bars(tokens.map(function (t, i) {
        return {
          label: t,
          value: renorm[i],
          max: 1,
          text: keep[i] ? (renorm[i] * 100).toFixed(1) + "%" : "被截断",
          color: keep[i] ? "green" : "dim"
        };
      })));
      out.textContent = desc + "\n\n保留 token 数：" + keptCount + " / " + tokens.length + "，保留集合内概率重新归一化后和为 1。";
    }
    var group = LC.buttonGroup(["全采样", "Greedy", "Top-K", "Top-P"], function (i) { mode = i; update(); });
    var kS = LC.slider("K", 1, 8, 1, K, function (v) { K = v; mode = 2; group.setActive(2); update(); });
    var pS = LC.slider("p", 0.1, 1, 0.05, P, function (v) { P = v; mode = 3; group.setActive(3); update(); });
    root.appendChild(group.el);
    root.appendChild(h("div", { class: "demo-controls" }, [kS.el, pS.el]));
    root.appendChild(wrap);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     KV Cache
     ============================================================ */
  LC.demos["kv-cache"] = function (root) {
    var TOKENS = ["I", "love", "machine", "learning"];
    var step = 0, timer = null;
    var leftWrap = h("div"), rightWrap = h("div"), out = LC.readout();
    var computeNo = 0, computeYes = 0;

    function render() {
      leftWrap.innerHTML = "";
      rightWrap.innerHTML = "";
      var noRow = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
      for (var i = 0; i < TOKENS.length; i++) {
        var active = i < step;
        var recompute = active; // 无缓存：每次都重算全部历史
        noRow.appendChild(h("span", {
          class: "chip ghost",
          text: TOKENS[i] + (recompute ? " ↻" : ""),
          style: active
            ? "background:var(--red-soft);border-color:color-mix(in srgb, var(--red) 40%, transparent);color:var(--red)"
            : "opacity:.35"
        }));
      }
      leftWrap.appendChild(LC.panel("Without KV Cache", [
        noRow,
        h("div", { class: "stat-line", html: "第 " + Math.max(step, 1) + " 步：对全部 " + Math.max(step, 1) + " 个 token 重新计算 Q/K/V（↻ 表示重复计算）" }),
        h("div", { class: "stat-line", html: "累计计算量：<b>" + computeNo + "</b> 次 token 级 QKV 计算" })
      ]));

      var yesRow = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
      for (var j = 0; j < TOKENS.length; j++) {
        var isNew = j === step - 1;
        var cached = j < step - 1;
        yesRow.appendChild(h("span", {
          class: "chip ghost",
          text: TOKENS[j] + (isNew ? " ★新" : cached ? " ✓缓存" : ""),
          style: isNew
            ? "background:var(--green-soft);border-color:color-mix(in srgb, var(--green) 40%, transparent);color:var(--green)"
            : cached
              ? "background:var(--accent-soft);border-color:color-mix(in srgb, var(--accent) 35%, transparent);color:var(--accent-text)"
              : "opacity:.35"
        }));
      }
      rightWrap.appendChild(LC.panel("With KV Cache", [
        yesRow,
        h("div", { class: "stat-line", html: "第 " + Math.max(step, 1) + " 步：只计算新 token 的 K/V，历史直接读缓存" }),
        h("div", { class: "stat-line", html: "累计计算量：<b>" + computeYes + "</b> 次 token 级 QKV 计算" })
      ]));
      out.textContent =
        "生成第 t 个 token 时：\n" +
        "· 无缓存：对整个 prefix 重跑完整前向，历史 token 的 K/V 投影全部重算（本演示只统计投影次数）→ 累计 O(n²)\n" +
        "· 有缓存：只算 1 个新 token 的投影，历史 K/V 直接读缓存 → 投影累计 O(n)\n\n" +
        "注意（常被讲错）：即使有缓存，新 Query 仍要与全部历史 K 计算注意力分数——每步 O(t·d)，随上下文线性增长。\n" +
        "KV Cache 省掉的是「重算历史」，不是注意力本身；代价是显存里保存所有历史的 K/V、每步读取缓存的带宽开销。";
    }
    function stepOnce() {
      if (step >= TOKENS.length) return;
      step++;
      computeNo += step;
      computeYes += 1;
      render();
    }
    function start() {
      if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = "自动播放"; return; }
      autoBtn.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        if (step >= TOKENS.length) { clearInterval(timer); timer = null; autoBtn.textContent = "自动播放"; return; }
        stepOnce();
      }, 900);
    }
    var autoBtn = button("自动播放", start, "primary");
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("下一步 ▶", stepOnce),
      autoBtn,
      button("重置", function () { clearInterval(timer); timer = null; autoBtn.textContent = "自动播放"; step = 0; computeNo = 0; computeYes = 0; render(); })
    ]));
    root.appendChild(h("div", { class: "demo-grid2" }, [leftWrap, rightWrap]));
    root.appendChild(out);

    /* --- 显存估算器 --- */
    var vals = { L: 32, H: 8, D: 128, S: 4096, dtype: 2 };
    var est = h("div", { class: "demo-readout" });
    function calc() {
      var bytes = 2 * vals.L * vals.H * vals.D * vals.S * vals.dtype; // K 和 V
      var gb = bytes / 1e9;
      est.textContent =
        "KV Cache 大小 = 2（K和V） × L × H_kv × d_head × S × bytes_per_elem\n" +
        "             = 2 × " + vals.L + " × " + vals.H + " × " + vals.D + " × " + vals.S + " × " + vals.dtype + " bytes\n" +
        "             = " + bytes.toLocaleString() + " bytes ≈ " + gb.toFixed(2) + " GB（单条序列）";
    }
    function numCfg(key, label) {
      var input = h("input", { class: "demo-num", type: "number", value: String(vals[key]) });
      input.addEventListener("input", function () { vals[key] = parseFloat(input.value || "0"); calc(); });
      return h("label", { class: "demo-control", style: "margin-right:12px" }, [h("span", { class: "demo-label", text: label }), input]);
    }
    var dtypeSel = h("select", { class: "demo-num", style: "width:110px" }, [
      h("option", { value: "2", text: "FP16/BF16" }),
      h("option", { value: "4", text: "FP32" }),
      h("option", { value: "1", text: "INT8" })
    ]);
    dtypeSel.addEventListener("change", function () { vals.dtype = parseFloat(dtypeSel.value); calc(); });
    root.appendChild(h("hr", { style: "border:none;border-top:1px dashed var(--border);margin:18px 0" }));
    root.appendChild(h("div", { class: "demo-sub", html: "<b>KV Cache 显存估算器</b>（改数字看结果）" }));
    root.appendChild(h("div", { class: "demo-controls" }, [
      numCfg("L", "层数 L"), numCfg("H", "KV heads"), numCfg("D", "head_dim"), numCfg("S", "序列长度"),
      h("label", { class: "demo-control" }, [h("span", { class: "demo-label", text: "精度" }), dtypeSel])
    ]));
    root.appendChild(est);
    render(); calc();
  };

  /* ============================================================
     MHA / MQA / GQA
     ============================================================ */
  LC.demos["mha-gqa"] = function (root) {
    var QH = 8;
    var mode = 2; // 0 MHA, 1 MQA, 2 GQA
    var svgWrap = h("div"), out = LC.readout();

    function render() {
      var kvHeads = mode === 0 ? QH : mode === 1 ? 1 : 2;
      var groupSize = QH / kvHeads;
      svgWrap.innerHTML = "";
      var svg = svgRoot("0 0 560 240");
      var defs = svgEl("defs", {});
      svg.appendChild(defs);

      svg.appendChild(svgText(90, 24, "Q heads（8 个）", { size: 12.5, weight: 700, fill: "var(--accent-text)" }));
      svg.appendChild(svgText(400, 24, "K/V heads（" + kvHeads + " 个）", { size: 12.5, weight: 700, fill: "var(--purple)" }));

      var qY = 60, spacing = 22;
      for (var i = 0; i < QH; i++) {
        var y = qY + i * spacing;
        var g = svgEl("g", {});
        g.appendChild(svgEl("circle", { cx: 90, cy: y, r: 8, fill: "var(--accent-soft)", stroke: "var(--accent)", "stroke-width": 1.5 }));
        g.appendChild(svgText(90, y + 4, "Q" + (i + 1), { size: 9, fill: "var(--accent-text)" }));
        var kvIndex = mode === 0 ? i : mode === 1 ? 0 : Math.floor(i / groupSize);
        var kvY = qY + (kvIndex * (spacing * QH - spacing) / Math.max(1, kvHeads - 1));
        if (kvHeads === 1) kvY = qY + (QH - 1) * spacing / 2;
        g.appendChild(svgEl("line", { x1: 98, y1: y, x2: 392, y2: kvY, stroke: "var(--text-faint)", "stroke-width": 1, opacity: 0.5 }));
        svg.appendChild(g);
      }
      for (var k = 0; k < kvHeads; k++) {
        var ky = kvHeads === 1 ? qY + (QH - 1) * spacing / 2 : qY + k * (spacing * QH - spacing) / Math.max(1, kvHeads - 1);
        svg.appendChild(svgEl("rect", { x: 392, y: ky - 9, width: 26, height: 18, rx: 5, fill: "var(--purple-soft)", stroke: "var(--purple)", "stroke-width": 1.5 }));
        svg.appendChild(svgText(405, ky + 4, "KV", { size: 8.5, fill: "var(--purple)" }));
      }
      svgWrap.appendChild(svg);

      var names = { 0: "MHA（Multi-Head Attention）", 1: "MQA（Multi-Query Attention）", 2: "GQA（Grouped-Query Attention）" };
      var saves = { 0: "1×（基准，KV Cache 最大）", 1: "1/8（KV Cache 最小，质量损失最大）", 2: "1/4（质量与显存的折中，现代 LLM 主流）" };
      out.textContent =
        names[mode] + "\n" +
        "Q heads = 8，K/V heads = " + kvHeads + "，每 " + (mode === 2 ? groupSize + " 个 Q 共享 1 组 K/V" : mode === 1 ? "所有 Q 共享 1 组 K/V" : "每个 Q 独享 K/V") + "\n" +
        "KV Cache 相对 MHA：" + saves[mode] + "\n\n" +
        "为什么重要：推理时 KV Cache 的显存和带宽是主要瓶颈。减少 KV heads 直接降低显存占用和读取量，对长上下文尤其关键。";
    }
    var group = LC.buttonGroup(["MHA", "MQA", "GQA"], function (i) { mode = i; render(); });
    group.setActive(2);
    root.appendChild(group.el);
    root.appendChild(svgWrap);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     RoPE 旋转位置编码
     ============================================================ */
  LC.demos["rope"] = function (root) {
    var m = 2, n = 0;
    var omega = 0.45;
    var cv = LC.canvas(520, 300);
    var ctx = cv.getContext("2d");
    var out = LC.readout();

    function draw() {
      var cx = 260, cy = 150, R = 110;
      ctx.clearRect(0, 0, 520, 300);
      // grid circle
      ctx.strokeStyle = "rgba(128,140,160,.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R - 20, cy); ctx.lineTo(cx + R + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R - 20); ctx.lineTo(cx, cy + R + 20); ctx.stroke();

      var angQ = 0.35 + m * omega;
      var angK = 1.9 + n * omega;
      function vec(angle, color, label) {
        var x = cx + R * Math.cos(angle), y = cy - R * Math.sin(angle);
        ctx.strokeStyle = color; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.font = "bold 13px -apple-system"; ctx.fillText(label, x + 9, y - 6);
      }
      vec(angQ, "#2f6fed", "q (pos m=" + m + ")");
      vec(angK, "#7c3aed", "k (pos n=" + n + ")");
      var dot = Math.cos(angQ - angK);
      ctx.fillStyle = "#5b6472"; ctx.font = "13px -apple-system";
      ctx.fillText("角度差 Δ = (m − n)·ω = " + ((m - n) * omega).toFixed(2) + " rad", 20, 280);
      ctx.fillText("q·k = |q||k|·cos(角度差) = " + dot.toFixed(4) + "（假设 |q|=|k|=1）", 20, 262);
      out.textContent =
        "q 与 k 各自按自己的位置旋转：角度 = 基础角度 + pos × ω。\n" +
        "点积只取决于角度差 → 只取决于相对位置 (m − n) = " + (m - n) + "。\n\n" +
        "点击「同时 +1」按钮：q 和 k 一起多转 ω，点积保持不变 —— 这就是 RoPE 编码相对位置的机制。";
    }
    var mS = LC.slider("q 的位置 m", 0, 8, 1, m, function (v) { m = v; draw(); });
    var nS = LC.slider("k 的位置 n", 0, 8, 1, n, function (v) { n = v; draw(); });
    root.appendChild(h("div", { class: "demo-controls" }, [
      mS.el, nS.el,
      button("同时 +1（看不变性）", function () { m = Math.min(8, m + 1); n = Math.min(8, n + 1); mS.set(m); nS.set(n); draw(); }),
      button("重置", function () { m = 2; n = 0; mS.set(2); nS.set(0); draw(); })
    ]));
    root.appendChild(cv);
    root.appendChild(out);
    draw();
  };

  /* ============================================================
     LayerNorm vs RMSNorm
     ============================================================ */
  LC.demos["norm-compare"] = function (root) {
    var x = [1, 2, 3, 4];
    var wrap = h("div", { class: "demo-grid2" });
    var out = LC.readout();

    function update() {
      var d = x.length;
      var mean = x.reduce(function (a, b) { return a + b; }, 0) / d;
      var varr = x.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / d;
      var std = Math.sqrt(varr);
      var ln = x.map(function (v) { return (v - mean) / (std + 1e-5); });
      var rms = Math.sqrt(x.reduce(function (a, b) { return a + b * b; }, 0) / d);
      // 标准 RMSNorm：x / sqrt(mean(x²)+ε)（ε 在根号内）
      var rn = x.map(function (v) { return v / Math.sqrt(rms * rms + 1e-6); });

      wrap.innerHTML = "";
      wrap.appendChild(LC.panel("LayerNorm：减均值 + 除标准差", [
        h("div", { class: "stat-line", html: "mean = (1+2+3+4)/4 = <b>" + LC.fmt(mean, 2) + "</b>" }),
        h("div", { class: "stat-line", html: "var = <b>" + LC.fmt(varr, 3) + "</b>，std = <b>" + LC.fmt(std, 3) + "</b>" }),
        h("div", { class: "stat-line", html: "(x − mean)/std = <b>[" + ln.map(function (v) { return LC.fmt(v, 2); }).join(", ") + "]</b>" }),
        h("div", { class: "stat-line", text: "输出均值 = 0，标准差 = 1" })
      ]));
      wrap.appendChild(LC.panel("RMSNorm：只除均方根（不减均值，ε 在根号内）", [
        h("div", { class: "stat-line", html: "RMS = √((1²+2²+3²+4²)/4) = √(30/4) = <b>" + LC.fmt(rms, 3) + "</b>" }),
        h("div", { class: "stat-line", html: "x / √(RMS²+ε) = <b>[" + rn.map(function (v) { return LC.fmt(v, 2); }).join(", ") + "]</b>" }),
        h("div", { class: "stat-line", text: "没有减均值步骤 → 少一次归约运算，更快" })
      ]));
      out.textContent =
        "输入 x = [" + x.join(", ") + "]\n\n" +
        "LayerNorm = (x − μ)/σ · γ + β      RMSNorm = x/√(mean(x²)+ε) · γ\n\n" +
        "RMSNorm 省掉了「减均值」和 β 偏置：在 Transformer 中效果几乎一样好，但计算更简单、更省带宽 —— 所以 LLaMA/Qwen 等现代 LLM 都用 RMSNorm。";
    }
    var controls = h("div", { class: "demo-controls" });
    x.forEach(function (v, i) {
      var s = LC.slider("x" + (i + 1), -5, 5, 0.5, v, function (nv) { x[i] = nv; update(); });
      controls.appendChild(s.el);
    });
    root.appendChild(controls);
    root.appendChild(wrap);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     Pre-Norm vs Post-Norm
     ============================================================ */
  LC.demos["pre-post-norm"] = function (root) {
    var wrap = h("div", { class: "demo-grid2" });
    var out = LC.readout();
    var animating = false;

    function block(title, color, order, desc) {
      var flow = h("div", { class: "demo-flex", style: "flex-direction:column;gap:5px;align-items:center" });
      order.forEach(function (step, i) {
        var isResidual = step.indexOf("残差") !== -1;
        var isNorm = step.indexOf("Norm") !== -1;
        flow.appendChild(h("div", {
          class: "chip ghost",
          text: step,
          style: "min-width:190px;text-align:center;padding:7px 12px;" +
            (isNorm ? "background:var(--purple-soft);border-color:color-mix(in srgb, var(--purple) 35%, transparent);color:var(--purple);" :
             isResidual ? "background:var(--green-soft);border-color:color-mix(in srgb, var(--green) 40%, transparent);color:var(--green);" : "")
        }));
        if (i < order.length - 1) flow.appendChild(h("div", { style: "color:var(--text-faint)", text: "↓" }));
      });
      return LC.panel(title, [flow, h("div", { class: "demo-sub", text: desc })]);
    }

    var post = block("Post-Norm（原始 Transformer）", "", ["x → Attention", "残差相加 ⊕", "LayerNorm", "FFN", "残差相加 ⊕", "LayerNorm"], "归一化在残差之后：x = Norm(x + F(x))。梯度必须穿过 Norm 才能回到浅层。");
    var pre = block("Pre-Norm（现代 LLM）", "", ["LayerNorm", "x → Attention", "残差相加 ⊕", "LayerNorm", "FFN", "残差相加 ⊕"], "归一化在子层之前：x = x + F(Norm(x))。残差路径是「干净」的恒等通道，梯度可以直接流回最底层。");
    var info = LC.panel("为什么 Pre-Norm 更容易训深层", [
      h("div", { class: "stat-line", text: "Pre-Norm 的残差路径上没有任何归一化/非线性，∂y/∂x 中始终含有恒等项 1，梯度可以无衰减地传回。" }),
      h("div", { class: "stat-line", text: "Post-Norm 每一层都要穿过 Norm，深了以后梯度容易衰减、训练不稳定（需要 warmup 配合）。" }),
      h("div", { class: "stat-line", text: "代价：Pre-Norm 的表示方差会随深度增长，所以最后通常再加一次 final norm。" })
    ]);
    wrap.appendChild(post);
    wrap.appendChild(pre);
    root.appendChild(wrap);
    root.appendChild(info);
    out.textContent = "总结：Post-Norm 是 2017 年原始设计；Pre-Norm 是深层 Transformer（GPT-3 之后几乎所有 LLM）的标准做法。";
    root.appendChild(out);
  };

  /* ============================================================
     SwiGLU
     ============================================================ */
  LC.demos["swiglu"] = function (root) {
    var cv = LC.canvas(520, 240);
    var ctx = cv.getContext("2d");
    var x = 1.0;
    var W1 = 1.5, W3 = 0.8, W2 = 1.2;
    var out = LC.readout();

    function silu(v) { return v / (1 + Math.exp(-v)); }
    function draw() {
      var W = 520, H = 240;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, H / 2); ctx.lineTo(W - 16, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, 12); ctx.lineTo(30, H - 12); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "11.5px -apple-system";
      ctx.fillText("x", W - 22, H / 2 - 6);
      // SiLU
      ctx.strokeStyle = "#17a673"; ctx.lineWidth = 2.4; ctx.beginPath();
      for (var i = 0; i <= 240; i++) {
        var xx = -6 + 12 * i / 240;
        var px = 30 + (xx + 6) / 12 * (W - 46);
        var py = H / 2 - silu(xx) / 6 * (H / 2 - 20);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      // ReLU
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath();
      for (var j = 0; j <= 240; j++) {
        var x2 = -6 + 12 * j / 240;
        var px2 = 30 + (x2 + 6) / 12 * (W - 46);
        var py2 = H / 2 - Math.max(0, x2) / 6 * (H / 2 - 20);
        if (j) ctx.lineTo(px2, py2); else ctx.moveTo(px2, py2);
      }
      ctx.stroke(); ctx.setLineDash([]);
      // current x marker
      var mx = 30 + (x + 6) / 12 * (W - 46);
      var my = H / 2 - silu(x) / 6 * (H / 2 - 20);
      ctx.fillStyle = "#17a673";
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, 7); ctx.fill();
      ctx.fillStyle = "#5b6472"; ctx.font = "12.5px -apple-system";
      ctx.fillText("—— Swish/SiLU: x·σ(x)", 340, 26);
      ctx.fillStyle = "#dc2626";
      ctx.fillText("-- ReLU: max(0, x)", 340, 44);
    }
    function update() {
      var gate = silu(x * W1);
      var value = x * W3;
      var hidden = gate * value;
      var outv = hidden * W2;
      out.textContent =
        "标量演算（W1=" + W1 + ", W3=" + W3 + ", W2=" + W2 + "）：\n" +
        "gate  = SiLU(x·W1) = SiLU(" + LC.fmt(x * W1, 2) + ") = " + LC.fmt(gate, 3) + "\n" +
        "value = x·W3 = " + LC.fmt(value, 2) + "\n" +
        "hidden = gate ⊙ value = " + LC.fmt(hidden, 3) + "   ← 门控：gate 决定 value 通过多少\n" +
        "output = hidden·W2 = " + LC.fmt(outv, 3) + "\n\n" +
        "SwiGLU(x) = SiLU(xW₁) ⊙ (xW₃)，再乘 W₂。相比 ReLU FFN，多了「门控」机制，现代 LLM（LLaMA/Qwen）标配。";
      draw();
    }
    var s = LC.slider("输入 x", -3, 3, 0.1, x, function (v) { x = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [s.el]));
    root.appendChild(cv);
    root.appendChild(LC.panel("结构对比", [
      h("div", { class: "stat-line", html: "<b>ReLU FFN：</b> x → W₁ → ReLU → W₂ → out（一条路）" }),
      h("div", { class: "stat-line", html: "<b>SwiGLU：</b> x → W₁ → SiLU ┐<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;x → W₃ ─────── ⊙ → W₂ → out（两条路，一条当门）" })
    ]));
    root.appendChild(out);
    update();
  };
})();
