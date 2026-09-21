(function () {
  "use strict";

  function plainText(markdown) {
    return markdown
      .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, " ")
      .replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, " ")
      .replace(/^:::[^\n]*$/gm, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1$2")
      .replace(/[#>*`|]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function sectionsFor(document_, markdown) {
    var sections = [];
    var current = { title: document_.title, body: [] };
    var fence = null;
    function save() {
      sections.push({ title: current.title, text: plainText(current.body.join("\n")) });
    }
    markdown.split("\n").forEach(function (line) {
      var marker = /^\s*(`{3,}|~{3,})/.exec(line);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
        current.body.push(line);
        return;
      }
      var heading = !fence && /^#{2,6}\s+(.+?)(?:\s+#+)?$/.exec(line);
      var step = !fence && /^:::step\s+(\d+)[.、]?\s+(.*)/.exec(line.trim());
      if (heading || step) {
        save();
        current = { title: heading ? plainText(heading[1]) : "Step " + step[1] + " · " + plainText(step[2]), body: [] };
      } else if (fence || !/^#\s/.test(line)) {
        current.body.push(line);
      }
    });
    save();
    return sections;
  }

  function create(options) {
    var input = document.getElementById("searchInput");
    var panel = document.getElementById("searchResults");
    var list = document.getElementById("searchList");
    var summary = document.getElementById("searchSummary");
    var closeButton = document.getElementById("closeSearch");
    var index = Object.create(null);
    var results = [];
    var started = false;
    var ready = false;
    var failed = 0;
    var timer = null;
    var revision = 0;
    var activeQuery = "";
    var escape = options.escapeHtml;

    // 主线章节与按需查阅的参考手册都要可搜索：拆出参考内容后，它仍然属于课程正文。
    var documents = options.chapters.map(function (chapter) {
      return { key: chapter.id, path: chapter.id, title: chapter.title, chapter: chapter, reference: null };
    }).concat((options.references || []).map(function (reference) {
      return {
        key: "reference/" + reference.id,
        path: "reference/" + reference.id,
        title: reference.title,
        chapter: options.chapters.find(function (item) { return item.id === reference.chapter; }) || null,
        reference: reference
      };
    }));

    function hrefFor(document_, section) {
      var heading = section && section !== document_.title ? section : null;
      return document_.reference
        ? options.referenceHref(document_.reference.id, heading)
        : options.chapterHref(document_.chapter.id, heading);
    }

    function close(restoreFocus) {
      revision += 1;
      clearTimeout(timer);
      activeQuery = "";
      panel.hidden = true;
      input.value = "";
      input.setAttribute("aria-expanded", "false");
      if (restoreFocus !== false && panel.contains(document.activeElement)) input.focus();
    }

    function render(query, expectedRevision) {
      if (expectedRevision !== revision || input.value.trim() !== query) return;
      if (!query) { close(false); return; }
      activeQuery = query;
      var needle = query.toLowerCase();
      results = [];
      documents.forEach(function (document_) {
        (index[document_.key] || []).forEach(function (section) {
          var position = section.text.toLowerCase().indexOf(needle);
          if (position < 0 && section.title.toLowerCase().indexOf(needle) < 0) return;
          var begin = position < 0 ? 0 : Math.max(0, position - 45);
          var end = position < 0 ? 110 : position + needle.length + 75;
          var snippet = (begin ? "…" : "") + section.text.slice(begin, end) + (end < section.text.length ? "…" : "");
          results.push({ document: document_, section: section.title, snippet: snippet });
        });
      });
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      summary.textContent = "找到 " + results.length + " 条与「" + query + "」相关的结果" +
        (!ready ? " · 正在建立索引…" : "") +
        (failed ? " · 索引不完整，" + failed + " 章暂未加载，可刷新重试" : "") +
        (results.length > 60 ? " · 显示前 60 条" : "");
      list.innerHTML = results.length ? results.slice(0, 60).map(function (result, resultIndex) {
        return '<a class="search-hit" data-search-index="' + resultIndex + '" href="' + escape(hrefFor(result.document, result.section)) + '">' +
          '<div class="hit-chapter">' + escape(result.document.title) + " · " + escape(result.section) + "</div>" +
          '<div class="hit-snippet">' + escape(result.snippet) + "</div></a>";
      }).join("") : '<div class="search-empty">' +
        (ready ? "没有找到相关内容，换个关键词试试？" : "正在加载课程内容，请稍候…") + "</div>";
    }

    function refresh() {
      if (activeQuery && !panel.hidden) render(activeQuery, revision);
    }

    function start() {
      if (started) return;
      started = true;
      input.setAttribute("aria-label", "搜索课程知识点");
      input.setAttribute("aria-controls", "searchResults");
      input.setAttribute("aria-expanded", "false");
      summary.setAttribute("role", "status");
      summary.setAttribute("aria-live", "polite");
      closeButton.setAttribute("aria-label", "关闭搜索");
      closeButton.addEventListener("click", function () { close(); });
      input.addEventListener("input", function () {
        revision += 1;
        clearTimeout(timer);
        var query = input.value.trim();
        var expectedRevision = revision;
        if (!query) { close(false); return; }
        timer = setTimeout(function () { render(query, expectedRevision); }, 160);
      });
      input.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown" && !panel.hidden) {
          var first = list.querySelector(".search-hit");
          if (first) { event.preventDefault(); first.focus(); }
        }
      });
      panel.addEventListener("click", function (event) {
        if (event.target === panel) { close(); return; }
        var hit = event.target.closest(".search-hit");
        if (!hit || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        var result = results[Number(hit.dataset.searchIndex)];
        if (!result) return;
        event.preventDefault();
        close(false);
        options.onNavigate(result.document.path, result.section);
      });
      document.addEventListener("keydown", function (event) {
        var target = document.activeElement;
        var editing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
        if (event.key === "/" && !editing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
          event.preventDefault();
          input.focus();
        }
        if (event.key === "Escape") { close(); options.closeSidebar(); }
      });
      setTimeout(function () {
        Promise.all(documents.map(function (document_) {
          return Promise.resolve().then(function () {
            return document_.reference ? options.fetchReference(document_.reference) : options.fetchChapter(document_.chapter);
          }).then(function (markdown) {
            index[document_.key] = sectionsFor(document_, markdown);
          }).catch(function () { failed += 1; });
        })).then(function () {
          ready = true;
          refresh();
        });
      }, 0);
    }

    return { start: start, close: close };
  }

  window.CourseSearch = { create: create };
})();
