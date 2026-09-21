(function () {
  "use strict";
  var byId = function (id) { return document.getElementById(id); };
  var root = byId("content"), nav = byId("chapterNav"), sidebar = byId("sidebar");
  var routes = window.CourseRoutes;
  var renderer = CourseRenderer.create({ marked: marked, katex: katex });
  var escape = renderer.escapeHtml;
  var chapters = [], tracks = [], references = [], current = null, currentPath = null, activeTrack = null, pages, search;
  var cache = {}, requestId = 0, pendingSection = null;
  var learningPlan = null, planError = null, selectedTaskId = stored("llm-course-current-task");
  var criterionDrafts = {};
  var reader = CourseReader.create({
    root: root, tocNav: byId("tocNav"), escapeHtml: escape,
    onSection: function (title) { syncTaskContext(title); }
  });
  function stored(key) { try { return localStorage.getItem(key); } catch (error) { return null; } }
  function remember(key, value) { try { localStorage.setItem(key, value); } catch (error) { /* Session remains usable without persistence. */ } }
  var progress = CourseProgress.create({ onChange: function () { updateProgress(); } });
  var learning = CourseLearning.create({ onChange: function () { updateStorageNotice(); } });
  function draftKey(taskId, id) { return String(taskId || "") + "::" + String(id || ""); }
  function normalizeNote(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function criterionDraft(taskId, id) { return criterionDrafts[draftKey(taskId, id)] || null; }
  function pageOptions(plan, error) {
    return {
      chapters: chapters, tracks: tracks, plan: plan, planError: error,
      selectedTaskId: selectedTaskId, references: references, progress: progress,
      learning: learning, criterionDraft: criterionDraft, escapeHtml: escape
    };
  }
  function closeSidebar() {
    sidebar.classList.remove("open"); byId("overlay").classList.remove("show");
    byId("menuToggle").setAttribute("aria-expanded", "false");
  }
  function fetchJson(path) {
    return fetch(path).then(function (response) {
      if (!response.ok) throw new Error("无法加载 " + path);
      return response.json();
    });
  }
  function fetchChapter(chapter) {
    if (cache[chapter.id]) return Promise.resolve(cache[chapter.id]);
    return fetch("content/" + chapter.file).then(function (response) {
      if (!response.ok) throw new Error("无法加载 " + chapter.file);
      return response.text();
    }).then(function (text) { cache[chapter.id] = text; return text; });
  }
  function fetchReference(reference) {
    var key = "reference:" + reference.id;
    if (cache[key]) return Promise.resolve(cache[key]);
    return fetch("content/" + reference.file).then(function (response) {
      if (!response.ok) throw new Error("无法加载 " + reference.file);
      return response.text();
    }).then(function (text) { cache[key] = text; return text; });
  }
  function updateProgress() {
    var ids = activeTrack ? activeTrack.chapters : chapters.map(function (chapter) { return chapter.id; });
    var count = ids.filter(progress.isRead).length;
    byId("progressText").textContent = count + " / " + ids.length + " 课";
    byId("progressFill").style.width = (ids.length ? count / ids.length * 100 : 0) + "%";
    nav.querySelectorAll("[data-id]").forEach(function (link) {
      var id = link.getAttribute("data-id");
      link.classList.toggle("done", progress.isRead(id));
      link.classList.toggle("active", !!current && current.id === id);
      if (current && current.id === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    var readButton = byId("markRead");
    if (readButton && current) {
      var read = progress.isRead(current.id);
      readButton.textContent = read ? "已读完 · 点击取消" : "标记已读";
      readButton.classList.toggle("done", read);
      readButton.setAttribute("aria-pressed", String(read));
    }
    updateStorageNotice();
  }
  function updateStorageNotice() {
    var notice = byId("storageNotice");
    if (!notice) return;
    var progressStatus = progress.storageStatus();
    var learningStatus = learning.storageStatus();
    if (progressStatus.persistent && learningStatus.persistent) {
      notice.hidden = true;
      notice.textContent = "";
      return;
    }
    notice.hidden = false;
    if (!progressStatus.persistent && !learningStatus.persistent) {
      notice.textContent = "阅读进度与学习记录都无法保存到此浏览器。本次会话仍可继续填写。";
    } else if (!learningStatus.persistent) {
      notice.textContent = learningStatus.message;
    } else {
      notice.textContent = progressStatus.message;
    }
  }
  function renderNav() {
    var items = activeTrack ? activeTrack.chapters.map(function (id) { return chapters.find(function (chapter) { return chapter.id === id; }); }) : chapters;
    var group = "";
    nav.innerHTML = (activeTrack ? '<a class="nav-group-label" href="#/track/' + activeTrack.id + '">' + escape(activeTrack.title) + '</a>' : "") +
      items.map(function (chapter) {
        var label = "";
        if (!activeTrack && group !== chapter.group) { group = chapter.group; label = '<div class="nav-group-label">' + escape(group) + '</div>'; }
        return label + '<a class="nav-item" data-id="' + chapter.id + '" href="' + routes.href(chapter.id, activeTrack) + '"><span class="nav-num">' +
          escape(chapter.num) + '</span><span class="nav-title">' + escape(chapter.shortTitle || chapter.title) + '</span><span class="nav-check" aria-label="已读">✓</span></a>';
      }).join("");
    updateProgress();
  }
  function readLast() {
    try { return routes.readLast(localStorage, chapters, tracks); } catch (error) { return null; }
  }
  function entry(html, title) {
    root.innerHTML = html;
    document.title = title + " · LLM Course";
    document.body.classList.add("entry-page");
    byId("tocPanel").hidden = true;
    byId("tocNav").innerHTML = "";
    window.scrollTo({ top: 0 });
  }
  function route() {
    if (location.hash && !location.hash.startsWith("#/")) return;
    if (currentPath === "home") syncDraftsFromDom();
    var token = ++requestId, locationRoute = routes.parse(location.hash), path = locationRoute.page;
    if (pendingSection && pendingSection.id !== path) pendingSection = null;
    current = null; currentPath = path;
    reader.dispose(); closeSidebar();
    activeTrack = path.startsWith("track/") ? routes.trackFor(tracks, path.slice(6)) : routes.context(tracks, locationRoute);
    renderNav();
    document.querySelectorAll(".site-nav a").forEach(function (link) {
      var href = link.getAttribute("href");
      var selected = (href === "#/" && path === "home") || href === "#/" + path;
      if (selected) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    if (path === "home") {
      entry(pages.home(readLast()), "我的学习");
      bindHome();
      return;
    }
    if (path === "catalog") return entry(pages.catalog(), "全部章节");
    if (path === "projects") return entry(pages.projects(), "已退出主线");
    if (path.startsWith("track/") && activeTrack) return entry(pages.track(activeTrack), activeTrack.title);
    if (path.startsWith("reference/")) {
      var reference = references.find(function (item) { return item.id === path.slice(10); });
      var referenceChapter = reference && chapters.find(function (item) { return item.id === reference.chapter; });
      if (!reference || !referenceChapter) return entry('<h1>没有找到这一页</h1><p><a href="#/">返回我的学习</a></p>', "页面不存在");
      current = referenceChapter;
      document.body.classList.remove("entry-page");
      byId("tocPanel").hidden = false;
      document.title = reference.title + " · LLM Course";
      root.innerHTML = '<div class="loading" role="status">正在加载参考手册…</div>';
      fetchReference(reference).then(function (text) {
        if (token !== requestId) return;
        root.innerHTML = pages.reference(reference, referenceChapter, renderer.renderMarkdown(text, "reference/" + reference.id));
        reader.init(referenceChapter.id);
        updateProgress(); window.scrollTo({ top: 0, behavior: "instant" });
        var referenceSection = locationRoute.section || (pendingSection && pendingSection.id === path && pendingSection.title);
        if (referenceSection) { reader.focusSection(referenceSection); pendingSection = null; }
      }).catch(function (error) {
        if (token !== requestId) return;
        root.innerHTML = '<div class="loading" role="alert">' + escape(error.message) + '</div>';
      });
      return;
    }
    var chapter = chapters.find(function (item) { return item.id === path; });
    if (!chapter) return entry('<h1>没有找到这一页</h1><p><a href="#/">返回我的学习</a></p>', "页面不存在");
    current = chapter;
    document.body.classList.remove("entry-page");
    byId("tocPanel").hidden = false;
    updateProgress();
    document.title = (chapter.shortTitle || chapter.title) + " · LLM Course";
    root.innerHTML = '<div class="loading" role="status">正在加载课程…</div>';
    fetchChapter(chapter).then(function (text) {
      if (token !== requestId) return;
      root.innerHTML = pages.lesson(chapter, activeTrack, renderer.renderMarkdown(text, chapter.id), pages.referenceFor(chapter.id), locationRoute.section);
      byId("markRead").addEventListener("click", function () { progress.toggleRead(chapter.id); });
      progress.initGuidedLabs(root, chapter.id);
      reader.init(chapter.id);
      remember("llm-course-last", JSON.stringify({ chapterId: chapter.id, trackId: activeTrack ? activeTrack.id : null }));
      updateProgress(); window.scrollTo({ top: 0, behavior: "instant" });
      var chapterSection = locationRoute.section || (pendingSection && pendingSection.id === chapter.id && pendingSection.title);
      if (chapterSection) { reader.focusSection(chapterSection); pendingSection = null; }
      else measureTaskContext();
    }).catch(function (error) {
      if (token !== requestId) return;
      root.innerHTML = '<div class="loading" role="alert">' + escape(error.message) + '<p><button class="btn" id="retryChapter">重新加载</button></p></div>';
      byId("retryChapter").addEventListener("click", route);
    });
  }
  function currentPlanTask() {
    if (!learningPlan || !learningPlan.tasks || !learningPlan.tasks.length) return null;
    return learningPlan.tasks.find(function (item) { return item.id === selectedTaskId; })
      || learningPlan.tasks.find(function (item) { return item.id === learningPlan.currentTaskId; })
      || learningPlan.tasks[0];
  }
  function measureTaskContext() {
    var bar = root && root.querySelector(".task-context");
    var height = bar && bar.getBoundingClientRect ? Math.ceil(bar.getBoundingClientRect().height) : 0;
    var style = document.documentElement && document.documentElement.style;
    if (!style) return;
    if (typeof style.setProperty === "function") style.setProperty("--task-context-h", height + "px");
    else style["--task-context-h"] = height + "px";
  }
  function replaceNode(existing, next) {
    if (!existing || !next) return;
    if (typeof existing.replaceWith === "function") {
      existing.replaceWith(next);
      return;
    }
    var parent = existing.parentNode;
    if (parent && typeof parent.replaceChild === "function") parent.replaceChild(next, existing);
  }
  function syncTaskContext(section) {
    var existing = root && root.querySelector(".task-context");
    if (!existing || !current || !pages || typeof pages.taskContext !== "function") {
      measureTaskContext();
      return;
    }
    var html = pages.taskContext(current, section || null);
    if (!html) {
      if (existing.parentNode && typeof existing.parentNode.removeChild === "function") {
        existing.parentNode.removeChild(existing);
      } else if (typeof existing.remove === "function") existing.remove();
      measureTaskContext();
      return;
    }
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    var next = wrap.querySelector ? wrap.querySelector(".task-context") : wrap.firstChild;
    if (next) replaceNode(existing, next);
    measureTaskContext();
  }
  function paintHome() {
    var y = typeof window.scrollY === "number" ? window.scrollY : 0;
    syncDraftsFromDom();
    entry(pages.home(readLast()), "我的学习");
    bindHome();
    if (typeof window.scrollTo === "function") window.scrollTo(0, y);
  }
  function readCriterionForm(id) {
    var task = currentPlanTask();
    var draft = task ? criterionDraft(task.id, id) : null;
    var area = root.querySelector('textarea[data-evidence="' + id + '"]');
    return {
      result: draft ? draft.result : (task ? learning.currentResult(task.id, id) : "unchecked"),
      evidence: area ? area.value : (draft ? draft.evidence : "")
    };
  }
  function formDiffers(taskId, id, form) {
    return form.result !== learning.currentResult(taskId, id)
      || normalizeNote(form.evidence) !== normalizeNote(learning.currentEvidence(taskId, id));
  }
  function rememberDraft(id, form) {
    var task = currentPlanTask();
    if (!task) return;
    var next = form || readCriterionForm(id);
    if (formDiffers(task.id, id, next)) criterionDrafts[draftKey(task.id, id)] = next;
    else delete criterionDrafts[draftKey(task.id, id)];
  }
  function setUnsavedNotice(id, dirty) {
    var note = root.querySelector('[data-unsaved="' + id + '"]');
    if (!note) return;
    note.hidden = !dirty;
    if (dirty) note.setAttribute("role", "status");
    else note.removeAttribute("role");
  }
  function markDraft(id, form) {
    var task = currentPlanTask();
    if (!task) return;
    rememberDraft(id, form);
    setUnsavedNotice(id, !!criterionDraft(task.id, id));
  }
  function syncDraftsFromDom() {
    if (!root) return;
    root.querySelectorAll("textarea[data-evidence]").forEach(function (area) {
      rememberDraft(area.getAttribute("data-evidence"));
    });
  }
  function saveCriterion(id) {
    var task = currentPlanTask();
    if (!task) return;
    var form = readCriterionForm(id);
    var ok = learning.recordCriterion(task.id, id, form.result, form.evidence);
    if (ok) {
      delete criterionDrafts[draftKey(task.id, id)];
      if (form.result === "user_passed" && learning.armReview) {
        var item = (task.criteria || []).find(function (entry) { return entry.id === id; });
        if (item && item.conceptId) learning.armReview(item.conceptId);
      }
    } else {
      criterionDrafts[draftKey(task.id, id)] = form;
    }
    paintHome();
  }
  function bindHome() {
    updateStorageNotice();
    var retryPlan = byId("retryPlan");
    if (retryPlan) retryPlan.addEventListener("click", loadLearningPlan);
    root.querySelectorAll("[data-week]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!learningPlan) return;
        var week = Number(button.getAttribute("data-week"));
        var task = learningPlan.tasks.find(function (item) { return item.weekBudget === week; });
        if (!task) return;
        syncDraftsFromDom();
        selectedTaskId = task.id;
        remember("llm-course-current-task", task.id);
        pages = CoursePages(pageOptions(learningPlan, planError));
        route();
      });
    });
    root.querySelectorAll("input[data-check]").forEach(function (input) {
      input.addEventListener("change", function () {
        if (!input.checked) return;
        var id = input.getAttribute("data-check");
        var area = root.querySelector('textarea[data-evidence="' + id + '"]');
        markDraft(id, { result: input.value, evidence: area ? area.value : "" });
      });
    });
    root.querySelectorAll("textarea[data-evidence]").forEach(function (area) {
      area.addEventListener("input", function () {
        markDraft(area.getAttribute("data-evidence"));
      });
      area.addEventListener("change", function () {
        markDraft(area.getAttribute("data-evidence"));
      });
    });
    root.querySelectorAll("[data-save-check]").forEach(function (button) {
      button.addEventListener("click", function () {
        saveCriterion(button.getAttribute("data-save-check"));
      });
    });
    root.querySelectorAll("input[data-concept]").forEach(function (input) {
      input.addEventListener("change", function () {
        learning.setConceptDim(input.getAttribute("data-concept"), input.getAttribute("data-dim"), input.checked);
      });
    });
    root.querySelectorAll("textarea[data-note]").forEach(function (input) {
      input.addEventListener("change", function () {
        var task = currentPlanTask();
        if (!task) return;
        learning.setNote(task.id, input.getAttribute("data-note"), input.value);
      });
    });
    root.querySelectorAll("textarea[data-stuck]").forEach(function (input) {
      input.addEventListener("change", function () {
        var task = currentPlanTask();
        if (!task) return;
        learning.setStuck(task.id, input.value);
      });
    });
    var advance = byId("advanceTask");
    if (advance) {
      advance.addEventListener("click", function () {
        var task = currentPlanTask();
        var next = task ? learning.nextTask(learningPlan, task) : null;
        if (!next) return;
        selectedTaskId = next.id;
        remember("llm-course-current-task", selectedTaskId);
        pages = CoursePages(pageOptions(learningPlan, planError));
        route();
      });
    }
  }
  function initShell() {
    document.querySelector(".skip-link").addEventListener("click", function (event) {
      event.preventDefault(); root.focus(); window.scrollTo({ top: 0 });
    });
    var theme = stored("llm-course-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    byId("themeToggle").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next); remember("llm-course-theme", next);
    });
    byId("menuToggle").addEventListener("click", function () {
      var open = !sidebar.classList.contains("open");
      sidebar.classList.toggle("open", open); byId("overlay").classList.toggle("show", open);
      byId("menuToggle").setAttribute("aria-expanded", String(open));
    });
    byId("overlay").addEventListener("click", closeSidebar);
    byId("resetProgress").addEventListener("click", function () {
      if (confirm("确定要重置阅读和项目步骤进度吗？")) { progress.reset(); route(); }
    });
    window.addEventListener("scroll", function () { byId("backTop").hidden = window.scrollY < 500; }, { passive: true });
    window.addEventListener("resize", measureTaskContext);
    byId("backTop").addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeSidebar(); });
  }
  initShell(); progress.load(); learning.load();
  function startRoutingAndSearch() {
    if (search) return;
    window.addEventListener("hashchange", route);
    search = CourseSearch.create({ chapters: chapters, references: references,
      fetchChapter: fetchChapter, fetchReference: fetchReference, escapeHtml: escape,
      chapterHref: function (id, section) { return routes.href(id, activeTrack, section); },
      referenceHref: function (id, section) {
        var href = "#/reference/" + encodeURIComponent(id);
        if (section) href += "?section=" + encodeURIComponent(section);
        return href;
      },
      closeSidebar: closeSidebar,
      onNavigate: function (path, title) {
        if (currentPath === path) {
          reader.focusSection(title);
          pendingSection = null;
          return;
        }
        pendingSection = { id: path, title: title };
        var href = path.indexOf("reference/") === 0
          ? "#/reference/" + encodeURIComponent(path.slice("reference/".length))
          : routes.href(path, activeTrack, title);
        if (location.hash === href) route();
        else location.hash = href;
      } });
    search.start();
  }
  function applyPlan(plan, error) {
    learningPlan = plan;
    planError = error;
    if (plan && selectedTaskId && !plan.tasks.some(function (item) { return item.id === selectedTaskId; })) {
      selectedTaskId = null;
    }
    pages = CoursePages(pageOptions(plan, error));
    startRoutingAndSearch();
    if (currentPath === "home") route();
  }
  function loadLearningPlan() {
    return fetchJson("content/learning-plan.json").then(function (plan) {
      applyPlan(plan, null);
    }, function (error) {
      applyPlan(null, error);
    });
  }
  Promise.all([fetchJson("content/manifest.json"), fetchJson("content/tracks.json"), fetchJson("content/references.json")]).then(function (data) {
    chapters = data[0].chapters; tracks = data[1].tracks; references = data[2].references;
    renderer.setCatalog({ chapters: chapters, tracks: tracks });
    pages = CoursePages(pageOptions(null, null));
    startRoutingAndSearch();
    route();
    return loadLearningPlan();
  }).catch(function (error) {
    root.innerHTML = '<div class="loading" role="alert">' + escape(error.message) + '<p>请通过 HTTP 服务打开课程，然后刷新重试。</p></div>';
  });
})();
