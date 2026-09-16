/* ============================================================
   LC — 交互演示 (LLM Inference Systems)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, button = LC.button;

  /* ============================================================
     1. Serving Pipeline
     ============================================================ */
  LC.demos["serving-pipeline"] = function (root) {
    var stages = [
      { name: "Request", desc: "用户请求到达（HTTP/API）。此时还没有任何计算。" },
      { name: "Tokenizer", desc: "文本 → token ids。注意：这一步也可能成为瓶颈（大 prompt 时）。" },
      { name: "Scheduler", desc: "排队 + 组批 + 分配 KV 空间。Continuous batching 在这里发生：谁进批、谁出批。" },
      { name: "Prefill", desc: "对完整 prompt 做一次大矩阵计算，产出第一个 token 的 logits 与全部 KV。TTFT 主要在这里。" },
      { name: "KV Cache", desc: "每层的 K/V 常驻显存，被后续每一步 decode 读取。显存管理是 serving 的核心资源问题。" },
      { name: "Decode", desc: "循环：读 KV → 算 1 个 token → 采样 → 拼回序列。ITL 由这一步决定（带宽受限）。" },
      { name: "Sampler", desc: "temperature / top-p 等采样策略，从 logits 选出 token。" },
      { name: "Response", desc: "detokenize 后流式返回；同时调度器把完成的请求移出批。" }
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
      out.textContent = "点击任意阶段查看说明。整条流水线要同时服务成千上万个请求——这正是 serving system 存在的意义。";
    }
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     2. Prefill vs Decode
     ============================================================ */
  LC.demos["prefill-decode"] = function (root) {
    var promptLen = 512, mode = 0; // 0 prefill 1 decode
    var gen = 0;                    // 已生成的 token 数（0 = 尚未开始 decode）
    var view = h("div"), out = LC.readout();

    function render() {             // ← 纯渲染：不修改任何 state
      view.innerHTML = "";
      if (mode === 0) {
        view.appendChild(LC.panel("Prefill（一次处理整个 prompt）", [
          h("div", { class: "stat-line", html: "输入形状：<b>[1, " + promptLen + ", d]</b> → 大矩阵乘：<b>[" + promptLen + ", d] × [d, ·]</b>" }),
          h("div", { class: "stat-line", html: "并行度：<b>高</b>（" + promptLen + " 个位置同时计算）" }),
          h("div", { class: "stat-line", html: "瓶颈：对长 prompt 通常更接近 <b>compute-bound</b>（取决于 shape/batch/kernel/硬件）" }),
          h("div", { class: "stat-line", html: "产出：<b>最后一个 prompt 位置的 logits</b>（直接用于采样【第一个生成 token】）+ 全部 " + promptLen + " 个位置的 KV" }),
          h("div", { class: "stat-line", html: "对应指标：<b>TTFT</b>（不需要额外跑一次 decode 才拿到第一个 token）" })
        ]));
      } else {
        view.appendChild(LC.panel("Decode（每次生成 1 个 token；这里共已生成 " + gen + " 个）", [
          h("div", { class: "stat-line", html: "本次输入：<b>上一个 token</b>（第 1 次 decode 的输入 = prefill 采样出的第一个 token）" }),
          h("div", { class: "stat-line", html: "注意力：新 token 的 Q 与全部 " + (promptLen + gen) + " 个历史 K 计算（KV 从缓存读取）" }),
          h("div", { class: "stat-line", html: "并行度：<b>低</b>（同一序列必须串行；只有 batch 维能并行）" }),
          h("div", { class: "stat-line", html: "瓶颈：常见 LLM decode <b>往往受</b>权重/KV 读取与内存带宽影响显著（随 batch/并行/kernel 变化）" }),
          h("div", { class: "stat-line", html: "对应指标：<b>ITL / TPOT</b>" })
        ]));
      }
      out.textContent = mode === 0
        ? "Prefill：序列长、矩阵大、一次算完；产出第一个生成 token 的 logits 与全部 KV。"
        : "Decode 已生成 " + gen + " 个 token。注意：「生成一个 token」= 1 次前向（输入上一个 token），且要读取全部历史 KV——这就是 decode 常受带宽影响的原因。\n\n自检：重置 → 点两次「Decode 下一步」→ 这里应显示 1 → 2（不会跳号）。";
    }

    var toggle = button("切换到 Decode →", function () {
      mode = 1 - mode;
      gen = 0;                                     // state 只在 handler 里改
      toggle.textContent = mode === 0 ? "切换到 Decode →" : "← 切回 Prefill";
      render();
    });
    var nextBtn = button("Decode 下一步", function () {
      mode = 1;
      toggle.textContent = "← 切回 Prefill";
      gen += 1;                                    // state 只在 handler 里改
      render();
    });
    var resetBtn = button("重置", function () { mode = 0; gen = 0; toggle.textContent = "切换到 Decode →"; render(); });
    var pS = LC.slider("prompt 长度", 64, 4096, 64, promptLen, function (v) { promptLen = Math.round(v); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [toggle, nextBtn, resetBtn, pS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     3. Static vs Continuous Batching
     ============================================================ */
  LC.demos["batching-viz"] = function (root) {
    var REQS = [
      { name: "A", len: 10 }, { name: "B", len: 100 }, { name: "C", len: 30 }, { name: "D", len: 40 }
    ];
    var mode = 0; // 0 static, 1 continuous
    var t = 0, timer = null;
    var view = h("div"), out = LC.readout();

    function render() {
      view.innerHTML = "";
      var grid = h("div");
      if (mode === 0) {
        // static：A/B/C 一批（D 等待），直到 B(100) 结束
        var rows = [["A", 10, 0], ["B", 100, 0], ["C", 30, 0]];
        rows.forEach(function (r) {
          var done = t >= r[1];
          var row = h("div", { class: "demo-flex", style: "gap:2px;margin:3px 0;align-items:center" });
          row.appendChild(h("span", { style: "width:70px;font-size:11px;color:var(--text-faint)", text: "Req " + r[0] + "(" + r[1] + ")" }));
          for (var i = 0; i < 100; i += 4) {
            var active = i < Math.min(t, r[1]);
            var finished = i < r[1] && i + 4 > r[1];
            row.appendChild(h("span", { style: "display:inline-block;width:5px;height:14px;border-radius:2px;background:" + (active ? (finished || i >= r[1] ? "var(--green)" : "var(--accent)") : "var(--bg-soft)") }));
          }
          row.appendChild(h("span", { style: "font-size:10.5px;color:" + (done ? "var(--green)" : "var(--text-faint)"), text: done ? "完成但槽位占用中" : "生成中" }));
          grid.appendChild(row);
        });
        var rowD = h("div", { class: "demo-flex", style: "gap:2px;margin:3px 0;align-items:center" });
        rowD.appendChild(h("span", { style: "width:70px;font-size:11px;color:var(--text-faint)", text: "Req D(40)" }));
        rowD.appendChild(h("span", { style: "font-size:10.5px;color:var(--amber)", text: "排队等待：要等整批（最长的 B=100）结束才能开始" }));
        grid.appendChild(rowD);
      } else {
        // continuous：A 完成 → D 立即进入
        var slots = [
          { name: "A", len: 10, start: 0 },
          { name: "B", len: 100, start: 0 },
          { name: "C", len: 30, start: 0 },
          { name: "D", len: 40, start: 10 }   // A 完成后立即进入
        ];
        slots.forEach(function (r) {
          var row = h("div", { class: "demo-flex", style: "gap:2px;margin:3px 0;align-items:center" });
          row.appendChild(h("span", { style: "width:70px;font-size:11px;color:var(--text-faint)", text: "Req " + r.name + "(" + r.len + ")" }));
          for (var i = 0; i < 100; i += 4) {
            var started = r.start <= i;
            var active = started && (i - r.start) < r.len;
            row.appendChild(h("span", { style: "display:inline-block;width:5px;height:14px;border-radius:2px;background:" + (active ? "var(--accent)" : "var(--bg-soft)") }));
          }
          row.appendChild(h("span", { style: "font-size:10.5px;color:var(--text-faint)", text: r.name === "D" ? "等待 A 完成后进入（第 10 步）" : "" }));
          grid.appendChild(row);
        });
      }
      view.appendChild(grid);
      out.textContent = mode === 0
        ? "Static batching：A(10) 和 C(30) 早就生成完了，但整批要等最长的 B(100) 才能结束——A/C 的槽位空转，D 一直排队。\n\n时间步：" + t + " / 100"
        : "Continuous batching：A 在第 10 步完成，D 立即进入它的槽位——槽位几乎不空转。\n\n时间步：" + t + " / 100\n\n这就是吞吐差距的来源（教学示意）。";
    }
    function play() {
      if (timer) { clearInterval(timer); timer = null; btn.textContent = "▶ 播放"; return; }
      btn.textContent = "⏸ 暂停";
      timer = setInterval(function () {
        t += 4;
        if (t > 100) { t = 0; }
        render();
      }, 120);
    }
    var btn = button("▶ 播放", play, "primary");
    var toggle = button("切换：Static ⟷ Continuous", function () {
      mode = 1 - mode; t = 0;
      toggle.textContent = mode === 0 ? "当前：Static batching（点击切换）" : "当前：Continuous batching（点击切换）";
      render();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [toggle, btn, button("重置", function () { t = 0; render(); })]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     4. PagedAttention：碎片 vs 分页
     ============================================================ */
  LC.demos["paged-attention"] = function (root) {
    var mode = 0; // 0 连续分配 1 分页
    var view = h("div"), out = LC.readout();
    function render() {
      view.innerHTML = "";
      if (mode === 0) {
        // 连续分配：请求 A(0.8G) B(0.3G) C(1.2G) 结束后留下空洞
        var blocks = [
          { label: "A 0.8GB", color: "var(--accent)", used: true },
          { label: "空洞", color: "transparent", used: false },
          { label: "B 0.3GB", color: "var(--purple)", used: true },
          { label: "空洞", color: "transparent", used: false },
          { label: "C 1.2GB", color: "var(--amber)", used: true },
          { label: "空洞", color: "transparent", used: false }
        ];
        var row = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
        blocks.forEach(function (b) {
          row.appendChild(h("span", { class: "chip ghost", text: b.label, style: "min-width:86px;text-align:center;border:1px dashed var(--border);background:" + (b.used ? b.color : "var(--bg-soft)") + ";color:" + (b.used ? "#fff" : "var(--text-faint)") + ";border-color:transparent" }));
        });
        view.appendChild(LC.panel("连续分配（请求结束后留下空洞）", [row]));
        view.appendChild(h("div", { class: "stat-line", html: "新请求 D 需要连续 1GB：总空闲 2.3GB，但最大连续块只有 0.8GB → <b style='color:var(--red)'>无法分配（或被迫预留巨大显存）</b>" }));
        out.textContent = "变长序列 + 不同生命周期 → 连续分配必然碎片化。\n（教学示意：块宽表示占用大小，不代表真实内存布局。）";
      } else {
        var pages = ["A", "A", "B", "C", "C", "D", "D", "A", "-", "C", "-", "D"];
        var row2 = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
        pages.forEach(function (p, i) {
          var color = p === "A" ? "var(--accent)" : p === "B" ? "var(--purple)" : p === "C" ? "var(--amber)" : p === "D" ? "var(--green)" : "transparent";
          row2.appendChild(h("span", { class: "chip ghost", text: "页" + i + (p === "-" ? "" : " " + p), style: "min-width:52px;text-align:center;border:1px dashed var(--border);background:" + (p === "-" ? "var(--bg-soft)" : color) + ";color:" + (p === "-" ? "var(--text-faint)" : "#fff") + ";border-color:transparent" }));
        });
        view.appendChild(LC.panel("PagedAttention（固定大小页池，按需分配）", [row2]));
        view.appendChild(h("div", { class: "stat-line", html: "新请求 D 需要 1GB → 申请 2 个空闲页即可：<b style='color:var(--green)'>立即分配成功</b>（逻辑连续、物理可不连续）" }));
        out.textContent = "分页化：把 KV 切成固定大小的页（如 16 token/页），任意空闲页都能复用。\n收益：碎片 ↓、按需增长、相同前缀的页还能共享（Prefix Cache）。\n这就是 vLLM 的核心机制之一 —— 思想来自 OS 虚拟内存分页。";
      }
    }
    var toggle = button("切换：连续分配 ⟷ 分页", function () {
      mode = 1 - mode;
      toggle.textContent = mode === 0 ? "当前：连续分配（点击切换）" : "当前：PagedAttention（点击切换）";
      render();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [toggle]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     5. Prefix Cache
     ============================================================ */
  LC.demos["prefix-cache"] = function (root) {
    var mode = 0; // 0 无缓存 1 有缓存
    var view = h("div"), out = LC.readout();
    function render() {
      view.innerHTML = "";
      var prefix = "【system prompt + 同一篇 8K 文档】（多个请求共享）";
      function reqRow(name, hit) {
        var row = h("div", { class: "demo-flex", style: "gap:6px;margin:5px 0;flex-wrap:wrap" });
        row.appendChild(h("span", { style: "width:64px;font-size:11.5px;color:var(--text-faint)", text: name }));
        row.appendChild(h("span", { class: "chip ghost", text: "共享前缀", style: "background:" + (hit ? "var(--green-soft);border-color:var(--green);color:var(--green)" : "var(--bg-soft);color:var(--text-faint)") }));
        row.appendChild(h("span", { style: "font-size:12px;color:var(--text-faint)", text: hit ? "→ 复用已缓存的 KV（跳过 prefill）" : "→ 重新 prefill（重复计算 8K token）" }));
        return row;
      }
      view.appendChild(LC.panel(mode === 0 ? "无前缀缓存" : "有前缀缓存（分页块共享）", [
        h("div", { class: "stat-line", text: prefix }),
        reqRow("请求 1", mode === 1),
        reqRow("请求 2", mode === 1),
        reqRow("请求 3", mode === 1)
      ]));
      out.textContent = mode === 0
        ? "无缓存：每个请求都要把 8K 共享前缀重新 prefill 一遍——同样的计算重复 3 次。\n（第一个请求无论如何都要算；这里是相对第一个请求的对比。）"
        : "有缓存：第一个请求把前缀的 KV 按页缓存；后续请求命中缓存，直接复用 KV，只需 prefill 各自的新内容。\n\n收益：TTFT 显著下降（省掉重复 prefill），并发越高收益越大。\n（实现上依赖分页块的引用计数与 copy-on-write。）";
    }
    var toggle = button("切换：无缓存 ⟷ 有缓存", function () {
      mode = 1 - mode;
      toggle.textContent = mode === 0 ? "当前：无前缀缓存（点击切换）" : "当前：有前缀缓存（点击切换）";
      render();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [toggle]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     6. Speculative Decoding
     ============================================================ */
  LC.demos["spec-decoding"] = function (root) {
    var draftTokens = ["A", "B", "C", "D"];
    var acceptN = 3; // 接受前 3 个
    var step = 0;
    var view = h("div"), out = LC.readout();
    function render() {
      view.innerHTML = "";
      var row = h("div", { class: "demo-flex", style: "gap:6px;justify-content:center;margin:8px 0" });
      draftTokens.forEach(function (t, i) {
        var accepted = step >= 2 && i < acceptN;
        var rejected = step >= 2 && i >= acceptN;
        var verifying = step === 1;
        row.appendChild(h("span", {
          class: "chip ghost",
          text: t,
          style: verifying ? "background:var(--amber-soft);border-color:var(--amber);color:var(--amber)"
            : accepted ? "background:var(--green-soft);border-color:var(--green);color:var(--green);font-weight:700"
            : rejected ? "background:var(--red-soft);border-color:var(--red);color:var(--red);text-decoration:line-through"
            : ""
        }));
      });
      view.appendChild(LC.panel("draft 猜 4 个 → target 并行验证", [row]));
      var msgs = [
        "第 0 步：draft 小模型自回归地猜出 4 个 token（很快，因为它小）。",
        "第 1 步：target 大模型一次前向，对 4 个位置并行打分。",
        "第 2 步：前 3 个被接受（与 target 分布一致），第 4 个被拒绝 → 从 target 重新采样一个。\n本次一次 target 前向推进了 3 个 token（否则需要 3 次前向）。"
      ];
      out.textContent = msgs[step] + "\n\n为什么分布仍然正确：接受/拒绝按概率比进行，拒绝时回退到 target 采样——最终输出分布与完全用 target 逐步采样一致（直觉层面）。\n加速比取决于「接受率」与 draft/target 的速度比；接受率低时可能反而变慢。";
    }
    root.appendChild(h("div", { class: "demo-controls" }, [
      button("下一步 ▶", function () { step = (step + 1) % 3; render(); }, "primary"),
      button("重置", function () { step = 0; render(); })
    ]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     7. Serving 指标模拟器（教学模型）
     ============================================================ */
  LC.demos["serving-metrics"] = function (root) {
    var N = 64;          // 请求数
    var promptLen = 512;
    var outputLen = 128;
    var batch = 16;
    var view = h("div"), out = LC.readout();

    function render() {
      // —— 教学模型（简化假设，非真实 benchmark）——
      // TTFT = queue + tokenize + prefill + sample（不含"额外一次 decode"）
      var tokenizeMs = promptLen * 0.02;
      var prefillMs = promptLen * 0.25;
      var samplingMs = 5;
      var decodeStepMs = 8 + 2.0 * batch;                  // 批越大每步越慢（带宽被分摊）
      var firstWaveTTFT = tokenizeMs + prefillMs + samplingMs;
      var waves = Math.ceil(N / batch);
      var perWaveMs = firstWaveTTFT + outputLen * decodeStepMs;   // 每波的总处理时间（简化）
      // 第 k 波的请求要等前 k-1 波处理完
      var lastWaveTTFT = (waves - 1) * perWaveMs + firstWaveTTFT;
      var sumTTFT = 0;
      for (var k = 0; k < waves; k++) sumTTFT += k * perWaveMs + firstWaveTTFT;
      var avgTTFT = sumTTFT / waves;
      var totalMs = waves * perWaveMs;
      var tokensPerSec = (N * outputLen) / (totalMs / 1000);
      var kvBytesPerToken = 2 * 32 * 8 * 128 * 2;          // 2·L·Hkv·d·fp16（L=32,H=8,d=128）
      var kvGB = N * (promptLen + outputLen) * kvBytesPerToken / 1e9;

      view.innerHTML = "";
      view.appendChild(LC.panel("TTFT 的三个口径（教学模型）", [
        h("div", { class: "stat-line", html: "① <b>首波请求</b> TTFT = tokenize " + tokenizeMs.toFixed(0) + " + prefill " + prefillMs.toFixed(0) + " + sample " + samplingMs + " = <b>" + firstWaveTTFT.toFixed(0) + " ms</b>" }),
        h("div", { class: "stat-line", html: "② <b>最后一波请求</b> TTFT = 前 " + (waves - 1) + " 波处理时间 + 首波 TTFT = <b>" + lastWaveTTFT.toFixed(0) + " ms</b>" }),
        h("div", { class: "stat-line", html: "③ <b>平均 TTFT</b>（全部 " + N + " 个请求）= <b>" + avgTTFT.toFixed(0) + " ms</b>（并发越高，排队项越大）" })
      ]));
      view.appendChild(LC.bars([
        { label: "首波 TTFT", value: firstWaveTTFT, max: Math.max(lastWaveTTFT, 100), text: firstWaveTTFT.toFixed(0) + " ms", color: "green" },
        { label: "平均 TTFT", value: avgTTFT, max: Math.max(lastWaveTTFT, 100), text: avgTTFT.toFixed(0) + " ms", color: "amber" },
        { label: "末波 TTFT", value: lastWaveTTFT, max: Math.max(lastWaveTTFT, 100), text: lastWaveTTFT.toFixed(0) + " ms", color: lastWaveTTFT > 2000 ? "red" : "amber" },
        { label: "ITL（一步 decode）", value: decodeStepMs, max: Math.max(lastWaveTTFT, 100), text: decodeStepMs.toFixed(1) + " ms", color: "green" },
        { label: "吞吐（tok/s）", value: tokensPerSec, max: Math.max(lastWaveTTFT, 100), text: tokensPerSec.toFixed(0), color: "green" },
        { label: "KV 显存（GB）", value: kvGB, max: Math.max(lastWaveTTFT, 100), text: kvGB.toFixed(1) + " GB", color: kvGB > 80 ? "red" : "green" }
      ], { max: Math.max(lastWaveTTFT, 100) }));
      out.textContent =
        "⚙️ 教学模型（简化假设，非真实硬件 benchmark）：\n" +
        "· TTFT = queue + tokenize + prefill + sample（prefill 直接产出第一个 token 的 logits，不含额外 decode）\n" +
        "· 波数 = ⌈N / batch⌉ = " + waves + "；每波 ≈ 首波 TTFT + " + outputLen + "×" + decodeStepMs.toFixed(1) + "ms（decode）\n" +
        "· 吞吐 = 总输出 token ÷ 总耗时 = " + tokensPerSec.toFixed(0) + " tok/s\n" +
        "· KV 显存 = Σ(每个请求的 prompt+output) × 每 token KV 字节 = " + kvGB.toFixed(1) + " GB（变长口径，见正文 20.8）\n\n" +
        (kvGB > 80 ? "⚠️ KV 显存已超过 80GB：真实系统会在这里 OOM——需要分页管理、限制并发或量化。\n" : "") +
        "试试：把 batch 拉大看吞吐与 ITL 的 trade-off；把请求数和长度拉大看 KV 与排队如何推高平均 TTFT。";
    }
    var nS = LC.slider("请求数 N", 1, 256, 1, N, function (v) { N = Math.round(v); render(); });
    var pS = LC.slider("prompt 长度", 64, 4096, 64, promptLen, function (v) { promptLen = Math.round(v); render(); });
    var oS = LC.slider("输出长度", 32, 1024, 32, outputLen, function (v) { outputLen = Math.round(v); render(); });
    var bS = LC.slider("batch size", 1, 64, 1, batch, function (v) { batch = Math.round(v); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [nS.el, pS.el, oS.el, bS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
