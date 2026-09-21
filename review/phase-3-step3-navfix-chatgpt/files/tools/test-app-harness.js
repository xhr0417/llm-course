"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const marked = require("../vendor/marked.min.js");
const katex = require("../vendor/katex/katex.js");
const { chapters } = require("../content/manifest.json");
const { tracks } = require("../content/tracks.json");
const { references } = require("../content/references.json");
const plan = require("../content/learning-plan.json");

const ROOT = path.resolve(__dirname, "..");
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

function decode(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function makeClassList(node) {
  function tokens() {
    return new Set(String(node.className || "").split(/\s+/).filter(Boolean));
  }
  function write(set) {
    node.className = Array.from(set).join(" ");
  }
  return {
    add: function (name) { const set = tokens(); set.add(name); write(set); },
    remove: function (name) { const set = tokens(); set.delete(name); write(set); },
    toggle: function (name, force) {
      const set = tokens();
      const on = force === undefined ? !set.has(name) : !!force;
      if (on) set.add(name); else set.delete(name);
      write(set);
      return on;
    },
    contains: function (name) { return tokens().has(name); }
  };
}

function applyAttrs(node, raw) {
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(raw || ""))) {
    const value = match[2] != null ? match[2] : match[3] != null ? match[3] : match[4] != null ? match[4] : "";
    node.setAttribute(match[1], value);
  }
}

function simpleMatch(node, selector) {
  if (!node || !node.tagName) return false;
  if (selector === "*") return true;
  const tokens = selector.match(/(\[[^\]]+\]|[.#]?[A-Za-z_][\w-]*)/g) || [];
  return tokens.every(function (token) {
    if (token[0] === ".") return node.classList.contains(token.slice(1));
    if (token[0] === "#") return node.id === token.slice(1);
    if (token[0] === "[") {
      const body = token.slice(1, -1);
      const prefix = body.indexOf("^=");
      if (prefix !== -1) {
        const key = body.slice(0, prefix);
        const value = body.slice(prefix + 2).replace(/^["']|["']$/g, "");
        const actual = node.getAttribute(key) || "";
        return actual.slice(0, value.length) === value;
      }
      const eq = body.indexOf("=");
      if (eq === -1) return node.getAttribute(body) != null;
      const key = body.slice(0, eq);
      const value = body.slice(eq + 1).replace(/^["']|["']$/g, "");
      return node.getAttribute(key) === value;
    }
    return node.tagName === token.toUpperCase();
  });
}

function walk(node, out) {
  (node.childNodes || []).forEach(function (child) {
    if (child.tagName) {
      out.push(child);
      walk(child, out);
    }
  });
  return out;
}

function queryAll(root, selector) {
  const results = [];
  String(selector).split(",").forEach(function (group) {
    const parts = group.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    let pool = walk(root, []);
    parts.forEach(function (part, index) {
      if (index === 0) {
        pool = pool.filter(function (node) { return simpleMatch(node, part); });
        return;
      }
      const next = [];
      pool.forEach(function (node) {
        walk(node, []).forEach(function (child) {
          if (simpleMatch(child, part)) next.push(child);
        });
      });
      pool = next;
    });
    pool.forEach(function (node) {
      if (results.indexOf(node) === -1) results.push(node);
    });
  });
  return results;
}

function createElementFactory(byId) {
  function unregister(node) {
    if (node.id && byId[node.id] === node) delete byId[node.id];
    (node.childNodes || []).forEach(unregister);
  }

  function parseInto(parent, html) {
    parent.childNodes.forEach(unregister);
    parent.childNodes = [];
    const stack = [parent];
    const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)>|<([a-zA-Z0-9]+)([^>]*)\/?>|([^<]+)/g;
    let match;
    while ((match = re.exec(html))) {
      if (match[0].slice(0, 4) === "<!--") continue;
      if (match[1]) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      if (match[2]) {
        const node = createElement(match[2]);
        applyAttrs(node, match[3] || "");
        const current = stack[stack.length - 1];
        node.parentNode = current;
        node.ownerDocument = current.ownerDocument;
        current.childNodes.push(node);
        const voidLike = VOID.has(match[2].toLowerCase()) || /\/$/.test((match[3] || "").trim()) || /\/$/.test(match[0].trim());
        if (!voidLike) stack.push(node);
        continue;
      }
      if (match[4]) {
        const current = stack[stack.length - 1];
        const text = decode(match[4]);
        if (current.tagName === "TEXTAREA") current.value += text;
        current.childNodes.push({
          tagName: null,
          textContent: text,
          childNodes: [],
          parentNode: current
        });
      }
    }
  }

  function createElement(tag) {
    const node = {
      tagName: String(tag).toUpperCase(),
      childNodes: [],
      parentNode: null,
      style: {
        setProperty: function (name, value) { this[name] = String(value); },
        getPropertyValue: function (name) { return this[name] || ""; }
      },
      hidden: false,
      disabled: false,
      value: "",
      type: "",
      name: "",
      checked: false,
      href: "",
      className: "",
      id: "",
      _html: "",
      _writes: 0,
      _listeners: {},
      attributes: Object.create(null),
      ownerDocument: null,
      get dataset() {
        const data = {};
        Object.keys(node.attributes).forEach(function (key) {
          if (key.slice(0, 5) !== "data-") return;
          const name = key.slice(5).replace(/-([a-z])/g, function (_, letter) { return letter.toUpperCase(); });
          data[name] = node.attributes[key];
        });
        return data;
      },
      get classList() { return makeClassList(node); },
      get parentElement() {
        return node.parentNode && node.parentNode.tagName ? node.parentNode : null;
      },
      get children() {
        return node.childNodes.filter(function (child) { return child.tagName; });
      },
      get textContent() {
        if (!node.childNodes.length && node._text != null) return node._text;
        return node.childNodes.map(function (child) {
          return child.textContent || "";
        }).join("");
      },
      set textContent(value) {
        node.childNodes.forEach(unregister);
        node.childNodes = [];
        node._text = String(value);
        node._html = "";
      },
      get innerHTML() { return node._html; },
      set innerHTML(value) {
        node._writes += 1;
        node._html = String(value == null ? "" : value);
        node._text = null;
        parseInto(node, node._html);
      },
      setAttribute: function (name, value) {
        const key = String(name).toLowerCase();
        const next = value == null ? "" : String(value);
        node.attributes[key] = next;
        if (key === "id") {
          if (node.id && byId[node.id] === node) delete byId[node.id];
          node.id = next;
          if (next) byId[next] = node;
        }         else if (key === "href") node.href = next;
        else if (key === "class") node.className = next;
        else if (key === "hidden") node.hidden = next === "" || next === "true" || next === "hidden";
        else if (key === "type") node.type = next;
        else if (key === "name") node.name = next;
        else if (key === "value") node.value = next;
        else if (key === "checked") node.checked = next !== "false";
      },
      getAttribute: function (name) {
        const key = String(name).toLowerCase();
        if (key === "id") return node.id || null;
        if (key === "href") return node.href || null;
        if (key === "class") return node.className || null;
        return Object.prototype.hasOwnProperty.call(node.attributes, key) ? node.attributes[key] : null;
      },
      removeAttribute: function (name) {
        const key = String(name).toLowerCase();
        delete node.attributes[key];
        if (key === "aria-current") return;
        if (key === "hidden") node.hidden = false;
      },
      addEventListener: function (type, fn) {
        (node._listeners[type] || (node._listeners[type] = [])).push(fn);
      },
      removeEventListener: function (type, fn) {
        node._listeners[type] = (node._listeners[type] || []).filter(function (item) { return item !== fn; });
      },
      dispatchEvent: function (event) {
        event.target = event.target || node;
        event.currentTarget = node;
        (node._listeners[event.type] || []).forEach(function (fn) { fn(event); });
        return !event.defaultPrevented;
      },
      click: function () {
        if (node.tagName === "INPUT") {
          const type = node.type || node.getAttribute("type") || "";
          if (type === "checkbox") node.checked = !node.checked;
          else if (type === "radio") node.checked = true;
        }
        const event = { type: "click", button: 0, target: node, preventDefault: function () { this.defaultPrevented = true; } };
        var current = node;
        while (current && typeof current.dispatchEvent === "function") {
          current.dispatchEvent(event);
          current = current.parentNode;
        }
        if (node.ownerDocument && typeof node.ownerDocument.dispatchEvent === "function") {
          node.ownerDocument.dispatchEvent(event);
        }
        if (node.tagName === "INPUT") {
          node.dispatchEvent({ type: "change", preventDefault: function () { this.defaultPrevented = true; } });
        }
      },
      focus: function () {},
      blur: function () {},
      contains: function (other) {
        let current = other;
        while (current) {
          if (current === node) return true;
          current = current.parentNode;
        }
        return false;
      },
      closest: function (selector) {
        const groups = String(selector).split(",").map(function (item) { return item.trim(); }).filter(Boolean);
        let current = node;
        while (current && current.tagName) {
          if (groups.some(function (group) { return simpleMatch(current, group); })) return current;
          current = current.parentNode;
        }
        return null;
      },
      querySelector: function (selector) {
        return queryAll(node, selector)[0] || null;
      },
      querySelectorAll: function (selector) {
        return queryAll(node, selector);
      },
      appendChild: function (child) {
        child.parentNode = node;
        child.ownerDocument = node.ownerDocument;
        node.childNodes.push(child);
        return child;
      },
      insertBefore: function (child, before) {
        child.parentNode = node;
        child.ownerDocument = node.ownerDocument;
        const index = before ? node.childNodes.indexOf(before) : -1;
        if (index < 0) node.childNodes.push(child);
        else node.childNodes.splice(index, 0, child);
        return child;
      },
      removeChild: function (child) {
        node.childNodes = node.childNodes.filter(function (item) { return item !== child; });
        child.parentNode = null;
        return child;
      },
      replaceChild: function (next, old) {
        const index = node.childNodes.indexOf(old);
        next.parentNode = node;
        next.ownerDocument = node.ownerDocument;
        if (index >= 0) node.childNodes[index] = next;
        else node.childNodes.push(next);
        old.parentNode = null;
        return old;
      },
      replaceWith: function () {
        const parent = node.parentNode;
        const next = arguments[0];
        if (!parent) return;
        if (next && typeof parent.replaceChild === "function") parent.replaceChild(next, node);
        else if (typeof parent.removeChild === "function") parent.removeChild(node);
      },
      getBoundingClientRect: function () {
        var height = node.classList && node.classList.contains("task-context") ? 168 : 24;
        return { top: 58, left: 0, width: 800, height: height, bottom: 58 + height, right: 800 };
      },
      scrollIntoView: function () {}
    };
    return node;
  }

  return createElement;
}

function createEmitter() {
  const map = Object.create(null);
  return {
    addEventListener: function (type, fn) {
      (map[type] || (map[type] = [])).push(fn);
    },
    removeEventListener: function (type, fn) {
      map[type] = (map[type] || []).filter(function (item) { return item !== fn; });
    },
    dispatchEvent: function (event) {
      (map[event.type] || []).forEach(function (fn) { fn(event); });
    }
  };
}

function jsonResponse(data) {
  return {
    ok: true,
    json: async function () { return JSON.parse(JSON.stringify(data)); },
    text: async function () { return JSON.stringify(data); }
  };
}

function textResponse(text) {
  return {
    ok: true,
    json: async function () { throw new Error("not json"); },
    text: async function () { return text; }
  };
}

function failResponse() {
  return { ok: false, status: 404, json: async function () { throw new Error("missing"); }, text: async function () { return ""; } };
}

function chapterMarkdown(chapter) {
  const lines = [
    "# " + chapter.title,
    "",
    "## 7.4 Self-Attention 是什么 ★",
    "",
    "GRPO-TOKEN " + chapter.id + " 用于搜索与章节渲染。",
    ""
  ];
  if (chapter.id === "transformer") {
    lines.push(
      "## 7.5 Q、K、V：三个投影 ★",
      "",
      "QKV placeholder",
      "",
      "## 7.6 为什么标准 Transformer 使用独立的 Q/K 投影？★",
      "",
      "not a week-1 material",
      "",
      "## 7.14 Multi-Head Attention ★",
      "",
      "last required heading",
      ""
    );
  }
  return lines.join("\n");
}

function createFetch(options) {
  options = options || {};
  let planAttempts = 0;
  return async function fetch(url) {
    const target = String(url);
    if (target === "content/manifest.json") return jsonResponse({ chapters: chapters });
    if (target === "content/tracks.json") return jsonResponse({ tracks: tracks });
    if (target === "content/references.json") return jsonResponse({ references: references });
    if (target === "content/learning-plan.json") {
      planAttempts += 1;
      if (options.planGate) await options.planGate;
      if (typeof options.planFailUntil === "number" && planAttempts <= options.planFailUntil) return failResponse();
      if (options.planError) return failResponse();
      return jsonResponse(options.plan || plan);
    }
    if (/\.md$/.test(target)) {
      const file = target.replace(/^content\//, "");
      const chapter = chapters.find(function (item) { return item.file === file; });
      if (chapter) return textResponse(chapterMarkdown(chapter));
      return textResponse("# 参考\n\nGRPO-TOKEN 参考手册\n");
    }
    throw new Error("unexpected fetch " + target);
  };
}

function mountShell(createElement, body) {
  function add(tag, attrs) {
    const node = createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    body.appendChild(node);
    return node;
  }
  const skip = add("a", { "class": "skip-link", href: "#content" });
  skip.textContent = "跳到正文";
  const siteNav = add("nav", { "class": "site-nav" });
  ["#/", "#/catalog"].forEach(function (href, index) {
    const link = createElement("a");
    link.setAttribute("href", href);
    link.textContent = index === 0 ? "我的学习" : "全部章节";
    siteNav.appendChild(link);
  });
  [
    ["button", { id: "menuToggle" }],
    ["aside", { id: "sidebar" }],
    ["div", { id: "overlay" }],
    ["nav", { id: "chapterNav" }],
    ["aside", { id: "tocPanel" }],
    ["nav", { id: "tocNav" }],
    ["span", { id: "progressText" }],
    ["div", { id: "progressFill" }],
    ["p", { id: "storageNotice" }],
    ["input", { id: "searchInput" }],
    ["button", { id: "themeToggle" }],
    ["button", { id: "resetProgress" }],
    ["button", { id: "backTop" }],
    ["main", { id: "content" }]
  ].forEach(function (item) { add(item[0], item[1]); });
  const searchResults = add("div", { id: "searchResults", "class": "search-results" });
  [
    ["span", { id: "searchSummary" }],
    ["button", { id: "closeSearch" }],
    ["div", { id: "searchList", "class": "search-list" }]
  ].forEach(function (item) {
    const node = createElement(item[0]);
    Object.keys(item[1]).forEach(function (key) { node.setAttribute(key, item[1][key]); });
    searchResults.appendChild(node);
  });
}

function bootApp(options) {
  options = options || {};
  const byId = Object.create(null);
  const createElement = createElementFactory(byId);
  const html = createElement("html");
  const body = createElement("body");
  html.appendChild(body);
  mountShell(createElement, body);
  Object.keys(byId).forEach(function (id) { byId[id].ownerDocument = null; });

  const location = { hash: options.hash || "#/" };
  const storage = Object.assign(Object.create(null), options.storage || {});
  const localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem: function (key, value) {
      if ((options.failKeys || []).indexOf(key) !== -1) throw new Error("quota");
      storage[key] = String(value);
    },
    removeItem: function (key) { delete storage[key]; }
  };
  const windowEvents = createEmitter();
  const documentEvents = createEmitter();
  const document = {
    body: body,
    documentElement: html,
    title: "",
    getElementById: function (id) { return byId[id] || null; },
    querySelector: function (selector) { return queryAll(html, selector)[0] || null; },
    querySelectorAll: function (selector) { return queryAll(html, selector); },
    addEventListener: documentEvents.addEventListener,
    removeEventListener: documentEvents.removeEventListener,
    dispatchEvent: documentEvents.dispatchEvent,
    createElement: createElement
  };
  body.ownerDocument = document;
  html.ownerDocument = document;
  Object.keys(byId).forEach(function (id) { byId[id].ownerDocument = document; });

  const ctx = {
    window: null,
    document: document,
    location: location,
    localStorage: localStorage,
    fetch: options.fetch || createFetch(options),
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    queueMicrotask: queueMicrotask,
    Promise: Promise,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Map: Map,
    Set: Set,
    JSON: JSON,
    Error: Error,
    TypeError: TypeError,
    Math: Math,
    Date: Date,
    RegExp: RegExp,
    URLSearchParams: URLSearchParams,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    Infinity: Infinity,
    NaN: NaN,
    marked: marked,
    katex: katex,
    matchMedia: function () {
      return { matches: false, addListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} };
    },
    confirm: function () { return false; },
    IntersectionObserver: function () {
      this.observe = function () {};
      this.disconnect = function () {};
    },
    scrollY: 0,
    scrollTo: function () { ctx.scrollY = 0; },
    addEventListener: windowEvents.addEventListener,
    removeEventListener: windowEvents.removeEventListener,
    dispatchEvent: windowEvents.dispatchEvent
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  ctx.Node = function () {};

  [
    "js/renderer.js",
    "js/course.js",
    "js/pages.js",
    "js/progress.js",
    "js/learning.js",
    "js/reader-ui.js",
    "js/search.js",
    "js/app.js"
  ].forEach(function (file) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  });

  return {
    document: document,
    window: ctx,
    location: location,
    localStorage: localStorage,
    content: byId.content,
    byId: function (id) { return byId[id] || null; },
    go: function (hash) {
      location.hash = hash;
      ctx.dispatchEvent({ type: "hashchange" });
    },
    text: function () { return (byId.content && byId.content.textContent) || ""; },
    html: function () { return (byId.content && byId.content.innerHTML) || ""; },
    writes: function () { return byId.content ? byId.content._writes : 0; }
  };
}

async function settle(times) {
  const count = times || 8;
  for (let index = 0; index < count; index += 1) {
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
  }
}

async function waitFor(fn, timeout) {
  const limit = Date.now() + (timeout || 1500);
  while (Date.now() < limit) {
    if (fn()) return;
    await new Promise(function (resolve) { setTimeout(resolve, 15); });
  }
  throw new Error("timed out waiting: " + fn.toString());
}

module.exports = {
  bootApp,
  createFetch,
  settle,
  waitFor,
  plan,
  chapters
};
