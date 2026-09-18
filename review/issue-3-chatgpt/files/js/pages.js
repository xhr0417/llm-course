(function () {
  "use strict";
  window.CoursePages = function (options) {
    var chapters = options.chapters, tracks = options.tracks, references = options.references || [];
    var plan = options.plan;
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
    function materialHref(item) {
      if (item.href) return item.href;
      return routes.href(item.chapterId, null, item.section);
    }
    function materialLink(item) {
      var attrs = item.external ? ' target="_blank" rel="noopener"' : "";
      return '<a href="' + materialHref(item) + '"' + attrs + ">" + escape(item.label) + "</a>";
    }
    function listByRole(task, role) {
      return task.materials.filter(function (item) { return item.role === role; });
    }
    function requiredCriteria(task) {
      return (task.criteria || []).filter(function (item) { return item.required !== false; });
    }
    function stretchCriteria(task) {
      return (task.criteria || []).filter(function (item) { return item.required === false; });
    }
    function home(last) {
      if (options.planError) {
        return header("我的学习", "当前练习暂时无法显示，教材仍可查阅。") +
          '<section class="task-panel" role="alert"><p>没有加载到学习计划，所以这一页无法展示当前练习。</p>' +
          '<p class="page-note">' + escape(options.planError.message || "学习计划加载失败。") + '</p>' +
          '<p><button class="btn primary" id="retryPlan" type="button">重新加载当前练习</button></p></section>' +
          '<p class="page-note">目录、章节和搜索仍然可用。也可以先浏览<a href="#/catalog">全部章节</a>。</p>';
      }
      var stage = plan && plan.stages.find(function (item) { return item.id === plan.currentStageId; });
      var task = plan && plan.tasks.find(function (item) { return item.id === plan.currentTaskId; });
      var conceptsById = {};
      (plan && plan.concepts || []).forEach(function (item) { conceptsById[item.id] = item; });
      if (!stage || !task) {
        if (plan) {
          return header("我的学习", "当前练习暂时无法显示，教材仍可查阅。") +
            '<section class="task-panel" role="alert"><p>学习计划不完整，所以这一页无法展示当前练习。</p>' +
            '<p><button class="btn primary" id="retryPlan" type="button">重新加载当前练习</button></p></section>' +
            '<p class="page-note">目录、章节和搜索仍然可用。也可以先浏览<a href="#/catalog">全部章节</a>。</p>';
        }
        return header("我的学习", "正在载入当前练习。") +
          '<p class="page-note" role="status">教材目录、章节和搜索已经可用。</p>';
      }
      var required = listByRole(task, "required");
      var parallel = listByRole(task, "parallel");
      var after = listByRole(task, "check-after");
      var reference = listByRole(task, "reference");
      var start = required[0];
      var previous = last && chapter(last.chapterId);
      var lastTrack = last && routes.trackFor(tracks, last.trackId);
      var resume = previous ? '<section class="resume-panel"><span class="page-label">上次打开的教材</span><h2>' +
        escape(name(previous)) + '</h2><p>这是阅读位置，不是练习完成，也不表示已掌握。</p>' +
        action("继续阅读", routes.href(previous.id, lastTrack)) + '</section>' : "";
      return header("小模型学习实验室—Attention",
        "当前练习：在空文件里写出因果多头注意力，并检查形状、因果性和数值。",
        "我的学习") +
        '<section class="task-panel"><span class="page-label">当前练习</span><h2>' + escape(task.title) + '</h2>' +
        '<p>' + escape(task.goal) + '</p>' +
        (start ? action("打开必要教材：" + start.label, materialHref(start)) : "") +
        '</section>' +
        '<section class="entry-section"><h2>必要教材</h2><ol class="task-list">' +
        required.map(function (item) { return "<li>" + materialLink(item) + "</li>"; }).join("") +
        '</ol><p class="page-note">先读这些小节再动手。章内交互演示可建立直觉，但不能代替自己写函数。</p></section>' +
        '<section class="entry-section"><h2>在哪里写、输入输出是什么</h2>' +
        '<dl class="task-spec"><dt>写在哪里</dt><dd>' + escape(task.workspace.where) + '</dd>' +
        '<dt>输入</dt><dd>' + escape(task.workspace.inputs) + '</dd>' +
        '<dt>输出</dt><dd>' + escape(task.workspace.outputs) + '</dd></dl></section>' +
        '<section class="entry-section"><h2>实现步骤</h2><ol class="task-list task-steps">' +
        task.steps.map(function (step) {
          return "<li><strong>" + escape(step.title) + "</strong><p>" + escape(step.body) + "</p></li>";
        }).join("") + "</ol></section>" +
        '<section class="entry-section"><h2>如何检查结果</h2><ol class="task-list">' +
        after.map(function (item) { return "<li>" + materialLink(item) + "</li>"; }).join("") +
        '</ol><p class="page-note">本页不代写核心算法，也不在浏览器里运行 Python。先留下一次自己的实现尝试再检查；卡住时可以分层求助，看过参考后重写关键部分并换输入验证。</p></section>' +
        '<section class="entry-section"><h2>验收条件</h2><ol class="task-list">' +
        requiredCriteria(task).map(function (item) {
          return "<li><strong>" + escape(item.label || "验收") + "</strong><p>" + escape(item.text) + "</p></li>";
        }).join("") +
        '</ol>' +
        (stretchCriteria(task).length ? '<h3>拓展（不挡完成）</h3><ol class="task-list">' +
          stretchCriteria(task).map(function (item) {
            return "<li><strong>" + escape(item.label || "拓展") + "</strong><p>" + escape(item.text) + "</p></li>";
          }).join("") + "</ol>" : "") +
        '</section>' +
        '<section class="entry-section"><h2>相关概念</h2><ul class="concept-list">' +
        task.conceptIds.map(function (id) {
          var concept = conceptsById[id];
          return "<li>" + escape(concept ? concept.name : "未命名概念") + "</li>";
        }).join("") + "</ul></section>" +
        '<section class="entry-section"><h2>并行补基础</h2><ul class="task-list">' +
        parallel.map(function (item) { return "<li>" + materialLink(item) + "</li>"; }).join("") +
        '</ul><p class="page-note">卡在 class、reshape 或 broadcasting 时，打开对应小节即可。</p></section>' +
        (reference.length ? '<section class="entry-section"><h2>对照入口</h2><ul class="task-list">' +
          reference.map(function (item) { return "<li>" + materialLink(item) + "</li>"; }).join("") +
          "</ul></section>" : "") +
        resume +
        '<p class="page-note">侧栏「阅读进度」只统计已读教材。已读不是已掌握。想查其他内容，使用顶部搜索或浏览<a href="#/catalog">全部章节</a>。</p>';
    }
    function trackPage(track) {
      var items = track.chapters.map(chapter);
      var next = items.find(function (item) { return !progress.isRead(item.id); }) || items[0];
      var read = items.filter(function (item) { return progress.isRead(item.id); }).length;
      return header(track.title, track.description, "查阅分组 · " + items.length + " 课") +
        '<div class="route-intro"><p class="page-note">这是旧岗位路线留下的查阅分组，不是当前主线。当前任务在<a href="#/">我的学习</a>。</p>' +
        '<p><strong>这条分组覆盖：</strong>' + escape(track.outcome) +
        '</p><p class="page-note">已读 ' + read + ' / ' + items.length + ' 课。阅读标记只表示读过。</p>' +
        action("打开下一篇未读", routes.href(next.id, track)) + '</div>' +
        lessonRows(items, track);
    }
    function catalog() {
      var groups = [];
      chapters.forEach(function (item) {
        var group = groups.find(function (entry) { return entry.title === item.group; });
        if (!group) { group = { title: item.group, items: [] }; groups.push(group); }
        group.items.push(item);
      });
      return header("全部章节", "按主题查阅教材。主线当前任务在「我的学习」，这里的顺序按全书编排。", chapters.length + " 章 · 知识手册") +
        groups.map(function (group) { return '<section class="entry-section"><h2>' + escape(group.title) + '</h2>' + lessonRows(group.items, null) + '</section>'; }).join("");
    }
    function projectPage() {
      return header("已退出主线", "六个旧作业项目不再作为主要学习入口。目录仍留在仓库中，待后续审计后再处理。", "说明") +
        '<section class="task-panel"><p>当前主线从<a href="#/">我的学习</a>进入，任务是小模型学习实验室—Attention。旧书签打开本页不会失效。</p>' +
        '<p>理论教材、交互演示和搜索仍在。需要查阅章节时打开<a href="#/catalog">全部章节</a>。</p>' +
        action("回到我的学习", "#/") + '</section>' +
        '<p class="page-note">第 25–31 章仍可当教材阅读。其中的历史仓库链接已标明可选参考，不是当前作业。</p>';
    }
    function footer(item, track) {
      var adjacent = routes.neighbors(chapters, track, item.id);
      function link(id, label, cls) {
        return '<a class="footer-link ' + cls + '" href="' + routes.href(id, track) + '"><span class="fl-label">' + label +
          '</span><span class="fl-title">' + escape(name(chapter(id))) + '</span></a>';
      }
      return '<nav class="chapter-footer" aria-label="课程翻页">' + (adjacent.previous ? link(adjacent.previous, "上一课", "") : '<span></span>') +
        (adjacent.next ? link(adjacent.next, "下一课", "next") : '<a class="footer-link next" href="' + (track ? '#/track/' + track.id : '#/catalog') +
          '"><span class="fl-label">已到最后一课</span><span class="fl-title">返回' + (track ? "查阅分组" : "章节目录") + '</span></a>') + '</nav>';
    }
    function lesson(item, track, body, reference) {
      var read = progress.isRead(item.id);
      var routeLink = track ? '<a href="#/track/' + track.id + '">' + escape(track.title) + '</a>' : '<a href="#/catalog">全部章节</a>';
      return '<div class="lesson-context">' + routeLink + '<span> / 第 ' + escape(item.num) + ' 章</span></div>' +
        header(item.title, item.desc, "课程") + '<div class="chapter-actions"><button class="btn' + (read ? " done" : "") +
        '" id="markRead" aria-pressed="' + read + '">' + (read ? "已读完 · 点击取消" : "标记已读") + '</button>' +
        '<span class="page-note">已读只保存在此浏览器，不是已掌握</span>' +
        (reference ? '<a class="reference-link" href="#/reference/' + reference.id + '">按需查阅本章参考手册 →</a>' : "") +
        '</div><div class="md" id="mdBody">' + body + '</div>' + footer(item, track);
    }
    function referencePage(reference, item, body) {
      return '<div class="lesson-context"><a href="#/' + item.id + '">返回第 ' + escape(item.num) + ' 章</a>' +
        '<span> / 参考手册</span></div>' + header(reference.title, reference.desc, "按需查阅 · 第 " + escape(item.num) + " 章") +
        '<div class="reference-note">这部分不是主线必读内容。遇到具体问题时再打开。</div>' +
        '<div class="md" id="mdBody">' + body + '</div>' +
        '<nav class="chapter-footer" aria-label="参考手册导航"><a class="footer-link next" href="#/' + item.id + '">' +
        '<span class="fl-label">返回教材</span><span class="fl-title">' + escape(name(item)) + '</span></a></nav>';
    }
    return { home: home, track: trackPage, catalog: catalog, projects: projectPage, lesson: lesson,
      reference: referencePage, referenceFor: referenceFor };
  };
})();
