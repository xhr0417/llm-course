(function () {
  "use strict";

  function create(options) {
    var root = options.root, tocNav = options.tocNav, escapeHtml = options.escapeHtml;
    var headings = [], observer = null, bound = false, quizMemory = {};
    var doc = root.ownerDocument;

    function slug(text) {
      return text.replace(/[^\w\u4e00-\u9fa5]+/g, "-").slice(0, 40);
    }

    function hiddenInFold(element) {
      var parent = element.parentElement;
      while (parent && root.contains(parent)) {
        if (parent.tagName === "DETAILS" && !parent.open) {
          var summary = Array.from(parent.children).find(function (child) { return child.tagName === "SUMMARY"; });
          if (!summary || !summary.contains(element)) return true;
        }
        parent = parent.parentElement;
      }
      return false;
    }

    function markActive(id) {
      tocNav.querySelectorAll(".toc-link").forEach(function (link) {
        var active = link.getAttribute("data-target") === id;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }

    function buildToc() {
      if (observer) observer.disconnect();
      var entries = Array.from(root.querySelectorAll("#mdBody h2, #mdBody h3, #mdBody details.fold > summary"))
        .filter(function (element) {
          if (hiddenInFold(element)) return false;
          if (element.tagName !== "SUMMARY") return true;
          return !element.parentElement.parentElement.closest("details.fold");
        });
      tocNav.innerHTML = entries.map(function (element) {
        var level = element.tagName === "H3" ? 3 : 2;
        return '<a class="toc-link lv' + level + '" href="#' + escapeHtml(element.id) +
          '" data-target="' + escapeHtml(element.id) + '">' + escapeHtml(element.textContent) + "</a>";
      }).join("");
      if (!window.IntersectionObserver || !entries.length) return;
      observer = new IntersectionObserver(function (updates) {
        updates.forEach(function (entry) {
          if (entry.isIntersecting) markActive(entry.target.id);
        });
      }, { rootMargin: "-70px 0px -70% 0px", threshold: 0 });
      entries.forEach(function (element) { observer.observe(element); });
    }

    function initDemos(scope) {
      if (!window.LC || !window.LC.init) return;
      var demos = Array.from(scope.querySelectorAll("[data-demo]"))
        .filter(function (demo) { return !demo.hasAttribute("data-init") && !hiddenInFold(demo); });
      if (!demos.length) return;
      // LC.init only queries descendants; filter here so closed folds keep their demos unmounted.
      window.LC.init({ querySelectorAll: function () { return demos; } });
    }

    function reveal(element) {
      var parent = element.parentElement;
      while (parent && root.contains(parent)) {
        if (parent.tagName === "DETAILS") parent.open = true;
        parent = parent.parentElement;
      }
      buildToc();
      initDemos(root);
      if (typeof options.onSection === "function") {
        options.onSection(String(element.textContent || "").trim());
      }
      // behavior 必须显式给：继承 html{scroll-behavior:smooth} 时这次滚动会被丢弃，停在页面顶部。
      element.scrollIntoView({ block: "start", behavior: "instant" });
      element.setAttribute("tabindex", "-1");
      element.focus({ preventScroll: true });
      markActive(element.id);
    }

    function loadQuizState() {
      try {
        var stored = JSON.parse(localStorage.getItem("llm-course-quiz") || "{}");
        if (stored && typeof stored === "object" && !Array.isArray(stored)) {
          quizMemory = Object.assign({}, stored, quizMemory);
        }
      } catch (_) { /* Answering still works when storage is unavailable. */ }
      return quizMemory;
    }

    function applyQuizAnswer(quiz, chosen) {
      var correct = quiz.getAttribute("data-answer");
      quiz.classList.add("answered");
      quiz.querySelectorAll(".quiz-option").forEach(function (option) {
        var key = option.getAttribute("data-key");
        option.classList.toggle("correct", key === correct);
        option.classList.toggle("wrong", key === chosen && key !== correct);
        option.setAttribute("aria-pressed", String(key === chosen));
      });
      var explanation = quiz.querySelector(".quiz-explain");
      if (explanation) explanation.hidden = false;
      var status = quiz.querySelector(".quiz-status");
      if (status) {
        var ok = chosen === correct;
        status.textContent = ok ? "✓ 回答正确" : "✗ 正确答案：" + correct;
        status.className = "quiz-status " + (ok ? "ok" : "no");
        status.setAttribute("role", "status");
      }
    }

    function onClick(event) {
      if (!event.target.closest) return;
      var link = event.target.closest("a[data-target], a[href^='#sec-']");
      if (link && (tocNav.contains(link) || root.contains(link))) {
        var id = link.getAttribute("data-target") || link.getAttribute("href").slice(1);
        var target = doc.getElementById(id);
        if (target && root.contains(target)) {
          event.preventDefault();
          reveal(target);
          return;
        }
      }
      var option = event.target.closest(".quiz-option");
      if (!option || !root.contains(option)) return;
      var quiz = option.closest(".quiz");
      if (!quiz || quiz.classList.contains("answered")) return;
      var chosen = option.getAttribute("data-key");
      applyQuizAnswer(quiz, chosen);
      var id = quiz.getAttribute("data-quiz-id");
      if (!id) return;
      loadQuizState()[id] = chosen;
      try { localStorage.setItem("llm-course-quiz", JSON.stringify(quizMemory)); }
      catch (_) {
        var status = quiz.querySelector(".quiz-status");
        if (status) status.textContent += "（本次有效，未能保存）";
      }
    }

    function onToggle(event) {
      if (event.target.tagName !== "DETAILS" || !root.contains(event.target)) return;
      buildToc();
      if (event.target.open) initDemos(event.target);
    }

    function init(chapterId) {
      if (!bound) {
        doc.addEventListener("click", onClick);
        root.addEventListener("toggle", onToggle, true);
        bound = true;
      }
      headings = Array.from(root.querySelectorAll("#mdBody h2, #mdBody h3"));
      headings.forEach(function (heading, index) {
        heading.setAttribute("id", "sec-" + index + "-" + slug(heading.textContent));
      });
      root.querySelectorAll("#mdBody details.fold > summary").forEach(function (summary, index) {
        summary.setAttribute("id", "sec-fold-" + index + "-" + slug(summary.textContent));
      });
      buildToc();
      var quizState = loadQuizState();
      root.querySelectorAll(".quiz").forEach(function (quiz, index) {
        var id = chapterId + "-q" + (index + 1);
        quiz.setAttribute("data-quiz-id", id);
        var chosen = quizState[id];
        var valid = Array.from(quiz.querySelectorAll(".quiz-option"))
          .some(function (option) { return option.getAttribute("data-key") === chosen; });
        if (valid) applyQuizAnswer(quiz, chosen);
      });
      initDemos(root);
    }

    function focusSection(title) {
      var text = String(title || "").trim();
      if (!text) return false;
      var searchable = Array.from(root.querySelectorAll("#mdBody h2, #mdBody h3, #mdBody h4, #mdBody h5, #mdBody h6"));
      var target = searchable.find(function (heading) { return heading.textContent.trim() === text; });
      var step = /^Step\s+(\d+)\s*[·.:：-]?/i.exec(text);
      if (!target && step) target = root.querySelector('.guided-step[data-step-id="s' + step[1] + '"] .gs-title');
      if (!target) target = searchable.find(function (heading) { return heading.textContent.includes(text); });
      if (!target) return false;
      reveal(target);
      return true;
    }

    function dispose() {
      if (observer) observer.disconnect();
      observer = null;
      headings = [];
      tocNav.innerHTML = "";
      doc.removeEventListener("click", onClick);
      root.removeEventListener("toggle", onToggle, true);
      bound = false;
    }

    return { init: init, focusSection: focusSection, dispose: dispose };
  }

  window.CourseReader = { create: create };
})();
