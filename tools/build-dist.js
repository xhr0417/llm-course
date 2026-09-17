#!/usr/bin/env node
/**
 * Assemble the deployable site. Source, audits and project code stay out of dist/.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

function copy(relativePath) {
  const source = path.join(ROOT, relativePath);
  const target = path.join(DIST, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

[
  "index.html",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
  "chapters",
  "content",
  "css",
  "js",
  "vendor",
].forEach(copy);

const required = ["index.html", "content/manifest.json", "content/tracks.json", "content/references.json"];
required.forEach(function (file) {
  if (!fs.existsSync(path.join(DIST, file))) throw new Error("dist 缺少发布文件：" + file);
});

console.log("✅ dist 构建完成：" + DIST);
