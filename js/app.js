(function () {
  "use strict";
  var byId = function (id) { return document.getElementById(id); };
  var root = byId("content"), nav = byId("chapterNav"), sidebar = byId("sidebar");
  var routes = window.CourseRoutes;
  var renderer = CourseRenderer.create({ marked: marked, katex: katex });
  var escape = renderer.escapeHtml;
  var chapters = [], tracks = [], references = [], current = null, currentPath = null, activeTrack = null, pages, search;
  var cache = {}, requestId = 0, pendingSection = null;
  var reader = CourseReader.create({ root: root, tocNav: byId("tocNav"), escapeHtml: escape });
  function stored(key) { try { return localStorage.getItem(key); } catch (error) { return null; } }
  function remember(key, value) { try { localStorage.setItem(key, value); } catch (error) { /* Session remains usable without persistence. */ } }
  var progress = CourseProgress.create({ onChange: function () { updateProgress(); } });
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
    var status = progress.storageStatus();
    byId("storageNotice").hidden = status.persistent;
    byId("storageNotice").textContent = status.message || "";
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
      var retryPlan = byId("retryPlan");
      if (retryPlan) retryPlan.addEventListener("click", loadLearningPlan);
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
      root.innerHTML = pages.lesson(chapter, activeTrack, renderer.renderMarkdown(text, chapter.id), pages.referenceFor(chapter.id));
      byId("markRead").addEventListener("click", function () { progress.toggleRead(chapter.id); });
      progress.initGuidedLabs(root, chapter.id);
      reader.init(chapter.id);
      remember("llm-course-last", JSON.stringify({ chapterId: chapter.id, trackId: activeTrack ? activeTrack.id : null }));
      updateProgress(); window.scrollTo({ top: 0, behavior: "instant" });
      var chapterSection = locationRoute.section || (pendingSection && pendingSection.id === chapter.id && pendingSection.title);
      if (chapterSection) { reader.focusSection(chapterSection); pendingSection = null; }
    }).catch(function (error) {
      if (token !== requestId) return;
      root.innerHTML = '<div class="loading" role="alert">' + escape(error.message) + '<p><button class="btn" id="retryChapter">重新加载</button></p></div>';
      byId("retryChapter").addEventListener("click", route);
    });
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
    byId("backTop").addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeSidebar(); });
  }
  initShell(); progress.load();
  function startRoutingAndSearch() {
    if (search) return;
    window.addEventListener("hashchange", route);
    search = CourseSearch.create({ chapters: chapters, references: references,
      fetchChapter: fetchChapter, fetchReference: fetchReference, escapeHtml: escape,
      chapterHref: function (id) { return routes.href(id, activeTrack); },
      referenceHref: function (id) { return "#/reference/" + encodeURIComponent(id); },
      closeSidebar: closeSidebar,
      onNavigate: function (path, title) {
        if (currentPath === path) { reader.focusSection(title); pendingSection = null; }
        else pendingSection = { id: path, title: title };
      } });
    search.start();
  }
  function applyPlan(plan, error) {
    pages = CoursePages({ chapters: chapters, tracks: tracks, plan: plan, planError: error,
      references: references, progress: progress, escapeHtml: escape });
    startRoutingAndSearch();
    route();
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
    pages = CoursePages({ chapters: chapters, tracks: tracks, plan: null, planError: null,
      references: references, progress: progress, escapeHtml: escape });
    startRoutingAndSearch();
    route();
    return loadLearningPlan();
  }).catch(function (error) {
    root.innerHTML = '<div class="loading" role="alert">' + escape(error.message) + '<p>请通过 HTTP 服务打开课程，然后刷新重试。</p></div>';
  });
})();
