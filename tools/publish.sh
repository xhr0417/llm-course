#!/usr/bin/env bash
# 一键发布（带门禁）：静态化 → 校验 → 发布到自有服务器 + GitHub 镜像
# 用法：bash tools/publish.sh "更新说明（可选）"
#
# 发布门禁（任一失败则终止，禁止 rsync / commit / push）：
#   1) build-static   生成静态页
#   2) validate-static 检查渲染结果（容器残留 / fence 错位 / 内容完整性）
#   3) validate-content 检查内容源（manifest / 容器配平 / demo 注册 / 编号一致）
set -e
cd "$(dirname "$0")/.."

MSG="${1:-update: $(date '+%Y-%m-%d %H:%M')}"

echo "==> [1/4] 生成静态阅读页"
node tools/build-static.js

echo "==> [2/4] 校验静态渲染（release gate）"
node tools/validate-static.js

echo "==> [3/4] 校验内容源（release gate）"
node tools/validate-content.js

echo "==> [4/4] 发布（门禁已通过）"
echo "    - 同步到自有服务器（llm.xhr0417.cn）"
rsync -az --delete --exclude='.DS_Store' --exclude='.git' ./ myserver:/var/www/llm-course/
echo "    - 推送 GitHub 镜像（xhr0417.github.io/llm-course）"
git add -A
if git diff --cached --quiet; then
  echo "      没有变化，跳过提交"
else
  git -c user.name="xhr0417" -c user.email="19816259397@163.com" commit -m "$MSG"
fi
git push 2>&1 | tail -2 || true

echo ""
echo "✅ 全部发布完成"
echo "   自有服务器：https://llm.xhr0417.cn/"
echo "   全球镜像：  https://xhr0417.github.io/llm-course/"
