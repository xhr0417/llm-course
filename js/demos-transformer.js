/* ============================================================
   LC — 交互演示 (Transformer / Attention)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, svgRoot = LC.svgRoot, svgEl = LC.svgEl, button = LC.button;

  /* ============================================================
     1. Attention 注意力热图
     ============================================================ */
  LC.demos["attention"] = function (root) {
    var TOKENS = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "tired", "."];

    // 手工构造一个“合理”的注意力矩阵（每行和为 1）
    function buildMatrix() {
      var n = TOKENS.length;
      var M = [];
      var special = {
        1: { 7: 0.35, 9: 0.15 },       // animal -> it, tired
        7: { 1: 0.55, 5: 0.15, 9: 0.10 }, // it -> animal, street, tired
        5: { 1: 0.20, 7: 0.15 },       // street -> animal, it
        9: { 1: 0.15, 7: 0.25 }        // tired -> animal, it
      };
      for (var i = 0; i < n; i++) {
        var row = new Array(n).fill(0.02);
        row[i] = 0.18;
        if (i > 0) row[i - 1] += 0.08;
        if (i < n - 1) row[i + 1] += 0.08;
        if (special[i]) {
          for (var k in special[i]) row[k] += special[i][k];
        }
        var s = row.reduce(function (a, b) { return a + b; }, 0);
        M.push(row.map(function (v) { return v / s; }));
      }
      return M;
    }
    var M = buildMatrix();
    var selected = 7;

    var chipsRow = h("div", { class: "demo-chips" });
    var sentenceRow = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
    var barsWrap = h("div");
    var stepsWrap = h("div");
    var out = LC.readout();

    function renderChips() {
      chipsRow.innerHTML = "";
      TOKENS.forEach(function (t, i) {
        var c = h("span", { class: "chip" + (i === selected ? " on" : ""), text: t });
        c.addEventListener("click", function () { selected = i; render(); });
        chipsRow.appendChild(c);
      });
    }
    function renderSentence() {
      sentenceRow.innerHTML = "";
      var row = M[selected];
      var max = Math.max.apply(null, row);
      TOKENS.forEach(function (t, i) {
        var alpha = row[i] / max;
        var bg = "rgba(124,58,237," + (0.08 + alpha * 0.55).toFixed(2) + ")";
        sentenceRow.appendChild(h("span", {
          class: "chip ghost",
          text: t,
          style: "background:" + bg + ";border-color:transparent;" + (i === selected ? "outline:2px solid var(--accent);" : "")
        }));
      });
    }
    function renderBars() {
      barsWrap.innerHTML = "";
      var row = M[selected];
      var items = TOKENS.map(function (t, i) {
        return { label: t, value: row[i], max: Math.max.apply(null, row), text: (row[i] * 100).toFixed(1) + "%", color: i === selected ? "amber" : "" };
      }).sort(function (a, b) { return b.value - a.value; }).slice(0, 6);
      barsWrap.appendChild(LC.panel("该 token 对其它 token 的注意力权重（softmax 后）", [LC.bars(items)]));
    }
    function renderSteps() {
      var row = M[selected];
      var top = TOKENS.map(function (t, i) { return { t: t, w: row[i] }; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 3);
      stepsWrap.innerHTML = "";
      stepsWrap.appendChild(LC.panel("从分数到加权求和（以选中的 token 为例）", [
        h("div", { class: "stat-line", html: "① 分数 s = q·k / √d_k（示意：s = ln(w) + 常数）" }),
        h("div", { class: "stat-line", html: "② softmax(s) 得到权重 w：<b>" + top.map(function (x) { return x.t + " " + (x.w * 100).toFixed(0) + "%"; }).join("，") + "</b>" }),
        h("div", { class: "stat-line", html: "③ 新表示 = " + top.map(function (x) { return x.w.toFixed(2) + " × V(" + x.t + ")"; }).join(" + ") + " + …" }),
        h("div", { class: "stat-line", html: "→ 选中 token 的表示被「按相关性加权混合」了其它 token 的信息" })
      ]));
    }
    function render() {
      renderChips(); renderSentence(); renderBars(); renderSteps();
      out.textContent =
        "当前查看：\"" + TOKENS[selected] + "\" 的注意力。\n" +
        "当处理 \"it\" 时，模型给 \"animal\" 的权重最高（约 " + (M[7][1] * 100).toFixed(0) + "%）——这就是「it 指代 animal」在数学上的表现。\n" +
        "点其它 token 可以看它关注哪里（每个 token 都有一条自己的权重分布）。";
    }
    root.appendChild(h("div", { class: "demo-sub", html: "<b>点击任意 token</b>，查看它的注意力分布：" }));
    root.appendChild(chipsRow);
    root.appendChild(h("div", { class: "demo-sub", html: "<b>句子热力图</b>（颜色越深 = 被关注越多）：" }));
    root.appendChild(sentenceRow);
    root.appendChild(h("div", { class: "demo-grid2" }, [barsWrap, stepsWrap]));
    root.appendChild(out);
    render();
  };

  /* ============================================================
     2. QKV 矩阵计算（分步）
     ============================================================ */
  LC.demos["qkv-matrix"] = function (root) {
    var X = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0]];
    var Wq = [[1, 0, 1], [0, 1, 0], [1, 0, 0], [0, 1, 1]];
    var Wk = [[0, 1, 0], [1, 0, 1], [0, 0, 1], [1, 1, 0]];
    var Wv = [[1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1]];

    function matmul(A, B) {
      var n = A.length, m = B[0].length, k = B.length;
      var C = [];
      for (var i = 0; i < n; i++) {
        C.push([]);
        for (var j = 0; j < m; j++) {
          var s = 0;
          for (var t = 0; t < k; t++) s += A[i][t] * B[t][j];
          C[i].push(s);
        }
      }
      return C;
    }
    function transpose(A) {
      return A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); });
    }
    function softmaxRows(A) {
      return A.map(function (row) {
        var ex = row.map(Math.exp);
        var s = ex.reduce(function (a, b) { return a + b; }, 0);
        return ex.map(function (e) { return e / s; });
      });
    }
    var Q = matmul(X, Wq), K = matmul(X, Wk), V = matmul(X, Wv);
    var S = matmul(Q, transpose(K));
    var dk = 3;
    var Scaled = S.map(function (r) { return r.map(function (v) { return v / Math.sqrt(dk); }); });
    var A = softmaxRows(Scaled);
    var O = matmul(A, V);

    var view = h("div");
    var out = LC.readout();
    var step = 0;
    var TOTAL = 6;

    function row(children) { return h("div", { class: "mat-wrap" }, children); }
    function label(t, shape) { return h("span", { class: "mat-label", html: t + (shape ? ' <span class="mat-shape">' + shape + "</span>" : "") }); }
    function op(t) { return h("span", { class: "shape-op", style: "font-size:16px", text: t }); }
    function arrow() { return h("span", { class: "shape-arrow", text: "→" }); }

    function render() {
      view.innerHTML = "";
      if (step === 0) {
        view.appendChild(row([LC.matGroup("X", "[3, 4]", X, { digits: 0 })]));
        out.textContent = "输入 X：3 个 token（seq_len=3），每个 token 用 4 维向量表示（d_model=4）。\n下一步：乘上三套权重矩阵，得到 Q、K、V。";
      } else if (step === 1) {
        view.appendChild(row([
          LC.matGroup("X", "[3,4]", X, { digits: 0 }), op("×"),
          LC.matGroup("W_Q", "[4,3]", Wq, { digits: 0 }), arrow(),
          LC.matGroup("Q", "[3,3]", Q, { digits: 0, hl: [[0, 0]] })
        ]));
        view.appendChild(row([
          LC.matGroup("X", "[3,4]", X, { digits: 0 }), op("×"),
          LC.matGroup("W_K", "[4,3]", Wk, { digits: 0 }), arrow(),
          LC.matGroup("K", "[3,3]", K, { digits: 0 })
        ]));
        view.appendChild(row([
          LC.matGroup("X", "[3,4]", X, { digits: 0 }), op("×"),
          LC.matGroup("W_V", "[4,3]", Wv, { digits: 0 }), arrow(),
          LC.matGroup("V", "[3,3]", V, { digits: 0 })
        ]));
        out.textContent = "Q = XW_Q，K = XW_K，V = XW_V。\n维度：(3,4) × (4,3) = (3,3)。中间维度 4 被「消掉」。\n这里 d_k = 3。";
      } else if (step === 2) {
        view.appendChild(row([
          LC.matGroup("Q", "[3,3]", Q, { digits: 0 }), op("×"),
          LC.matGroup("Kᵀ", "[3,3]", transpose(K), { digits: 0 }), arrow(),
          LC.matGroup("QKᵀ", "[3,3]", S, { digits: 0, colorScale: true })
        ]));
        out.textContent = "QKᵀ：每一行是「这个 token 对所有 token 的原始匹配分数」。\n(3,3)×(3,3) → (3,3)。分数越大表示 Query 和 Key 越匹配。\n注意：K 转置后形状是 (d_k, seq_len)。";
      } else if (step === 3) {
        view.appendChild(row([
          LC.matGroup("QKᵀ", "[3,3]", S, { digits: 0 }), op("÷ √3 ≈ 1.732"), arrow(),
          LC.matGroup("缩放后", "[3,3]", Scaled, { digits: 2 })
        ]));
        out.textContent = "除以 √d_k（这里 √3 ≈ 1.732）：把分数压回合理范围，避免 softmax 过于尖锐。\n这一步没有改变形状，只改变了数值尺度。";
      } else if (step === 4) {
        view.appendChild(row([
          LC.matGroup("缩放后分数", "[3,3]", Scaled, { digits: 2 }), op("softmax(按行)"), arrow(),
          LC.matGroup("注意力权重 A", "[3,3]", A, { digits: 2 })
        ]));
        out.textContent = "对每一行做 softmax：每行变成概率分布，和为 1。\nA[i][j] = token i 应该从 token j 取多少信息。\n可以看到对角线往往较大（token 会关注自己）。";
      } else {
        view.appendChild(row([
          LC.matGroup("A", "[3,3]", A, { digits: 2 }), op("×"),
          LC.matGroup("V", "[3,3]", V, { digits: 0 }), arrow(),
          LC.matGroup("输出 O", "[3,3]", O, { digits: 1, hl: [[0, 0]] })
        ]));
        out.textContent = "输出 = 注意力权重 × V：每个 token 的新表示是所有 V 的加权平均。\n(3,3)×(3,3) → (3,3)。\n完整公式：Attention(Q,K,V) = softmax(QKᵀ/√d_k)V —— 你已经从头算完了一遍。";
      }
    }
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("← 上一步", function () { if (step > 0) { step--; render(); } }),
      button("下一步 →", function () { if (step < TOTAL - 1) { step++; render(); } }, "primary"),
      button("重置", function () { step = 0; render(); }),
      h("span", { class: "badge", text: "步骤 " + (step + 1) + " / " + TOTAL })
    ]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     3. 为什么除 √d_k
     ============================================================ */
  LC.demos["scaling"] = function (root) {
    var dk = 16;
    var a = [1.2, 0.6, 0.3]; // 平均匹配强度
    var wrap = h("div", { class: "demo-grid2" });
    var out = LC.readout();

    function softmax(arr) {
      var ex = arr.map(Math.exp);
      var s = ex.reduce(function (x, y) { return x + y; }, 0);
      return ex.map(function (e) { return e / s; });
    }
    function update() {
      var scores = a.map(function (v) { return v * Math.sqrt(dk); });
      var pNo = softmax(scores);
      var pYes = softmax(scores.map(function (v) { return v / Math.sqrt(dk); }));
      wrap.innerHTML = "";
      wrap.appendChild(LC.panel("不缩放：softmax(q·k)，d_k = " + dk, [
        LC.bars(pNo.map(function (v, i) { return { label: "token " + (i + 1), value: v, max: 1, text: (v * 100).toFixed(2) + "%", color: "red" }; })),
        h("div", { class: "demo-sub", text: "最大概率 ≈ " + (Math.max.apply(null, pNo) * 100).toFixed(2) + "% —— 分布几乎变成 one-hot" })
      ]));
      wrap.appendChild(LC.panel("缩放后：softmax(q·k/√d_k)", [
        LC.bars(pYes.map(function (v, i) { return { label: "token " + (i + 1), value: v, max: 1, text: (v * 100).toFixed(2) + "%", color: "green" }; })),
        h("div", { class: "demo-sub", text: "最大概率 ≈ " + (Math.max.apply(null, pYes) * 100).toFixed(2) + "% —— 分布更平滑、梯度更健康" })
      ]));
      out.textContent =
        "d_k 越大，点积 q·k 的方差越大（若 q,k 各维独立、方差为 1，则 q·k 的方差 ≈ d_k）。\n" +
        "分数过大会让 softmax 饱和：输出接近 one-hot → 反向传播时梯度 ≈ 0（softmax 的雅可比趋近 0）。\n" +
        "除以 √d_k 让方差回到 ≈ 1，这正是 Scaled Dot-Product Attention 中 \"Scaled\" 的含义。\n\n" +
        "为什么是 √d_k 而不是 d_k？因为方差随 d_k 线性增长，标准差随 √d_k 增长，除以标准差才能把尺度归一。";
    }
    var s = LC.slider("d_k（head 维度）", 1, 128, 1, dk, function (v) { dk = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [s.el, button("d_k = 1", function () { s.set(1); dk = 1; update(); }), button("d_k = 64", function () { s.set(64); dk = 64; update(); }), button("d_k = 128", function () { s.set(128); dk = 128; update(); })]));
    root.appendChild(wrap);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     4. Multi-Head Attention
     ============================================================ */
  LC.demos["mha"] = function (root) {
    var n = 5;
    var heads = [
      { name: "Head 1 · 局部邻域", desc: "关注相邻 token（局部语法/搭配）", build: function (i) { return i > 0 ? 0.6 : 0.1; } },
      { name: "Head 2 · 前一个词", desc: "固定看前一个位置（类似 bigram）", build: function (i) { return i > 0 ? 0.9 : 0.05; } },
      { name: "Head 3 · 关注自己", desc: "对角线模式（保留自身信息）", build: function (i) { return 0.9; } },
      { name: "Head 4 · 句首聚合", desc: "所有 token 都看第一个位置（全局汇聚）", build: function (i) { return 0.8; } }
    ];
    function makeMatrix(head, i) {
      var row = [];
      for (var j = 0; j < n; j++) {
        var v = 0.05;
        if (head === 0) v = (j === i - 1 || j === i + 1) ? 0.6 : (j === i ? 0.3 : 0.05);
        else if (head === 1) v = j === i - 1 ? 0.9 : (j === i ? 0.2 : 0.02);
        else if (head === 2) v = j === i ? 0.9 : 0.025;
        else v = j === 0 ? 0.8 : 0.05;
        row.push(v);
      }
      var s = row.reduce(function (a, b) { return a + b; }, 0);
      return row.map(function (v) { return v / s; });
    }
    var selected = 0;
    var grid = h("div", { class: "demo-grid2" });
    var out = LC.readout();

    function render() {
      grid.innerHTML = "";
      heads.forEach(function (hd, hi) {
        var matrix = [];
        for (var i = 0; i < n; i++) matrix.push(makeMatrix(hi, i));
        var p = LC.panel(hd.name, [
          LC.heatmap(matrix, { fmt: function (v) { return v.toFixed(2); } }),
          h("div", { class: "demo-sub", text: hd.desc })
        ]);
        if (hi === selected) p.style.borderColor = "var(--accent)";
        p.style.cursor = "pointer";
        p.addEventListener("click", function () { selected = hi; render(); });
        grid.appendChild(p);
      });
      out.textContent =
        "每个 head 有自己独立的 W_Q / W_K / W_V（把 d_model 投影到 d_k），因此学到不同的关注模式。\n" +
        "本演示是 5×5 的示意矩阵。真实模型：h 个头并行计算，然后 Concat + W_O 融合。\n\n" +
        "shape：每个 head 输出 (B, S, d_v)，h 个头拼接 → (B, S, h·d_v) = (B, S, d_model)，再乘 W_O (d_model, d_model)。";
    }
    root.appendChild(h("div", { class: "demo-sub", text: "点击任意 head 查看（4 个 head 的不同注意力模式）：" }));
    root.appendChild(grid);
    root.appendChild(LC.panel("Concat + 输出投影", [
      LC.frag([
        h("div", { class: "stat-line", html: "head₁ (B,S,d_v) ┐" }),
        h("div", { class: "stat-line", html: "head₂ (B,S,d_v) ┤ Concat → (B, S, h·d_v) = (B, S, d_model) ── × W_O (d_model,d_model) → 输出 (B,S,d_model)" }),
        h("div", { class: "stat-line", html: "head₃ (B,S,d_v) ┘" })
      ])
    ]));
    root.appendChild(out);
    render();
  };

  /* ============================================================
     5. Causal Mask
     ============================================================ */
  LC.demos["causal-mask"] = function (root) {
    var S = [[2, 3, 1, 0], [1, 4, 2, 1], [0, 2, 3, 2], [1, 1, 1, 4]];
    var MASKED = S.map(function (row, i) { return row.map(function (v, j) { return j > i ? -Infinity : v; }); });
    function softmax(row) {
      var ex = row.map(function (v) { return v === -Infinity ? 0 : Math.exp(v); });
      var s = ex.reduce(function (a, b) { return a + b; }, 0);
      return ex.map(function (e) { return e / s; });
    }
    var A = MASKED.map(softmax);
    var view = h("div");
    var out = LC.readout();
    var stage = 0;

    function fmtCell(v) { return v === -Infinity ? "−∞" : LC.fmt(v, 1); }
    function render() {
      view.innerHTML = "";
      if (stage === 0) {
        view.appendChild(LC.panel("① 原始分数 QKᵀ/√d_k（还包含未来位置）", [LC.heatmap(S, { fmt: fmtCell })]));
        out.textContent = "训练时如果直接 softmax，位置 0 就会「看到」位置 3 的答案 → 作弊。\n下一步：把未来位置遮起来。";
      } else if (stage === 1) {
        view.appendChild(LC.panel("② 加 causal mask：j > i 的位置设为 −∞", [LC.heatmap(MASKED, { fmt: fmtCell })]));
        out.textContent = "mask 矩阵 M：上三角（未来）为 −∞，下三角（过去+现在）为 0。\nAttention = softmax(QKᵀ/√d_k + M)V。";
      } else {
        view.appendChild(LC.panel("③ softmax 后：未来位置权重 = 0", [LC.heatmap(A, { fmt: function (v) { return v.toFixed(2); } })]));
        out.textContent = "e^(−∞) = 0，所以未来 token 的权重严格为 0。\n每一行只对「自己及之前」的 token 分配概率（行和为 1）。\n这就是 GPT 能并行训练又不会偷看答案的原因。";
      }
      var btns = view.querySelectorAll(".demo-stage-btn");
    }
    var group = LC.buttonGroup(["① 原始分数", "② 加 mask", "③ softmax 后"], function (i) { stage = i; render(); });
    root.appendChild(group.el);
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     6. Transformer Block 可点击结构图
     ============================================================ */
  LC.demos["transformer-block"] = function (root) {
    var nodes = [
      { id: "input", name: "输入 x", desc: "来自上一层（或 embedding + 位置编码）的 (B, S, d_model) 张量。" },
      { id: "norm1", name: "RMSNorm / LayerNorm", desc: "对每个 token 的 hidden 维做归一化，稳定训练。Pre-Norm 把它放在 Attention 之前。" },
      { id: "attn", name: "Masked Self-Attention", desc: "token 之间交换信息。Q/K/V 都由同一个 x 投影得到；causal mask 遮住未来。shape 保持 (B, S, d_model)。" },
      { id: "add1", name: "残差相加 ⊕", desc: "x + Attention(Norm(x))。恒等路径保证梯度可以直接回传，是深层网络可训练的关键。" },
      { id: "norm2", name: "RMSNorm / LayerNorm", desc: "第二次归一化，进入 FFN 之前。" },
      { id: "ffn", name: "FFN / SwiGLU", desc: "逐 token 的非线性加工：d_model → d_ff → d_model（SwiGLU 时 d_ff ≈ 8/3 d_model）。Attention 负责交流，FFN 负责加工。" },
      { id: "add2", name: "残差相加 ⊕", desc: "再次加回残差，输出到下一层。" }
    ];
    var flow = h("div", { class: "demo-flex", style: "flex-direction:column;gap:4px;align-items:center" });
    var info = LC.panel("点击任意模块查看说明", [h("div", { class: "stat-line", text: "整个 Block 的输入输出形状不变，都是 (B, S, d_model)。" })]);
    var nodeEls = {};

    nodes.forEach(function (nd, i) {
      var el = h("div", {
        class: "chip",
        text: nd.name,
        style: "min-width:230px;text-align:center;padding:8px 14px;font-size:13.5px"
      });
      el.addEventListener("click", function () {
        Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("on"); });
        el.classList.add("on");
        info.innerHTML = "";
        info.appendChild(h("h5", { text: nd.name }));
        info.appendChild(h("div", { class: "stat-line", text: nd.desc }));
      });
      nodeEls[nd.id] = el;
      flow.appendChild(el);
      if (i < nodes.length - 1) {
        var isResidualTarget = nd.id === "attn" || nd.id === "ffn";
        flow.appendChild(h("div", { style: "color:var(--text-faint);font-size:14px", text: isResidualTarget ? "↓  (⊕ 残差从这里绕过)" : "↓" }));
      }
    });
    root.appendChild(h("div", { class: "demo-grid2" }, [
      h("div", {}, [flow]),
      h("div", {}, [info, h("div", { class: "demo-sub", html: "对应章节：<a href=\"#/transformer\">第 7 章 Transformer</a>、<a href=\"#/modern-llm\">第 10 章 现代 LLM 架构</a>" })])
    ]));
  };

  /* ============================================================
     7. BERT vs GPT 可见性对比
     ============================================================ */
  LC.demos["bert-vs-gpt"] = function (root) {
    var TOKENS = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "tired", "."];
    var pos = 7;
    var bertRow = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
    var gptRow = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
    var out = LC.readout();

    function render() {
      bertRow.innerHTML = "";
      gptRow.innerHTML = "";
      TOKENS.forEach(function (t, i) {
        bertRow.appendChild(h("span", {
          class: "chip ghost",
          text: t,
          style: "background:var(--green-soft);border-color:color-mix(in srgb, var(--green) 40%, transparent);color:var(--green)"
        }));
        var visible = i <= pos;
        gptRow.appendChild(h("span", {
          class: "chip ghost",
          text: t,
          style: visible
            ? "background:var(--green-soft);border-color:color-mix(in srgb, var(--green) 40%, transparent);color:var(--green)"
            : "background:var(--red-soft);border-color:color-mix(in srgb, var(--red) 30%, transparent);color:var(--red);text-decoration:line-through"
        }));
      });
      out.textContent =
        "当前预测位置：" + pos + "（\"" + TOKENS[pos] + "\"）\n\n" +
        "BERT（上）：双向 attention，可以看到整句（含右侧上下文）→ 适合理解任务。\n" +
        "GPT（下）：causal attention，只能看到位置 ≤ " + pos + " 的 token，未来 token 被 mask 掉（红色删除线）→ 适合生成任务。";
    }
    var chips = h("div", { class: "demo-chips" });
    TOKENS.forEach(function (t, i) {
      var c = h("span", { class: "chip" + (i === pos ? " on" : ""), text: i });
      c.addEventListener("click", function () {
        pos = i;
        chips.querySelectorAll(".chip").forEach(function (x, j) { x.classList.toggle("on", j === i); });
        render();
      });
      chips.appendChild(c);
    });
    root.appendChild(h("div", { class: "demo-sub", text: "选择要预测的位置：" }));
    root.appendChild(chips);
    root.appendChild(LC.panel("BERT · Encoder-only · 双向可见", [bertRow]));
    root.appendChild(LC.panel("GPT · Decoder-only · 因果可见", [gptRow]));
    root.appendChild(out);
    render();
  };
  /* ============================================================
     8. 点积 = 相似度（QK^T 的几何直觉）
     ============================================================ */
  LC.demos["dot-product"] = function (root) {
    var cv = LC.canvas(520, 260);
    var ctx = cv.getContext("2d");
    var angQ = 30, angK = 60;
    var out = LC.readout();

    function draw() {
      var W = 520, H = 260, cx = 260, cy = 130, R = 100;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - R - 30, cy); ctx.lineTo(cx + R + 30, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R - 20); ctx.lineTo(cx, cy + R + 20); ctx.stroke();
      function arrow(deg, color, label) {
        var rad = deg * Math.PI / 180;
        var x = cx + R * Math.cos(rad), y = cy - R * Math.sin(rad);
        ctx.strokeStyle = color; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.font = "bold 13px -apple-system";
        ctx.fillText(label, x + 9, y - 6);
      }
      arrow(angQ, "#2f6fed", "q");
      arrow(angK, "#7c3aed", "k");
      var diff = Math.abs(angQ - angK) * Math.PI / 180;
      var dot = Math.cos(diff);
      ctx.fillStyle = "#5b6472"; ctx.font = "13px -apple-system";
      ctx.fillText("夹角 θ = " + Math.abs(angQ - angK) + "°", 20, 240);
      ctx.fillText("q·k = |q||k|·cosθ = " + dot.toFixed(3) + "（|q|=|k|=1）", 20, 222);
      ctx.fillStyle = dot > 0.7 ? "#17a673" : dot < 0 ? "#dc2626" : "#d97706";
      ctx.fillText(dot > 0.7 ? "方向接近 → 高匹配分数" : dot < 0 ? "方向相反 → 负分数" : "接近垂直 → 低匹配分数", 20, 204);
    }
    function update() { draw(); }
    var qS = LC.slider("q 的角度", 0, 360, 5, angQ, function (v) { angQ = v; update(); });
    var kS = LC.slider("k 的角度", 0, 360, 5, angK, function (v) { angK = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [qS.el, kS.el,
      button("让 q 和 k 对齐", function () { kS.set(angQ); angK = angQ; update(); }),
      button("让 q 和 k 垂直", function () { var v = (angQ + 90) % 360; kS.set(v); angK = v; update(); })
    ]));
    root.appendChild(cv);
    root.appendChild(out);
    out.textContent = "QKᵀ 的每一项就是一对 q 和 k 的点积：点积越大，说明「我在找的东西」和「你提供的标签」越匹配。Attention 的分数矩阵就是这么来的。";
    draw();
  };

  /* ============================================================
     9. V 加权求和
     ============================================================ */
  LC.demos["weighted-sum"] = function (root) {
    var cv = LC.canvas(520, 280);
    var ctx = cv.getContext("2d");
    var a = [0.6, 0.3, 0.1];
    var V = [[1, 0], [0, 1], [1, 1]];
    var out = LC.readout();

    function draw() {
      var W = 520, H = 280, cx = 150, cy = 150, S = 70;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 120, cy); ctx.lineTo(cx + 160, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + 110); ctx.lineTo(cx, cy - 130); ctx.stroke();
      function arrow(v, color, label, bold) {
        var x = cx + v[0] * S, y = cy - v[1] * S;
        ctx.strokeStyle = color; ctx.lineWidth = bold ? 3.2 : 1.8;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, bold ? 6 : 4, 0, 7); ctx.fill();
        ctx.font = (bold ? "bold " : "") + "12.5px -apple-system";
        ctx.fillText(label, x + 8, y - 6);
      }
      arrow(V[0], "rgba(47,111,237,.45)", "V₁", false);
      arrow(V[1], "rgba(124,58,237,.45)", "V₂", false);
      arrow(V[2], "rgba(217,119,6,.45)", "V₃", false);
      var sum = [0, 0];
      for (var i = 0; i < 3; i++) { sum[0] += a[i] * V[i][0]; sum[1] += a[i] * V[i][1]; }
      arrow(sum, "#17a673", "输出 = ΣaᵢVᵢ", true);
      ctx.fillStyle = "#5b6472"; ctx.font = "12.5px -apple-system";
      ctx.fillText("输出的方向由权重 a 决定：", 320, 40);
      ctx.fillText("a₁=" + a[0].toFixed(2) + "  a₂=" + a[1].toFixed(2) + "  a₃=" + a[2].toFixed(2), 320, 60);
      ctx.fillText("（三者之和恒为 1）", 320, 78);
    }
    function update() {
      var s = a[0] + a[1] + a[2];
      var na = a.map(function (v) { return v / s; });
      draw();
      var sum = [0, 0];
      for (var i = 0; i < 3; i++) { sum[0] += na[i] * V[i][0]; sum[1] += na[i] * V[i][1]; }
      out.textContent =
        "输出 = a₁·V₁ + a₂·V₂ + a₃·V₃\n" +
        "     = " + na[0].toFixed(2) + "×[1,0] + " + na[1].toFixed(2) + "×[0,1] + " + na[2].toFixed(2) + "×[1,1]\n" +
        "     = [" + sum[0].toFixed(2) + ", " + sum[1].toFixed(2) + "]\n\n" +
        "Attention 的输出就是「按注意力权重对 V 做加权平均」。权重大的 V 对结果影响大；所有 V 都被混合进来，不是只挑一个。";
    }
    var s1 = LC.slider("权重 a₁", 0, 1, 0.05, a[0], function (v) { a[0] = v; update(); });
    var s2 = LC.slider("权重 a₂", 0, 1, 0.05, a[1], function (v) { a[1] = v; update(); });
    var s3 = LC.slider("权重 a₃", 0, 1, 0.05, a[2], function (v) { a[2] = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [s1.el, s2.el, s3.el]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     10. 残差连接的梯度高速公路
     ============================================================ */
  LC.demos["residual"] = function (root) {
    var cv = LC.canvas(520, 260);
    var ctx = cv.getContext("2d");
    var layers = 12, factor = 0.7, useResidual = false;
    var out = LC.readout();

    function gradAt(n) {
      if (useResidual) {
        return Math.pow(factor, n) + 1; // 1 是恒等通道 + 衰减的 F 路径
      }
      return Math.pow(factor, n);
    }
    function draw() {
      var W = 520, H = 260;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, H - 30); ctx.lineTo(W - 14, H - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40, 12); ctx.lineTo(40, H - 30); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "11.5px -apple-system";
      ctx.fillText("层数（从输出往回数）→", W - 170, H - 10);
      ctx.fillText("梯度幅度（log）", 6, 20);
      var maxLog = 1.2, minLog = -8;
      function X(n) { return 40 + n / layers * (W - 60); }
      function Y(g) { var l = Math.log10(Math.max(g, 1e-8)); return (H - 30) - (l - minLog) / (maxLog - minLog) * (H - 50); }
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2.2; ctx.beginPath();
      for (var n = 0; n <= layers; n++) {
        var g = Math.pow(factor, n);
        if (n) ctx.lineTo(X(n), Y(g)); else ctx.moveTo(X(n), Y(g));
      }
      ctx.stroke();
      ctx.strokeStyle = "#17a673"; ctx.lineWidth = 2.2; ctx.beginPath();
      for (var m = 0; m <= layers; m++) {
        var g2 = Math.pow(factor, m) + 1;
        if (m) ctx.lineTo(X(m), Y(g2)); else ctx.moveTo(X(m), Y(g2));
      }
      ctx.stroke();
      ctx.fillStyle = "#dc2626"; ctx.fillText("无残差: " + factor + "^n", W - 200, 40);
      ctx.fillStyle = "#17a673"; ctx.fillText("有残差: 1 + " + factor + "^n", W - 200, 58);
      var gFirst = gradAt(layers);
      ctx.fillStyle = "#5b6472";
      ctx.fillText("第 1 层（最深处）的梯度 ≈ " + gFirst.toExponential(2), 60, H - 44);
    }
    function update() {
      draw();
      var noRes = Math.pow(factor, layers);
      var res = Math.pow(factor, layers) + 1;
      out.textContent =
        "每层因子 = " + factor + "，层数 = " + layers + "\n" +
        "无残差：梯度 = " + factor + "^" + layers + " = " + noRes.toExponential(3) + "（几乎为 0，浅层学不动）\n" +
        "有残差：梯度 ≈ 1 + " + factor + "^" + layers + " = " + res.toFixed(4) + "（恒等通道保住了信号）\n\n" +
        "原因：∂(x + F(x))/∂x = 1 + ∂F/∂x。那个常数 1 与层数无关，梯度可以无衰减地直达最底层。\n" +
        "拖动「每层因子」到 1.0 以上时，无残差路径会爆炸——这也是残差能同时缓解爆炸/消失的原因。";
    }
    var lS = LC.slider("层数", 2, 24, 1, layers, function (v) { layers = Math.round(v); update(); });
    var fS = LC.slider("每层因子", 0.5, 1.2, 0.05, factor, function (v) { factor = v; update(); });
    var toggle = button("切换：有残差 / 无残差", function () {
      useResidual = !useResidual;
      toggle.textContent = useResidual ? "当前：有残差（点击切换）" : "当前：无残差（点击切换）";
      update();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [lS.el, fS.el, toggle]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     11. LayerNorm 逐步计算
     ============================================================ */
  LC.demos["layernorm"] = function (root) {
    var x = [1, 2, 3, 4];
    var gamma = 1, beta = 0;
    var stage = 0; // 0 输入 1 均值 2 方差 3 标准化 4 缩放平移
    var view = h("div");
    var out = LC.readout();

    function render() {
      var d = x.length;
      var mean = x.reduce(function (a, b) { return a + b; }, 0) / d;
      var varr = x.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / d;
      var std = Math.sqrt(varr + 1e-5);
      var norm = x.map(function (v) { return (v - mean) / std; });
      var y = norm.map(function (v) { return gamma * v + beta; });

      var rows = [];
      function row(label, vals, highlight) {
        return h("div", { class: "stat-line", html: "<b>" + label + "</b>  [" + vals.map(function (v) { return LC.fmt(v, 3); }).join(", ") + "]" + (highlight ? " ←" : "") });
      }
      view.innerHTML = "";
      var body = h("div");
      body.appendChild(row("x", x, stage === 0));
      if (stage >= 1) body.appendChild(row("μ = " + LC.fmt(mean, 3), x.map(function () { return mean; }), stage === 1));
      if (stage >= 2) body.appendChild(row("σ = " + LC.fmt(Math.sqrt(varr), 3), x.map(function () { return Math.sqrt(varr); }), stage === 2));
      if (stage >= 3) body.appendChild(row("x̂ = (x−μ)/σ", norm, stage === 3));
      if (stage >= 4) body.appendChild(row("y = γx̂ + β", y, stage === 4));
      view.appendChild(LC.panel("计算过程（γ = " + gamma + "，β = " + beta + "）", [body]));

      var msgs = [
        "输入 x = [" + x.join(", ") + "]。这是某一个 token 的 hidden 向量（这里用 4 维演示，真实是 4096 维）。",
        "第 1 步：求均值 μ = (" + x.join(" + ") + ") / " + d + " = " + LC.fmt(mean, 3) + "。注意：只在【这个 token 自己的维度】上求，不跨 token、不跨 batch。",
        "第 2 步：求标准差 σ = " + LC.fmt(Math.sqrt(varr), 3) + "。σ 衡量这组数值的离散程度。",
        "第 3 步：标准化 x̂ = (x − μ)/σ = [" + norm.map(function (v) { return LC.fmt(v, 2); }).join(", ") + "]。此时均值 = 0、标准差 = 1。",
        "第 4 步：缩放平移 y = γ·x̂ + β。γ、β 是可学习参数，让模型自己决定「要多少方差、什么均值」，避免归一化限制表达能力。"
      ];
      out.textContent = msgs[stage];
      stageBtn.textContent = stage >= 4 ? "重新开始" : ["下一步：求均值", "下一步：求标准差", "下一步：标准化", "下一步：缩放平移", "已完成"][stage];
    }
    var stageBtn = button("下一步：求均值", function () { stage = stage >= 4 ? 0 : stage + 1; render(); }, "primary");
    var controls = h("div", { class: "demo-controls" });
    x.forEach(function (v, i) {
      var s = LC.slider("x" + (i + 1), -5, 5, 0.5, v, function (nv) { x[i] = nv; stage = 4; render(); });
      controls.appendChild(s.el);
    });
    var gS = LC.slider("γ（缩放）", 0, 3, 0.1, gamma, function (v) { gamma = v; stage = 4; render(); });
    var bS = LC.slider("β（平移）", -2, 2, 0.1, beta, function (v) { beta = v; stage = 4; render(); });
    root.appendChild(controls);
    root.appendChild(h("div", { class: "demo-controls" }, [gS.el, bS.el]));
    root.appendChild(view);
    root.appendChild(h("div", { class: "demo-controls" }, [stageBtn]));
    root.appendChild(out);
    render();
  };

  /* ============================================================
     12. FFN 形状与参数量
     ============================================================ */
  LC.demos["ffn"] = function (root) {
    var dModel = 512, ratio = 4, useSwiGLU = false;
    var view = h("div"), out = LC.readout();

    function render() {
      var dFF = useSwiGLU ? Math.round(8 / 3 * dModel) : Math.round(ratio * dModel);
      var params = useSwiGLU ? 3 * dModel * dFF : 2 * dModel * dFF;
      view.innerHTML = "";
      view.appendChild(LC.panel("Shape 流（每层，作用在每个 token 上）", [
        h("div", { class: "stat-line", html: "输入 x <b>[" + dModel + "]</b> → W₁ → 中间层 <b>[" + dFF + "]</b> → 激活 → W₂ → 输出 <b>[" + dModel + "]</b>" }),
        h("div", { class: "stat-line", html: useSwiGLU ? "SwiGLU 三矩阵：W₁ [d, d_ff] + W₃ [d, d_ff] + W₂ [d_ff, d]" : "ReLU FFN 两矩阵：W₁ [d, d_ff] + W₂ [d_ff, d]" })
      ]));
      view.appendChild(LC.bars([
        { label: "参数量", value: params, max: 3 * 512 * 4096, text: (params / 1e6).toFixed(2) + "M", color: "green" }
      ], { max: 3 * 512 * 4096 }));
      out.textContent =
        "d_model = " + dModel + "，中间维度 d_ff = " + dFF + "\n" +
        "参数量 = " + (useSwiGLU ? "3" : "2") + " × d_model × d_ff = " + params.toLocaleString() + " ≈ " + (params / 1e6).toFixed(2) + "M\n\n" +
        (useSwiGLU
          ? "SwiGLU 有 3 个矩阵，所以中间维度取 8/3·d（而不是 4d），保持总参数量与 ReLU FFN 相当。"
          : "ReLU FFN：d_model → 4·d_model → d_model。FFN 参数量通常是 Attention 的 2 倍左右，是 Transformer 里参数最多的部分。") +
        "\n\n注意：FFN 对每个 token 【独立】作用，不混合不同 token 的信息——混合是 Attention 的工作。";
    }
    var dS = LC.slider("d_model", 128, 1024, 64, dModel, function (v) { dModel = Math.round(v); render(); });
    var rS = LC.slider("扩展比 d_ff/d_model", 1, 8, 0.5, ratio, function (v) { ratio = v; render(); });
    var toggle = button("切换：ReLU FFN / SwiGLU", function () {
      useSwiGLU = !useSwiGLU;
      toggle.textContent = useSwiGLU ? "当前：SwiGLU（点击切换）" : "当前：ReLU FFN（点击切换）";
      render();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [dS.el, rS.el, toggle]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     13. Cross-Attention
     ============================================================ */
  LC.demos["cross-attention"] = function (root) {
    var ENC = ["I", "love", "you"];
    var DEC = ["我", "爱", "你"];
    var MATRIX = [
      [0.85, 0.10, 0.05],
      [0.05, 0.90, 0.05],
      [0.05, 0.10, 0.85]
    ];
    var sel = 1;
    var chips = h("div", { class: "demo-chips" });
    var barsWrap = h("div"), out = LC.readout();

    function render() {
      chips.innerHTML = "";
      DEC.forEach(function (t, i) {
        var c = h("span", { class: "chip" + (i === sel ? " on" : ""), text: t });
        c.addEventListener("click", function () { sel = i; render(); });
        chips.appendChild(c);
      });
      barsWrap.innerHTML = "";
      barsWrap.appendChild(LC.panel("Decoder 的 \"" + DEC[sel] + "\" 对 Encoder 各位置的注意力", [
        LC.bars(ENC.map(function (t, j) {
          return { label: "Encoder: " + t, value: MATRIX[sel][j], max: 1, text: (MATRIX[sel][j] * 100).toFixed(0) + "%", color: MATRIX[sel][j] > 0.5 ? "green" : "" };
        }))
      ]));
      out.textContent =
        "Decoder 在生成 \"" + DEC[sel] + "\" 时：\n" +
        "  Q 来自 Decoder 当前状态（我在找什么？）\n" +
        "  K、V 来自 Encoder 的输出（输入句子的每个位置）\n" +
        "  注意力权重：[ " + MATRIX[sel].map(function (v) { return v.toFixed(2); }).join(", ") + " ]\n\n" +
        "所以 Cross-Attention = Attention(Q_decoder, K_encoder, V_encoder)，让 Decoder 决定「该从输入句子的哪里取信息」。\n" +
        "翻译任务里，这通常表现为近似对齐（爱→love、我→I、你→you）。";
    }
    root.appendChild(h("div", { class: "demo-sub", text: "点击 Decoder 的 token，查看它关注 Encoder 的哪些位置：" }));
    root.appendChild(chips);
    root.appendChild(h("div", { class: "demo-grid2" }, [
      LC.panel("Encoder 输出（提供 K、V）", [h("div", { class: "demo-chips" }, ENC.map(function (t) { return h("span", { class: "chip ghost", text: t, style: "background:var(--purple-soft);border-color:var(--purple);color:var(--purple)" }); }))]),
      barsWrap
    ]));
    root.appendChild(out);
    render();
  };

  /* ============================================================
     14. 训练 vs 推理
     ============================================================ */
  LC.demos["train-vs-inference"] = function (root) {
    var TOKENS = ["<BOS>", "I", "love", "AI"];
    var trainStep = 0, inferStep = 0, timer = null;
    var trainWrap = h("div"), inferWrap = h("div"), out = LC.readout();

    function renderTrain() {
      trainWrap.innerHTML = "";
      var row = h("div", { class: "demo-flex", style: "gap:5px;flex-wrap:wrap" });
      TOKENS.forEach(function (t, i) {
        var done = trainStep >= 1;
        row.appendChild(h("span", {
          class: "chip ghost",
          text: t,
          style: done ? "background:var(--green-soft);border-color:var(--green);color:var(--green)" : "opacity:.4"
        }));
      });
      trainWrap.appendChild(LC.panel("训练：一次前向，并行计算所有位置", [
        row,
        h("div", { class: "stat-line", html: trainStep >= 1
          ? "✅ 1 次前向 → 同时得到 " + (TOKENS.length - 1) + " 个位置的预测与 loss（causal mask 保证不偷看）"
          : "点击「运行训练」查看" })
      ]));
    }
    function renderInfer() {
      inferWrap.innerHTML = "";
      var row = h("div", { class: "demo-flex", style: "gap:5px;flex-wrap:wrap" });
      for (var i = 0; i < TOKENS.length; i++) {
        var shown = i <= inferStep;
        row.appendChild(h("span", {
          class: "chip ghost",
          text: shown ? TOKENS[i] : "？",
          style: shown ? (i === inferStep && inferStep > 0 ? "background:var(--accent-soft);border-color:var(--accent);color:var(--accent-text)" : "background:var(--green-soft);border-color:var(--green);color:var(--green)") : "opacity:.4"
        }));
      }
      inferWrap.appendChild(LC.panel("推理：逐 token 生成，每一步都要一次前向", [
        row,
        h("div", { class: "stat-line", html: inferStep >= 1
          ? "已执行 " + inferStep + " 次前向（每次只多生成 1 个 token）"
          : "点击「运行推理」查看" })
      ]));
    }
    function render() {
      renderTrain(); renderInfer();
      out.textContent =
        "训练：正确答案全都在手上 + causal mask → 一次前向并行算所有位置，GPU 利用率高。\n" +
        "推理：没有答案，必须一个 token 一个 token 生成，每次前向只产生下一个 token（KV Cache 用来避免重算历史）。\n\n" +
        "当前对比：训练 1 次前向 vs 推理 " + (inferStep || 0) + " 次前向（序列越长差距越大）。";
    }
    function runInference() {
      if (timer) return;
      inferStep = 0;
      timer = setInterval(function () {
        inferStep++;
        if (inferStep >= TOKENS.length) { clearInterval(timer); timer = null; }
        render();
      }, 700);
    }
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("运行训练（并行）", function () { trainStep = 1; render(); }, "primary"),
      button("运行推理（逐 token）", runInference),
      button("重置", function () { clearInterval(timer); timer = null; trainStep = 0; inferStep = 0; render(); })
    ]));
    root.appendChild(h("div", { class: "demo-grid2" }, [trainWrap, inferWrap]));
    root.appendChild(out);
    render();
  };
  /* ============================================================
     15. BERT MLM：15% 选择与 80/10/10
     ============================================================ */
  LC.demos["mlm"] = function (root) {
    var TOKENS = ["my", "dog", "is", "cute"];
    var SEL = 3;
    var stage = 0; // 0 原句 1 选中 2 处理 3 预测
    var treatment = 0; // 0 MASK 1 random 2 keep
    var view = h("div"), out = LC.readout();
    var PROBS = [
      { t: "cute", p: 0.62 }, { t: "dog", p: 0.15 }, { t: "happy", p: 0.09 },
      { t: "small", p: 0.07 }, { t: "其他", p: 0.07 }
    ];

    function render() {
      view.innerHTML = "";
      var row = h("div", { class: "demo-flex", style: "gap:6px;justify-content:center;margin:10px 0" });
      TOKENS.forEach(function (t, i) {
        var isSel = i === SEL;
        var display = t, style = "";
        if (isSel && stage >= 2) {
          display = treatment === 0 ? "[MASK]" : treatment === 1 ? "banana" : t;
          style = "background:var(--red-soft);border-color:var(--red);color:var(--red);font-weight:700";
        } else if (isSel && stage >= 1) {
          style = "background:var(--amber-soft);border-color:var(--amber);color:var(--amber);font-weight:700";
        }
        row.appendChild(h("span", { class: "chip ghost", text: display, style: style }));
      });
      view.appendChild(row);

      if (stage >= 1) {
        var note = stage === 1
          ? "随机选中 15% 的 token（本例 4 个词选中 1 个 = 25%，示意）：\"cute\" 被选中。"
          : stage === 2
            ? "对被选中的 token 做 80/10/10 处理。当前演示：" + ["80% → [MASK]", "10% → 随机词（banana）", "10% → 保持不变"][treatment]
            : "模型根据上下文预测被遮住的位置。正确答案 \"cute\" 概率最高（62%）。";
        view.appendChild(h("div", { class: "demo-sub", text: note }));
      }
      if (stage >= 3) {
        view.appendChild(LC.bars(PROBS.map(function (x, i) {
          return { label: x.t, value: x.p, max: 1, text: (x.p * 100).toFixed(0) + "%", color: i === 0 ? "green" : "dim" };
        })));
      }
      var msgs = [
        "原始句子：my dog is cute。MLM 的目标是挖掉一部分词，让模型根据【左右两侧】上下文猜回来。",
        "随机选 15% 的 token 作为预测目标（这里示意为 1 个词）。",
        "对选中的 token 做处理：80% 换成 [MASK]，10% 换成随机词，10% 保持不变。可以切换看三种情况——模型必须对任何输入都保持警惕。",
        "预测阶段：模型同时看左右上下文（bidirectional），给出被遮位置的概率分布。因为看到了 \"my dog is ___\" 的两侧，正确答案 cute 排第一。"
      ];
      out.textContent = msgs[stage];
      nextBtn.textContent = stage >= 3 ? "重新开始" : ["下一步：选 15%", "下一步：80/10/10", "下一步：模型预测", "已完成"][stage];
    }
    var nextBtn = button("下一步：选 15%", function () { stage = stage >= 3 ? 0 : stage + 1; render(); }, "primary");
    var tGroup = LC.buttonGroup(["80% → [MASK]", "10% → 随机词", "10% → 保持不变"], function (i) { treatment = i; stage = Math.max(stage, 2); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [nextBtn]));
    root.appendChild(view);
    root.appendChild(h("div", { class: "demo-sub", text: "切换 80/10/10 的三种处理方式：" }));
    root.appendChild(tGroup.el);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     16. BERT 三种 Embedding 相加
     ============================================================ */
  LC.demos["bert-embeddings"] = function (root) {
    var TOKENS = ["[CLS]", "my", "dog", "[SEP]", "is", "cute", "[SEP]"];
    var SEGS = [0, 0, 0, 0, 1, 1, 1];
    var TOKEN_VECS = {
      "[CLS]": [0.1, 0.2, -0.1, 0.0], "[SEP]": [0.0, -0.2, 0.1, 0.2],
      "my": [0.2, -0.1, 0.4, 0.1], "dog": [0.5, 0.3, -0.2, 0.4],
      "is": [-0.1, 0.4, 0.2, -0.3], "cute": [0.6, -0.2, 0.3, 0.5]
    };
    var sel = 5;
    var view = h("div"), out = LC.readout();

    function vecTable(label, vec, color) {
      var t = h("table", { class: "mat" });
      var tr = h("tr");
      vec.forEach(function (v) { tr.appendChild(h("td", { text: LC.fmt(v, 1), style: color || "" })); });
      t.appendChild(tr);
      return h("div", { class: "mat-group" }, [h("div", { class: "mat-label", text: label }), t]);
    }
    function render() {
      view.innerHTML = "";
      var row = h("div", { class: "demo-chips" });
      TOKENS.forEach(function (t, i) {
        var c = h("span", { class: "chip" + (i === sel ? " on" : ""), text: t });
        c.addEventListener("click", function () { sel = i; render(); });
        row.appendChild(c);
      });
      view.appendChild(row);

      var tok = TOKENS[sel], pos = sel, seg = SEGS[sel];
      var vTok = TOKEN_VECS[tok];
      var vPos = [pos * 0.05, -pos * 0.03, pos * 0.04, pos * 0.02];
      var vSeg = seg === 0 ? [0.1, 0.1, 0.1, 0.1] : [-0.1, -0.1, -0.1, -0.1];
      var sum = vTok.map(function (v, i) { return v + vPos[i] + vSeg[i]; });

      view.appendChild(h("div", { class: "mat-wrap", style: "justify-content:center" }, [
        vecTable("Token Embedding", vTok, "color:var(--accent-text)"),
        h("span", { class: "shape-op", style: "font-size:18px", text: "+" }),
        vecTable("Position Embedding", vPos, "color:var(--amber)"),
        h("span", { class: "shape-op", style: "font-size:18px", text: "+" }),
        vecTable("Segment Embedding", vSeg, "color:var(--purple)"),
        h("span", { class: "shape-arrow", style: "font-size:18px", text: "=" }),
        vecTable("输入向量", sum, "background:var(--green-soft);border-color:var(--green)")
      ]));
      out.textContent =
        "当前 token：\"" + tok + "\"（位置 " + pos + "，Segment " + (seg === 0 ? "A" : "B") + "）\n" +
        "输入向量 = Token + Position + Segment = [" + sum.map(function (v) { return LC.fmt(v, 2); }).join(", ") + "]\n\n" +
        "三种信息逐元素【相加】（不是拼接），所以维度仍然是 d_model（这里用 4 维示意，真实是 768）。\n" +
        "注意：BERT 的 Position Embedding 是【可学习】的（不是 sinusoidal），上限 512 个位置。";
    }
    root.appendChild(h("div", { class: "demo-sub", text: "点击任意 token，查看三种 Embedding 如何相加：" }));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
  /* ============================================================
     17. 3 token × 2 维完整手算 Attention
     ============================================================ */
  LC.demos["attn-handcalc"] = function (root) {
    function mm(A, B) {
      return A.map(function (row) {
        return B[0].map(function (_, j) {
          return row.reduce(function (s, v, k) { return s + v * B[k][j]; }, 0);
        });
      });
    }
    function T(A) { return A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }); }
    var X = [[1, 0], [0, 1], [1, 1]];
    var Wq = [[1, 0], [1, 1]], Wk = [[0, 1], [1, 0]], Wv = [[1, 0], [0, 1]];
    var Q = mm(X, Wq), K = mm(X, Wk), V = mm(X, Wv);
    var S = mm(Q, T(K));
    var dk = 2, sq = Math.sqrt(dk);
    var SQ = S.map(function (r) { return r.map(function (v) { return v / sq; }); });
    var A = SQ.map(function (row) {
      var ex = row.map(Math.exp);
      var s = ex.reduce(function (a, b) { return a + b; }, 0);
      return ex.map(function (e) { return e / s; });
    });
    var O = mm(A, V);

    var step = 0, TOTAL = 6;
    var view = h("div"), out = LC.readout();
    var badge = h("span", { class: "badge" });

    function wrap(children) { return h("div", { class: "mat-wrap", style: "justify-content:center;flex-wrap:wrap" }, children); }
    function op(t) { return h("span", { class: "shape-op", style: "font-size:17px", text: t }); }
    function arrow() { return h("span", { class: "shape-arrow", style: "font-size:17px", text: "→" }); }

    function render() {
      badge.textContent = "步骤 " + (step + 1) + " / " + TOTAL;
      view.innerHTML = "";
      if (step === 0) {
        view.appendChild(wrap([LC.matGroup("X 输入", "[3,2]", X, { digits: 0 })]));
        out.textContent =
          "输入 X：3 个 token（行），每个 token 2 维（列）。\n" +
          "X = [[1,0], [0,1], [1,1]]，d_model = d_k = d_v = 2。\n\n" +
          "下面每一步都可以自己用纸笔验算。";
      } else if (step === 1) {
        view.appendChild(wrap([
          LC.matGroup("X", "[3,2]", X, { digits: 0 }), op("×"),
          LC.matGroup("W_Q", "[2,2]", Wq, { digits: 0 }), arrow(),
          LC.matGroup("Q", "[3,2]", Q, { digits: 0, hl: [[2, 0]] })
        ]));
        view.appendChild(wrap([
          LC.matGroup("X", "[3,2]", X, { digits: 0 }), op("×"),
          LC.matGroup("W_K", "[2,2]", Wk, { digits: 0 }), arrow(),
          LC.matGroup("K", "[3,2]", K, { digits: 0 })
        ]));
        view.appendChild(wrap([
          LC.matGroup("X", "[3,2]", X, { digits: 0 }), op("×"),
          LC.matGroup("W_V", "[2,2]", Wv, { digits: 0 }), arrow(),
          LC.matGroup("V", "[3,2]", V, { digits: 0 })
        ]));
        out.textContent =
          "第 1 步：三个投影 Q = XW_Q，K = XW_K，V = XW_V。\n" +
          "每个投影：(3,2) × (2,2) = (3,2)，形状不变。\n\n" +
          "手算示例（Q 的第 3 行）：[1,1] × W_Q = [1×1+1×1, 1×0+1×1] = [2, 1]\n" +
          "（W_Q 第 1 列 [1,1] → 1+1=2；第 2 列 [0,1] → 0+1=1）";
      } else if (step === 2) {
        view.appendChild(wrap([
          LC.matGroup("Q", "[3,2]", Q, { digits: 0 }), op("×"),
          LC.matGroup("Kᵀ", "[2,3]", T(K), { digits: 0 }), arrow(),
          LC.matGroup("S = QKᵀ", "[3,3]", S, { digits: 0, colorScale: true })
        ]));
        out.textContent =
          "第 2 步：S = QKᵀ，每个元素是「query 和 key 的点积」。\n" +
          "(3,2) × (2,3) = (3,3)：3 个 token 互相打分，得到 3×3 的分数矩阵。\n\n" +
          "手算示例：\n" +
          "S₁₁ = q₁·k₁ = [1,0]·[0,1] = 1×0+0×1 = 0\n" +
          "S₂₃ = q₂·k₃ = [1,1]·[1,1] = 1+1 = 2\n" +
          "S₃₃ = q₃·k₃ = [2,1]·[1,1] = 2+1 = 3（最匹配）";
      } else if (step === 3) {
        view.appendChild(wrap([
          LC.matGroup("S", "[3,3]", S, { digits: 0 }), op("÷ √2 ≈ 1.414"), arrow(),
          LC.matGroup("缩放后", "[3,3]", SQ, { digits: 2 })
        ]));
        out.textContent =
          "第 3 步：除以 √d_k = √2 ≈ 1.414。\n" +
          "目的：把分数压回合理范围，防止 softmax 饱和。\n\n" +
          "手算示例：3 ÷ 1.414 = 2.121，2 ÷ 1.414 = 1.414，1 ÷ 1.414 = 0.707。\n" +
          "形状不变，仍是 (3,3)。";
      } else if (step === 4) {
        view.appendChild(wrap([
          LC.matGroup("缩放后分数", "[3,3]", SQ, { digits: 2 }), op("softmax(逐行)"), arrow(),
          LC.matGroup("A 注意力权重", "[3,3]", A, { digits: 2 })
        ]));
        view.appendChild(LC.panel("A 的热力图（每行和为 1）", [
          LC.heatmap(A, { fmt: function (v) { return v.toFixed(2); } })
        ]));
        out.textContent =
          "第 4 步：对每一行做 softmax，得到注意力权重 A。\n" +
          "每行和为 1：第 1 行 [0.198, 0.401, 0.401]，第 2 行 [0.248, 0.248, 0.504]，第 3 行 [0.140, 0.284, 0.576]。\n\n" +
          "手算第 1 行：exp([0, 0.707, 0.707]) = [1, 2.028, 2.028]，和 = 5.056\n" +
          "→ [1/5.056, 2.028/5.056, 2.028/5.056] = [0.198, 0.401, 0.401]\n\n" +
          "怎么读：第 3 行表示 token3 把 14% 注意力给 token1、28% 给 token2、58% 留给自己。";
      } else {
        view.appendChild(wrap([
          LC.matGroup("A", "[3,3]", A, { digits: 2 }), op("×"),
          LC.matGroup("V", "[3,2]", V, { digits: 0 }), arrow(),
          LC.matGroup("O 输出", "[3,2]", O, { digits: 3, hl: [[0, 0]] })
        ]));
        out.textContent =
          "第 5 步：O = A·V，每个 token 的输出是所有 V 的加权和。\n" +
          "(3,3) × (3,2) = (3,2)，形状与输入 X 一致（d_v = d_model 时）。\n\n" +
          "手算 output₁（第 1 行）：\n" +
          "0.198×V₁ + 0.401×V₂ + 0.401×V₃\n" +
          "= 0.198×[1,0] + 0.401×[0,1] + 0.401×[1,1]\n" +
          "= [0.198+0.401, 0.401+0.401] = [0.599, 0.802] ✅\n\n" +
          "恭喜：你已经从头到尾手算完一次完整的 Self-Attention。";
      }
    }
    var prevBtn = button("← 上一步", function () { if (step > 0) { step--; render(); } });
    var nextBtn = button("下一步 →", function () { if (step < TOTAL - 1) { step++; render(); } }, "primary");
    root.appendChild(h("div", { class: "demo-controls" }, [prevBtn, nextBtn, button("重置", function () { step = 0; render(); }), badge]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
