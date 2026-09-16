/* ============================================================
   LC — 交互演示 (训练工程：Pretrain / SFT / RL / 高效训练)
   ============================================================ */
(function () {
  "use strict";
  var LC = window.LC;
  if (!LC) return;
  var h = LC.h, svgRoot = LC.svgRoot, svgEl = LC.svgEl, button = LC.button;

  /* ============================================================
     训练流水线
     ============================================================ */
  LC.demos["pipeline"] = function (root) {
    var stages = [
      { name: "Raw Data", desc: "Common Crawl、GitHub、书籍、论文、内部数据。海量但脏。", ch: "pretrain-sft" },
      { name: "Cleaning / Dedup", desc: "URL 过滤、内容过滤、语言识别、质量过滤、MinHash 近似去重。", ch: "pretrain-sft" },
      { name: "Tokenizer", desc: "训练 BPE/BBPE 词表：vocab size、special tokens、多语言配比。", ch: "nlp" },
      { name: "Pretraining", desc: "next token prediction，几万亿 token，学习语言/知识/代码能力。产出 Base Model。", ch: "pretrain-sft" },
      { name: "Base Model", desc: "会续写，但不会「按指令回答」。", ch: "pretrain-sft" },
      { name: "SFT", desc: "指令数据微调（chat template + loss mask），学会回答方式。产出 Instruction Model。", ch: "pretrain-sft" },
      { name: "Instruction Model", desc: "能对话、能听指令，但回答质量未按人类偏好优化。", ch: "pretrain-sft" },
      { name: "RL / Preference Opt.", desc: "PPO / GRPO + reward：优化「人类更喜欢哪个回答」。产出 Aligned Model。", ch: "rl-grpo" },
      { name: "Aligned Model", desc: "对齐后的可用模型（还要经过评估、量化、部署）。", ch: "rl-grpo" }
    ];
    var selected = 0;
    var flow = h("div", { class: "demo-flex", style: "gap:6px;flex-wrap:wrap" });
    var info = LC.panel("点击任意阶段查看说明", [h("div", { class: "stat-line", text: "整条流水线：数据 → 清洗 → Tokenizer → Pretrain → SFT → RL → 部署。" })]);

    function render() {
      flow.innerHTML = "";
      stages.forEach(function (st, i) {
        var c = h("span", { class: "chip" + (i === selected ? " on" : ""), text: st.name });
        c.addEventListener("click", function () { selected = i; render(); });
        flow.appendChild(c);
        if (i < stages.length - 1) flow.appendChild(h("span", { style: "color:var(--text-faint)", text: "→" }));
      });
      info.innerHTML = "";
      info.appendChild(h("h5", { text: stages[selected].name }));
      info.appendChild(h("div", { class: "stat-line", text: stages[selected].desc }));
      info.appendChild(h("div", { class: "demo-sub", html: '对应章节：<a href="#/' + stages[selected].ch + '">' + stages[selected].ch + "</a>" }));
    }
    root.appendChild(flow);
    root.appendChild(info);
    render();
  };

  /* ============================================================
     SFT Loss Mask
     ============================================================ */
  LC.demos["loss-mask"] = function (root) {
    var seq = [
      { t: "<|im_start|>", role: "special" }, { t: "system", role: "sys" }, { t: "You", role: "sys" }, { t: "are", role: "sys" }, { t: "helpful", role: "sys" }, { t: "<|im_end|>", role: "special" },
      { t: "<|im_start|>", role: "special" }, { t: "user", role: "user" }, { t: "1+1", role: "user" }, { t: "=", role: "user" }, { t: "?", role: "user" }, { t: "<|im_end|>", role: "special" },
      { t: "<|im_start|>", role: "special" }, { t: "assistant", role: "asst" }, { t: "2", role: "asst" }, { t: "<|im_end|>", role: "special" }
    ];
    var showMask = true;
    var row = h("div", { class: "demo-flex", style: "gap:4px;flex-wrap:wrap" });
    var out = LC.readout();

    function render() {
      row.innerHTML = "";
      seq.forEach(function (tk) {
        var isAsst = tk.role === "asst";
        var mask = isAsst ? 1 : 0;
        var style = isAsst
          ? "background:var(--green-soft);border-color:color-mix(in srgb, var(--green) 45%, transparent);color:var(--green)"
          : "background:var(--bg-soft);border-color:var(--border);color:var(--text-faint)";
        if (tk.role === "special") style = "background:var(--purple-soft);border-color:color-mix(in srgb, var(--purple) 35%, transparent);color:var(--purple)";
        var label = tk.t + (showMask ? "\nmask=" + mask : "");
        row.appendChild(h("span", { class: "chip ghost", text: label, style: style + ";white-space:pre-line;text-align:center;font-size:12px;line-height:1.5" }));
      });
      var asstCount = seq.filter(function (t) { return t.role === "asst"; }).length;
      out.textContent =
        "序列共 " + seq.length + " 个 token，其中 assistant 回答部分 " + asstCount + " 个 token 计入 loss。\n" +
        "Loss = Σ maskᵢ·Lᵢ / Σ maskᵢ（只在 mask=1 的位置算交叉熵）\n\n" +
        "为什么？我们想让模型学会「如何回答」，而不是学会「预测用户的提问」。\n" +
        "如果不 mask，模型会把大量算力花在模仿用户输入上，还会在推理时试图续写用户的话。";
    }
    var toggle = button("隐藏 mask 标注", function () {
      showMask = !showMask;
      toggle.textContent = showMask ? "隐藏 mask 标注" : "显示 mask 标注";
      render();
    });
    root.appendChild(h("div", { class: "demo-controls" }, [toggle]));
    root.appendChild(row);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     PPO vs GRPO
     ============================================================ */
  LC.demos["ppo-grpo"] = function (root) {
    var wrap = h("div", { class: "demo-grid2" });
    var out = LC.readout();
    var highlight = false;

    function box(name, color, extra) {
      return h("div", {
        class: "chip ghost",
        text: name + (extra || ""),
        style: "min-width:150px;text-align:center;padding:7px 12px;" + color
      });
    }
    var ppo = LC.panel("PPO（4 个模型）", [
      h("div", { class: "demo-flex", style: "flex-direction:column;gap:5px;align-items:center" }, [
        box("Policy Model（训练中）", "background:var(--accent-soft);border-color:var(--accent);color:var(--accent-text)"),
        h("div", { style: "color:var(--text-faint)", text: "↓ 生成回答" }),
        box("Reference Model（算 KL）", ""),
        box("Reward Model（打分）", ""),
        box("Value Model（估计 V(s)，算 GAE）", "background:var(--amber-soft);border-color:var(--amber);color:var(--amber)")
      ])
    ]);
    var grpo = LC.panel("GRPO（3 个模型，去掉 Value）", [
      h("div", { class: "demo-flex", style: "flex-direction:column;gap:5px;align-items:center" }, [
        box("Policy Model（训练中）", "background:var(--accent-soft);border-color:var(--accent);color:var(--accent-text)"),
        h("div", { style: "color:var(--text-faint)", text: "↓ 同一 prompt 采样一组回答" }),
        box("Reference Model（算 KL）", ""),
        box("Reward Model / 规则校验（打分）", ""),
        box("Group Responses → Group Advantage（组内相对）", "background:var(--green-soft);border-color:var(--green);color:var(--green)")
      ])
    ]);
    wrap.appendChild(ppo);
    wrap.appendChild(grpo);
    root.appendChild(wrap);
    root.appendChild(out);
    out.textContent =
      "PPO 需要额外训练一个 Value Model 来估计每个状态的基线（baseline），显存和工程复杂度都高。\n" +
      "GRPO 用「同一问题采样一组回答，组内互相比较」代替 Value Model：\n" +
      "  Aᵢ = (rᵢ − mean(r)) / std(r)\n" +
      "高于组平均 → 正优势（提高概率）；低于组平均 → 负优势（降低概率）。\n\n" +
      "在数学/代码这类「答案可验证」的任务上，reward 可以直接用规则算，连 Reward Model 都能省。";
  };

  /* ============================================================
     GRPO Group Advantage
     ============================================================ */
  LC.demos["grpo-group"] = function (root) {
    var rewards = [1, 3, 2, 6];
    var sliders = [];
    var barsWrap = h("div");
    var advWrap = h("div");
    var out = LC.readout();

    function update() {
      var mean = rewards.reduce(function (a, b) { return a + b; }, 0) / rewards.length;
      var varr = rewards.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / rewards.length;
      var std = Math.sqrt(varr) || 1e-8;
      var adv = rewards.map(function (r) { return (r - mean) / std; });

      barsWrap.innerHTML = "";
      barsWrap.appendChild(LC.bars(rewards.map(function (r, i) {
        return { label: "回答 " + (i + 1), value: r, max: 10, text: r.toFixed(1), color: "amber" };
      }), { max: 10 }));
      advWrap.innerHTML = "";
      advWrap.appendChild(LC.bars(adv.map(function (a, i) {
        return {
          label: "回答 " + (i + 1),
          value: Math.abs(a),
          max: 2.5,
          text: (a >= 0 ? "+" : "") + a.toFixed(2),
          color: a >= 0 ? "green" : "red"
        };
      }), { max: 2.5 }));
      out.textContent =
        "rewards = [" + rewards.join(", ") + "]\n" +
        "mean = " + LC.fmt(mean, 3) + "，std = " + LC.fmt(std, 3) + "\n" +
        "advantage Aᵢ = (rᵢ − mean) / std = [" + adv.map(function (a) { return (a >= 0 ? "+" : "") + LC.fmt(a, 2); }).join(", ") + "]\n\n" +
        "绿色 = 正优势（提高该回答的生成概率）；红色 = 负优势（降低概率）。\n" +
        "注意：advantage 只取决于「组内相对表现」，与绝对分数无关。";
    }
    rewards.forEach(function (r, i) {
      var s = LC.slider("回答 " + (i + 1) + " reward", 0, 10, 0.5, r, function (v) { rewards[i] = v; update(); });
      sliders.push(s);
    });
    root.appendChild(h("div", { class: "demo-controls" }, sliders.map(function (s) { return s.el; })));
    root.appendChild(h("div", { class: "demo-grid2" }, [
      LC.panel("原始 reward", [barsWrap]),
      LC.panel("组内标准化后的 advantage", [advWrap])
    ]));
    root.appendChild(out);
    update();
  };

  /* ============================================================
     KL Divergence
     ============================================================ */
  LC.demos["kl-divergence"] = function (root) {
    var Q = [0.30, 0.22, 0.16, 0.12, 0.08, 0.06, 0.04, 0.02];
    var alpha = 0;
    var wrap = h("div");
    var out = LC.readout();

    function update() {
      var U = new Array(8).fill(1 / 8);
      var P = Q.map(function (q, i) { return (1 - alpha) * q + alpha * U[i]; });
      var kl = 0;
      P.forEach(function (p, i) { if (p > 0 && Q[i] > 0) kl += p * Math.log(p / Q[i]); });
      wrap.innerHTML = "";
      wrap.appendChild(LC.panel("Reference π_ref（固定）", [
        LC.bars(Q.map(function (v, i) { return { label: "token " + (i + 1), value: v, max: 0.3, text: (v * 100).toFixed(0) + "%", color: "dim" }; }))
      ]));
      wrap.appendChild(LC.panel("当前 Policy π_θ（α 越大越偏离）", [
        LC.bars(P.map(function (v, i) { return { label: "token " + (i + 1), value: v, max: 0.3, text: (v * 100).toFixed(0) + "%", color: alpha > 0.5 ? "red" : "green" }; }))
      ]));
      out.textContent =
        "D_KL(π_θ ‖ π_ref) = Σ π_θ(x)·ln( π_θ(x) / π_ref(x) ) = " + LC.fmt(kl, 4) + " nats\n\n" +
        (kl < 0.01 ? "策略几乎没偏离 reference，KL 惩罚 ≈ 0。" :
         kl < 0.1 ? "轻微偏离：模型在探索，但还没有跑远。" :
         "偏离较大：模型为了拿 reward 改变了很多。GRPO/PPO 会加 −β·KL 惩罚，防止语言能力退化与 reward hacking。") +
        "\n\n直觉：KL 衡量「用 π_θ 的分布去看 π_ref 有多意外」，越不像越大。";
    }
    var s = LC.slider("偏离程度 α", 0, 1, 0.05, alpha, function (v) { alpha = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [
      s.el,
      button("α = 0（完全对齐）", function () { s.set(0); alpha = 0; update(); }),
      button("α = 1（完全偏离）", function () { s.set(1); alpha = 1; update(); })
    ]));
    root.appendChild(wrap);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     LoRA
     ============================================================ */
  LC.demos["lora"] = function (root) {
    var d = 4096, k = 4096;
    var r = 8;
    var wrap = h("div");
    var out = LC.readout();

    function update() {
      var full = d * k;
      var lora = r * (d + k);
      var pct = lora / full * 100;
      wrap.innerHTML = "";
      wrap.appendChild(LC.panel("重参数化：W = W₀ + BA", [
        h("div", { class: "demo-flex", style: "gap:10px;align-items:center;flex-wrap:wrap" }, [
          h("div", { class: "chip ghost", html: "W₀<br><span style='font-size:10.5px;color:var(--text-faint)'>d×k = 4096×4096<br>❄️ 冻结不训练</span>", style: "text-align:center;padding:10px 14px" }),
          h("span", { style: "font-size:16px;font-weight:700", text: "+" }),
          h("div", { class: "chip ghost", html: "B<br><span style='font-size:10.5px;color:var(--text-faint)'>d×r = 4096×" + r + "</span>", style: "text-align:center;padding:10px 14px;background:var(--green-soft);border-color:var(--green);color:var(--green)" }),
          h("span", { style: "font-size:16px;font-weight:700", text: "×" }),
          h("div", { class: "chip ghost", html: "A<br><span style='font-size:10.5px;color:var(--text-faint)'>r×k = " + r + "×4096</span>", style: "text-align:center;padding:10px 14px;background:var(--green-soft);border-color:var(--green);color:var(--green)" }),
          h("span", { style: "font-size:16px;font-weight:700", text: "=" }),
          h("div", { class: "chip ghost", html: "ΔW<br><span style='font-size:10.5px;color:var(--text-faint)'>低秩更新</span>", style: "text-align:center;padding:10px 14px;background:var(--purple-soft);border-color:var(--purple);color:var(--purple)" })
        ])
      ]));
      wrap.appendChild(LC.panel("可训练参数量对比", [
        LC.bars([
          { label: "Full FT", value: full, max: full, text: (full / 1e6).toFixed(1) + "M", color: "red" },
          { label: "LoRA r=" + r, value: lora, max: full, text: (lora / 1e6).toFixed(2) + "M", color: "green" }
        ], { max: full }),
        h("div", { class: "stat-line", html: "LoRA 可训练参数 = r × (d + k) = " + r + " × " + (d + k) + " = <b>" + lora.toLocaleString() + "</b>（占全量的 <b>" + pct.toFixed(2) + "%</b>）" })
      ]));
      out.textContent =
        "为什么可行：微调所需的变化 ΔW 往往集中在低维子空间，用秩 r ≪ min(d,k) 的 BA 就能近似。\n" +
        "训练时只更新 A、B（优化器状态也只保存它们）→ 显存需求骤降。\n" +
        "A 通常高斯初始化、B 初始化为 0，保证训练开始时 ΔW = 0（不破坏原模型）。\n\n" +
        "⚠️ LoRA 不是量化：它不改动原权重的精度，而是额外挂一对低秩矩阵。";
    }
    var s = LC.slider("秩 r", 1, 64, 1, r, function (v) { r = Math.round(v); update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [s.el]));
    root.appendChild(wrap);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     Mixed Precision
     ============================================================ */
  LC.demos["mixed-precision"] = function (root) {
    var formats = [
      { name: "FP32", sign: 1, exp: 8, man: 23, bytes: 4, note: "基准精度" },
      { name: "FP16", sign: 1, exp: 5, man: 10, bytes: 2, note: "精度高，范围小，易 overflow" },
      { name: "BF16", sign: 1, exp: 8, man: 7, bytes: 2, note: "范围同 FP32，训练首选" },
      { name: "INT8", sign: 1, exp: 0, man: 7, bytes: 1, note: "量化推理常用" },
      { name: "INT4", sign: 1, exp: 0, man: 3, bytes: 0.5, note: "最省显存" }
    ];
    var bitsWrap = h("div");
    formats.forEach(function (f) {
      var total = f.exp === 0 ? 8 : 32;
      if (f.name === "INT4") total = 4;
      var segs = [];
      function seg(label, n, color, textColor) {
        if (n <= 0) return;
        segs.push(h("div", {
          style: "width:" + (n / total * 100) + "%;background:" + color + ";color:" + (textColor || "#fff") + ";display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;overflow:hidden;white-space:nowrap",
          text: label + " " + n
        }));
      }
      if (f.exp === 0) {
        seg("int", total - 1, "#7c3aed");
        seg("s", 1, "#dc2626");
      } else {
        seg("s", f.sign, "#dc2626");
        seg("exp", f.exp, "#2f6fed");
        seg("mantissa", f.man, "#17a673");
      }
      bitsWrap.appendChild(h("div", { style: "margin:8px 0" }, [
        h("div", { style: "display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px" }, [
          h("b", { text: f.name }),
          h("span", { style: "color:var(--text-faint)", text: f.note })
        ]),
        h("div", { style: "display:flex;height:20px;border-radius:6px;overflow:hidden;border:1px solid var(--border)" }, segs)
      ]));
    });

    var params = 7, dtype = 2;
    var est = h("div", { class: "demo-readout" });
    function calc() {
      var bytes = params * 1e9 * dtype;
      var gb = bytes / 1e9;
      est.textContent =
        "权重显存 = 参数量 × 每参数字节\n" +
        "        = " + params + "B × " + dtype + " bytes = " + gb.toFixed(1) + " GB\n\n" +
        "训练还要加：梯度（+2~4 bytes）、FP32 master weights（+4）、Adam m/v（+8）\n" +
        "混合精度训练 ≈ 18 bytes/参数 → 约 " + (params * 18).toFixed(0) + " GB（还不含 activations）";
    }
    var groupP = LC.buttonGroup(["7B", "14B", "32B", "70B"], function (i) { params = [7, 14, 32, 70][i]; calc(); });
    var groupD = LC.buttonGroup(["FP32", "FP16/BF16", "INT8", "INT4"], function (i) { dtype = [4, 2, 1, 0.5][i]; calc(); });
    groupD.setActive(1);
    root.appendChild(LC.panel("浮点 / 整数格式的位分布", [bitsWrap]));
    root.appendChild(h("div", { class: "demo-sub", html: "<b>模型权重显存计算器</b>" }));
    root.appendChild(h("div", { class: "demo-controls" }, [groupP.el, groupD.el]));
    root.appendChild(est);
    calc();
  };
  /* ============================================================
     Warmup + Cosine Decay 学习率调度
     ============================================================ */
  LC.demos["warmup-schedule"] = function (root) {
    var cv = LC.canvas(520, 240);
    var ctx = cv.getContext("2d");
    var warmup = 1000, total = 10000, peak = 3e-4, finalRatio = 0.1;
    var out = LC.readout();

    function lrAt(step) {
      if (step < warmup) return peak * step / Math.max(1, warmup);
      var progress = (step - warmup) / Math.max(1, total - warmup);
      return peak * (finalRatio + (1 - finalRatio) * 0.5 * (1 + Math.cos(Math.PI * progress)));
    }
    function draw() {
      var W = 520, H = 240;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, H - 30); ctx.lineTo(W - 14, H - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40, 12); ctx.lineTo(40, H - 30); ctx.stroke();
      ctx.fillStyle = "#8a93a3"; ctx.font = "11.5px -apple-system";
      ctx.fillText("step", W - 40, H - 12);
      ctx.fillText("LR", 14, 20);
      function X(s) { return 40 + s / total * (W - 56); }
      function Y(l) { return (H - 30) - l / peak * (H - 48); }
      ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 2.4; ctx.beginPath();
      for (var s = 0; s <= total; s += Math.max(1, Math.floor(total / 400))) {
        var px = X(s), py = Y(lrAt(s));
        if (s) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      // warmup 边界
      ctx.strokeStyle = "rgba(217,119,6,.7)"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(X(warmup), 12); ctx.lineTo(X(warmup), H - 30); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#d97706"; ctx.font = "11.5px -apple-system";
      ctx.fillText("warmup 结束 (" + warmup + " 步)", X(warmup) + 4, 22);
      ctx.fillStyle = "#2f6fed";
      ctx.fillText("峰值 LR = " + peak.toExponential(1), 50, 22);
    }
    function update() {
      draw();
      out.textContent =
        "总步数 " + total + "，warmup " + warmup + " 步，峰值 LR = " + peak.toExponential(1) + "，最终 LR = " + (peak * finalRatio).toExponential(1) + "\n\n" +
        "· warmup 阶段：线性升到峰值（前 " + warmup + " 步）——初期梯度方向不可靠，小步走避免带偏；\n" +
        "· cosine 衰减：从峰值平滑降到峰值的 " + (finalRatio * 100).toFixed(0) + "%——后期精细收敛、减少震荡。\n\n" +
        "典型配置：warmup 占总步数 0.1%~2%，final ratio 0.1 左右。LLaMA、Qwen 等都使用这套调度。";
    }
    var wS = LC.slider("warmup 步数", 0, 3000, 100, warmup, function (v) { warmup = v; update(); });
    var tS = LC.slider("总步数", 2000, 20000, 1000, total, function (v) { total = v; update(); });
    var pS = LC.slider("峰值 LR", 1e-5, 1e-3, 5e-6, peak, function (v) { peak = v; update(); });
    var fS = LC.slider("最终比例", 0.01, 0.5, 0.01, finalRatio, function (v) { finalRatio = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [wS.el, tS.el, pS.el, fS.el]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     Policy Ratio 与 Clip
     ============================================================ */
  LC.demos["policy-ratio"] = function (root) {
    var pOld = 0.4, pNew = 0.5, A = 1.0, eps = 0.2;
    var cv = LC.canvas(520, 240);
    var ctx = cv.getContext("2d");
    var out = LC.readout();

    function objective(r) {
      var clipped = Math.min(Math.max(r, 1 - eps), 1 + eps);
      return Math.min(r * A, clipped * A);
    }
    function draw() {
      var W = 520, H = 240;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(128,140,160,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, H - 30); ctx.lineTo(W - 14, H - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40, 12); ctx.lineTo(40, H - 30); ctx.stroke();
      function X(r) { return 40 + r / 2 * (W - 56); }
      function Y(v) { return (H - 30) - (v + 2.5) / 5 * (H - 48); }
      ctx.fillStyle = "#8a93a3"; ctx.font = "11.5px -apple-system";
      ctx.fillText("ratio r = π_new / π_old", W - 160, H - 12);
      ctx.fillText("目标函数", 6, 20);
      // clip 区间
      ctx.fillStyle = "rgba(23,166,115,.12)";
      ctx.fillRect(X(1 - eps), 12, X(1 + eps) - X(1 - eps), H - 42);
      // 曲线
      ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 2.4; ctx.beginPath();
      for (var i = 0; i <= 200; i++) {
        var r = 2 * i / 200;
        var px = X(r), py = Y(objective(r));
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      var rNow = pNew / pOld;
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(X(rNow), H - 30); ctx.lineTo(X(rNow), Y(objective(rNow))); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#dc2626";
      ctx.beginPath(); ctx.arc(X(rNow), Y(objective(rNow)), 6, 0, 7); ctx.fill();
      ctx.fillStyle = "#17a673"; ctx.font = "11.5px -apple-system";
      ctx.fillText("clip 区间 [" + (1 - eps).toFixed(2) + ", " + (1 + eps).toFixed(2) + "]", X(1 - eps), H - 14);
    }
    function update() {
      draw();
      var r = pNew / pOld;
      var rClip = Math.min(Math.max(r, 1 - eps), 1 + eps);
      var obj = Math.min(r * A, rClip * A);
      out.textContent =
        "π_old(a) = " + pOld.toFixed(2) + "，π_new(a) = " + pNew.toFixed(2) + " → ratio r = " + r.toFixed(3) + "\n" +
        "advantage A = " + A.toFixed(1) + "，clip 范围 [" + (1 - eps).toFixed(2) + ", " + (1 + eps).toFixed(2) + "]\n" +
        "clip(r) = " + rClip.toFixed(3) + "\n" +
        "目标 = min(r·A, clip(r)·A) = min(" + (r * A).toFixed(3) + ", " + (rClip * A).toFixed(3) + ") = " + obj.toFixed(3) + "\n\n" +
        (r > 1 + eps && A > 0 ? "r 超出上界：即使继续提高概率，收益也被截断——防止单次更新过猛。" :
         r < 1 - eps && A < 0 ? "r 超出下界且 A 为负：降低概率的收益被截断，防止过度打压。" :
         "当前 ratio 在 clip 区间内，目标函数正常增长。") +
        "\n\n试试把 π_new 拉高到 ratio > 1.2：曲线在 clip 边界后变平——这就是 PPO/GRPO 的「悲观更新」。";
    }
    var oS = LC.slider("π_old", 0.05, 0.95, 0.05, pOld, function (v) { pOld = v; update(); });
    var nS = LC.slider("π_new", 0.05, 0.95, 0.05, pNew, function (v) { pNew = v; update(); });
    var aS = LC.slider("advantage A", -2, 2, 0.1, A, function (v) { A = v; update(); });
    var eS = LC.slider("ε", 0.05, 0.4, 0.05, eps, function (v) { eps = v; update(); });
    root.appendChild(h("div", { class: "demo-controls" }, [oS.el, nS.el, aS.el, eS.el]));
    root.appendChild(cv);
    root.appendChild(out);
    update();
  };

  /* ============================================================
     LoRA 矩阵运算（数值演示）
     ============================================================ */
  LC.demos["lora-math"] = function (root) {
    var r = 1;
    var W0 = [[0.5, 0.1, -0.2, 0.3], [0.1, 0.4, 0.2, -0.1], [-0.2, 0.2, 0.6, 0.1], [0.3, -0.1, 0.1, 0.5]];
    var B = [[0.5, 0.2], [-0.3, 0.1], [0.2, -0.4], [0.1, 0.3]];
    var A = [[0.4, 0.1, -0.2, 0.3], [0.1, -0.2, 0.3, 0.1]];
    var view = h("div"), out = LC.readout();

    function mm(X, Y) {
      return X.map(function (row) {
        return Y[0].map(function (_, j) {
          return row.reduce(function (s, v, k) { return s + v * Y[k][j]; }, 0);
        });
      });
    }
    function render() {
      var Bs = B.map(function (row) { return row.slice(0, r); });
      var As = A.slice(0, r);
      var dW = mm(Bs, As);
      var W = W0.map(function (row, i) { return row.map(function (v, j) { return v + dW[i][j]; }); });
      view.innerHTML = "";
      view.appendChild(h("div", { class: "mat-wrap", style: "justify-content:center" }, [
        LC.matGroup("W₀（冻结 ❄️）", "4×4", W0, { digits: 1 }),
        h("span", { class: "shape-op", style: "font-size:18px", text: "+" }),
        LC.matGroup("B", "4×" + r, Bs, { digits: 1, hl: Bs.map(function (_, i) { return [i, 0]; }) }),
        h("span", { class: "shape-op", text: "×" }),
        LC.matGroup("A", r + "×4", As, { digits: 1 }),
        h("span", { class: "shape-arrow", style: "font-size:18px", text: "=" }),
        LC.matGroup("W = W₀ + BA", "4×4", W, { digits: 2, colorScale: true })
      ]));
      view.appendChild(LC.panel("ΔW = B × A（低秩更新）", [
        h("div", { class: "mat-wrap", style: "justify-content:center" }, [LC.matGroup("ΔW", "4×4", dW, { digits: 2, colorScale: true })])
      ]));
      var full = 16, lora = r * (4 + 4);
      out.textContent =
        "秩 r = " + r + "：ΔW = B(4×" + r + ") × A(" + r + "×4)，得到完整的 4×4 更新矩阵。\n" +
        "可训练参数：LoRA = r×(4+4) = " + lora + " vs 全量 = 4×4 = " + full + "（占 " + (lora / full * 100).toFixed(0) + "%）\n\n" +
        "注意 ΔW 的每一行都是 A 的行的倍数（行之间线性相关）——这就是「低秩」：无论怎么训练，B×A 只能表示少数方向的组合。\n" +
        "真实模型：d=k=4096，r=8 → 0.39% 参数。r 越大表达能力越强，但收益递减、显存上升。";
    }
    var s = LC.slider("秩 r", 1, 2, 1, r, function (v) { r = Math.round(v); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [s.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
