/* ============================================================
   LC — 交互演示 (FlashAttention / Triton / Kernel)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, button = LC.button;

  /* ============================================================
     1. 数据搬运对比：标准 vs 分块融合
     ============================================================ */
  LC.demos["attention-io"] = function (root) {
    var S = 512;   // 序列长度
    var d = 64;    // head 维度
    var view = h("div"), out = LC.readout();

    function render() {
      var bytes = 2; // fp16
      var sMatrixMB = S * S * bytes / 1e6;
      var qkvMB = 3 * S * d * bytes / 1e6;
      // 教学量级估算（不追求精确系数）：
      // 标准：S 写1次+softmax读1写1+PV读1 → 约 4 次 S×S 搬运
      var stdTraffic = 4 * sMatrixMB;
      // 分块：中间不落 HBM；只算 Q/K/V 读 + 输出写（按 tile 载入，K/V 被复用次数忽略）
      var flashTraffic = qkvMB + S * d * bytes / 1e6;
      view.innerHTML = "";
      view.appendChild(LC.bars([
        { label: "标准：S×S 往返搬运", value: stdTraffic, max: Math.max(stdTraffic, flashTraffic), text: stdTraffic.toFixed(0) + " MB", color: "red" },
        { label: "分块：只搬 Q/K/V+输出", value: flashTraffic, max: Math.max(stdTraffic, flashTraffic), text: flashTraffic.toFixed(1) + " MB", color: "green" }
      ], { max: Math.max(stdTraffic, flashTraffic) }));
      out.textContent =
        "S = " + S + "，d = " + d + "，FP16\n\n" +
        "S×S 中间矩阵大小 = " + S + "² × 2B = " + sMatrixMB.toFixed(1) + " MB\n" +
        "标准实现把它在 HBM 中写/读约 4 趟 → ≈ " + stdTraffic.toFixed(0) + " MB 搬运\n" +
        "分块融合：中间结果留在 SRAM，只搬 Q/K/V 与输出 → ≈ " + flashTraffic.toFixed(1) + " MB（量级）\n\n" +
        "⚠️ 教学量级估算（忽略了 K/V tile 的重复载入、attention 内部细节与硬件差异），用于说明「瓶颈在搬运量」；不是精确 benchmark。\n" +
        "把 S 调大：S×S 项按平方增长，差距急剧拉大——这就是长上下文下 FlashAttention 收益变大的原因。";
    }
    var sS = LC.slider("序列长度 S", 128, 4096, 128, S, function (v) { S = Math.round(v); render(); });
    var dS = LC.slider("head 维度 d", 32, 128, 16, d, function (v) { d = Math.round(v); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [sS.el, dS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     2. Tiling：一块一块算 Attention
     ============================================================ */
  LC.demos["tiling"] = function (root) {
    var SIZE = 8;          // 8×8 scores
    var TILE = 4;          // 4×4 tile
    var qTiles = SIZE / TILE, kTiles = SIZE / TILE;
    var step = 0;
    var totalSteps = qTiles * kTiles; // 4 步
    var view = h("div"), out = LC.readout();

    function render() {
      var qIdx = Math.floor(step / kTiles);
      var kIdx = step % kTiles;
      view.innerHTML = "";
      // 可视化：两个矩阵（Q行块 × K列块）与输出
      var grid = h("div", { class: "demo-flex", style: "gap:18px;justify-content:center;flex-wrap:wrap" });

      function mat(label, highlighted, sub) {
        var g = h("div", { class: "mat-group" });
        g.appendChild(h("div", { class: "mat-label", text: label }));
        var t = h("table", { class: "mat" });
        for (var r = 0; r < SIZE; r++) {
          var tr = h("tr");
          for (var c = 0; c < SIZE; c++) {
            var inQ = Math.floor(r / TILE) === qIdx;
            var inK = Math.floor(c / TILE) === kIdx;
            var hot = (sub === "q" && inQ) || (sub === "k" && inK) || (sub === "o" && inQ && c < (kIdx + 1) * TILE);
            tr.appendChild(h("td", {
              text: hot ? "●" : "",
              style: hot ? "background:var(--accent-soft);border-color:var(--accent);color:var(--accent-text)" : ""
            }));
          }
          t.appendChild(tr);
        }
        g.appendChild(t);
        return g;
      }
      grid.appendChild(mat("Q 的行块（当前 tile）", true, "q"));
      grid.appendChild(mat("K/V 的列块（当前 tile）", true, "k"));
      grid.appendChild(mat("输出累积（已处理区域）", true, "o"));
      view.appendChild(grid);
      view.appendChild(h("div", { class: "stat-line", html: "当前：Q_tile " + qIdx + " × K/V_tile " + kIdx + "（第 " + (step + 1) + "/" + totalSteps + " 步）" }));

      out.textContent =
        step === 0
          ? "开始：把 Q 分成行块、K/V 分成列块。\n每一步只把【一个 Q 块 + 一个 K/V 块】载入 SRAM：算局部 scores → 更新 running max/分母 → 累积到输出。\n中间 scores 从不写入 HBM。"
          : "已处理 " + (step + 1) + " 个 (Q_tile, K_tile) 组合。\n注意：输出按行块累积——同一 Q 块会与所有 K/V 块依次相乘（K/V 被多个 Q 块复用，非常适合 SRAM 缓存）。\n\n" +
            (step + 1 === totalSteps ? "✅ 全部完成：整个过程只把 Q/K/V 读进来、把输出写出去，S×S 矩阵从未落 HBM。" : "继续点「下一步」看当前 Q 块与下一个 K/V 块的计算。");
    }
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("下一步 ▶", function () { step = (step + 1) % totalSteps; render(); }, "primary"),
      button("重置", function () { step = 0; render(); })
    ]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     3. Online Softmax：分块算，结果精确一致
     ============================================================ */
  LC.demos["online-softmax"] = function (root) {
    var scores = [1, 2, 3, 4];
    var step = 0; // 0 初始 / 1 块1 / 2 块2 / 3 对比
    var view = h("div"), out = LC.readout();

    function fmtArr(a, f) { return "[" + a.map(function (v) { return (f ? v.toFixed(f) : v); }).join(", ") + "]"; }
    function standardSoftmax(x) {
      var m = Math.max.apply(null, x);
      var e = x.map(function (v) { return Math.exp(v - m); });
      var s = e.reduce(function (a, b) { return a + b; }, 0);
      return { m: m, l: s, w: e.map(function (v) { return v / s; }) };
    }
    function render() {
      view.innerHTML = "";
      var std = standardSoftmax(scores);
      var rows = [];
      if (step >= 1) {
        var b1 = scores.slice(0, 2);
        var m1 = Math.max.apply(null, b1);
        var l1 = b1.reduce(function (a, v) { return a + Math.exp(v - m1); }, 0);
        rows.push({ name: "块 1 = [1,2]", m: m1, l: l1, note: "局部 max / 分母" });
      }
      if (step >= 2) {
        var b2 = scores.slice(2);
        var mNew = Math.max(1, 2, 3, 4); // = 4
        var alpha = Math.exp(2 - mNew);
        var l1c = 1.3679 * alpha;
        var l2 = Math.exp(3 - mNew) + Math.exp(4 - mNew);
        rows.push({ name: "块 2 = [3,4]", m: mNew, l: l1c + l2, note: "旧 ℓ 修正 " + alpha.toFixed(4) + " 倍后加上新块" });
      }
      var body = h("div");
      rows.forEach(function (r) {
        body.appendChild(h("div", { class: "stat-line", html: "<b>" + r.name + "</b>：m = " + r.m + "，ℓ = " + r.l.toFixed(4) + "　（" + r.note + "）" }));
      });
      if (step >= 3) {
        var w = scores.map(function (v) { return Math.exp(v - 4) / 1.5530; });
        body.appendChild(h("div", { class: "stat-line", html: "分块结果权重 = <b>" + fmtArr(w, 4) + "</b>" }));
        body.appendChild(h("div", { class: "stat-line", html: "标准 softmax   = <b>" + fmtArr(std.w, 4) + "</b>" }));
        var ok = w.every(function (v, i) { return Math.abs(v - std.w[i]) < 1e-4; });
        body.appendChild(h("div", { class: "stat-line", html: ok ? "✅ 两者一致（分块是精确的，不是近似）" : "存在差异" }));
      }
      view.appendChild(LC.panel("running 统计（scores = [1,2,3,4]，两块各 2 个）", [body]));

      out.textContent =
        step === 0 ? "从这里开始：先看标准 softmax 一次算的结果。点「下一步」进入分块计算。"
        : step === 1 ? "只看块 1 时：m=2、ℓ=1.3679——但还不知道后面有更大的分数。"
        : step === 2 ? "看到块 2 后：新 max=4。旧的 ℓ 要乘修正因子 e^(2−4)=0.1353 再累加新块的贡献——这一步是 online softmax 的核心。"
        : "最终权重与标准 softmax 逐位一致 ✅\n\n结论：分块 + running max/denom 可以在【不保存完整分数矩阵】的前提下，得到精确的 softmax 结果。";
    }
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("下一步 ▶", function () { step = (step + 1) % 4; render(); }, "primary"),
      button("重置", function () { step = 0; render(); })
    ]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     4. Triton：program / block / mask 视图
     ============================================================ */
  LC.demos["triton-block"] = function (root) {
    var N = 10000000, BLOCK = 1024, showN = 40;
    var view = h("div"), out = LC.readout();

    function render() {
      var grid = Math.ceil(N / BLOCK);
      var lastBlockFill = N % BLOCK === 0 ? BLOCK : N % BLOCK;
      view.innerHTML = "";
      // 可视化前 showN 个元素如何分配给 program（用 showN 模拟）
      var visN = 24, visBlock = 8;
      var rows = h("div");
      var numPrograms = Math.ceil(visN / visBlock);
      for (var p = 0; p < numPrograms; p++) {
        var row = h("div", { class: "demo-flex", style: "gap:2px;margin:3px 0;align-items:center" });
        row.appendChild(h("span", { style: "width:84px;font-size:10.5px;color:var(--text-faint)", text: "program " + p }));
        for (var i = 0; i < visBlock; i++) {
          var idx = p * visBlock + i;
          var inRange = idx < visN;
          row.appendChild(h("span", {
            class: "chip ghost",
            text: String(idx),
            style: "min-width:26px;text-align:center;padding:2px 4px;font-size:10px;" + (inRange ? "background:var(--accent-soft);border-color:var(--accent);color:var(--accent-text)" : "background:var(--bg-soft);color:var(--text-faint);text-decoration:line-through")
          }));
        }
        rows.appendChild(row);
      }
      view.appendChild(LC.panel("示意：N（截取前 " + visN + " 个元素）→ 每 " + visBlock + " 个交给一个 program", [rows]));
      view.appendChild(LC.panel("映射到实际规模", [
        h("div", { class: "stat-line", html: "N = " + N.toLocaleString() + "，BLOCK_SIZE = " + BLOCK }),
        h("div", { class: "stat-line", html: "grid = ⌈N / BLOCK_SIZE⌉ = <b>" + grid.toLocaleString() + "</b> 个 program" }),
        h("div", { class: "stat-line", html: "最后一个 program：有效元素 " + lastBlockFill + " 个" + (lastBlockFill < BLOCK ? "（其余 " + (BLOCK - lastBlockFill) + " 个被 mask 掉）" : "（刚好装满）") })
      ]));
      out.textContent =
        "Triton 的心智模型：\n" +
        "1. 你把数据切成「数量固定大小的块」；\n" +
        "2. 每个 program（块）负责一块：算 offsets → load → 计算 → store；\n" +
        "3. 最后一块不满时用 mask 跳过越界元素——mask 保证正确性，不需要 padding。\n\n" +
        "对比 CUDA：不需要手写线程索引/共享内存管理；对比 PyTorch：你能自由融合算子、控制数据搬运。\n" +
        "（本演示是教学视图；真实执行由 triton 编译器把 kernel 编译到 GPU。）";
    }
    var nS = LC.slider("N（万元素）", 1, 2000, 1, N / 10000, function (v) { N = Math.round(v) * 10000; render(); });
    var bS = LC.slider("BLOCK_SIZE", 128, 8192, 128, BLOCK, function (v) { BLOCK = Math.round(v); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [nS.el, bS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
