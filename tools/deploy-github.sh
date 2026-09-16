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

echo "==> [1/4] 生成静态页 + 双门禁校验"
node tools/build-static.js
node tools/validate-static.js
node tools/validate-content.js

echo "==> [2/4] 创建仓库（如不存在）并推送"
if gh repo view "$GH_USER/$REPO_NAME" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
  git push -u origin main
else
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push \
    --description "大模型知识体系：从 Transformer 原理到 LLM Training/Systems/Evaluation 的中文交互式课程"
fi

echo "==> [3/4] 启用 GitHub Pages"
gh api -X POST "repos/$GH_USER/$REPO_NAME/pages" \
  -H "Accept: application/vnd.github+json" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  && echo "Pages 已启用" \
  || echo "Pages 已启用过或需手动在 Settings → Pages 开启（选 main / root）"

echo "==> [4/4] 完成"
echo "   首页:   https://$GH_USER.github.io/$REPO_NAME/"
echo "   静态页: https://$GH_USER.github.io/$REPO_NAME/chapters/transformer.html"
