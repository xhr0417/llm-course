(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.CourseProgress = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  var PROGRESS_KEYS = ["read", "lab", "project"];
  var STEP_STATES = ["doing", "done"];

  function create(options) {
    options = options || {};
    var storage = options.storage;
    if (storage === undefined) {
      try { storage = root && root.localStorage; } catch (error) { storage = null; }
    }
    var state = {};
    var persistent = !!storage;
    var onChange = typeof options.onChange === "function" ? options.onChange : function () {};

    function safeGet(key) {
      if (!storage) return null;
      try { return storage.getItem(key); }
      catch (error) { persistent = false; return null; }
    }

    function safeSet(key, value) {
      if (!storage) { persistent = false; return false; }
      try {
        storage.setItem(key, value);
        return true;
      } catch (error) {
        persistent = false;
        return false;
      }
    }

    function migrateProgress(raw) {
      var out = {};
      Object.keys(raw || {}).forEach(function (id) {
        var value = raw[id];
        if (value === true) {
          out[id] = { read: true };
          return;
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) return;
        out[id] = {};
        PROGRESS_KEYS.forEach(function (key) {
          if (value[key]) out[id][key] = true;
        });
        if (value.guided && typeof value.guided === "object" && !Array.isArray(value.guided)) {
          var guided = { steps: {}, ran: !!value.guided.ran, explained: !!value.guided.explained };
          if (value.guided.steps && typeof value.guided.steps === "object" && !Array.isArray(value.guided.steps)) {
            Object.keys(value.guided.steps).forEach(function (stepId) {
              var stepState = value.guided.steps[stepId];
              if (STEP_STATES.indexOf(stepState) !== -1) guided.steps[stepId] = stepState;
            });
          }
          out[id].guided = guided;
        }
      });
      return out;
    }

    function save() {
      safeSet("llm-course-progress", JSON.stringify(state));
      onChange();
    }

    function load() {
      var raw = {};
      var serialized = safeGet("llm-course-progress");
      try { raw = JSON.parse(serialized || "{}"); }
      catch (error) { raw = {}; }
      var needsMigration = Object.keys(raw || {}).some(function (id) { return raw[id] === true; });
      state = migrateProgress(raw);
      if (needsMigration) save();
      return state;
    }

    function isRead(id) {
      return !!(state[id] && state[id].read);
    }

    function countKey(key, chapters) {
      return (chapters || []).filter(function (chapter) {
        return !!(state[chapter.id] && state[chapter.id][key]);
      }).length;
    }

    function toggleRead(id) {
      var entry = state[id] || (state[id] = {});
      if (entry.read) delete entry.read;
      else entry.read = true;
      save();
    }

    function guidedState(chapterId) {
      var entry = state[chapterId] || (state[chapterId] = {});
      if (!entry.guided || typeof entry.guided !== "object") entry.guided = {};
      if (!entry.guided.steps || typeof entry.guided.steps !== "object") entry.guided.steps = {};
      return entry.guided;
    }

    var STEP_UI = {
      todo: { chip: "○ 未开始", button: "▶ 开始这一步", className: "gs-btn primary" },
      doing: { chip: "◐ 进行中", button: "✓ 我已在本地通过（self-check）", className: "gs-btn" },
      done: { chip: "● 完成", button: "● 已完成（点击重置）", className: "gs-btn done" }
    };

    function nextStepState(current) {
      return current === "todo" ? "doing" : (current === "doing" ? "done" : "todo");
    }

    function applyStepUI(element, stepState) {
      var ui = STEP_UI[stepState] || STEP_UI.todo;
      element.setAttribute("data-state", stepState);
      var chip = element.querySelector(".gs-chip");
      if (chip) {
        chip.textContent = ui.chip;
        chip.className = "gs-chip " + stepState;
      }
      var button = element.querySelector(".gs-btn");
      if (button) {
        button.textContent = ui.button;
        button.className = ui.className;
      }
    }

    function setBadge(panel, name, label, badgeState, icon) {
      var element = panel.querySelector('[data-badge="' + name + '"]');
      if (!element) return;
      element.textContent = label + " " + icon;
      element.className = "gl-badge " + badgeState;
    }

    function initGuidedLabs(rootElement, chapterId) {
      if (!rootElement || !rootElement.querySelectorAll) return;
      var labs = rootElement.querySelectorAll(".guided-lab");
      if (!labs.length) return;
      var guided = guidedState(chapterId);

      Array.prototype.forEach.call(labs, function (lab) {
        var steps = Array.prototype.slice.call(lab.querySelectorAll(".guided-step"));
        var panel = lab.querySelector(".gl-progress");
        if (panel) {
          panel.innerHTML =
            '<div class="gl-bar-row"><div class="gl-bar"><div class="gl-bar-fill"></div></div>' +
            '<span class="gl-count"></span></div>' +
            '<details class="gl-check-details"><summary>最终验收自检</summary><div class="gl-badges">' +
            '<span class="gl-badge no" data-badge="learned"></span>' +
            '<span class="gl-badge no" data-badge="implemented"></span>' +
            '<button class="gl-badge no" data-guided="ran" title="手动自检：你在本地真实跑通过吗？"></button>' +
            '<button class="gl-badge no" data-guided="explained" title="手动自检：能不看资料讲清楚吗？"></button>' +
            '</div><div class="gl-note">进度记录在本机浏览器（localStorage，不上传）。打开 Solution 不会自动算完成——' +
            "只有你在本地真实跑过测试，才点「我已在本地通过」。</div></details>";
        }

        function refresh() {
          var done = 0;
          steps.forEach(function (step) {
            var stepId = step.getAttribute("data-step-id");
            var stepState = guided.steps[stepId] || "todo";
            applyStepUI(step, stepState);
            if (stepState === "done") done++;
          });
          var total = steps.length;
          var fill = panel && panel.querySelector(".gl-bar-fill");
          if (fill) fill.style.width = (total ? done / total * 100 : 0) + "%";
          var count = panel && panel.querySelector(".gl-count");
          if (count) count.textContent = "项目步骤 · " + done + " / " + total;
          if (!panel) return;
          var learned = isRead(chapterId);
          setBadge(panel, "learned", "Learned", learned ? "ok" : "no", learned ? "✅" : "❌");
          var implemented = total === 0 ? "no" : (done === total ? "ok" : (done > 0 ? "partial" : "no"));
          setBadge(panel, "implemented", "Implemented", implemented,
            implemented === "ok" ? "✅" : (implemented === "partial" ? "🟡" : "❌"));
          var ran = panel.querySelector('[data-guided="ran"]');
          if (ran) {
            ran.textContent = "Ran " + (guided.ran ? "✅" : "❌");
            ran.className = "gl-badge " + (guided.ran ? "ok" : "no");
          }
          var explained = panel.querySelector('[data-guided="explained"]');
          if (explained) {
            explained.textContent = "Explained " + (guided.explained ? "✅" : "❌");
            explained.className = "gl-badge " + (guided.explained ? "ok" : "no");
          }
        }

        steps.forEach(function (step) {
          var button = step.querySelector(".gs-btn");
          if (!button) return;
          button.addEventListener("click", function () {
            var stepId = step.getAttribute("data-step-id");
            var next = nextStepState(guided.steps[stepId] || "todo");
            if (next === "todo") delete guided.steps[stepId];
            else guided.steps[stepId] = next;
            save();
            refresh();
          });
        });

        if (panel) {
          panel.querySelectorAll("[data-guided]").forEach(function (button) {
            button.addEventListener("click", function () {
              var key = button.getAttribute("data-guided");
              if (key === "ran") guided.ran = !guided.ran;
              else if (key === "explained") guided.explained = !guided.explained;
              save();
              refresh();
            });
          });
        }
        refresh();
      });
    }

    function reset() {
      state = {};
      save();
    }

    function storageStatus() {
      return persistent
        ? { persistent: true, message: "" }
        : { persistent: false, message: "当前浏览器无法保存进度，本次会话仍可继续。" };
    }

    return {
      load: load,
      save: save,
      reset: reset,
      isRead: isRead,
      countKey: countKey,
      toggleRead: toggleRead,
      guidedState: guidedState,
      initGuidedLabs: initGuidedLabs,
      storageStatus: storageStatus
    };
  }

  return { create: create };
});
