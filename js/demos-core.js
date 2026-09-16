/* ============================================================
   LC — 交互演示框架 (core)
   共享 helper + 基础章节演示
   ============================================================ */
(function () {
  "use strict";

  var LC = window.LC = {
    demos: {},
    registry: {}
  };

  /* ---------------- DOM helpers ---------------- */
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null) continue;
        if (k === "class") e.className = v;
        else if (k === "html") e.innerHTML = v;
        else if (k === "text") e.textContent = v;
        else if (k === "style") e.setAttribute("style", v);
        else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      }
    }
    appendChildren(e, children);
    return e;
  }
  function appendChildren(e, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
  }
  function frag(children) {
    var f = document.createDocumentFragment();
    appendChildren(f, children);
    return f;
  }
  function fmt(x, d) {
    if (typeof d === "undefined") d = 3;
    if (x === 0) return "0";
    var a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) return x.toExponential(2);
    return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toString();
  }
  function slider(labelText, min, max, step, value, onInput) {
    var valSpan = h("span", { class: "demo-val", text: fmt(value, 2) });
    var input = h("input", {
      type: "range", min: String(min), max: String(max),
      step: String(step), value: String(value)
    });
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      valSpan.textContent = fmt(v, 2);
      onInput(v);
    });
    var el = h("label", { class: "demo-control" }, [
      h("span", { class: "demo-label", text: labelText }), input, valSpan
    ]);
    return {
      el: el,
      input: input,
      set: function (v) { input.value = String(v); valSpan.textContent = fmt(v, 2); }
    };
  }
  function button(text, onClick, cls) {
    return h("button", { class: "demo-btn " + (cls || ""), text: text, onclick: onClick });
  }
  function buttonGroup(items, onSelect) {
    var btns = items.map(function (it, i) {
      return button(it, function () { setActive(i); onSelect(i); });
    });
    function setActive(i) {
      btns.forEach(function (b, j) { b.classList.toggle("active", i === j); });
    }
    setActive(0);
    return { el: h("div", { class: "demo-flex" }, btns), setActive: setActive };
  }
  function canvas(w, hh) {
    return h("canvas", { width: w, height: hh, class: "demo-canvas" });
  }
  function svgRoot(viewBox) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", viewBox);
    s.setAttribute("class", "svg-demo");
    return s;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
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
  function readout() { return h("div", { class: "demo-readout" }); }
  function panel(title, children) {
    return h("div", { class: "demo-panel" }, [h("h5", { text: title }), frag(children)]);
  }

  function matrixTable(mat, opts) {
    opts = opts || {};
    var hl = {};
    (opts.hl || []).forEach(function (rc) { hl[rc[0] + "," + rc[1]] = true; });
    var t = h("table", { class: "mat" });
    mat.forEach(function (row, r) {
      var tr = h("tr");
      row.forEach(function (v, c) {
        var cls = "";
        if (hl[r + "," + c]) cls += " hl";
        if (opts.colorScale) {
          var a = Math.abs(v);
          if (a > 0.001) cls += v > 0 ? " pos" : " neg";
        }
        tr.appendChild(h("td", {
          class: cls.trim(),
          text: opts.fmt ? opts.fmt(v) : fmt(v, opts.digits != null ? opts.digits : 2)
        }));
      });
      t.appendChild(tr);
    });
    return t;
  }
  function matGroup(label, shape, mat, opts) {
    return h("div", { class: "mat-group" }, [
      h("div", { class: "mat-label", html: label + (shape ? ' <span class="mat-shape">' + shape + "</span>" : "") }),
      matrixTable(mat, opts)
    ]);
  }
  function bars(items, opts) {
    opts = opts || {};
    var max = opts.max != null ? opts.max : Math.max.apply(null, items.map(function (i) { return i.value; }));
    if (max <= 0) max = 1;
    var wrap = h("div", { class: "bars" });
    items.forEach(function (it) {
      var pct = Math.max(0, Math.min(100, it.value / max * 100));
      wrap.appendChild(h("div", { class: "bar-row" }, [
        h("div", { class: "bar-label", text: it.label }),
        h("div", { class: "bar-track" }, [
          h("div", { class: "bar-fill " + (it.color || ""), style: "width:" + pct + "%" })
        ]),
        h("div", { class: "bar-val", text: it.text != null ? it.text : fmt(it.value, 3) })
      ]));
    });
    return wrap;
  }
  function heatColor(v, max) {
    var t = max > 0 ? Math.min(1, v / max) : 0;
    var r = Math.round(255 - (255 - 47) * t);
    var g = Math.round(255 - (255 - 111) * t);
    var b = Math.round(255 - (255 - 237) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function heatmap(matrix, opts) {
    opts = opts || {};
    var max = opts.max || 0;
    if (!max) {
      matrix.forEach(function (row) {
        row.forEach(function (v) { if (typeof v === "number" && v > max) max = v; });
      });
    }
    var g = h("div", { class: "heatmap", style: "grid-template-columns: repeat(" + matrix[0].length + ", 1fr)" });
    matrix.forEach(function (row) {
      row.forEach(function (v) {
        var txt = opts.fmt ? opts.fmt(v) : (typeof v === "number" ? fmt(v, 2) : v);
        var isNum = typeof v === "number";
        var dark = isNum && v / max > 0.55;
        g.appendChild(h("div", {
          class: "heat-cell",
          text: txt,
          style: isNum ? "background:" + heatColor(v, max) + ";color:" + (dark ? "#fff" : "var(--text)") : ""
        }));
      });
    });
    return g;
  }

  LC.h = h;
  LC.frag = frag;
  LC.fmt = fmt;
  LC.slider = slider;
  LC.button = button;
  LC.buttonGroup = buttonGroup;
  LC.canvas = canvas;
  LC.svgRoot = svgRoot;
  LC.svgEl = svgEl;
  LC.svgText = svgText;
  LC.readout = readout;
  LC.panel = panel;
  LC.matrixTable = matrixTable;
  LC.matGroup = matGroup;
  LC.bars = bars;
  LC.heatmap = heatmap;
  LC.heatColor = heatColor;

  /* ---------------- init ---------------- */
  LC.init = function (root) {
    root.querySelectorAll("[data-demo]").forEach(function (el) {
      var name = el.getAttribute("data-demo");
      if (el.getAttribute("data-init")) return;
      el.setAttribute("data-init", "1");
      var fn = LC.demos[name];
      if (fn) {
        try { fn(el); } catch (err) {
          el.innerHTML = '<div class="demo-error">演示出错：' + (err && err.message ? err.message : err) + "</div>";
          if (window.console) console.error("demo " + name, err);
        }
      } else {
        el.innerHTML = '<div class="demo-error">未找到演示组件 "' + name + '"</div>';
      }
    });
  };

  /* ============================================================
     1. 梯度下降
     ============================================================ */
  LC.demos["gradient-descent"] = function (root) {
    var W = 560, H = 300;
    var cv = canvas(W, H);
    var ctx = cv.getContext("2d");
    var lr = 0.1, w = -1.5, path = [w], timer = null;
    var out = readout();

    function L(x) { return (x - 3) * (x - 3); }
    function g(x) { return 2 * (x - 3); }
    function X(x) { return 46 + (x + 2) / 10 * (W - 66); }
    function Y(l) { return H - 34 - l / 28 * (H - 58); }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, H - 34); ctx.lineTo(W - 14, H - 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(46, 12); ctx.lineTo(46, H - 34); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "12px -apple-system,sans-serif";
      ctx.fillText("w", W - 24, H - 16); ctx.fillText("Loss", 12, 18);
      for (var t = -2; t <= 8; t++) {
        ctx.fillText(String(t), X(t) - 3, H - 18);
      }
      ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 2.5; ctx.beginPath();
      for (var i = 0; i <= 220; i++) {
        var ww = -2 + 10 * i / 220, x = X(ww), y = Y(L(ww));
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      if (path.length > 1) {
        ctx.strokeStyle = "rgba(124,58,237,.5)"; ctx.lineWidth = 1.6; ctx.beginPath();
        path.forEach(function (p, i) { var x = X(p), y = Y(L(p)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      }
      path.forEach(function (p, i) {
        var x = X(p), y = Y(L(p)), last = i === path.length - 1;
        ctx.fillStyle = last ? "#7c3aed" : "rgba(124,58,237,.3)";
        ctx.beginPath(); ctx.arc(x, y, last ? 6 : 2.6, 0, 7); ctx.fill();
      });
    }
    function update() {
      var last = path[path.length - 1];
      var next = last - lr * g(last);
      out.textContent =
        "step " + (path.length - 1) +
        "   w = " + fmt(last, 4) +
        "   L(w) = " + fmt(L(last), 4) +
        "   ∇L = " + fmt(g(last), 4) +
        "\nw ← w − η·∇L = " + fmt(last, 3) + " − " + fmt(lr, 2) + "×" + fmt(g(last), 3) + " = " + fmt(next, 4);
    }
    function step() {
      var last = path[path.length - 1];
      var nw = last - lr * g(last);
      if (!isFinite(nw) || Math.abs(nw) > 40) {
        out.textContent += "\n\n💥 发散了！参数冲出画面（|w| > 40）。学习率太大。";
        stop();
        return;
      }
      path.push(nw);
      if (path.length > 80) stop();
      draw(); update();
    }
    function start() {
      if (timer) return;
      timer = setInterval(step, 420);
      playBtn.textContent = "⏸ 暂停";
    }
    function stop() {
      clearInterval(timer); timer = null;
      playBtn.textContent = "▶ 开始";
    }
    function reset() { stop(); path = [w]; draw(); update(); }

    var playBtn = button("▶ 开始", function () { timer ? stop() : start(); }, "primary");
    var lrS = slider("学习率 η", 0.01, 1.2, 0.01, lr, function (v) { lr = v; reset(); });
    var presets = h("div", { class: "demo-flex" }, [
      button("η=0.02 太慢", function () { lrS.set(0.02); lr = 0.02; reset(); }),
      button("η=0.30 合适", function () { lrS.set(0.30); lr = 0.30; reset(); }),
      button("η=0.90 震荡", function () { lrS.set(0.90); lr = 0.90; reset(); }),
      button("η=1.10 发散", function () { lrS.set(1.10); lr = 1.10; reset(); })
    ]);
    root.appendChild(h("div", { class: "demo-controls" }, [lrS.el, playBtn, button("单步", step), button("重置", reset)]));
    root.appendChild(presets);
    root.appendChild(cv);
    root.appendChild(out);
    draw(); update();
  };

  /* ============================================================
     2. Softmax
     ============================================================ */
  LC.demos["softmax"] = function (root) {
    var z = [2, 1, 0.1];
    var left = h("div"), right = h("div");
    var out = readout();

    function update() {
      var ex = z.map(Math.exp);
      var s = ex.reduce(function (a, b) { return a + b; }, 0);
      var p = ex.map(function (e) { return e / s; });

      left.innerHTML = "";
      left.appendChild(panel("逐步计算", [
        h("div", { class: "stat-line", html: "logits z = <b>[" + z.map(function (v) { return fmt(v, 1); }).join(", ") + "]</b>" }),
        h("div", { class: "stat-line", html: "exp(z) = <b>[" + ex.map(function (v) { return fmt(v, 2); }).join(", ") + "]</b>" }),
        h("div", { class: "stat-line", html: "sum = <b>" + fmt(s, 3) + "</b>" }),
        h("div", { class: "stat-line", html: "P = exp(z) / sum = <b>[" + p.map(function (v) { return fmt(v, 3); }).join(", ") + "]</b>" })
      ]));

      right.innerHTML = "";
      right.appendChild(panel("概率柱状图（和为 1）", [
        bars(p.map(function (v, i) {
          return { label: "类别 " + (i + 1), value: v, max: 1, text: (v * 100).toFixed(1) + "%" };
        }))
      ]));
      out.textContent = "观察：logit 最大的类别概率最大，但所有类别都保留非零概率（Softmax 永不为 0）。";
    }

    var controls = h("div", { class: "demo-controls" });
    z.forEach(function (v, i) {
      var s = slider("z" + (i + 1), -3, 5, 0.1, v, function (nv) { z[i] = nv; update(); });
      controls.appendChild(s.el);
    });
    root.appendChild(controls);
    root.appendChild(h("div", { class: "demo-grid2" }, [left, right]));
    root.appendChild(out);
    update();
  };

  /* ============================================================
     3. 交叉熵
     ============================================================ */
  LC.demos["cross-entropy"] = function (root) {
    var W = 560, H = 250;
    var cv = canvas(W, H);
    var ctx = cv.getContext("2d");
    var p = 0.3;
    var out = readout();

    function X(pv) { return 50 + pv * (W - 70); }
    function Y(l) { return H - 30 - l / 5 * (H - 46); }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, H - 30); ctx.lineTo(W - 12, H - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(50, 10); ctx.lineTo(50, H - 30); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "12px -apple-system,sans-serif";
      ctx.fillText("正确类别概率 p →", W - 150, H - 10);
      ctx.fillText("−ln(p)", 8, 18);
      ctx.fillText("0", 44, H - 16); ctx.fillText("1", W - 20, H - 16);
      ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 2.5; ctx.beginPath();
      for (var i = 0; i <= 300; i++) {
        var pv = 0.01 + 0.99 * i / 300;
        var x = X(pv), y = Y(-Math.log(pv));
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      var x = X(p), y = Y(-Math.log(p));
      ctx.strokeStyle = "rgba(124,58,237,.35)"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, H - 30); ctx.lineTo(x, y); ctx.lineTo(50, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
    }
    function update() {
      draw();
      var loss = -Math.log(p);
      out.textContent =
        "p = " + fmt(p, 3) + "\n" +
        "Loss = −ln(p) = " + fmt(loss, 4) +
        (p < 0.05 ? "\n\n⚠️ 正确类别概率接近 0 → loss 趋向 +∞（模型非常错误，梯度也很大）" :
         p > 0.9 ? "\n\n✅ 正确类别概率接近 1 → loss 接近 0（模型很自信且正确）" : "");
    }
    var s = slider("正确类别概率 p", 0.01, 1, 0.01, p, function (v) { p = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [s.el]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     4. 梯度消失 / 梯度爆炸
     ============================================================ */
  LC.demos["vanishing-exploding"] = function (root) {
    var base = 0.8;
    var ns = [1, 5, 10, 20, 50, 100];
    var out = readout();
    var barWrap = h("div");

    function update() {
      var items = ns.map(function (n) {
        var v = Math.pow(base, n);
        var l = Math.log10(v);
        var pct = Math.max(0.5, Math.min(100, (l + 12) / 24 * 100));
        var color = v > 100 ? "red" : v < 0.01 ? "dim" : "green";
        return { label: base + "^" + n, value: pct, max: 100, text: fmt(v, 3), color: color };
      });
      barWrap.innerHTML = "";
      barWrap.appendChild(h("div", { class: "demo-sub", html: "对数刻度柱状图（每格 = 10 倍变化），数值为梯度连乘结果：" }));
      barWrap.appendChild(bars(items, { max: 100 }));
      var v100 = Math.pow(base, 100);
      var msg;
      if (base < 0.999) {
        msg = "每层乘 " + base + " → 100 层后只剩 " + fmt(v100, 3) + " 倍。梯度信号在传到浅层时几乎消失（梯度消失）。";
      } else if (base > 1.001) {
        msg = "每层乘 " + base + " → 100 层后放大到 " + fmt(v100, 3) + " 倍。参数更新会爆炸甚至 NaN（梯度爆炸）。";
      } else {
        msg = "每层乘 1.0 → 梯度不增不减（理想状态，实际很难做到）。";
      }
      out.textContent = msg + "\n\n反向传播时梯度 = 各层局部梯度的连乘：∂L/∂W₁ = ∂L/∂hₙ · Π(∂hᵢ/∂hᵢ₋₁)";
    }
    var s = slider("每层梯度系数", 0.5, 1.6, 0.01, base, function (v) { base = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [
      s.el,
      button("0.8（消失）", function () { s.set(0.8); base = 0.8; update(); }),
      button("1.5（爆炸）", function () { s.set(1.5); base = 1.5; update(); })
    ]));
    root.appendChild(barWrap);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     5. 混淆矩阵计算器
     ============================================================ */
  LC.demos["confusion-matrix"] = function (root) {
    var vals = { TP: 80, FP: 20, FN: 10, TN: 90 };
    var out = h("div");
    var metrics = h("div");

    function numInput(key, label) {
      var input = h("input", { class: "demo-num", type: "number", value: String(vals[key]) });
      input.addEventListener("input", function () {
        vals[key] = Math.max(0, parseInt(input.value || "0", 10));
        update();
      });
      return h("label", { class: "demo-control" }, [h("span", { class: "demo-label", text: label }), input]);
    }

    function update() {
      var TP = vals.TP, FP = vals.FP, FN = vals.FN, TN = vals.TN;
      var acc = (TP + TN) / Math.max(1, TP + TN + FP + FN);
      var prec = TP / Math.max(1, TP + FP);
      var rec = TP / Math.max(1, TP + FN);
      var f1 = (prec + rec) > 0 ? 2 * prec * rec / (prec + rec) : 0;
      var spec = TN / Math.max(1, TN + FP);

      out.innerHTML = "";
      out.appendChild(LC.bars([
        { label: "Accuracy", value: acc, max: 1, text: (acc * 100).toFixed(1) + "%", color: "green" },
        { label: "Precision", value: prec, max: 1, text: (prec * 100).toFixed(1) + "%", color: "green" },
        { label: "Recall", value: rec, max: 1, text: (rec * 100).toFixed(1) + "%", color: "green" },
        { label: "F1", value: f1, max: 1, text: (f1 * 100).toFixed(1) + "%", color: "green" },
        { label: "Specificity", value: spec, max: 1, text: (spec * 100).toFixed(1) + "%", color: "dim" }
      ]));
      metrics.innerHTML =
        "Accuracy  = (TP+TN)/(全部)      = (" + TP + "+" + TN + ")/" + (TP + TN + FP + FN) + " = " + (acc * 100).toFixed(1) + "%\n" +
        "Precision = TP/(TP+FP)          = " + TP + "/(" + TP + "+" + FP + ") = " + (prec * 100).toFixed(1) + "%\n" +
        "Recall    = TP/(TP+FN)          = " + TP + "/(" + TP + "+" + FN + ") = " + (rec * 100).toFixed(1) + "%\n" +
        "F1        = 2PR/(P+R)           = " + (f1 * 100).toFixed(1) + "%";
    }

    var matrix = h("div", { class: "demo-grid2" }, [
      panel("预测正 (Predicted +)", [
        h("div", { class: "demo-controls" }, [numInput("TP", "TP（真阳性）"), numInput("FP", "FP（误报）")])
      ]),
      panel("预测负 (Predicted −)", [
        h("div", { class: "demo-controls" }, [numInput("FN", "FN（漏报）"), numInput("TN", "TN（真阴性）")])
      ])
    ]);
    var line = readout();
    root.appendChild(matrix);
    root.appendChild(h("div", { class: "demo-sub", text: "试着把 TP 调成 0（模型把所有病人都判成健康），看 Accuracy 和 Recall 会怎样。" }));
    root.appendChild(out);
    root.appendChild(line);
    update();
    // swap: use line as metrics readout
    line.remove();
    root.appendChild(metrics);
    metrics.className = "demo-readout";
    update();
  };

  /* ============================================================
     6. 优化器竞赛（SGD / Momentum / Adam）
     ============================================================ */
  LC.demos["optimizer-race"] = function (root) {
    var W = 560, H = 300;
    var cv = canvas(W, H);
    var ctx = cv.getContext("2d");
    var lr = 0.06, timer = null;
    var optimizers = [
      { name: "SGD", color: "#dc2626", w: -1.5, v: 0, path: [] },
      { name: "Momentum", color: "#d97706", w: -1.5, v: 0, path: [] },
      { name: "Adam", color: "#17a673", w: -1.5, m: 0, vv: 0, t: 0, path: [] }
    ];
    var out = readout();

    function L(x) { return (x - 3) * (x - 3) + 0.8 * Math.sin(4 * x); }
    function g(x) { return 2 * (x - 3) + 3.2 * Math.cos(4 * x); }
    function X(x) { return 46 + (x + 2) / 10 * (W - 66); }
    function Y(l) { return H - 34 - l / 30 * (H - 58); }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, H - 34); ctx.lineTo(W - 14, H - 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(46, 12); ctx.lineTo(46, H - 34); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "12px -apple-system,sans-serif";
      ctx.fillText("Loss = (w−3)² + 0.8·sin(4w)（带波浪的非凸函数）", 60, 18);
      ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 2.2; ctx.beginPath();
      for (var i = 0; i <= 260; i++) {
        var ww = -2 + 10 * i / 260, x = X(ww), y = Y(L(ww));
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      optimizers.forEach(function (o) {
        o.path.forEach(function (p, i) {
          if (!i) return;
          ctx.strokeStyle = o.color + "55"; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(X(o.path[i - 1]), Y(L(o.path[i - 1]))); ctx.lineTo(X(p), Y(L(p))); ctx.stroke();
        });
        var x = X(o.w), y = Y(L(o.w));
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(x, Math.max(8, Math.min(H - 8, y)), 5, 0, 7); ctx.fill();
      });
    }
    function step() {
      optimizers.forEach(function (o) {
        if (o.name === "SGD") {
          o.w = o.w - lr * g(o.w);
        } else if (o.name === "Momentum") {
          o.v = 0.9 * o.v + lr * g(o.w);
          o.w = o.w - o.v;
        } else {
          o.t++;
          o.m = 0.9 * o.m + 0.1 * g(o.w);
          o.vv = 0.999 * o.vv + 0.001 * g(o.w) * g(o.w);
          var mh = o.m / (1 - Math.pow(0.9, o.t));
          var vh = o.vv / (1 - Math.pow(0.999, o.t));
          o.w = o.w - lr * 3 * mh / (Math.sqrt(vh) + 1e-8);
        }
        o.path.push(o.w);
        if (o.path.length > 120) o.path.shift();
      });
      draw();
      out.textContent = optimizers.map(function (o) {
        return o.name.padEnd(10) + " w = " + fmt(o.w, 4) + "   L = " + fmt(L(o.w), 4);
      }).join("\n");
      if (optimizers.every(function (o) { return Math.abs(g(o.w)) < 1e-3 || Math.abs(o.w) > 30; })) stop();
    }
    function start() { if (timer) return; timer = setInterval(step, 300); btn.textContent = "⏸ 暂停"; }
    function stop() { clearInterval(timer); timer = null; btn.textContent = "▶ 开始"; }
    function reset() {
      stop();
      optimizers[0].w = optimizers[1].w = optimizers[2].w = -1.5;
      optimizers[1].v = 0; optimizers[2].m = optimizers[2].vv = 0; optimizers[2].t = 0;
      optimizers.forEach(function (o) { o.path = [o.w]; });
      draw();
    }
    var btn = button("▶ 开始", function () { timer ? stop() : start(); }, "primary");
    var s = slider("学习率 η", 0.01, 0.2, 0.005, lr, function (v) { lr = v; reset(); });
    optimizers.forEach(function (o) { o.path = [o.w]; });
    root.appendChild(h("div", { class: "demo-controls" }, [s.el, btn, button("重置", reset)]));
    root.appendChild(cv);
    root.appendChild(h("div", { class: "demo-sub", html: "三种颜色分别是 <b>SGD</b>（红）、<b>Momentum</b>（橙）、<b>Adam</b>（绿）。观察谁能更快冲过波浪到达谷底。" }));
    root.appendChild(out);
    draw();
  };
  /* ============================================================
     7. 反向传播逐步演示
     ============================================================ */
  LC.demos["backprop"] = function (root) {
    var x = 2, w = 1, y = 5;
    var step = 0; // 0 初始 1 前向 2 反向 3 更新
    var graph = h("div", { class: "demo-flex", style: "gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 0" });
    var out = LC.readout();

    function node(label, sub, color) {
      return h("div", {
        class: "chip ghost",
        html: label + (sub ? '<br><span style="font-size:10.5px;color:var(--text-faint)">' + sub + "</span>" : ""),
        style: "min-width:96px;text-align:center;padding:9px 12px;line-height:1.5;" + (color || "")
      });
    }
    function arrow(label) {
      return h("div", { class: "demo-flex", style: "flex-direction:column;align-items:center;gap:0" }, [
        h("span", { style: "font-size:10.5px;color:var(--accent-text);font-family:monospace", text: label || "" }),
        h("span", { style: "color:var(--text-faint);font-size:16px", text: "→" })
      ]);
    }
    function render() {
      var z = w * x;
      var L = (z - y) * (z - y);
      var dLdz = 2 * (z - y);
      var dLdw = dLdz * x;
      var wNew = w - 0.1 * dLdw;
      var zNew = wNew * x;
      var LNew = (zNew - y) * (zNew - y);

      var vx = step >= 1 ? "x=" + x : "x";
      var vw = step >= 1 ? "w=" + w : "w";
      var vz = step >= 1 ? "z=" + LC.fmt(z, 2) : "z = w·x";
      var vL = step >= 1 ? "L=" + LC.fmt(L, 2) : "L = (z−y)²";
      var gw = step >= 2 ? "∂L/∂w=" + LC.fmt(dLdw, 2) : "∂L/∂w = ?";
      var gz = step >= 2 ? "∂L/∂z=" + LC.fmt(dLdz, 2) : "∂L/∂z = ?";
      var upd = step >= 3 ? "w ← " + LC.fmt(wNew, 3) + "（L=" + LC.fmt(LNew, 3) + "）" : "更新 w";

      graph.innerHTML = "";
      graph.appendChild(node(vx, "输入", "background:var(--accent-soft);border-color:var(--accent);color:var(--accent-text)"));
      graph.appendChild(arrow(""));
      graph.appendChild(node(vw, "参数", "background:var(--purple-soft);border-color:var(--purple);color:var(--purple)"));
      graph.appendChild(arrow("×"));
      graph.appendChild(node(vz, "中间值", step >= 1 ? "background:var(--green-soft);border-color:var(--green);color:var(--green)" : ""));
      graph.appendChild(arrow(step >= 2 ? "∂L/∂z" : ""));
      graph.appendChild(node(vL, "损失", step >= 1 ? "background:var(--red-soft);border-color:var(--red);color:var(--red)" : ""));
      graph.appendChild(arrow(""));
      graph.appendChild(node(upd, "梯度下降", step >= 3 ? "background:var(--green-soft);border-color:var(--green);color:var(--green)" : ""));

      if (step === 0) {
        out.textContent = "设置：x = " + x + "，w = " + w + "，y = " + y + "。\n点击「前向传播」开始计算。";
      } else if (step === 1) {
        out.textContent =
          "【前向传播】\nz = w·x = " + w + " × " + x + " = " + LC.fmt(z, 2) + "\n" +
          "L = (z − y)² = (" + LC.fmt(z, 2) + " − " + y + ")² = " + LC.fmt(L, 2) + "\n\n" +
          "下一步：从 L 出发反向求梯度。";
      } else if (step === 2) {
        out.textContent =
          "【反向传播】（链式法则，从后往前）\n" +
          "① ∂L/∂z = 2(z − y) = 2 × (" + LC.fmt(z, 2) + " − " + y + ") = " + LC.fmt(dLdz, 2) + "\n" +
          "② ∂z/∂w = x = " + x + "\n" +
          "③ ∂L/∂w = ∂L/∂z × ∂z/∂w = " + LC.fmt(dLdz, 2) + " × " + x + " = " + LC.fmt(dLdw, 2) + "\n\n" +
          "含义：w 每增大 1，Loss 会变化 " + LC.fmt(dLdw, 2) + "（现在是负的，说明增大 w 能减小 Loss）。";
      } else {
        out.textContent =
          "【参数更新】（η = 0.1）\n" +
          "w ← w − η·∂L/∂w = " + w + " − 0.1 × (" + LC.fmt(dLdw, 2) + ") = " + LC.fmt(wNew, 3) + "\n\n" +
          "验证：新 z = " + LC.fmt(zNew, 2) + "，新 L = " + LC.fmt(LNew, 3) + "（原来是 " + LC.fmt(L, 2) + "）\n" +
          "→ Loss 下降了，说明这一步更新方向正确。✅";
      }
      stepBtn.disabled = step >= 3;
    }
    var stepBtn = button("前向传播 →", function () { step = Math.min(3, step + 1); stepBtn.textContent = ["前向传播 →", "反向传播 →", "更新参数 →", "已完成"][step]; render(); }, "primary");
    var xs = slider("x（输入）", -3, 5, 0.5, x, function (v) { x = v; step = 0; stepBtn.disabled = false; stepBtn.textContent = "前向传播 →"; render(); });
    var ws = slider("w（参数）", -3, 3, 0.5, w, function (v) { w = v; step = 0; stepBtn.disabled = false; stepBtn.textContent = "前向传播 →"; render(); });
    var ys = slider("y（目标）", -3, 8, 0.5, y, function (v) { y = v; step = 0; stepBtn.disabled = false; stepBtn.textContent = "前向传播 →"; render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [xs.el, ws.el, ys.el]));
    root.appendChild(graph);
    root.appendChild(h("div", { class: "demo-controls" }, [stepBtn, button("重置", function () { step = 0; stepBtn.disabled = false; stepBtn.textContent = "前向传播 →"; render(); })]));
    root.appendChild(out);
    render();
  };

  /* ============================================================
     8. 激活函数曲线与导数
     ============================================================ */
  LC.demos["activations"] = function (root) {
    var W = 520, H = 260;
    var cv = canvas(W, H);
    var ctx = cv.getContext("2d");
    var showDeriv = false, xv = 1.0;
    var out = LC.readout();

    var fns = [
      { name: "Sigmoid", color: "#dc2626", f: function (x) { return 1 / (1 + Math.exp(-x)); }, d: function (x) { var s = 1 / (1 + Math.exp(-x)); return s * (1 - s); } },
      { name: "Tanh", color: "#d97706", f: Math.tanh, d: function (x) { return 1 - Math.tanh(x) * Math.tanh(x); } },
      { name: "ReLU", color: "#2f6fed", f: function (x) { return Math.max(0, x); }, d: function (x) { return x > 0 ? 1 : 0; } },
      { name: "SiLU", color: "#17a673", f: function (x) { return x / (1 + Math.exp(-x)); }, d: function (x) { var s = 1 / (1 + Math.exp(-x)); return s + x * s * (1 - s); } }
    ];
    function X(x) { return 40 + (x + 6) / 12 * (W - 60); }
    function Y(y) { return H / 2 - y / 2.2 * (H / 2 - 24); }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, H / 2); ctx.lineTo(W - 14, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40, 12); ctx.lineTo(40, H - 12); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "11.5px -apple-system";
      ctx.fillText("x", W - 22, H / 2 - 6);
      ctx.fillText(showDeriv ? "f′(x)" : "f(x)", 12, 20);
      fns.forEach(function (fn) {
        ctx.strokeStyle = fn.color; ctx.lineWidth = 2.2; ctx.beginPath();
        for (var i = 0; i <= 260; i++) {
          var x = -6 + 12 * i / 260;
          var v = showDeriv ? fn.d(x) : fn.f(x);
          var px = X(x), py = Y(v);
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
        var vx = showDeriv ? fn.d(xv) : fn.f(xv);
        ctx.fillStyle = fn.color;
        ctx.beginPath(); ctx.arc(X(xv), Y(vx), 5, 0, 7); ctx.fill();
      });
      // legend
      var lx = W - 110, ly = 20;
      fns.forEach(function (fn, i) {
        ctx.fillStyle = fn.color; ctx.fillRect(lx, ly + i * 17 - 8, 10, 3);
        ctx.fillStyle = "#5b6472"; ctx.font = "11.5px -apple-system";
        ctx.fillText(fn.name, lx + 16, ly + i * 17 - 4);
      });
      ctx.fillStyle = "#2f6fed";
      ctx.fillText("x = " + LC.fmt(xv, 1), X(xv) + 8, H - 14);
    }
    function update() {
      draw();
      var lines = fns.map(function (fn) {
        return fn.name.padEnd(9) + " f(" + LC.fmt(xv, 1) + ") = " + LC.fmt(fn.f(xv), 3) + "   f′(" + LC.fmt(xv, 1) + ") = " + LC.fmt(fn.d(xv), 3);
      }).join("\n");
      out.textContent = lines + "\n\n观察：Sigmoid 导数最大只有 0.25（梯度消失的根源）；ReLU 正区间导数恒为 1；SiLU 平滑且非单调。";
    }
    var s = slider("输入 x", -6, 6, 0.1, xv, function (v) { xv = v; update(); });
    var toggle = button("切换到导数 f′(x)", function () {
      showDeriv = !showDeriv;
      toggle.textContent = showDeriv ? "切换到函数 f(x)" : "切换到导数 f′(x)";
      update();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [s.el, toggle]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };
})();
