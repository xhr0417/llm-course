(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.CourseLearning = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  var KEY = "llm-course-learning";
  var RESULTS = { unchecked: "unchecked", failed: "failed", user_passed: "user_passed" };
  var SOURCE = "user_reported";
  var DIMS = { read: true, implemented: true, verified: true, explained: true };

  function emptyState() {
    return { version: 1, criteria: {}, concepts: {}, notes: {}, stuck: {} };
  }

  function criterionKey(taskId, criterionId) {
    return String(taskId || "") + "::" + String(criterionId || "");
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function create(options) {
    options = options || {};
    var storage = options.storage;
    if (storage === undefined) {
      try { storage = root && root.localStorage; } catch (error) { storage = null; }
    }
    var state = emptyState();
    var persistent = !!storage;
    var onChange = typeof options.onChange === "function" ? options.onChange : function () {};

    function persist() {
      if (!storage) {
        persistent = false;
        onChange();
        return false;
      }
      try {
        storage.setItem(KEY, JSON.stringify(state));
        persistent = true;
        onChange();
        return true;
      } catch (error) {
        persistent = false;
        onChange();
        return false;
      }
    }

    function load() {
      if (!storage) {
        persistent = false;
        state = emptyState();
        return;
      }
      try {
        var raw = storage.getItem(KEY);
        persistent = true;
        if (!raw) {
          state = emptyState();
          return;
        }
        var parsed = JSON.parse(raw);
        state = {
          version: 1,
          criteria: asObject(parsed && parsed.criteria),
          concepts: asObject(parsed && parsed.concepts),
          notes: asObject(parsed && parsed.notes),
          stuck: asObject(parsed && parsed.stuck)
        };
      } catch (error) {
        persistent = false;
        state = emptyState();
      }
    }

    function recordOf(taskId, criterionId) {
      return state.criteria[criterionKey(taskId, criterionId)] || null;
    }

    function currentResult(taskId, criterionId) {
      var record = recordOf(taskId, criterionId);
      var result = record && record.current && record.current.result;
      if (result === RESULTS.failed || result === RESULTS.user_passed) return result;
      return RESULTS.unchecked;
    }

    function failedHistory(taskId, criterionId) {
      var record = recordOf(taskId, criterionId);
      var history = record && Array.isArray(record.history) ? record.history : [];
      var out = history.filter(function (item) { return item && item.result === RESULTS.failed; });
      if (record && record.current && record.current.result === RESULTS.failed) out = out.concat([record.current]);
      return out;
    }

    function recordCriterion(taskId, criterionId, result) {
      if (result !== RESULTS.unchecked && result !== RESULTS.failed && result !== RESULTS.user_passed) return;
      var key = criterionKey(taskId, criterionId);
      var record = recordOf(taskId, criterionId) || { current: null, history: [] };
      var history = Array.isArray(record.history) ? record.history.slice() : [];
      if (record.current && record.current.result && record.current.result !== result) {
        history.push(record.current);
      }
      state.criteria[key] = {
        current: { result: result, source: SOURCE, at: Date.now() },
        history: history
      };
      persist();
    }

    function requiredCriteria(task) {
      return (task && task.criteria || []).filter(function (item) { return item.required !== false; });
    }

    function isTaskComplete(task) {
      var required = requiredCriteria(task);
      if (!required.length) return false;
      return required.every(function (item) {
        return currentResult(task.id, item.id) === RESULTS.user_passed;
      });
    }

    function conceptDim(conceptId, dim) {
      var row = state.concepts[conceptId];
      return !!(row && row[dim]);
    }

    function setConceptDim(conceptId, dim, on) {
      if (!DIMS[dim]) return;
      var row = state.concepts[conceptId] || {};
      row[dim] = !!on;
      state.concepts[conceptId] = row;
      persist();
    }

    function note(taskId, field) {
      var row = state.notes[taskId] || {};
      return row[field] || "";
    }

    function setNote(taskId, field, value) {
      var row = state.notes[taskId] || {};
      row[field] = String(value || "");
      state.notes[taskId] = row;
      persist();
    }

    function stuck(taskId) {
      return state.stuck[taskId] || "";
    }

    function setStuck(taskId, value) {
      state.stuck[taskId] = String(value || "");
      persist();
    }

    function nextTask(plan, task) {
      if (!plan || !task) return null;
      var weeks = (plan.tasks || []).filter(function (item) {
        return item.stageId === task.stageId;
      }).slice().sort(function (a, b) {
        return (a.weekBudget || 0) - (b.weekBudget || 0);
      });
      var index = -1;
      weeks.forEach(function (item, i) { if (item.id === task.id) index = i; });
      if (index < 0) return null;
      return weeks[index + 1] || null;
    }

    function reset() {
      state = emptyState();
      persist();
    }

    function storageStatus() {
      return persistent
        ? { persistent: true, message: "" }
        : { persistent: false, message: "学习记录无法保存到此浏览器，本次会话仍可继续填写。" };
    }

    return {
      load: load,
      recordCriterion: recordCriterion,
      currentResult: currentResult,
      failedHistory: failedHistory,
      isTaskComplete: isTaskComplete,
      conceptDim: conceptDim,
      setConceptDim: setConceptDim,
      note: note,
      setNote: setNote,
      stuck: stuck,
      setStuck: setStuck,
      nextTask: nextTask,
      reset: reset,
      storageStatus: storageStatus
    };
  }

  return { create: create, KEY: KEY, RESULTS: RESULTS };
});
