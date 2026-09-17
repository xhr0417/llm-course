#!/usr/bin/env bash
# 一键部署 GitHub Pages 全球镜像（带门禁）
# 前提：本机已运行 gh auth login 并登录 xhr0417 账号
set -e
cd "$(dirname "$0")/.."

GH_USER="xhr0417"
REPO_NAME="llm-course"

echo "==> [0/4] 检查 GitHub 登录状态"
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ 未登录 GitHub。请先在终端运行：gh auth login"
  exit 1
fi

echo "==> [1/4] 生成静态页、dist + 双门禁校验"
node tools/build-static.js
node tools/validate-static.js
node tools/validate-content.js
node tools/build-dist.js

echo "==> [2/4] 创建仓库（如不存在）并推送"
if gh repo view "$GH_USER/$REPO_NAME" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
  git push -u origin main
else
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push \
    --description "大模型知识体系：从 Transformer 原理到 LLM Training/Systems/Evaluation 的中文交互式课程"
fi

echo "==> [3/4] 配置 GitHub Pages 为 GitHub Actions 源"
# dist/ 由 .github/workflows/ci.yml 的 deploy-pages job 通过 actions/upload-pages-artifact 发布，
# 因此 Pages 必须是 build_type=workflow。若建成 branch 源，deploy-pages 会失败。
if gh api "repos/$GH_USER/$REPO_NAME/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$GH_USER/$REPO_NAME/pages" \
    -H "Accept: application/vnd.github+json" \
    -f "build_type=workflow" >/dev/null \
    && echo "    ✅ Pages 已切换为 GitHub Actions 源" \
    || { echo "    ❌ 无法切换 Pages 源，请手动到 Settings → Pages 选择 GitHub Actions" >&2; exit 1; }
else
  gh api -X POST "repos/$GH_USER/$REPO_NAME/pages" \
    -H "Accept: application/vnd.github+json" \
    -f "build_type=workflow" >/dev/null \
    && echo "    ✅ Pages 已启用（GitHub Actions 源）" \
    || { echo "    ❌ 无法启用 Pages，请手动到 Settings → Pages 选择 GitHub Actions" >&2; exit 1; }
fi

echo "==> [4/4] 完成"
echo "   首页:   https://$GH_USER.github.io/$REPO_NAME/"
echo "   静态页: https://$GH_USER.github.io/$REPO_NAME/chapters/transformer.html"
