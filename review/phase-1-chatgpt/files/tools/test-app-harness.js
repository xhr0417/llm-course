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
        current.childNodes.push(node);
        const voidLike = VOID.has(match[2].toLowerCase()) || /\/$/.test((match[3] || "").trim()) || /\/$/.test(match[0].trim());
        if (!voidLike) stack.push(node);
        continue;
      }
      if (match[4]) {
        const current = stack[stack.length - 1];
        current.childNodes.push({
          tagName: null,
          textContent: decode(match[4]),
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
      style: {},
      hidden: false,
      disabled: false,
      value: "",
      href: "",
      className: "",
      id: "",
      _html: "",
      _writes: 0,
      _listeners: {},
      attributes: Object.create(null),
      ownerDocument: null,
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
        } else if (key === "href") node.href = next;
        else if (key === "class") node.className = next;
        else if (key === "hidden") node.hidden = next === "" || next === "true" || next === "hidden";
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
        node.dispatchEvent({ type: "click", button: 0, preventDefault: function () { this.defaultPrevented = true; } });
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
        let current = node;
        while (current && current.tagName) {
          if (simpleMatch(current, selector)) return current;
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
        node.childNodes.push(child);
        return child;
      },
      getBoundingClientRect: function () {
        return { top: 80, left: 0, width: 100, height: 24, bottom: 104, right: 100 };
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
  return [
    "# " + chapter.title,
    "",
    "## 7.4 Self-Attention 是什么 ★",
    "",
    "GRPO-TOKEN " + chapter.id + " 用于搜索与章节渲染。",
    ""
  ].join("\n");
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
    ["div", { id: "searchResults" }],
    ["div", { id: "searchList" }],
    ["span", { id: "searchSummary" }],
    ["button", { id: "closeSearch" }],
    ["button", { id: "themeToggle" }],
    ["button", { id: "resetProgress" }],
    ["button", { id: "backTop" }],
    ["main", { id: "content" }]
  ].forEach(function (item) { add(item[0], item[1]); });
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
  const storage = Object.create(null);
  const localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem: function (key, value) { storage[key] = String(value); },
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
