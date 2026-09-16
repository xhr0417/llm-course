/* ============================================================
   LC — 交互演示 (LLM Systems：Scaling / GPU / 分布式)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, button = LC.button;

  /* ============================================================
     1. 训练算力计算器（6ND / GPU hours / MFU）
     ============================================================ */
  LC.demos["scaling-calculator"] = function (root) {
    var N = 7;          // 参数量（B）
    var D = 1400;       // token 数（B）
    var gpus = 1024;
    var peak = 312;     // 单卡 BF16 TFLOPS（A100=312, H100=989）
    var mfu = 0.35;
    var out = LC.readout();
    var view = h("div");

    function render() {
      var flops = 6 * N * D * 1e18;                 // 6 · N · D（N 和 D 单位都是 B）
      var gpuSeconds = flops / (peak * 1e12 * mfu);
      var gpuHours = gpuSeconds / 3600;
      var wallDays = gpuSeconds / gpus / 86400;
      var chinchillaD = 20 * N;
      var ratio = D / chinchillaD;

      view.innerHTML = "";
      view.appendChild(LC.panel("计算明细", [
        h("div", { class: "stat-line", html: "训练 FLOPs ≈ 6 · N · D = 6 × " + N + "B × " + D + "B = <b>" + flops.toExponential(2) + "</b>" }),
        h("div", { class: "stat-line", html: "每 GPU 有效算力 = 峰值 × MFU = " + peak + " × " + mfu.toFixed(2) + " = <b>" + (peak * mfu).toFixed(1) + " TFLOPS</b>" }),
        h("div", { class: "stat-line", html: "GPU 总时长 = FLOPs ÷ 有效算力 = <b>" + (gpuHours / 1e6).toFixed(2) + "M GPU-hours</b>" }),
        h("div", { class: "stat-line", html: gpus + " 卡并行 → 墙钟时间 ≈ <b>" + wallDays.toFixed(1) + " 天</b>" })
      ]));
      view.appendChild(LC.bars([
        { label: "本配置 tokens", value: D, max: Math.max(D, 2000), text: D + "B", color: "green" },
        { label: "Chinchilla 最优", value: chinchillaD, max: Math.max(D, 2000), text: chinchillaD.toFixed(0) + "B", color: "amber" }
      ], { max: Math.max(D, 2000) }));
      out.textContent =
        "结论：一个 " + N + "B 模型训练 " + D + "B token，\n" +
        "在 " + gpus + " 张 " + (peak === 312 ? "A100" : "H100") + "（MFU " + (mfu * 100).toFixed(0) + "%）上大约需要 " + wallDays.toFixed(1) + " 天。\n\n" +
        "Chinchilla 视角：同一算力预算下最优 token 数约为 20 × N = " + chinchillaD.toFixed(0) + "B，当前配置是它的 " + ratio.toFixed(2) + " 倍。\n" +
        (ratio > 1.5 ? "→ 属于「过度训练」策略（用更多数据换更强小模型，现代主流）。" :
         ratio < 0.7 ? "→ 数据偏少，可能没训够。" : "→ 接近 compute-optimal 配比。") +
        "\n\n经验参考：GPT-3 175B ≈ 3.1e23 FLOPs；一个 7B/1.4T 配置 ≈ " + flops.toExponential(1) + " FLOPs。";
    }

    var nS = LC.slider("参数量 N（B）", 0.1, 175, 0.1, N, function (v) { N = v; render(); });
    var dS = LC.slider("训练 tokens D（B）", 10, 5000, 10, D, function (v) { D = v; render(); });
    var gS = LC.slider("GPU 数量", 8, 16384, 8, gpus, function (v) { gpus = v; render(); });
    var mS = LC.slider("MFU", 0.05, 0.6, 0.01, mfu, function (v) { mfu = v; render(); });
    var presets = h("div", { class: "demo-flex" }, [
      button("GPT-2 级别 0.1B/10B", function () { nS.set(0.1); N = 0.1; dS.set(10); D = 10; render(); }),
      button("LLaMA-2 7B/2T", function () { nS.set(7); N = 7; dS.set(2000); D = 2000; render(); }),
      button("Chinchilla 70B/1.4T", function () { nS.set(70); N = 70; dS.set(1400); D = 1400; render(); }),
      button("A100 集群", function () { peak = 312; render(); }),
      button("H100 集群", function () { peak = 989; render(); })
    ]);
    root.appendChild(h("div", { class: "demo-controls" }, [nS.el, dS.el]));
    root.appendChild(h("div", { class: "demo-controls" }, [gS.el, mS.el]));
    root.appendChild(presets);
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     2. Chinchilla 曲线：isoFLOP 与最优配比
     ============================================================ */
  LC.demos["chinchilla-curve"] = function (root) {
    var cv = LC.canvas(560, 300);
    var ctx = cv.getContext("2d");
    var logC = 22; // FLOPs = 10^logC
    var out = LC.readout();

    // 教学用简化拟合（θ 相等的幂律形式，保证 D*/N* ≈ 20）：
    // L(N,D) = E + A/N^α + B/D^α，取 α=0.3、A/B 使最优点落在
    // C≈5.9e23 时 N*≈70B、D*≈1.4T（对齐 Chinchilla headline）
    var E = 1.69, A = 224, B = 550, ALPHA = 0.3;
    function lossOf(N, D) { return E + A / Math.pow(N, ALPHA) + B / Math.pow(D, ALPHA); }
    function optimalN(C) {
      // 令 dL/dN=0：N* = [(A/B)·(C/6)^α]^(1/(2α))
      return Math.pow((A / B) * Math.pow(C / 6, ALPHA), 1 / (2 * ALPHA));
    }

    function draw() {
      var W = 560, H = 300, padL = 54, padB = 40, padT = 16, padR = 14;
      ctx.clearRect(0, 0, W, H);
      var logNmin = 7, logNmax = 12.5; // 10^7 ~ ~3e12 params
      function X(N) { return padL + (Math.log10(N) - logNmin) / (logNmax - logNmin) * (W - padL - padR); }
      function Y(l) { return H - padB - (l - 1.5) / 3.5 * (H - padB - padT); }
      // 坐标轴
      ctx.strokeStyle = "rgba(128,140,160,.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "11.5px -apple-system";
      for (var e = 7; e <= 12; e++) {
        ctx.fillText("1e" + e, X(Math.pow(10, e)) - 12, H - padB + 15);
      }
      ctx.fillText("模型参数量 N（对数轴）", padL + 120, H - 6);
      ctx.fillText("Loss", 10, padT + 10);
      // 其他预算的浅色曲线
      [19, 20, 21, 22, 23].forEach(function (lc) {
        var C = Math.pow(10, lc);
        ctx.strokeStyle = "rgba(128,140,160,.28)"; ctx.lineWidth = 1.2;
        ctx.beginPath();
        var first = true;
        for (var i = 0; i <= 200; i++) {
          var ln = logNmin + (logNmax - logNmin) * i / 200;
          var N2 = Math.pow(10, ln);
          var D2 = C / (6 * N2);
          if (D2 < 1e6) continue;
          var l2 = lossOf(N2, D2);
          if (!first) ctx.lineTo(X(N2), Y(l2)); else { ctx.moveTo(X(N2), Y(l2)); first = false; }
        }
        ctx.stroke();
      });
      // 当前预算的粗曲线
      var C = Math.pow(10, logC);
      ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 2.6;
      ctx.beginPath();
      var first = true, best = { N: 0, l: 99 };
      for (var i = 0; i <= 260; i++) {
        var ln2 = logNmin + (logNmax - logNmin) * i / 260;
        var N3 = Math.pow(10, ln2);
        var D3 = C / (6 * N3);
        if (D3 < 1e6) continue;
        var l3 = lossOf(N3, D3);
        if (l3 < best.l) best = { N: N3, l: l3 };
        if (!first) ctx.lineTo(X(N3), Y(l3)); else { ctx.moveTo(X(N3), Y(l3)); first = false; }
      }
      ctx.stroke();
      // 最优点
      var Nstar = optimalN(C);
      var Dstar = C / (6 * Nstar);
      var Lstar = lossOf(Nstar, Dstar);
      ctx.fillStyle = "#dc2626";
      ctx.beginPath(); ctx.arc(X(Nstar), Y(Lstar), 6, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(220,38,38,.4)"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(X(Nstar), H - padB); ctx.lineTo(X(Nstar), Y(Lstar)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#dc2626"; ctx.font = "bold 12px -apple-system";
      ctx.fillText("最优点 N*=" + (Nstar / 1e9).toFixed(1) + "B", X(Nstar) + 8, Y(Lstar) - 8);

      out.textContent =
        "计算预算 C = 10^" + logC + " ≈ " + C.toExponential(1) + " FLOPs\n" +
        "最优模型 N* ≈ " + (Nstar / 1e9).toFixed(1) + "B 参数\n" +
        "最优数据 D* ≈ " + (Dstar / 1e9).toFixed(0) + "B token\n" +
        "比值 D*/N* ≈ " + (Dstar / Nstar).toFixed(1) + "（Chinchilla 结论 ≈ 20）\n\n" +
        "灰色曲线是不同预算的 isoFLOP 曲线——每条都有一个最优点，\n" +
        "说明：固定算力下，模型不是越大越好，也不是数据越多越好，而是存在最优配比。\n" +
        "该配置的损失约 " + Lstar.toFixed(2) + "。";
    }
    var s = LC.slider("log₁₀(计算预算 FLOPs)", 19, 25, 0.1, logC, function (v) { logC = v; draw(); });
    root.appendChild(h("div", { class: "demo-controls" }, [
      s.el,
      button("GPT-3 级 3e23", function () { s.set(23.5); logC = 23.5; draw(); }),
      button("小实验 1e19", function () { s.set(19); logC = 19; draw(); })
    ]));
    root.appendChild(cv);
    root.appendChild(out);
    draw();
  };

  /* ============================================================
     3. Roofline：算术强度与瓶颈判断
     ============================================================ */
  LC.demos["roofline"] = function (root) {
    var cv = LC.canvas(560, 300);
    var ctx = cv.getContext("2d");
    var bw = 2039;   // GB/s (A100 HBM)
    var peak = 312;  // TFLOPS BF16
    var ai = 2;      // 当前算子的算术强度
    var out = LC.readout();

    var OPS = [
      { name: "向量加法（逐元素）", ai: 0.08 },
      { name: "Softmax", ai: 0.25 },
      { name: "LayerNorm", ai: 0.5 },
      { name: "GELU", ai: 0.2 },
      { name: "Attention（朴素）", ai: 4 },
      { name: "FlashAttention", ai: 40 },
      { name: "大 GEMM", ai: 200 }
    ];
    function draw() {
      var W = 560, H = 300, padL = 60, padB = 42, padT = 16, padR = 16;
      ctx.clearRect(0, 0, W, H);
      var aiMin = -1, aiMax = 3.2, pMin = -1, pMax = Math.log10(400); // log scales
      function X(a) { return padL + (Math.log10(a) - aiMin) / (aiMax - aiMin) * (W - padL - padR); }
      function Y(p) { return H - padB - (Math.log10(p) - pMin) / (pMax - pMin) * (H - padB - padT); }
      ctx.strokeStyle = "rgba(128,140,160,.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "11px -apple-system";
      ["0.1", "1", "10", "100", "1000"].forEach(function (t) {
        ctx.fillText(t, X(parseFloat(t)), H - padB + 15);
      });
      ctx.fillText("算术强度（FLOPs / Byte，对数轴）", padL + 110, H - 6);
      ctx.fillText("性能 TFLOPS", 6, padT + 10);
      // roofline
      var ridgeAI = peak * 1e12 / (bw * 1e9); // ≈153
      ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 2.6; ctx.beginPath();
      for (var i = 0; i <= 260; i++) {
        var a = Math.pow(10, aiMin + (aiMax - aiMin) * i / 260);
        var p = Math.min(peak, bw * a / 1000);
        if (i) ctx.lineTo(X(a), Y(p)); else ctx.moveTo(X(a), Y(p));
      }
      ctx.stroke();
      ctx.fillStyle = "#7c3aed"; ctx.font = "12px -apple-system";
      ctx.fillText("Roofline: min(峰值, 带宽×AI)", X(0.5), Y(260));
      // ridge point
      ctx.fillStyle = "#8a93a3";
      ctx.fillText("拐点 AI*=" + ridgeAI.toFixed(0), X(ridgeAI) - 42, H - padB - 6);
      // 各算子的点
      OPS.forEach(function (op) {
        var p = Math.min(peak, bw * op.ai / 1000);
        ctx.fillStyle = "rgba(47,111,237,.75)";
        ctx.beginPath(); ctx.arc(X(op.ai), Y(p), 4, 0, 7); ctx.fill();
        ctx.fillStyle = "#5b6472"; ctx.font = "10.5px -apple-system";
        ctx.fillText(op.name, X(op.ai) + 7, Y(p) + 3);
      });
      // 当前点
      var pNow = Math.min(peak, bw * ai / 1000);
      ctx.fillStyle = "#dc2626";
      ctx.beginPath(); ctx.arc(X(ai), Y(pNow), 6.5, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(220,38,38,.35)"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(X(ai), H - padB); ctx.lineTo(X(ai), Y(pNow)); ctx.stroke();
      ctx.setLineDash([]);
    }
    function update() {
      draw();
      var bound = bw * ai / 1000 < peak ? "Memory-bound（带宽瓶颈）" : "Compute-bound（算力瓶颈）";
      var achieved = Math.min(peak, bw * ai / 1000);
      out.textContent =
        "硬件：A100（HBM 带宽 " + bw + " GB/s，BF16 峰值 " + peak + " TFLOPS）\n" +
        "拐点算术强度 AI* = 峰值 ÷ 带宽 ≈ " + (peak * 1e12 / (bw * 1e9)).toFixed(0) + " FLOPs/Byte\n\n" +
        "当前算子：AI = " + ai + " FLOPs/Byte → " + achieved.toFixed(1) + " TFLOPS，属于 " + bound + "\n\n" +
        (bound.indexOf("Memory") === 0
          ? "含义：算力大量闲置，瓶颈是把数据从 HBM 搬到计算单元。优化方向是减少内存读写（kernel fusion、FlashAttention、量化）。"
          : "含义：计算单元被喂饱，瓶颈在算力本身。优化方向是更快的矩阵乘（Tensor Core、低精度、更好的分块）。") +
        "\n\n试试拖到 40（FlashAttention 水平）或 200（大 GEMM），观察从左侧「墙」跳上右侧「平顶」。";
    }
    var s = LC.slider("算术强度（log₁₀ FLOPs/Byte）", -1, 3.2, 0.05, Math.log10(ai), function (v) { ai = Math.pow(10, v); update(); });
    var btns = h("div", { class: "demo-flex" }, OPS.map(function (op) {
      return button(op.name, function () { s.set(Math.log10(op.ai)); ai = op.ai; update(); });
    }));
    root.appendChild(h("div", { class: "demo-controls" }, [s.el]));
    root.appendChild(btns);
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     4. Ring AllReduce 动画（4 卡）
     ============================================================ */
  LC.demos["allreduce-ring"] = function (root) {
    var N = 4;
    var step = 0; // 0..6（3 reduce-scatter + 3 all-gather）
    var state = null;
    var view = h("div"), out = LC.readout();

    function initState() {
      state = [];
      for (var g = 0; g < N; g++) {
        var chunks = [];
        for (var c = 0; c < N; c++) chunks.push({ set: [g], complete: false });
        state.push(chunks);
      }
      step = 0;
    }
    function doStep() {
      if (step >= 6) return;
      if (step < 3) {
        // reduce-scatter 第 s 步
        var s = step;
        var sends = [];
        for (var i = 0; i < N; i++) {
          var c = ((i - s) % N + N) % N;
          sends.push({ from: i, to: (i + 1) % N, chunk: c, data: state[i][c].set.slice() });
        }
        sends.forEach(function (m) {
          var target = state[m.to][m.chunk];
          m.data.forEach(function (x) { if (target.set.indexOf(x) === -1) target.set.push(x); });
          if (target.set.length === N) target.complete = true;
        });
      } else {
        // all-gather 第 k 步
        var k = step - 3;
        var sends2 = [];
        for (var j = 0; j < N; j++) {
          var c2 = ((j - k + 1) % N + N) % N;
          sends2.push({ from: j, to: (j + 1) % N, chunk: c2, data: state[j][c2].set.slice(), complete: state[j][c2].complete });
        }
        sends2.forEach(function (m) {
          var target = state[m.to][m.chunk];
          m.data.forEach(function (x) { if (target.set.indexOf(x) === -1) target.set.push(x); });
          if (m.complete || target.set.length === N) target.complete = true;
        });
      }
      step++;
      render();
    }
    function chunkColor(ch) {
      if (ch.complete) return "background:var(--green-soft);border-color:var(--green);color:var(--green)";
      if (ch.set.length > 1) return "background:var(--amber-soft);border-color:var(--amber);color:var(--amber)";
      return "background:var(--bg-soft);border-color:var(--border);color:var(--text-faint)";
    }
    function render() {
      view.innerHTML = "";
      var ring = h("div", { class: "demo-flex", style: "gap:14px;justify-content:center;flex-wrap:wrap" });
      for (var g = 0; g < N; g++) {
        var gpu = h("div", { class: "demo-panel", style: "min-width:118px" });
        gpu.appendChild(h("h5", { text: "GPU " + g }));
        var row = h("div", { class: "demo-flex", style: "gap:4px" });
        for (var c = 0; c < N; c++) {
          var ch = state[g][c];
          row.appendChild(h("span", {
            class: "chip ghost",
            html: "块" + c + "<br><span style='font-size:9.5px'>{" + ch.set.join(",") + "}</span>",
            style: chunkColor(ch) + ";min-width:52px;text-align:center;padding:5px 6px;line-height:1.35;font-size:11px"
          }));
        }
        gpu.appendChild(row);
        ring.appendChild(gpu);
      }
      view.appendChild(ring);
      view.appendChild(LC.panel("通信拓扑", [
        h("div", { class: "stat-line", html: "环：" + Array.from({ length: N }, function (_, i) { return "GPU" + i; }).join(" → ") + " → GPU0" }),
        h("div", { class: "stat-line", html: "当前阶段：" + (step < 3 ? "① Reduce-Scatter（第 " + (step + 1) + "/3 步）——每卡把一块发给下一张卡，接收方做累加（集合合并）" : step < 6 ? "② All-Gather（第 " + (step - 2) + "/3 步）——已完整求和的块沿环传播" : "完成：每张卡都持有全部 4 个块的完整和 ✅") })
      ]));
      var msgs = [
        "初始：每张卡有 4 个数据块，各自只含自己的数据 {本卡编号}。目标是让每张卡的每个块都变成 {0,1,2,3} 的完整和。",
        "Reduce-Scatter 第 1 步：每卡把块 i 发给下一张卡，接收方把它与本卡同编号的块合并（累加）。",
        "Reduce-Scatter 第 2 步：继续传递并累加，可以看到部分块已经累积了 3 张卡的数据。",
        "Reduce-Scatter 第 3 步完成：此时每张卡恰好持有【一个】完整求和的块（GPU i 持有块 i+1），其余块仍是部分和。",
        "All-Gather 第 1 步：每卡把手中的完整块沿环传给下一张卡。",
        "All-Gather 第 2 步：完整块继续传播，每张卡手里的完整块越来越多。",
        "All-Gather 第 3 步完成：所有卡的四个块都是完整和 —— allreduce 结束。总通信量 ≈ 2(N−1)/N × 数据量，与卡数几乎无关（ring 的优势）。"
      ];
      out.textContent = msgs[Math.min(step, 6)] +
        (step === 6 ? "\n\n关键结论：Ring AllReduce 每卡通信量 = 2(N−1)/N · S ≈ 2S（S 为参数量），不随卡数线性增长——这是 DDP 能扩展到成千上万卡的基础。" : "");
    }
    var autoTimer = null;
    var autoBtn = button("自动播放", function () {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = "自动播放"; return; }
      autoBtn.textContent = "⏸ 暂停";
      autoTimer = setInterval(function () {
        if (step >= 6) { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = "自动播放"; return; }
        doStep();
      }, 1000);
    });
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("下一步 ▶", doStep, "primary"), autoBtn,
      button("重置", function () { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = "自动播放"; initState(); render(); })
    ]));
    root.appendChild(view);
    root.appendChild(out);
    initState();
    render();
  };

  /* ============================================================
     5. ZeRO 显存对比
     ============================================================ */
  LC.demos["zero-stages"] = function (root) {
    var paramsB = 7;   // 模型参数量（B）
    var ngpu = 8;
    var out = LC.readout();
    var view = h("div");

    function render() {
      var P = paramsB * 1e9;
      var N = ngpu;
      // 每参数：bf16参数2 + bf16梯度2 + fp32主权重4 + m4 + v4 = 16 bytes
      function bytes(stage) {
        if (stage === 0) return 16;
        if (stage === 1) return 4 + 12 / N;
        if (stage === 2) return 2 + 14 / N;
        return 16 / N;
      }
      var items = [0, 1, 2, 3].map(function (s) {
        var gb = P * bytes(s) / 1e9;
        return { label: "ZeRO-" + s, value: gb, max: P * 16 / 1e9, text: gb.toFixed(1) + " GB", color: gb <= 80 ? "green" : "red" };
      });
      view.innerHTML = "";
      view.appendChild(LC.bars(items, { max: P * 16 / 1e9 }));
      view.appendChild(LC.panel("说明", [
        h("div", { class: "stat-line", html: "模型 " + paramsB + "B 参数 × " + N + " 卡，混合精度 + Adam（基线 16 bytes/参数）" }),
        h("div", { class: "stat-line", html: "ZeRO-0：全部复制 → " + (P * 16 / 1e9).toFixed(1) + " GB/卡" }),
        h("div", { class: "stat-line", html: "ZeRO-1：切优化器状态（m/v + 主权重）→ 参数2 + 梯度2 + 12/" + N }),
        h("div", { class: "stat-line", html: "ZeRO-2：再切梯度 → 参数2 + (2+12)/" + N }),
        h("div", { class: "stat-line", html: "ZeRO-3 / FSDP：再切参数 → 16/" + N })
      ]));
      out.textContent =
        "观察：ZeRO 每推进一级，单卡显存就下降一档。\n" +
        (P * 16 / 1e9 > 80 && P * bytes(1) / 1e9 <= 80 ? "当前配置下：ZeRO-0 放不进 80GB 卡，ZeRO-1 起就能放下。\n" : "") +
        "代价是通信量增加：ZeRO-1/2 需在更新时 all-gather 参数（前向/反向也可能需要），ZeRO-3 每次前向都要收集参数（通信最多，靠 prefetch 掩盖）。\n\n" +
        "一句话选型：单卡放不下 → 先上 ZeRO-2/FSDP；还放不下或想减少通信 → 张量并行 + 流水线并行组合（3D 并行）。";
    }
    var pS = LC.slider("参数量（B）", 0.1, 175, 0.1, paramsB, function (v) { paramsB = v; render(); });
    var gS = LC.slider("GPU 数量", 2, 1024, 2, ngpu, function (v) { ngpu = v; render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [pS.el, gS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
