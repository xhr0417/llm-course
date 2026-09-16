#!/usr/bin/env bash
# 一键部署 GitHub Pages 全球镜像
# 前提：本机已运行 gh auth login 并登录 xhr0417 账号
set -e
cd "$(dirname "$0")/.."

GH_USER="xhr0417"
REPO_NAME="llm-course"

echo "==> [1/4] 检查 GitHub 登录状态"
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ 未登录 GitHub。请先在终端运行：gh auth login"
  echo "   选择：GitHub.com → HTTPS → Yes → Login with a web browser"
  exit 1
fi
gh auth status 2>&1 | head -3

echo "==> [2/4] 创建仓库并推送"
if gh repo view "$GH_USER/$REPO_NAME" >/dev/null 2>&1; then
  echo "仓库 $GH_USER/$REPO_NAME 已存在，推送更新"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
  git push -u origin main
else
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push \
    --description "大模型知识体系：从深度学习基础到 GRPO/LoRA 的交互式教材（含静态阅读版，适合 AI 抓取）"
fi

echo "==> [3/4] 启用 GitHub Pages"
gh api -X POST "repos/$GH_USER/$REPO_NAME/pages" \
  -H "Accept: application/vnd.github+json" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  && echo "Pages 已启用" \
  || echo "Pages 已启用过或需手动在 Settings → Pages 开启（选 main / root）"

echo "==> [4/4] 完成"
echo ""
echo "🕐 首次生效需 1~3 分钟，之后全球可访问（Fastly CDN）："
echo "   首页:   https://$GH_USER.github.io/$REPO_NAME/"
echo "   静态页: https://$GH_USER.github.io/$REPO_NAME/chapters/transformer.html"
echo "   AI索引: https://$GH_USER.github.io/$REPO_NAME/llms.txt"
echo ""
echo "以后更新内容后重新发布："
echo "   git add -A && git commit -m 'update' && git push"
