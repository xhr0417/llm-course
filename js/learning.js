(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.CourseLearning = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  var KEY = "llm-course-learning";
  var RESULTS = { unchecked: "unchecked", failed: "failed", user_passed: "user_passed" };
  var SOURCE = "user_reported";
  var DIMS = { read: true, implemented: true, verified: true, explained: true };
  var DAY_MS = 24 * 60 * 60 * 1000;
  var INTERVAL_DAYS = [1, 3, 7, 21];
  var FORMS = { explain: true, recall: true, rewrite: true };
  var REVIEW = { passed: "passed", failed: "failed" };

  function emptyState() {
    return { version: 1, criteria: {}, concepts: {}, notes: {}, stuck: {}, reviews: {} };
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
    var blockedPassId = "";
    var onChange = typeof options.onChange === "function" ? options.onChange : function () {};

    function normalizeEvidence(text) {
      return String(text || "").replace(/\s+/g, " ").trim();
    }

    function hasEvidence(text) {
      return normalizeEvidence(text).length > 0;
    }

    function cloneEntry(item) {
      return {
        result: item.result,
        source: item.source || SOURCE,
        evidence: item.evidence || "",
        at: item.at || Date.now()
      };
    }

    function sameSnapshot(a, b) {
      return !!(a && b && a.result === b.result && normalizeEvidence(a.evidence) === normalizeEvidence(b.evidence));
    }

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
          stuck: asObject(parsed && parsed.stuck),
          reviews: asObject(parsed && parsed.reviews)
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

    function currentEvidence(taskId, criterionId) {
      var record = recordOf(taskId, criterionId);
      return record && record.current && record.current.evidence ? String(record.current.evidence) : "";
    }

    function failedHistory(taskId, criterionId) {
      var record = recordOf(taskId, criterionId);
      var history = record && Array.isArray(record.history) ? record.history : [];
      return history.filter(function (item) { return item && item.result === RESULTS.failed; });
    }

    function recordCriterion(taskId, criterionId, result, evidence) {
      if (result !== RESULTS.unchecked && result !== RESULTS.failed && result !== RESULTS.user_passed) return false;
      var note = normalizeEvidence(evidence);
      if (result === RESULTS.user_passed && !hasEvidence(note)) {
        blockedPassId = String(criterionId || "");
        onChange();
        return false;
      }
      blockedPassId = "";
      var key = criterionKey(taskId, criterionId);
      var record = recordOf(taskId, criterionId) || { current: null, history: [] };
      var history = Array.isArray(record.history) ? record.history.slice() : [];
      var next = { result: result, source: SOURCE, evidence: note, at: Date.now() };
      if (record.current && record.current.result) {
        var prev = cloneEntry(record.current);
        if (sameSnapshot(prev, next)) return true;
        history.push(prev);
      }
      state.criteria[key] = {
        current: next,
        history: history
      };
      persist();
      return true;
    }

    function requiredCriteria(task) {
      return (task && task.criteria || []).filter(function (item) { return item.required !== false; });
    }

    function isTaskComplete(task) {
      var required = requiredCriteria(task);
      if (!required.length) return false;
      return required.every(function (item) {
        return currentResult(task.id, item.id) === RESULTS.user_passed && hasEvidence(currentEvidence(task.id, item.id));
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

    function intervalDays() {
      var raw = options.intervalDays;
      if (Array.isArray(raw) && raw.length) {
        var days = raw.map(function (n) { return Number(n); }).filter(function (n) { return n > 0 && isFinite(n); });
        if (days.length) return days;
      }
      return INTERVAL_DAYS.slice();
    }

    function dayMs() {
      var value = Number(options.dayMs);
      return value > 0 && isFinite(value) ? value : DAY_MS;
    }

    function nowMs(now) {
      return typeof now === "number" && isFinite(now) ? now : Date.now();
    }

    function emptyReview(now, days) {
      return {
        dueAt: now + days[0] * dayMs(),
        intervalIndex: 0,
        weak: false,
        current: null,
        history: []
      };
    }

    function reviewOf(conceptId) {
      return state.reviews[conceptId] || null;
    }

    function clampIndex(index, days) {
      var value = typeof index === "number" && isFinite(index) ? Math.floor(index) : 0;
      if (value < 0) return 0;
      if (value > days.length - 1) return days.length - 1;
      return value;
    }

    function armReview(conceptId, now) {
      var id = String(conceptId || "");
      if (!id) return false;
      if (state.reviews[id]) return true;
      state.reviews[id] = emptyReview(nowMs(now), intervalDays());
      persist();
      return true;
    }

    function cloneReviewEntry(item) {
      return {
        result: item.result,
        form: item.form,
        at: item.at || Date.now()
      };
    }

    function recordReview(conceptId, result, form, now) {
      var id = String(conceptId || "");
      if (!id) return false;
      if (result !== REVIEW.passed && result !== REVIEW.failed) return false;
      if (!FORMS[form]) return false;
      var record = state.reviews[id];
      if (!record || typeof record.dueAt !== "number") return false;
      var ts = nowMs(now);
      if (ts < record.dueAt) return true;
      var days = intervalDays();
      var history = Array.isArray(record.history) ? record.history.slice() : [];
      var next = { result: result, form: form, at: ts };
      if (record.current && record.current.result) {
        history.push(cloneReviewEntry(record.current));
      }
      var index = clampIndex(record.intervalIndex, days);
      if (result === REVIEW.passed) index = Math.min(index + 1, days.length - 1);
      else index = 0;
      state.reviews[id] = {
        dueAt: ts + days[index] * dayMs(),
        intervalIndex: index,
        weak: result === REVIEW.failed,
        current: next,
        history: history
      };
      persist();
      return true;
    }

    function dueReviews(now) {
      var ts = nowMs(now);
      var days = intervalDays();
      var items = [];
      Object.keys(state.reviews).forEach(function (id) {
        var row = state.reviews[id];
        if (!row || typeof row.dueAt !== "number" || row.dueAt > ts) return;
        items.push({
          conceptId: id,
          dueAt: row.dueAt,
          intervalIndex: clampIndex(row.intervalIndex, days),
          intervalDays: days[clampIndex(row.intervalIndex, days)],
          weak: !!row.weak,
          lastResult: row.current && row.current.result ? row.current.result : null,
          lastForm: row.current && row.current.form ? row.current.form : null
        });
      });
      items.sort(function (a, b) { return a.dueAt - b.dueAt; });
      return items;
    }

    function weakConcepts() {
      return Object.keys(state.reviews).filter(function (id) {
        return !!(state.reviews[id] && state.reviews[id].weak);
      });
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
      currentEvidence: currentEvidence,
      failedHistory: failedHistory,
      passBlocked: function () { return blockedPassId; },
      isTaskComplete: isTaskComplete,
      conceptDim: conceptDim,
      setConceptDim: setConceptDim,
      note: note,
      setNote: setNote,
      stuck: stuck,
      setStuck: setStuck,
      nextTask: nextTask,
      armReview: armReview,
      recordReview: recordReview,
      reviewOf: reviewOf,
      dueReviews: dueReviews,
      weakConcepts: weakConcepts,
      reset: reset,
      storageStatus: storageStatus
    };
  }

  return {
    create: create,
    KEY: KEY,
    RESULTS: RESULTS,
    INTERVAL_DAYS: INTERVAL_DAYS,
    FORMS: FORMS,
    REVIEW: REVIEW
  };
});
