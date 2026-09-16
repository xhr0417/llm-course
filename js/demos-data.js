/* ============================================================
   LC — 交互演示 (Pretraining Data Engineering)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, button = LC.button;

  /* ============================================================
     1. 数据管线逐步走
     ============================================================ */
  LC.demos["data-pipeline"] = function (root) {
    var stages = [
      { name: "Raw Web", in: "&lt;html&gt;&lt;nav&gt;首页 关于 联系&lt;/nav&gt;&lt;article&gt;深度学习是……&lt;/article&gt;&lt;footer&gt;© 2026&lt;/footer&gt;&lt;script&gt;...&lt;/script&gt;&lt;/html&gt;", out: "深度学习是……", note: "HTML extraction：只保留正文块，丢掉导航/页脚/脚本。" },
      { name: "Normalization", in: "“深度  学习”是…… （全角引号，双空格）", out: "\"深度 学习\"是…… （统一空白/引号/换行）", note: "统一 Unicode/空白/换行；但代码与数学要按域保留格式。" },
      { name: "Language ID", in: "URL: example.cn 正文：This is an English article...", out: "language = en（不是按域名判断！）", note: "来源 ≠ 语言；文档级分类器判定。" },
      { name: "Quality Filter", in: "点击 领取 优惠 点击 领取 优惠 点击 领取……（重复行）", out: "丢弃（重复率超阈值）", note: "启发式/分类器/PPL；过滤过猛会丢论坛/代码/小语种。" },
      { name: "Exact Dedup", in: "doc#42 与 doc#7 内容完全相同（仅空白差异）", out: "保留 1 份", note: "轻度归一 + SHA-256 哈希去重。" },
      { name: "Near Dedup", in: "doc#91 = doc#12 + 页脚广告（99% 相同）", out: "判定近似重复 → 丢弃", note: "shingles → MinHash → LSH → 阈值判定。" },
      { name: "Benchmark 去污染", in: "文档包含 MMLU 原题与答案", out: "移除该文档", note: "训练集 vs 评测集匹配（同一套 normalize）。" },
      { name: "PII", in: "联系邮箱 a@b.com，电话 138-xxxx-xxxx", out: "邮箱/电话被移除或遮蔽", note: "正则 + 规则 + NER。" },
      { name: "Mixture", in: "（各领域 token 池）", out: "Web 60% / Code 15% / Books 10% / …", note: "配比决定最终能力分布。" },
      { name: "Tokenization", in: "深度学习是……", out: "[2481, 667, 102, …]（token ids）", note: "tokenizer 训一次、冻结、全局一致。" },
      { name: "Boundary + Packing", in: "doc A（5 token）+ doc B（8 token）+ …", out: "定长序列 [doc A + EOS + doc B + EOS + pad]", note: "EOS 标记边界；打包提高利用率（43.75% → 87.5%）。" },
      { name: "Shard + Stream", in: "（全部 token 流）", out: "shard-00000.bin / shard-00001.bin + manifest.json → DataLoader 流式读取", note: "分片 + 校验 + 按需 prefetch 到 GPU。" }
    ];
    var step = 0;
    var view = h("div"), out = LC.readout();

    function render() {
      view.innerHTML = "";
      view.appendChild(LC.panel("当前站点：" + stages[step].name, [
        h("div", { class: "stat-line", html: "<b>输入：</b>" + stages[step].in }),
        h("div", { class: "stat-line", html: "<b>输出：</b>" + stages[step].out }),
        h("div", { class: "stat-line", html: "💡 " + stages[step].note })
      ]));
      var flow = h("div", { class: "demo-chips" });
      stages.forEach(function (s, i) {
        flow.appendChild(h("span", {
          class: "chip" + (i === step ? " on" : ""),
          text: s.name,
          style: i < step ? "opacity:.55" : ""
        }));
      });
      view.appendChild(flow);
      out.textContent = "第 " + (step + 1) + " / " + stages.length + " 站：" + stages[step].name +
        "\n（样例为教学示意，展示每一步「进来什么、出去什么」，非真实抓取数据）";
    }
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("← 上一站", function () { if (step > 0) { step--; render(); } }),
      button("下一站 →", function () { if (step < stages.length - 1) { step++; render(); } }, "primary"),
      button("重置", function () { step = 0; render(); })
    ]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     2. Exact Dedup
     ============================================================ */
  LC.demos["exact-dedup"] = function (root) {
    var DOCS = [
      "深度学习是机器学习的一个分支。",
      "深度学习是机器学习的一个分支。",          // 完全相同
      "深度学习是机器学习的一个分支",             // 差一个句号（严格哈希不同）
      "Transformer 使用自注意力机制。",
      "Transformer 使用自注意力机制。",           // 完全相同
      "BERT 是 Encoder-only 模型。",
      "GPT 是 Decoder-only 模型。",
      "GPT 是 Decoder-only 模型。",               // 完全相同
      "RNN 存在长程依赖问题。",
      "RNN 存在长程依赖问题"                      // 差句号
    ];
    var useDedup = true;
    var view = h("div"), out = LC.readout();

    function hash8(s) {
      // 教学用简单哈希（真实场景用 SHA-256）
      var hv = 2166136261;
      for (var i = 0; i < s.length; i++) { hv ^= s.charCodeAt(i); hv = Math.imul(hv, 16777619); }
      return ("00000000" + (hv >>> 0).toString(16)).slice(-8);
    }
    function render() {
      view.innerHTML = "";
      var seen = {};
      var kept = 0, dup = 0;
      var table = h("table", { class: "mat", style: "border-spacing:2px" });
      DOCS.forEach(function (d, i) {
        var hv = hash8(d);
        var isDup = !!seen[hv] && useDedup;
        if (seen[hv]) dup++; else kept++;
        seen[hv] = true;
        var tr = h("tr");
        tr.appendChild(h("td", { style: "width:34px;font-size:11px", text: "#" + i }));
        tr.appendChild(h("td", { style: "width:74px;font-size:10.5px;font-family:monospace", text: hv }));
        tr.appendChild(h("td", { style: "font-size:11.5px;text-align:left;padding:3px 8px;" + (isDup ? "background:var(--red-soft);border-color:var(--red);color:var(--red)" : "background:var(--green-soft);border-color:var(--green)"), text: d.slice(0, 22) + (d.length > 22 ? "…" : "") }));
        tr.appendChild(h("td", { style: "width:56px;font-size:10.5px", text: isDup ? "重复→丢弃" : "保留" }));
        table.appendChild(tr);
      });
      view.appendChild(table);
      out.textContent =
        "10 篇文档 → 哈希桶 " + Object.keys(seen).length + " 个\n" +
        "开启去重：保留 " + (useDedup ? kept : 10) + " 篇" + (useDedup ? "，丢弃 " + dup + " 篇完全相同文档" : "（未去重）") + "\n\n" +
        "注意：#2 与 #0 只差一个句号、#9 与 #8 只差一个句号——严格哈希把它们视为不同文档。\n" +
        "这类「近似但不同」要靠 MinHash 近似去重（见下一个演示）。";
    }
    var toggle = button("切换：开启去重 / 关闭去重", function () {
      useDedup = !useDedup;
      toggle.textContent = useDedup ? "当前：开启去重（点击关闭）" : "当前：关闭去重（点击开启）";
      render();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [toggle]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     3. MinHash + LSH 实验台
     ============================================================ */
  LC.demos["minhash-lab"] = function (root) {
    var textA = "深度学习是机器学习的一个分支，它使用多层神经网络。transformer 使用自注意力机制处理序列。";
    var textB = "深度学习是机器学习的一个分支，它使用多层神经网络。transformer 使用自注意力机制处理序列。本文由某某网站转载。";
    var k = 4;          // shingle 大小（字符 k-gram）
    var threshold = 0.7;
    var NUM_PERM = 64;
    var view = h("div"), out = LC.readout();

    function shingles(text) {
      var t = text.replace(/\s+/g, " ").trim();
      var set = new Set();
      for (var i = 0; i + k <= t.length; i++) set.add(t.slice(i, i + k));
      return set;
    }
    function jaccard(A, B) {
      var inter = 0;
      A.forEach(function (x) { if (B.has(x)) inter++; });
      var union = A.size + B.size - inter;
      return union ? inter / union : 0;
    }
    function strHash(s) {
      var hv = 2166136261;
      for (var i = 0; i < s.length; i++) { hv ^= s.charCodeAt(i); hv = Math.imul(hv, 16777619); }
      return hv >>> 0;
    }
    function minhashSig(set) {
      var sig = new Array(NUM_PERM);
      for (var i = 0; i < NUM_PERM; i++) sig[i] = Infinity;
      set.forEach(function (x) {
        var base = strHash(x);
        for (var i = 0; i < NUM_PERM; i++) {
          // 教学用哈希族：h_i(x) = (a_i * base + b_i) mod p
          var hv = (Math.imul(i + 1, base) + i * 2654435761) >>> 0;
          if (hv < sig[i]) sig[i] = hv;
        }
      });
      return sig;
    }
    function render() {
      var A = shingles(textA), B = shingles(textB);
      var J = jaccard(A, B);
      var sA = minhashSig(A), sB = minhashSig(B);
      var eq = 0;
      for (var i = 0; i < NUM_PERM; i++) if (sA[i] === sB[i]) eq++;
      var mh = eq / NUM_PERM;
      // LSH：16 bands × 4 rows
      var bands = 16, rows = 4, bandHit = -1;
      for (var b = 0; b < bands; b++) {
        var same = true;
        for (var r = 0; r < rows; r++) {
          if (sA[b * rows + r] !== sB[b * rows + r]) { same = false; break; }
        }
        if (same) { bandHit = b; break; }
      }
      var decision = mh >= threshold;

      view.innerHTML = "";
      view.appendChild(LC.panel("结果", [
        h("div", { class: "stat-line", html: "shingle 数：A = <b>" + A.size + "</b>，B = <b>" + B.size + "</b>（字符 " + k + "-gram）" }),
        h("div", { class: "stat-line", html: "精确 Jaccard 相似度：<b>" + J.toFixed(4) + "</b>" }),
        h("div", { class: "stat-line", html: "MinHash 估计（" + NUM_PERM + " 个哈希）：<b>" + mh.toFixed(4) + "</b>（估计误差随哈希数减少而增大）" }),
        h("div", { class: "stat-line", html: "LSH 分桶（16 band × 4 row）：<b>" + (bandHit >= 0 ? "命中 band " + bandHit + " → 候选对" : "未命中 → 跳过比较") + "</b>" }),
        h("div", { class: "stat-line", html: "去重判定（阈值 " + threshold + "）：<b style='color:" + (decision ? "var(--red)" : "var(--green)") + "'>" + (decision ? "判定为近似重复 → 丢弃 B" : "不是重复 → 都保留") + "</b>" })
      ]));
      out.textContent =
        "编辑上面两段文本，调 shingle 大小与阈值，观察四个数字如何变化。\n\n" +
        "流程回顾：shingles → Jaccard → MinHash（估计）→ LSH（找候选）→ 阈值判定。\n" +
        "注意：MinHash 是对 Jaccard 的统计估计（本例 " + mh.toFixed(3) + " vs 精确 " + J.toFixed(3) + "）；真实系统用 128~256 个哈希以降低方差，并用 LSH 避免 O(n²) 两两比较。";
    }
    var ta = h("textarea", { style: "width:100%;height:64px;font-size:12.5px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit" });
    ta.value = textA;
    ta.addEventListener("input", function () { textA = ta.value; render(); });
    var tb = h("textarea", { style: "width:100%;height:64px;font-size:12.5px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit" });
    tb.value = textB;
    tb.addEventListener("input", function () { textB = tb.value; render(); });
    var kS = LC.slider("shingle 大小 k", 2, 8, 1, k, function (v) { k = Math.round(v); render(); });
    var tS = LC.slider("去重阈值", 0.3, 0.95, 0.05, threshold, function (v) { threshold = v; render(); });
    root.appendChild(h("div", { class: "demo-grid2" }, [
      h("div", {}, [h("div", { class: "demo-sub", text: "文档 A：" }), ta]),
      h("div", {}, [h("div", { class: "demo-sub", text: "文档 B：" }), tb])
    ]));
    root.appendChild(h("div", { class: "demo-controls" }, [kS.el, tS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     4. Mixture 配比计算器
     ============================================================ */
  LC.demos["mixture-calculator"] = function (root) {
    var DOMAINS = [
      { name: "Web", pct: 60, quality: "通用语言/世界知识" },
      { name: "Code", pct: 15, quality: "代码/结构化推理" },
      { name: "Books", pct: 10, quality: "长文/叙事" },
      { name: "Wikipedia", pct: 5, quality: "事实密度" },
      { name: "Math", pct: 5, quality: "符号推理" },
      { name: "Other", pct: 5, quality: "论文/对话等" }
    ];
    var totalB = 2000; // 总 token（B）
    var view = h("div"), out = LC.readout();
    var sliders = [];

    function render() {
      var sum = DOMAINS.reduce(function (a, d) { return a + d.pct; }, 0);
      var items = DOMAINS.map(function (d) {
        var pct = sum > 0 ? d.pct / sum * 100 : 0;
        return { label: d.name + " " + pct.toFixed(0) + "%", value: pct, max: 100, text: (totalB * pct / 100).toFixed(0) + "B tok", color: d.name === "Web" ? "dim" : d.name === "Code" ? "green" : "amber" };
      });
      view.innerHTML = "";
      view.appendChild(LC.bars(items, { max: 100 }));
      out.textContent =
        "总预算 " + totalB + "B token（可在下方调）\n" +
        DOMAINS.map(function (d) {
          var pct = sum > 0 ? d.pct / sum * 100 : 0;
          return "· " + d.name.padEnd(10) + (totalB * pct / 100).toFixed(0).padStart(5) + "B  — " + d.quality;
        }).join("\n") +
        "\n\n比例和 = " + sum + "%" + (sum !== 100 ? "（每行按实际和归一化显示）" : "") +
        "\n\n⚠️ 这些百分比是「教学示意」，不是任何模型的真实配比；真实配比需要消融实验确定。";
    }
    var controls = h("div", { class: "demo-controls" });
    DOMAINS.forEach(function (d, i) {
      var s = LC.slider(d.name, 0, 100, 1, d.pct, function (v) { DOMAINS[i].pct = v; render(); });
      sliders.push(s);
      controls.appendChild(s.el);
    });
    var totalS = LC.slider("总预算（B token）", 100, 15000, 100, totalB, function (v) { totalB = v; render(); });
    var presets = h("div", { class: "demo-flex" }, [
      button("更重代码", function () {
        var p = [45, 30, 10, 5, 5, 5];
        DOMAINS.forEach(function (d, i) { d.pct = p[i]; sliders[i].set(p[i]); });
        render();
      }),
      button("更重网页", function () {
        var p = [75, 8, 8, 4, 2, 3];
        DOMAINS.forEach(function (d, i) { d.pct = p[i]; sliders[i].set(p[i]); });
        render();
      }),
      button("均衡", function () {
        var p = [60, 15, 10, 5, 5, 5];
        DOMAINS.forEach(function (d, i) { d.pct = p[i]; sliders[i].set(p[i]); });
        render();
      })
    ]);
    root.appendChild(controls);
    root.appendChild(h("div", { class: "demo-controls" }, [totalS.el]));
    root.appendChild(presets);
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     5. Packing：Naive Padding vs Packing
     ============================================================ */
  LC.demos["packing-demo"] = function (root) {
    var DOCS = [
      { name: "doc A", len: 5, color: "var(--accent)" },
      { name: "doc B", len: 8, color: "var(--purple)" },
      { name: "doc C", len: 3, color: "var(--green)" },
      { name: "doc D", len: 12, color: "var(--amber)" }
    ];
    var MAX_SEQ = 16;
    var mode = 0; // 0 naive, 1 packing
    var view = h("div"), out = LC.readout();

    function cell(color, isPad, isEos, w) {
      return h("span", {
        class: "chip ghost",
        text: isEos ? "EOS" : isPad ? "pad" : "",
        style: "min-width:" + (w * 17) + "px;height:20px;padding:0 3px;font-size:9.5px;background:" + (isPad ? "var(--bg-soft)" : color) + ";border-color:transparent;color:" + (isPad ? "var(--text-faint)" : "#fff") + ";opacity:" + (isPad ? ".7" : "1")
      });
    }
    function render() {
      view.innerHTML = "";
      var totalTokens = DOCS.reduce(function (a, d) { return a + d.len + 1; }, 0); // +1 EOS each
      if (mode === 0) {
        // naive：每篇单独成行，pad 到 MAX_SEQ
        var used = 0;
        DOCS.forEach(function (d) {
          var row = h("div", { class: "demo-flex", style: "gap:2px;margin:3px 0;align-items:center" });
          row.appendChild(h("span", { style: "width:52px;font-size:10.5px;color:var(--text-faint)", text: d.name + " (" + d.len + ")" }));
          for (var i = 0; i < d.len; i++) row.appendChild(cell(d.color, false, false, 1));
          row.appendChild(cell("", false, true, 1));               // EOS
          for (var j = d.len + 1; j < MAX_SEQ; j++) row.appendChild(cell("", true, false, 1));
          used += d.len + 1;
          view.appendChild(row);
        });
        var util = used / (DOCS.length * MAX_SEQ) * 100;
        view.appendChild(h("div", { class: "stat-line", html: "4 行 × 16 位置 = 64 个位置，有效 " + used + " → 利用率 <b>" + util.toFixed(1) + "%</b>" }));
        out.textContent = "Naive padding：每篇文档单独占用一行并补齐到 max_seq = 16。\n浅灰色 pad 位置不携带信息，但仍然占用 GPU 计算与显存。\n\n→ 切到 Packing 看另一种策略。";
      } else {
        // packing：贪心装箱
        var buckets = [], current = [], usedCur = 0;
        DOCS.forEach(function (d) {
          if (usedCur + d.len + 1 > MAX_SEQ) { buckets.push({ items: current, used: usedCur }); current = []; usedCur = 0; }
          current.push(d); usedCur += d.len + 1;
        });
        if (current.length) buckets.push({ items: current, used: usedCur });
        var used = 0;
        buckets.forEach(function (b, bi) {
          var row = h("div", { class: "demo-flex", style: "gap:2px;margin:3px 0;align-items:center" });
          row.appendChild(h("span", { style: "width:52px;font-size:10.5px;color:var(--text-faint)", text: "pack " + bi }));
          b.items.forEach(function (d, di) {
            for (var i = 0; i < d.len; i++) row.appendChild(cell(d.color, false, false, 1));
            row.appendChild(cell("", false, true, 1));
          });
          for (var j = b.used; j < MAX_SEQ; j++) row.appendChild(cell("", true, false, 1));
          used += b.used;
          view.appendChild(row);
        });
        var util2 = used / (buckets.length * MAX_SEQ) * 100;
        view.appendChild(h("div", { class: "stat-line", html: buckets.length + " 行 × 16 位置 = " + (buckets.length * MAX_SEQ) + " 个位置，有效 " + used + " → 利用率 <b>" + util2.toFixed(1) + "%</b>" }));
        out.textContent = "Packing：贪心把多篇文档塞进定长序列，每篇后跟 EOS 标记边界。\n利用率从 43.75% 提升到 " + util2.toFixed(1) + "%，同样的 GPU 步数能训练更多有效 token。\n\n代价：需要 EOS 标记（或 attention mask）告诉模型「这是两篇不同文档」，否则模型会学到假的跨文档关联。";
      }
      if (mode === 1) { /* nothing */ }
    }
    var toggle = button("切换：Naive Padding ⟷ Packing", function () {
      mode = 1 - mode;
      toggle.textContent = mode === 0 ? "当前：Naive Padding（点击切换）" : "当前：Packing（点击切换）";
      render();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [toggle]));
    root.appendChild(LC.panel("文档：doc A(5) / doc B(8) / doc C(3) / doc D(12)，max_seq = 16", [view]));
    root.appendChild(out);
    render();
  };

  /* ============================================================
     6. DataLoader 时间线：GPU 在等谁？
     ============================================================ */
  LC.demos["dataloader-timeline"] = function (root) {
    var dataMs = 30, computeMs = 50, NUM_STEPS = 6;
    var cv = LC.canvas(560, 200);
    var ctx = cv.getContext("2d");
    var out = LC.readout();

    function draw() {
      var W = 560, H = 200, padL = 60, padT = 14;
      ctx.clearRect(0, 0, W, H);
      var scale = (W - padL - 20) / (NUM_STEPS * (dataMs + computeMs));
      ctx.font = "11.5px -apple-system";
      ctx.fillStyle = "#8a93a3";
      ctx.fillText("GPU", 14, padT + 26);
      ctx.fillText("Data", 14, padT + 76);
      var t = padL;
      for (var s = 0; s < NUM_STEPS; s++) {
        // data 准备
        ctx.fillStyle = "#2f6fed";
        ctx.fillRect(t, padT + 60, dataMs * scale, 22);
        var dataEnd = t + dataMs * scale;
        // compute（如果数据还没好则 GPU 空等——教学简化模型）
        var computeStart = Math.max(dataEnd, t);
        ctx.fillStyle = "#17a673";
        ctx.fillRect(computeStart, padT + 10, computeMs * scale, 22);
        // 等待区（红色）
        if (dataMs > computeMs) {
          ctx.fillStyle = "#dc2626";
          ctx.fillRect(t, padT + 10, (dataMs - computeMs) * scale, 22);
        }
        t += Math.max(dataMs, computeMs) * scale;
      }
      ctx.fillStyle = "#5b6472";
      ctx.fillText("蓝=data 准备  " + dataMs + "ms   绿=GPU 计算  " + computeMs + "ms   红=GPU 空等", 200, H - 12);
    }
    function update() {
      draw();
      var cycle = Math.max(dataMs, computeMs);
      var util = Math.min(100, computeMs / cycle * 100);
      out.textContent =
        "每步：data 准备 " + dataMs + "ms，GPU 计算 " + computeMs + "ms\n" +
        "GPU 利用率（教学模型）≈ " + util.toFixed(0) + "%" +
        (dataMs > computeMs ? "　← 瓶颈在【数据管线】：GPU 在红色区间空等" : "　← 数据跟得上计算") + "\n\n" +
        "关键结论：GPU 利用率低不一定是模型问题。\n" +
        "优化方向：num_workers ↑、prefetch_factor ↑、pin_memory、数据预解码/打包、把重活（tokenize/去重）离线做完。\n\n" +
        "（这是教学模拟：真实系统还有流水线重叠、多 worker 并行、IO 抖动等因素。）";
    }
    var dS = LC.slider("data 准备时间（ms）", 5, 100, 5, dataMs, function (v) { dataMs = v; update(); });
    var cS = LC.slider("GPU 计算时间（ms）", 5, 100, 5, computeMs, function (v) { computeMs = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [dS.el, cS.el]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };
})();
