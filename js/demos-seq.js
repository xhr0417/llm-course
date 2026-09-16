/* ============================================================
   LC — 交互演示 (序列模型：RNN / LSTM / GRU / BPE / Embedding)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, svgRoot = LC.svgRoot, svgEl = LC.svgEl, button = LC.button;

  function svgText(x, y, str, opts) {
    opts = opts || {};
    var t = svgEl("text", {
      x: x, y: y,
      "text-anchor": opts.anchor || "middle",
      "font-size": opts.size || 13,
      "font-weight": opts.weight || 500,
      fill: opts.fill || "var(--text)",
      "font-family": "-apple-system,PingFang SC,sans-serif"
    });
    t.textContent = str;
    return t;
  }
  function svgBox(x, y, w, hh, opts) {
    opts = opts || {};
    var g = svgEl("g", {});
    var r = svgEl("rect", {
      x: x, y: y, width: w, height: hh, rx: opts.rx || 9,
      fill: opts.fill || "var(--bg-soft)",
      stroke: opts.stroke || "var(--border)",
      "stroke-width": opts.sw || 1.4
    });
    g.appendChild(r);
    if (opts.label) g.appendChild(svgText(x + w / 2, y + hh / 2 + 4.5, opts.label, opts.labelOpts));
    return { g: g, rect: r };
  }
  function svgArrow(defs, x1, y1, x2, y2, opts) {
    opts = opts || {};
    var id = "arr-" + Math.random().toString(36).slice(2, 8);
    var marker = svgEl("marker", { id: id, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" });
    marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: opts.color || "var(--text-faint)" }));
    defs.appendChild(marker);
    var line = svgEl("line", {
      x1: x1, y1: y1, x2: x2, y2: y2,
      stroke: opts.color || "var(--text-faint)",
      "stroke-width": opts.sw || 1.6,
      "marker-end": "url(#" + id + ")",
      "stroke-dasharray": opts.dash || "none"
    });
    return line;
  }

  /* ============================================================
     RNN 展开
     ============================================================ */
  LC.demos["rnn-unroll"] = function (root) {
    var svg = svgRoot("0 0 560 270");
    var defs = svgEl("defs", {});
    svg.appendChild(defs);

    var W = 560;
    var positions = [70, 200, 330, 460];
    var hY = 120, xY = 210;
    var elements = {};

    // h0
    var h0 = svgBox(28, hY - 20, 56, 40, { label: "h₀", fill: "var(--bg-soft)" });
    svg.appendChild(h0.g);
    elements.h0 = h0;

    var hs = [], xs = [];
    for (var i = 0; i < 3; i++) {
      var x = positions[i + 1] - 28;
      var hb = svgBox(x, hY - 20, 56, 40, { label: "h" + (i + 1) });
      svg.appendChild(hb.g);
      hs.push(hb);
      var xb = svgBox(x, xY - 18, 56, 36, { label: "x" + (i + 1), fill: "var(--accent-soft)", stroke: "color-mix(in srgb, var(--accent) 45%, transparent)" });
      svg.appendChild(xb.g);
      xs.push(xb);
      // x -> h arrow
      var a1 = svgArrow(defs, positions[i + 1], xY - 20, positions[i + 1], hY + 22, {});
      svg.appendChild(a1);
      elements["xin" + i] = a1;
      // h_{i} -> h_{i+1}
      var from = i === 0 ? 84 : positions[i] + 30;
      var a2 = svgArrow(defs, from, hY, positions[i + 1] - 30, hY, {});
      svg.appendChild(a2);
      elements["hh" + i] = a2;
      // W labels on arrows
      var wt = svgText((from + positions[i + 1] - 30) / 2, hY - 8, i === 0 ? "U" : "U", { size: 11.5, fill: "var(--purple)", weight: 700 });
      svg.appendChild(wt);
      elements["U" + i] = wt;
      var wx = svgText(positions[i + 1] + 12, (xY + hY) / 2, "W", { size: 11.5, fill: "var(--purple)", weight: 700 });
      svg.appendChild(wx);
      elements["W" + i] = wx;
    }
    // output from h3
    var outArrow = svgArrow(defs, positions[3], hY - 22, positions[3], 34, { color: "var(--green)" });
    svg.appendChild(outArrow);
    svg.appendChild(svgText(positions[3], 22, "ŷ（情感分类输出）", { size: 11.5, fill: "var(--green)" }));
    elements.out = outArrow;

    var out = LC.readout();
    var step = 0;

    function clearHL() {
      [h0].concat(hs).forEach(function (b) { b.rect.setAttribute("stroke", "var(--border)"); b.rect.setAttribute("stroke-width", "1.4"); });
      xs.forEach(function (b) { b.rect.setAttribute("stroke", "color-mix(in srgb, var(--accent) 45%, transparent)"); b.rect.setAttribute("stroke-width", "1.4"); });
      Object.keys(elements).forEach(function (k) {
        if (elements[k].setAttribute && elements[k].tagName === "line") elements[k].setAttribute("stroke", "var(--text-faint)");
      });
      outArrow.setAttribute("stroke", "var(--green)");
      ["U0", "U1", "U2", "W0", "W1", "W2"].forEach(function (k) { elements[k].setAttribute("fill", "var(--purple)"); });
    }
    function highlight(ix) {
      clearHL();
      if (ix < 0) return;
      xs[ix].rect.setAttribute("stroke", "var(--accent)");
      xs[ix].rect.setAttribute("stroke-width", "3");
      hs[ix].rect.setAttribute("stroke", "var(--accent)");
      hs[ix].rect.setAttribute("stroke-width", "3");
      elements["xin" + ix].setAttribute("stroke", "var(--accent)");
      elements["hh" + ix].setAttribute("stroke", "var(--accent)");
      elements["W" + ix].setAttribute("fill", "var(--accent)");
      elements["U" + ix].setAttribute("fill", "var(--accent)");
      if (ix === 2) outArrow.setAttribute("stroke", "var(--green)");
    }
    function update() {
      highlight(step - 1);
      if (step === 0) {
        out.textContent = "初始状态 h₀（通常为 0 向量）。点击「下一步」开始按时间展开。";
      } else {
        out.textContent =
          "第 " + step + " 步：h" + step + " = tanh( W·x" + step + " + U·h" + (step - 1) + " + b )\n" +
          "注意高亮的 W 和 U —— 每个时间步使用的是【同一组参数】，这就是参数共享。";
      }
    }
    var stepBtn = button("下一步 ▶", function () {
      step = (step + 1) % 4;
      update();
    }, "primary");
    var shareBtn = button("显示参数共享", function () {
      ["U0", "U1", "U2", "W0", "W1", "W2"].forEach(function (k) {
        elements[k].setAttribute("fill", "var(--red)");
        elements[k].setAttribute("font-size", "13");
      });
      out.textContent = "所有时间步共用同一组 (W, U, b)。参数量与序列长度无关 → 可以处理任意长度序列，但也导致梯度沿时间连乘，产生长程依赖问题。";
    });
    root.appendChild(svg);
    root.appendChild(h("div", { class: "demo-controls" }, [stepBtn, shareBtn, button("重置", function () { step = 0; update(); })]));
    root.appendChild(out);
    update();
  };

  /* ============================================================
     LSTM
     ============================================================ */
  LC.demos["lstm"] = function (root) {
    var svg = svgRoot("0 0 560 320");
    var defs = svgEl("defs", {});
    svg.appendChild(defs);

    // Cell state highway
    var cY = 60;
    svg.appendChild(svgText(40, cY - 22, "Cell State 长期记忆高速公路 C", { size: 11.5, fill: "var(--purple)", anchor: "start", weight: 700 }));
    var cPrev = svgBox(30, cY - 16, 64, 32, { label: "Cₜ₋₁", fill: "var(--purple-soft)", stroke: "color-mix(in srgb, var(--purple) 40%, transparent)" });
    svg.appendChild(cPrev.g);
    var fBox = svgBox(140, cY - 18, 52, 36, { label: "⊗ fₜ", fill: "var(--red-soft)", stroke: "color-mix(in srgb, var(--red) 45%, transparent)" });
    svg.appendChild(fBox.g);
    var plusBox = svgBox(250, cY - 18, 46, 36, { label: "⊕", fill: "var(--green-soft)", stroke: "color-mix(in srgb, var(--green) 45%, transparent)" });
    svg.appendChild(plusBox.g);
    var cNext = svgBox(360, cY - 16, 64, 32, { label: "Cₜ", fill: "var(--purple-soft)", stroke: "color-mix(in srgb, var(--purple) 40%, transparent)" });
    svg.appendChild(cNext.g);
    var a1 = svgArrow(defs, 94, cY, 140, cY, { color: "var(--purple)" }); svg.appendChild(a1);
    var a2 = svgArrow(defs, 192, cY, 250, cY, { color: "var(--purple)" }); svg.appendChild(a2);
    var a3 = svgArrow(defs, 296, cY, 360, cY, { color: "var(--purple)" }); svg.appendChild(a3);

    // Candidate memory
    var candBox = svgBox(210, 150, 100, 36, { label: "C̃ₜ = tanh(...)", fill: "var(--green-soft)", stroke: "color-mix(in srgb, var(--green) 45%, transparent)" });
    svg.appendChild(candBox.g);
    var iBox = svgBox(130, 150, 62, 36, { label: "⊗ iₜ", fill: "var(--accent-soft)", stroke: "color-mix(in srgb, var(--accent) 45%, transparent)" });
    svg.appendChild(iBox.g);
    var ai = svgArrow(defs, 192, 168, 210, 168, { color: "var(--accent)" }); svg.appendChild(ai);
    var aUp = svgArrow(defs, 260, 150, 262, cY + 20, { color: "var(--green)" }); svg.appendChild(aUp);

    // gates column
    var gY = 240;
    svg.appendChild(svgText(60, gY - 26, "xₜ 与 hₜ₋₁", { size: 11.5, fill: "var(--text-faint)", anchor: "start" }));
    var xBox = svgBox(30, gY - 16, 66, 32, { label: "xₜ, hₜ₋₁", fill: "var(--bg-soft)" });
    svg.appendChild(xBox.g);
    var fGate = svgBox(130, gY - 16, 62, 32, { label: "σ → fₜ", fill: "var(--red-soft)", stroke: "color-mix(in srgb, var(--red) 40%, transparent)" });
    var iGate = svgBox(212, gY - 16, 62, 32, { label: "σ → iₜ", fill: "var(--accent-soft)", stroke: "color-mix(in srgb, var(--accent) 40%, transparent)" });
    var oGate = svgBox(294, gY - 16, 62, 32, { label: "σ → oₜ", fill: "var(--amber-soft)", stroke: "color-mix(in srgb, var(--amber) 40%, transparent)" });
    [fGate, iGate, oGate].forEach(function (g) { svg.appendChild(g.g); });
    var g1 = svgArrow(defs, 96, gY, 130, gY, {}); svg.appendChild(g1);
    var g2 = svgArrow(defs, 162, gY, 212, gY, {}); svg.appendChild(g2);
    var g3 = svgArrow(defs, 274, gY, 294, gY, {}); svg.appendChild(g3);
    // gate up arrows
    var fUp = svgArrow(defs, 161, gY - 18, 161, cY + 20, { color: "var(--red)", dash: "4 4" }); svg.appendChild(fUp);
    var iUp = svgArrow(defs, 243, gY - 18, 161 + 80, 186, { color: "var(--accent)", dash: "4 4" }); svg.appendChild(iUp);
    // output
    var oUp = svgArrow(defs, 325, gY - 18, 325, 130, { color: "var(--amber)", dash: "4 4" }); svg.appendChild(oUp);
    var tanhC = svgBox(420, 120, 74, 34, { label: "tanh(Cₜ)", fill: "var(--purple-soft)" });
    svg.appendChild(tanhC.g);
    var multO = svgBox(420, 176, 74, 34, { label: "⊗ oₜ → hₜ", fill: "var(--amber-soft)", stroke: "color-mix(in srgb, var(--amber) 45%, transparent)" });
    svg.appendChild(multO.g);
    var aTanh = svgArrow(defs, 424, cY + 18, 440, 120, { color: "var(--purple)", dash: "4 4" }); svg.appendChild(aTanh);
    var aO = svgArrow(defs, 457, 154, 457, 176, { color: "var(--amber)" }); svg.appendChild(aO);
    var aH = svgArrow(defs, 494, 193, 540, 193, { color: "var(--green)" }); svg.appendChild(aH);
    svg.appendChild(svgText(548, 185, "hₜ", { size: 13, weight: 700, fill: "var(--green)" }));

    var out = LC.readout();
    var fv = 0.7, iv = 0.4, Cprev = 0.8, Ccand = 1.0;

    function updateVals() {
      var oldPart = fv * Cprev, newPart = iv * Ccand, Ct = oldPart + newPart;
      out.textContent =
        "Cₜ = fₜ ⊙ Cₜ₋₁ + iₜ ⊙ C̃ₜ\n" +
        "   = " + LC.fmt(fv, 2) + " × " + LC.fmt(Cprev, 2) + " + " + LC.fmt(iv, 2) + " × " + LC.fmt(Ccand, 2) + "\n" +
        "   = " + LC.fmt(oldPart, 3) + "（保留的旧记忆） + " + LC.fmt(newPart, 3) + "（写入的新记忆） = " + LC.fmt(Ct, 3) + "\n\n" +
        (fv > 0.7 ? "遗忘门 fₜ 很大 → 旧记忆保留得多。" : fv < 0.3 ? "遗忘门 fₜ 很小 → 旧记忆几乎被忘掉。" : "旧记忆部分保留。") +
        (iv > 0.6 ? " 输入门 iₜ 很大 → 新信息大量写入。" : " 输入门控制新信息写入量。");
    }
    function highlightGate(which) {
      function op(el, v) {
        if (el && el.setAttribute) el.setAttribute("opacity", v);
        else if (el && el.rect) el.rect.setAttribute("opacity", v);
      }
      var map = { f: [fBox, fGate, a1, g1, fUp], i: [iBox, iGate, ai, g2, iUp], o: [multO, oGate, g3, oUp, aO] };
      var all = [fBox, iBox, multO, fGate, iGate, oGate, a1, a2, a3, ai, aUp, g1, g2, g3, fUp, iUp, oUp, aTanh, aO, aH];
      all.forEach(function (el) { op(el, "0.35"); });
      map[which].forEach(function (el) { op(el, "1"); });
      svg.setAttribute("opacity", "1");
      var names = { f: "遗忘门：决定 Cₜ₋₁ 保留多少（σ 输出 0~1，0=全忘，1=全留）", i: "输入门：决定新候选记忆 C̃ₜ 写入多少", o: "输出门：决定 Cₜ 中哪些信息暴露给 hₜ" };
      out.textContent = names[which] + "\n\n（可以拖动下面的滑块改变门的值，看 Cₜ 如何混合）";
      window.setTimeout(function () { all.forEach(function (el) { op(el, "1"); }); }, 2600);
    }

    var fS = LC.slider("遗忘门 fₜ", 0, 1, 0.01, fv, function (v) { fv = v; updateVals(); });
    var iS = LC.slider("输入门 iₜ", 0, 1, 0.01, iv, function (v) { iv = v; updateVals(); });
    root.appendChild(svg);
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("遗忘门", function () { highlightGate("f"); }),
      button("输入门", function () { highlightGate("i"); }),
      button("输出门", function () { highlightGate("o"); })
    ]));
    root.appendChild(h("div", { class: "demo-controls" }, [fS.el, iS.el]));
    root.appendChild(h("div", { class: "demo-sub", text: "固定：Cₜ₋₁ = 0.8，候选记忆 C̃ₜ = 1.0" }));
    root.appendChild(out);
    updateVals();
  };

  /* ============================================================
     GRU（与 LSTM 并排对比）
     ============================================================ */
  LC.demos["gru"] = function (root) {
    var svg = svgRoot("0 0 560 260");
    var defs = svgEl("defs", {});
    svg.appendChild(defs);

    // LSTM side
    svg.appendChild(svgText(140, 24, "LSTM", { size: 15, weight: 800, fill: "var(--purple)" }));
    svg.appendChild(svgText(140, 46, "3 个门 + 2 个状态", { size: 11.5, fill: "var(--text-faint)" }));
    var lx = 30;
    ["遗忘门 f", "输入门 i", "输出门 o"].forEach(function (t, i) {
      var b = svgBox(lx, 70 + i * 42, 110, 32, { label: t, fill: "var(--purple-soft)" });
      svg.appendChild(b.g);
    });
    var cState = svgBox(lx + 120, 70, 110, 32, { label: "Cell State C", fill: "var(--purple-soft)", stroke: "color-mix(in srgb, var(--purple) 45%, transparent)" });
    svg.appendChild(cState.g);
    var hState = svgBox(lx + 120, 112, 110, 32, { label: "Hidden State h", fill: "var(--accent-soft)", stroke: "color-mix(in srgb, var(--accent) 45%, transparent)" });
    svg.appendChild(hState.g);
    svg.appendChild(svgText(140, 200, "参数 ≈ 4 × h × (d + h)", { size: 12, fill: "var(--text-soft)" }));

    // divider
    svg.appendChild(svgEl("line", { x1: 280, y1: 14, x2: 280, y2: 246, stroke: "var(--border)", "stroke-width": 1.4, "stroke-dasharray": "5 5" }));

    // GRU side
    svg.appendChild(svgText(420, 24, "GRU", { size: 15, weight: 800, fill: "var(--green)" }));
    svg.appendChild(svgText(420, 46, "2 个门 + 1 个状态", { size: 11.5, fill: "var(--text-faint)" }));
    var rBox = svgBox(310, 70, 110, 32, { label: "重置门 r", fill: "var(--green-soft)" });
    svg.appendChild(rBox.g);
    var zBox = svgBox(310, 112, 110, 32, { label: "更新门 z", fill: "var(--green-soft)" });
    svg.appendChild(zBox.g);
    var hOnly = svgBox(430, 90, 110, 34, { label: "Hidden State h", fill: "var(--accent-soft)", stroke: "color-mix(in srgb, var(--accent) 45%, transparent)" });
    svg.appendChild(hOnly.g);
    var rArr = svgArrow(defs, 420, 104, 430, 104, { color: "var(--green)" });
    svg.appendChild(rArr);
    svg.appendChild(svgText(420, 200, "参数 ≈ 3 × h × (d + h)", { size: 12, fill: "var(--text-soft)" }));
    svg.appendChild(svgText(420, 222, "少了 25% 参数，还少了一个状态", { size: 11.5, fill: "var(--green)" }));

    var out = LC.readout();
    var d = 256, hh = 256;
    var lstmP = 4 * hh * (d + hh);
    var gruP = 3 * hh * (d + hh);
    out.textContent =
      "以 d = h = 256 为例（单层）：\n" +
      "LSTM ≈ 4 × 256 × 512 = " + lstmP.toLocaleString() + " 参数\n" +
      "GRU  ≈ 3 × 256 × 512 = " + gruP.toLocaleString() + " 参数\n" +
      "GRU 比 LSTM 少约 " + Math.round((1 - gruP / lstmP) * 100) + "% 的参数，训练更快，小数据集上往往不输 LSTM。";
    root.appendChild(svg);
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("高亮 LSTM 的门", function () {
        function op(el, v) {
          if (el && el.setAttribute) el.setAttribute("opacity", v);
          else if (el && el.rect) el.rect.setAttribute("opacity", v);
        }
        [rBox, zBox, hOnly, rArr].forEach(function (b) { op(b, "0.3"); });
        [cState, hState].forEach(function (b) { op(b, "1"); });
      }),
      button("高亮 GRU 的门", function () {
        function op(el, v) {
          if (el && el.setAttribute) el.setAttribute("opacity", v);
          else if (el && el.rect) el.rect.setAttribute("opacity", v);
        }
        [cState, hState].forEach(function (b) { op(b, "0.3"); });
        [rBox, zBox, hOnly, rArr].forEach(function (b) { op(b, "1"); });
      }),
      button("恢复", function () {
        function op(el, v) {
          if (el && el.setAttribute) el.setAttribute("opacity", v);
          else if (el && el.rect) el.rect.setAttribute("opacity", v);
        }
        [rBox, zBox, hOnly, rArr, cState, hState].forEach(function (b) { op(b, "1"); });
      })
    ]));
    root.appendChild(out);
  };

  /* ============================================================
     BPE（真实训练 + 编码）
     ============================================================ */
  LC.demos["bpe"] = function (root) {
    var CORPUS = [
      { w: "low", c: 5 },
      { w: "lower", c: 2 },
      { w: "newest", c: 6 },
      { w: "widest", c: 3 }
    ];
    var state, merges, iter, autoTimer = null;

    function splitWord(w) {
      var chars = w.split("");
      chars[chars.length - 1] += "</w>";
      return chars;
    }
    function initState() {
      state = CORPUS.map(function (x) { return { tokens: splitWord(x.w), count: x.c }; });
      merges = [];
      iter = 0;
    }
    function countPairs() {
      var m = {};
      state.forEach(function (word) {
        for (var i = 0; i < word.tokens.length - 1; i++) {
          var key = word.tokens[i] + "|" + word.tokens[i + 1];
          m[key] = (m[key] || 0) + word.count;
        }
      });
      return Object.keys(m).map(function (k) {
        return { pair: k.split("|"), count: m[k] };
      }).sort(function (a, b) { return b.count - a.count; });
    }
    function applyMerge(pair) {
      state = state.map(function (word) {
        var out = [], i = 0;
        while (i < word.tokens.length) {
          if (i < word.tokens.length - 1 && word.tokens[i] === pair[0] && word.tokens[i + 1] === pair[1]) {
            out.push(pair[0] + pair[1]); i += 2;
          } else { out.push(word.tokens[i]); i++; }
        }
        return { tokens: out, count: word.count };
      });
    }

    var wordsEl = h("div"), pairsEl = h("div"), rulesEl = h("div"), out = LC.readout();
    var iterBadge = h("span", { class: "badge" });

    function render() {
      iterBadge.textContent = "合并次数：" + iter;
      wordsEl.innerHTML = "";
      wordsEl.appendChild(h("div", { class: "demo-sub", text: "当前语料切分（数字为词频）：" }));
      state.forEach(function (word) {
        var row = h("div", { class: "demo-flex", style: "margin:4px 0" });
        row.appendChild(h("span", { class: "badge gray", text: "×" + word.count }));
        word.tokens.forEach(function (t) {
          row.appendChild(h("span", { class: "chip ghost", text: t }));
        });
        wordsEl.appendChild(row);
      });
      var pairs = countPairs().slice(0, 5);
      pairsEl.innerHTML = "";
      pairsEl.appendChild(h("div", { class: "demo-sub", text: "出现频率最高的相邻 pair：" }));
      pairsEl.appendChild(LC.bars(pairs.map(function (p) {
        return { label: p.pair[0] + " + " + p.pair[1], value: p.count, max: pairs[0].count, text: "×" + p.count, color: "amber" };
      })));
      rulesEl.innerHTML = "";
      rulesEl.appendChild(h("div", { class: "demo-sub", text: "学到的 merge rules（按学习顺序）：" }));
      var wrap = h("div", { class: "demo-chips" });
      merges.forEach(function (m, i) {
        wrap.appendChild(h("span", { class: "chip green", text: (i + 1) + ". " + m[0] + " + " + m[1] }));
      });
      rulesEl.appendChild(wrap);
    }
    function doStep() {
      var pairs = countPairs();
      if (!pairs.length) {
        out.textContent = "没有更多可合并的 pair 了。";
        stopAuto();
        return;
      }
      var best = pairs[0];
      applyMerge(best.pair);
      merges.push(best.pair);
      iter++;
      render();
      out.textContent =
        "第 " + iter + " 次合并：频率最高的 pair 是 (" + best.pair[0] + " + " + best.pair[1] + ")，共出现 " + best.count + " 次。\n" +
        "→ 在所有词中把它合并成一个新 token：" + best.pair[0] + best.pair[1] + "\n" +
        "这就是「Tokenizer 不是魔法，它在学 merge rules」的含义。";
    }
    function stopAuto() { clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = "自动播放"; }
    var autoBtn = button("自动播放", function () {
      if (autoTimer) { stopAuto(); return; }
      autoBtn.textContent = "⏸ 暂停";
      autoTimer = setInterval(doStep, 1100);
    });

    /* encoding */
    var encInput = h("input", { class: "demo-num", style: "width:140px", value: "slowest" });
    var encOut = LC.readout();

    function encodeWord(word) {
      var tokens = splitWord(word);
      var steps = [{ label: "初始切分", tokens: tokens.slice() }];
      merges.forEach(function (pair) {
        var outT = [], i = 0, changed = false;
        while (i < tokens.length) {
          if (i < tokens.length - 1 && tokens[i] === pair[0] && tokens[i + 1] === pair[1]) {
            outT.push(pair[0] + pair[1]); i += 2; changed = true;
          } else { outT.push(tokens[i]); i++; }
        }
        if (changed) {
          tokens = outT;
          steps.push({ label: "应用规则 " + pair[0] + " + " + pair[1] + " → " + pair[0] + pair[1], tokens: tokens.slice() });
        }
      });
      return steps;
    }
    function doEncode() {
      var w = (encInput.value || "").trim();
      if (!w) return;
      var steps = encodeWord(w);
      encOut.innerHTML = "";
      steps.forEach(function (s) {
        var row = h("div", { class: "demo-flex", style: "margin:3px 0" });
        row.appendChild(h("span", { class: "badge gray", text: s.label }));
        s.tokens.forEach(function (t) { row.appendChild(h("span", { class: "chip ghost", text: t })); });
        encOut.appendChild(row);
      });
      var finalTokens = steps[steps.length - 1].tokens;
      encOut.appendChild(h("div", { class: "demo-sub", html: "最终 token 序列：<b>" + finalTokens.join(" | ") + "</b>（再查词表即可得到 token IDs）" }));
    }

    root.appendChild(h("div", { class: "demo-flex" }, [
      h("span", { class: "demo-sub", text: "语料：" }),
      h("span", { class: "chip ghost", text: "low ×5" }),
      h("span", { class: "chip ghost", text: "lower ×2" }),
      h("span", { class: "chip ghost", text: "newest ×6" }),
      h("span", { class: "chip ghost", text: "widest ×3" })
    ]));
    root.appendChild(h("div", { class: "demo-controls" }, [button("下一步合并 ▶", doStep, "primary"), autoBtn, button("重置", function () { stopAuto(); initState(); render(); out.textContent = ""; }), iterBadge]));
    root.appendChild(wordsEl);
    root.appendChild(h("div", { class: "demo-grid2" }, [pairsEl, rulesEl]));
    root.appendChild(out);

    root.appendChild(h("hr", { style: "border:none;border-top:1px dashed var(--border);margin:18px 0" }));
    root.appendChild(h("div", { class: "demo-sub", html: "<b>Encoding（用学到的规则编码新词）</b>：输入一个词，看它如何被 merge rules 逐步切分。" }));
    root.appendChild(h("div", { class: "demo-controls" }, [encInput, button("编码", doEncode, "primary")]));
    root.appendChild(encOut);

    initState();
    render();
  };

  /* ============================================================
     Embedding
     ============================================================ */
  LC.demos["embedding"] = function (root) {
    var tokens = [
      { word: "dog", id: 100, vec: [1.2, 1.0, 0.2, -0.4], pos: [1.2, 1.0] },
      { word: "cat", id: 101, vec: [1.5, 1.3, 0.1, -0.3], pos: [1.5, 1.3] },
      { word: "king", id: 102, vec: [3.2, 2.8, 0.9, 0.5], pos: [3.2, 2.8] },
      { word: "queen", id: 103, vec: [3.4, 2.4, 0.9, 0.6], pos: [3.4, 2.4] },
      { word: "man", id: 104, vec: [2.6, 2.9, 0.8, 0.4], pos: [2.6, 2.9] },
      { word: "woman", id: 105, vec: [2.9, 2.2, 0.8, 0.5], pos: [2.9, 2.2] },
      { word: "apple", id: 106, vec: [0.5, 3.5, -1.2, 0.3], pos: [0.5, 3.5] }
    ];
    var tableWrap = h("div"), scatterWrap = h("div"), out = LC.readout();

    function renderTable(selected) {
      tableWrap.innerHTML = "";
      var t = h("table", { class: "mat", style: "border-spacing:2px" });
      var head = h("tr");
      ["token", "token id", "embedding（4 维示意）"].forEach(function (x) {
        head.appendChild(h("th", { style: "font-size:11.5px;padding:4px 8px;text-align:left", text: x }));
      });
      t.appendChild(head);
      tokens.forEach(function (tk) {
        var tr = h("tr", { style: "cursor:pointer" });
        var isSel = selected === tk.word;
        var td1 = h("td", { style: "width:60px;" + (isSel ? "background:var(--accent-soft);border-color:var(--accent)" : ""), text: tk.word });
        var td2 = h("td", { style: "width:60px;" + (isSel ? "background:var(--accent-soft);border-color:var(--accent)" : ""), text: String(tk.id) });
        var td3 = h("td", { style: "width:200px;font-size:11.5px;" + (isSel ? "background:var(--accent-soft);border-color:var(--accent)" : ""), text: "[" + tk.vec.join(", ") + "]" });
        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
        tr.addEventListener("click", function () { select(tk.word); });
        t.appendChild(tr);
      });
      tableWrap.appendChild(t);
      tableWrap.appendChild(h("div", { class: "demo-sub", text: "点击任意行，看它在 2D 语义空间中的位置。" }));
    }

    function renderScatter(selected) {
      scatterWrap.innerHTML = "";
      var svg = svgRoot("0 0 340 300");
      // axes
      svg.appendChild(svgEl("line", { x1: 30, y1: 270, x2: 320, y2: 270, stroke: "var(--border)", "stroke-width": 1.2 }));
      svg.appendChild(svgEl("line", { x1: 30, y1: 270, x2: 30, y2: 16, stroke: "var(--border)", "stroke-width": 1.2 }));
      function px(x) { return 30 + x / 4 * 290; }
      function py(y) { return 270 - y / 4 * 250; }
      tokens.forEach(function (tk) {
        var sel = selected === tk.word;
        var c = svgEl("circle", { cx: px(tk.pos[0]), cy: py(tk.pos[1]), r: sel ? 8 : 5.5, fill: sel ? "var(--purple)" : "var(--accent)", opacity: sel ? 1 : 0.55 });
        c.style.cursor = "pointer";
        c.addEventListener("click", function () { select(tk.word); });
        svg.appendChild(c);
        var label = svgText(px(tk.pos[0]) + 10, py(tk.pos[1]) + 4, tk.word, { anchor: "start", size: 12, weight: sel ? 700 : 500, fill: sel ? "var(--purple)" : "var(--text-soft)" });
        label.style.cursor = "pointer";
        label.addEventListener("click", function () { select(tk.word); });
        svg.appendChild(label);
      });
      // king - man + woman ≈ queen
      var k = tokens[2], m = tokens[4], wm = tokens[5], q = tokens[3];
      var kx = px(k.pos[0]), ky = py(k.pos[1]);
      var mx = px(m.pos[0]), my = py(m.pos[1]);
      var wx = px(wm.pos[0]), wy = py(wm.pos[1]);
      var qx = px(q.pos[0]), qy = py(q.pos[1]);
      var arrow1 = svgEl("line", { x1: kx, y1: ky, x2: kx + (wx - mx), y2: ky - (my - wy), stroke: "var(--amber)", "stroke-width": 1.8, "stroke-dasharray": "5 4" });
      svg.appendChild(arrow1);
      svg.appendChild(svgText(px(1.6), py(3.6), "king − man + woman ≈ queen", { size: 11.5, fill: "var(--amber)", anchor: "start" }));
      scatterWrap.appendChild(svg);
      scatterWrap.appendChild(h("div", { class: "demo-sub", text: "2D 只是把 4096 维压扁的示意；真实 embedding 空间里语义关系是高维几何结构。" }));
    }
    function select(word) {
      renderTable(word);
      renderScatter(word);
      var tk = tokens.filter(function (t) { return t.word === word; })[0];
      out.textContent =
        "Embedding 本质是查表：E ∈ R^(V×d)。\n" +
        word + " 的 token id = " + tk.id + " → 取 E 的第 " + tk.id + " 行 → 得到 " + tk.vec.length + " 维向量（示意）：[" + tk.vec.join(", ") + "]\n\n" +
        "关键点：token id 只是行号，本身没有语义；语义全部在查出来的向量里。";
    }
    root.appendChild(h("div", { class: "demo-grid2" }, [tableWrap, scatterWrap]));
    root.appendChild(out);
    select("dog");
  };
  /* ============================================================
     Tokenizer 粒度对比
     ============================================================ */
  LC.demos["tokenizer"] = function (root) {
    var text = "I love machine learning 我爱机器学习";
    var SUBWORD_DICT = ["I", "love", "machine", "learn", "ing", "我", "爱", "机器", "学习"];
    var mode = 0; // 0 word, 1 char, 2 subword
    var tokensWrap = h("div"), statsWrap = h("div"), out = LC.readout();

    function tokenize(t, m) {
      if (m === 0) {
        return t.split(/\s+/).filter(Boolean);
      }
      if (m === 1) {
        return t.replace(/\s+/g, "").split("");
      }
      // 简单子词模拟：优先匹配词典中最长的词，否则退化为单字符
      var s = t.replace(/\s+/g, "");
      var out = [], i = 0;
      while (i < s.length) {
        var matched = null;
        for (var L = 4; L >= 1; L--) {
          var piece = s.slice(i, i + L);
          if (SUBWORD_DICT.indexOf(piece) !== -1) { matched = piece; break; }
        }
        if (!matched) matched = s[i];
        out.push(matched);
        i += matched.length;
      }
      return out;
    }
    function render() {
      var toks = tokenize(text, mode);
      tokensWrap.innerHTML = "";
      var row = h("div", { class: "demo-chips" });
      toks.forEach(function (t) { row.appendChild(h("span", { class: "chip ghost", text: t })); });
      tokensWrap.appendChild(row);
      var names = ["Word-level（按词）", "Character-level（按字符）", "Subword（子词，示意）"];
      var vocabNote = ["词表巨大、有新词 OOV 问题", "词表最小、但序列最长", "词表可控、序列适中、几乎无 OOV"];
      statsWrap.innerHTML = "";
      statsWrap.appendChild(LC.bars([
        { label: "token 数量", value: toks.length, max: 30, text: toks.length + " 个", color: mode === 1 ? "red" : mode === 2 ? "green" : "amber" }
      ], { max: 30 }));
      out.textContent =
        "模式：" + names[mode] + "\n" +
        "token 序列：[" + toks.slice(0, 12).join(", ") + (toks.length > 12 ? ", …" : "") + "]\n" +
        "token 总数：" + toks.length + "\n\n" +
        "特点：" + vocabNote[mode] + "\n" +
        "（真实的子词切分由 BPE 从语料中学出，见下面的 BPE 演示；这里用固定词典示意。）";
    }
    var group = LC.buttonGroup(["Word", "Character", "Subword"], function (i) { mode = i; render(); });
    var input = h("input", { class: "demo-num", style: "width:280px", value: text });
    input.addEventListener("input", function () { text = input.value || " "; render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [h("span", { class: "demo-sub", text: "输入文本：" }), input]));
    root.appendChild(group.el);
    root.appendChild(tokensWrap);
    root.appendChild(statsWrap);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     CBOW / Skip-Gram 窗口
     ============================================================ */
  LC.demos["cbow-skipgram"] = function (root) {
    var SENT = ["I", "love", "machine", "learning", "very", "much"];
    var center = 3; // "learning"
    var mode = 0; // 0 CBOW, 1 Skip-Gram
    var win = 2;
    var view = h("div"), out = LC.readout();

    function render() {
      view.innerHTML = "";
      var row = h("div", { class: "demo-flex", style: "gap:5px;justify-content:center;margin:10px 0;flex-wrap:wrap" });
      SENT.forEach(function (t, i) {
        var isCenter = i === center;
        var inWin = !isCenter && Math.abs(i - center) <= win;
        var style = isCenter
          ? "background:var(--purple-soft);border-color:var(--purple);color:var(--purple);font-weight:700"
          : inWin
            ? "background:var(--green-soft);border-color:var(--green);color:var(--green)"
            : "opacity:.35";
        row.appendChild(h("span", { class: "chip ghost", text: t, style: style }));
      });
      view.appendChild(row);

      var ctx = SENT.filter(function (_, i) { return i !== center && Math.abs(i - center) <= win; });
      var pairs = [];
      if (mode === 0) {
        ctx.forEach(function (w) { pairs.push([w + "（上下文）", "→", SENT[center] + "（目标）"]); });
      } else {
        ctx.forEach(function (w) { pairs.push([SENT[center] + "（中心）", "→", w + "（目标）"]); });
      }
      var list = h("div");
      pairs.forEach(function (p) {
        list.appendChild(h("div", { class: "stat-line", html: '<span class="badge ' + (mode === 0 ? "green" : "gray") + '">' + p[0] + "</span> → " + p[2] }));
      });
      view.appendChild(LC.panel(mode === 0 ? "CBOW：用上下文预测中心词" : "Skip-Gram：用中心词预测上下文", [list]));
      out.textContent =
        (mode === 0
          ? "CBOW：把窗口内的上下文词向量平均/求和，预测中间词。训练快，对高频词更友好。"
          : "Skip-Gram：用中心词预测窗口内每个上下文词。训练慢一些，但对低频词和语义关系（king−man+woman≈queen）效果更好。") +
        "\n\n滑动窗口大小 = " + win + "：窗口越大，上下文信息越多，但计算量越大。";
    }
    var group = LC.buttonGroup(["CBOW", "Skip-Gram"], function (i) { mode = i; render(); });
    var cS = LC.slider("中心词位置", 1, SENT.length - 2, 1, center, function (v) { center = Math.round(v); render(); });
    var wS = LC.slider("窗口大小", 1, 3, 1, win, function (v) { win = Math.round(v); render(); });
    root.appendChild(group.el);
    root.appendChild(h("div", { class: "demo-controls" }, [cS.el, wS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
