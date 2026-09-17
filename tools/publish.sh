#!/usr/bin/env bash
# 一键发布（带门禁）：静态化 → 校验 → 组装 dist → 发布到自有服务器 + GitHub Pages
# 用法：bash tools/publish.sh "更新说明（可选）"
#
# 发布门禁（任一失败立即终止，禁止继续发布）：
#   1) build-static    生成静态页
#   2) validate-static 校验渲染结果
#   3) validate-content 校验内容源
#   4) test-course 路由/渲染/进度测试
#   5) validate-batch2 回归测试（第二批）
#   6) validate-jobs 求职项目门禁
#   7) validate-portfolio 作品集一致性
#   8) validate-guided Guided Build 门禁
#   9) 组装 dist（只发布 dist，不发布源码/审计/工具）
#   10) rsync 自有服务器
#   11) git push GitHub（GitHub Pages workflow 发布 dist）
# 任何一步失败：脚本以非零退出码结束，并明确报告「哪一端成功、哪一端失败」。
set -e
cd "$(dirname "$0")/.."

MSG="${1:-update: $(date '+%Y-%m-%d %H:%M')}"

echo "==> [1/11] 生成静态阅读页"
node tools/build-static.js

echo "==> [2/11] 校验静态渲染（release gate）"
node tools/validate-static.js

echo "==> [3/11] 校验内容源（release gate）"
node tools/validate-content.js

echo "==> [4/11] 运行路由/渲染/进度测试（release gate）"
node --test tools/test-course.js

echo "==> [5/11] 运行第二批回归测试（release gate）"
node tools/validate-batch2.js

echo "==> [6/11] 运行 Job-Ready 项目门禁（release gate）"
node tools/validate-jobs.js

echo "==> [7/11] 运行 Portfolio 一致性门禁（release gate）"
node tools/validate-portfolio.js

echo "==> [8/11] 运行 Guided Build 门禁（release gate）"
node tools/validate-guided.js

echo "==> [9/11] 组装 dist 发布目录"
node tools/build-dist.js

echo "==> [10/11] 发布到自有服务器（llm.xhr0417.cn）"
if rsync -az --delete --exclude='.DS_Store' dist/ myserver:/var/www/llm-course/; then
  echo "    ✅ 服务器发布成功：https://llm.xhr0417.cn/"
else
  echo "    ❌ 服务器发布失败（rsync 出错）——终止发布，GitHub 未更新" >&2
  exit 1
fi

echo "==> [11/11] 推送源码到 GitHub（GitHub Pages workflow 发布 dist）"
git add -A
if git diff --cached --quiet; then
  echo "    没有新变化，跳过提交"
else
  git -c user.name="xhr0417" -c user.email="19816259397@163.com" commit -m "$MSG"
fi
if git push; then
  echo "    ✅ GitHub 发布成功：https://xhr0417.github.io/llm-course/"
else
  echo "    ❌ GitHub push 失败！注意：自有服务器已更新，GitHub 镜像仍是旧版本。" >&2
  echo "       修复网络/权限后重新执行：git push" >&2
  exit 1
fi

echo ""
echo "✅ 全部发布完成（服务器 + GitHub 均成功）"
echo "   自有服务器：https://llm.xhr0417.cn/"
echo "   全球镜像：  https://xhr0417.github.io/llm-course/"
