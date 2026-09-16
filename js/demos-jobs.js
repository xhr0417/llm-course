/* ============================================================
   LC — Job-Ready Track 演示（Python 工程 / HuggingFace）
   ============================================================ */
(function () {
  "use strict";
  if (!window.LC) return;
  var h = function (tag, attrs, children) {
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
    if (children != null) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  };

  /* ============================================================
     1. 同步 vs 异步（第 25 章）
     ============================================================ */
  LC.demos["sync-async"] = function (root) {
    var N = 20, latencyMs = 800, concurrency = 8;
    var view = h("div"), out = LC.readout();

    function render() {
      var seqTotal = N * latencyMs;
      var waves = Math.ceil(N / concurrency);
      var asyncTotal = waves * latencyMs;
      var speedup = seqTotal / asyncTotal;

      view.innerHTML = "";
      view.appendChild(LC.bars([
        { label: "同步（串行）", value: seqTotal / 1000, max: seqTotal / 1000, text: (seqTotal / 1000).toFixed(1) + " s", color: "red" },
        { label: "异步（限流 " + concurrency + "）", value: asyncTotal / 1000, max: seqTotal / 1000, text: (asyncTotal / 1000).toFixed(1) + " s", color: "green" }
      ], { max: seqTotal / 1000 }));
      out.textContent =
        "教学模型（假设每次请求固定耗时 " + latencyMs + "ms，忽略网络抖动）：\n" +
        "· 同步：A → B → C … 逐个等待 = " + N + " × " + latencyMs + "ms = " + (seqTotal / 1000).toFixed(1) + "s\n" +
        "· 异步 + Semaphore(" + concurrency + ")：分 " + waves + " 波，每波同时发出 = " + waves + " × " + latencyMs + "ms = " + (asyncTotal / 1000).toFixed(1) + "s\n" +
        "· 加速比 ≈ " + speedup.toFixed(1) + "×（并发上限越大越快，但服务端 QPS 与 429 限流会封顶）\n\n" +
        "⚠️ 为什么不能「全并发」：请求数 " + N + " 一次性打出去，服务端限流 → 429 → 重试风暴，\n" +
        "实测上反而更慢甚至被封。标准做法：asyncio.gather + Semaphore 限流 + timeout + 指数退避重试。\n\n" +
        "真实场景提醒：LLM API 的单次耗时以秒计（生成越长越慢），并发收益比这个小 demo 更显著——\n" +
        "评测 5000 题的 Eval Harness（Capstone 1）就靠这一招把时间从小时级降到分钟级。";
    }
    var nS = LC.slider("请求数 N", 1, 100, 1, N, function (v) { N = Math.round(v); render(); });
    var lS = LC.slider("单次延迟 (ms)", 100, 2000, 100, latencyMs, function (v) { latencyMs = Math.round(v); render(); });
    var cS = LC.slider("并发上限", 1, 16, 1, concurrency, function (v) { concurrency = Math.round(v); render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [nS.el, lS.el, cS.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     2. Chat Template 渲染（第 26 章）
     ============================================================ */
  LC.demos["chat-template"] = function (root) {
    var templates = {
      "Qwen (ChatML)": {
        system: "<|im_start|>system\nYou are Qwen, created by Alibaba Cloud. You are a helpful assistant.<|im_end|>",
        user: "<|im_start|>user\n{content}<|im_end|>",
        assistant: "<|im_start|>assistant\n{content}<|im_end|>",
        gen: "<|im_start|>assistant\n",
        note: "Qwen 系（Qwen2/2.5/3）使用 ChatML：<|im_start|> / <|im_end|> 包裹每一轮角色。"
      },
      "Llama 3": {
        system: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful assistant.<|eot_id|>",
        user: "<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>",
        assistant: "<|start_header_id|>assistant<|end_header_id|>\n\n{content}<|eot_id|>",
        gen: "<|start_header_id|>assistant<|end_header_id|>\n\n",
        note: "Llama 3 使用 header 标记：<|start_header_id|>role<|end_header_id|> + <|eot_id|> 结束。"
      }
    };
    var messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "什么是过拟合？" },
      { role: "assistant", content: "过拟合是模型记住了训练噪声，在新数据上表现变差。" },
      { role: "user", content: "那怎么缓解？" }
    ];
    var current = "Qwen (ChatML)";
    var view = h("div"), out = LC.readout();

    function highlight(text) {
      var escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return escaped.replace(/(&lt;\|[^|]+\|&gt;)/g, '<span style="background:var(--accent-soft);color:var(--accent-text);border-radius:4px;padding:0 2px;font-weight:700">$1</span>');
    }
    function renderTemplate(msgs, tpl, withGen) {
      var parts = [tpl.system];
      msgs.filter(function (m) { return m.role !== "system"; }).forEach(function (m) {
        var t = tpl[m.role] || "";
        parts.push(t.replace("{content}", m.content));
      });
      if (withGen) parts.push(tpl.gen);
      return parts.join("\n");
    }

    function render() {
      var tpl = templates[current];
      var full = renderTemplate(messages, tpl, true);
      var promptOnly = renderTemplate(messages.slice(0, 3), tpl, true);
      view.innerHTML = "";
      view.appendChild(LC.panel("messages（程序里看到的是结构化数据）", messages.map(function (m) {
        return h("div", { class: "stat-line", html: "<b>" + m.role + "</b> · " + m.content });
      })));
      view.appendChild(LC.panel("apply_chat_template 之后的文本（模型看到的）", [
        h("pre", { style: "white-space:pre-wrap;font-size:12.5px;line-height:1.7;margin:6px 0", html: highlight(full) })
      ]));
      out.textContent =
        tpl.note + "\n\n" +
        "· 特殊 token（高亮部分）是模板自动注入的；手拼字符串漏一个 <|im_end|>，分布就偏移了。\n" +
        "· add_generation_prompt=True：末尾补 " + JSON.stringify(tpl.gen.trim()) + "，告诉模型「该 assistant 说话了」。\n" +
        "· SFT 的 response-only loss：labels 只保留 assistant 内容，prompt 部分（含模板 token）全部置 -100 不参与 loss。\n" +
        "· 本例 prompt 部分（前 3 条消息 + 生成提示）约 " + promptOnly.length + " 字符，占总文本 " +
        Math.round(promptOnly.length / full.length * 100) + "%；答案部分才参与 loss。\n\n" +
        "⚠️ 真实 token 数需要用对应模型的 tokenizer 计算（本 demo 展示的是文本形态，未做分词）。";
    }
    var group = LC.buttonGroup(Object.keys(templates), function (i) { current = Object.keys(templates)[i]; render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [group.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };

  /* ============================================================
     3. Left vs Right padding（第 26 章）
     ============================================================ */
  LC.demos["padding-side"] = function (root) {
    var side = 0; // 0 = left, 1 = right
    var seqLens = [7, 3];
    var view = h("div"), out = LC.readout();
    var MAX = 8;

    function tokenBox(t, isPad, isLastReal) {
      return h("span", {
        style: "display:inline-block;min-width:34px;text-align:center;padding:4px 6px;margin:2px;" +
          "border-radius:6px;font-size:12px;font-family:ui-monospace,monospace;" +
          (isPad
            ? "background:transparent;border:1px dashed var(--border);color:var(--text-faint);"
            : "background:var(--accent-soft);color:var(--accent-text);border:1px solid var(--accent);") +
          (isLastReal ? "box-shadow:0 0 0 2px var(--green);" : ""),
        text: t
      });
    }

    function render() {
      view.innerHTML = "";
      view.appendChild(LC.panel("batch 中的两条序列（PAD = 补齐位）", seqLens.map(function (len, si) {
        var row = h("div", { style: "margin:4px 0" });
        row.appendChild(h("span", { class: "demo-label", text: "序列 " + (si + 1) + "（" + len + " token）  " }));
        if (side === 0) {
          for (var p = 0; p < MAX - len; p++) row.appendChild(tokenBox("PAD", true, false));
          for (var i = 0; i < len; i++) row.appendChild(tokenBox("t" + (i + 1), false, i === len - 1));
        } else {
          for (var j = 0; j < len; j++) row.appendChild(tokenBox("t" + (j + 1), false, j === len - 1));
          for (var q = 0; q < MAX - len; q++) row.appendChild(tokenBox("PAD", true, false));
        }
        return row;
      })));
      out.textContent =
        (side === 0 ? "当前：left padding" : "当前：right padding") + "\n" +
        "· 绿框 = 序列最后一个真实 token；生成从它之后的第一个位置开始。\n" +
        "· right padding：序列 2 的生成位后面跟着 PAD，不同长度序列的生成位【错开】——\n" +
        "  且部分实现会对 pad 位置也计算 logits，造成浪费/错位。\n" +
        "· left padding：所有序列的生成位都贴齐 batch 右侧，一次前向拿到所有序列的下一个 token。\n" +
        "→ 这就是 decoder-only 推理默认 left padding、训练常用 right padding 的原因。\n\n" +
        "注意：padding 位必须配 attention_mask=0，否则模型会 attend 到 PAD token。";
    }
    var group = LC.buttonGroup(["left padding", "right padding"], function (i) { side = i; render(); });
    root.appendChild(h("div", { class: "demo-controls" }, [group.el]));
    root.appendChild(view);
    root.appendChild(out);
    render();
  };
})();
