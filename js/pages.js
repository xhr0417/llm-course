(function () {
  "use strict";
  window.CoursePages = function (options) {
    var chapters = options.chapters, tracks = options.tracks, projects = options.projects, references = options.references || [];
    var escape = options.escapeHtml, progress = options.progress, routes = window.CourseRoutes;
    function chapter(id) { return chapters.find(function (item) { return item.id === id; }); }
    function referenceFor(chapterId) { return references.find(function (item) { return item.chapter === chapterId; }) || null; }
    function name(item) { return item.shortTitle || item.title; }
    function header(title, description, eyebrow) {
      return '<header class="chapter-head"><div class="chapter-eyebrow">' + escape(eyebrow || "LLM Course") +
        '</div><h1 class="chapter-title">' + escape(title) + '</h1><p class="chapter-desc">' + escape(description) + '</p></header>';
    }
    function action(label, href) { return '<a class="btn primary" href="' + href + '">' + escape(label) + ' <span aria-hidden="true">→</span></a>'; }
    function lessonRows(items, track) {
      return '<ol class="lesson-list">' + items.map(function (item, index) {
        return '<li><a class="lesson-row" href="' + routes.href(item.id, track) + '"><span class="lesson-number">' +
          (index + 1).toString().padStart(2, "0") + '</span><span class="lesson-name">' + escape(name(item)) +
          '</span><span class="lesson-status">' + (progress.isRead(item.id) ? "已读" : "进入") + '</span></a></li>';
      }).join("") + '</ol>';
    }
    function home(last) {
      var previous = last && chapter(last.chapterId);
      var track = last && routes.trackFor(tracks, last.trackId);
      var lead = previous ? '<section class="resume-panel"><span class="page-label">上次学到</span><h2>' +
        escape(name(previous)) + '</h2><p>' + escape(track ? track.title : "全部章节") + '</p>' +
        action("继续学习", routes.href(previous.id, track)) + '</section>' :
        '<section class="resume-panel"><span class="page-label">第一次来，从这里开始</span><h2>做出你的第一个 LLM 项目</h2>' +
        '<p>从 Python 工程起步，逐步完成模型评测和 RAG 服务。已有基础可以跳过熟悉的课程。</p>' +
        action("开始学习", "#/track/application") + '</section>';
      return header("一步一步，学会大模型", "理解原理，动手实验，做出能运行的项目。选一条适合你的路线开始。") + lead +
        '<section class="entry-section"><h2>按目标选择路线</h2><ul class="route-list">' + tracks.map(function (item, index) {
          return '<li><a class="route-row" href="#/track/' + item.id + '"><span class="lesson-number">0' + (index + 1) +
            '</span><span><strong>' + escape(item.title) + '</strong><span class="route-description">' + escape(item.outcome) +
            '</span></span><span class="route-meta">' + item.chapters.length + ' 课 <span aria-hidden="true">→</span></span></a></li>';
        }).join("") + '</ul></section>' +
        '<p class="page-note">想查一个知识点？使用顶部搜索，或浏览<a href="#/catalog">全部章节</a>。想直接动手？查看<a href="#/projects">实战项目</a>。</p>';
    }
    function trackPage(track) {
      var items = track.chapters.map(chapter);
      var next = items.find(function (item) { return !progress.isRead(item.id); }) || items[0];
      var read = items.filter(function (item) { return progress.isRead(item.id); }).length;
      return header(track.title, track.description, "学习路线 · " + items.length + " 课") +
        '<div class="route-intro"><p><strong>学完的产出：</strong>' + escape(track.outcome) +
        '</p><p class="page-note">已读 ' + read + ' / ' + items.length + ' 课。按顺序前进，也可以直接进入熟悉的阶段。</p>' +
        action(read ? "继续这条路线" : "从第一课开始", routes.href(next.id, track)) + '</div>' +
        lessonRows(items, track) + '<p class="page-note">阅读标记只记录阅读进度；项目需要按步骤运行测试并完成验收。<a href="#/job-ready">查看项目验收说明</a></p>';
    }
    function catalog() {
      var groups = [];
      chapters.forEach(function (item) {
        var group = groups.find(function (entry) { return entry.title === item.group; });
        if (!group) { group = { title: item.group, items: [] }; groups.push(group); }
        group.items.push(item);
      });
      return header("全部章节", "按主题查阅，随时回到学习路线。这里的章节顺序按教材编排。", chapters.length + " 章 · 知识手册") +
        groups.map(function (group) { return '<section class="entry-section"><h2>' + escape(group.title) + '</h2>' + lessonRows(group.items, null) + '</section>'; }).join("");
    }
    function projectPage() {
      return header("实战项目", "选择一个项目，进入课程开始动手。带练习起点的项目可以跟着步骤完成，参考实现随时可查。", projects.length + " 个可运行项目") +
        '<div class="project-list">' + projects.map(function (item) {
          var repo = "https://github.com/xhr0417/llm-course/tree/main/projects/" + item.id;
          return '<article class="project-card"><span class="page-label">' + escape(item.id) + '</span><h2>' + escape(item.title) +
            '</h2><p>' + escape(item.description) + '</p><a class="project-start" href="' + routes.href(item.chapter, null) + '">' +
            (item.starter ? "开始分步实作" : "进入项目课程") + ' →</a><div class="project-links">' +
            (item.starter ? '<a href="' + repo + '/starter" target="_blank" rel="noopener">练习起点</a>' : '') +
            '<a href="' + repo + '" target="_blank" rel="noopener">参考实现与运行记录</a></div></article>';
        }).join("") + '</div>';
    }
    function footer(item, track) {
      var adjacent = routes.neighbors(chapters, track, item.id);
      function link(id, label, cls) {
        return '<a class="footer-link ' + cls + '" href="' + routes.href(id, track) + '"><span class="fl-label">' + label +
          '</span><span class="fl-title">' + escape(name(chapter(id))) + '</span></a>';
      }
      return '<nav class="chapter-footer" aria-label="课程翻页">' + (adjacent.previous ? link(adjacent.previous, "上一课", "") : '<span></span>') +
        (adjacent.next ? link(adjacent.next, "下一课", "next") : '<a class="footer-link next" href="' + (track ? '#/track/' + track.id : '#/catalog') +
          '"><span class="fl-label">已到最后一课</span><span class="fl-title">返回' + (track ? "学习路线" : "章节目录") + '</span></a>') + '</nav>';
    }
    function lesson(item, track, body, reference) {
      var read = progress.isRead(item.id);
      var routeLink = track ? '<a href="#/track/' + track.id + '">' + escape(track.title) + '</a>' : '<a href="#/catalog">全部章节</a>';
      return '<div class="lesson-context">' + routeLink + '<span> / 第 ' + escape(item.num) + ' 章</span></div>' +
        header(item.title, item.desc, "课程") + '<div class="chapter-actions"><button class="btn' + (read ? " done" : "") +
        '" id="markRead" aria-pressed="' + read + '">' + (read ? "已读完 · 点击取消" : "标记已读") + '</button>' +
        '<span class="page-note">进度保存在此浏览器</span>' +
        (reference ? '<a class="reference-link" href="#/reference/' + reference.id + '">按需查阅本章参考手册 →</a>' : "") +
        '</div><div class="md" id="mdBody">' + body + '</div>' + footer(item, track);
    }
    function referencePage(reference, item, body) {
      return '<div class="lesson-context"><a href="#/' + item.id + '">返回第 ' + escape(item.num) + ' 章</a>' +
        '<span> / 参考手册</span></div>' + header(reference.title, reference.desc, "按需查阅 · 第 " + escape(item.num) + " 章") +
        '<div class="reference-note">这部分不是主线必读内容。遇到具体问题时再打开；完整项目仍以课程中的 starter 和实验验收为准。</div>' +
        '<div class="md" id="mdBody">' + body + '</div>' +
        '<nav class="chapter-footer" aria-label="参考手册导航"><a class="footer-link next" href="#/' + item.id + '">' +
        '<span class="fl-label">返回主线</span><span class="fl-title">' + escape(name(item)) + '</span></a></nav>';
    }
    return { home: home, track: trackPage, catalog: catalog, projects: projectPage, lesson: lesson,
      reference: referencePage, referenceFor: referenceFor };
  };
})();
