#!/usr/bin/env bash
# 一键发布：静态化 → 更新自己的服务器 → 推送 GitHub 镜像
# 用法：bash tools/publish.sh "更新说明（可选）"
set -e
cd "$(dirname "$0")/.."

MSG="${1:-update: $(date '+%Y-%m-%d %H:%M')}"

echo "==> [1/3] 生成静态阅读页"
node tools/build-static.js

echo "==> [2/3] 更新自有服务器（llm.xhr0417.cn）"
rsync -az --delete --exclude='.DS_Store' --exclude='.git' ./ myserver:/var/www/llm-course/
echo "    完成：https://llm.xhr0417.cn/"

echo "==> [3/3] 推送 GitHub 镜像（xhr0417.github.io/llm-course）"
git add -A
if git diff --cached --quiet; then
  echo "    没有变化，跳过提交"
else
  git -c user.name="xhr0417" -c user.email="19816259397@163.com" commit -m "$MSG"
fi
git push
echo "    完成：https://xhr0417.github.io/llm-course/"

echo ""
echo "✅ 全部发布完成"
echo "   自有服务器：https://llm.xhr0417.cn/"
echo "   全球镜像：  https://xhr0417.github.io/llm-course/"
