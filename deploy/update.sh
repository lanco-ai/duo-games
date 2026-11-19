#!/usr/bin/env bash
# 在服务器上更新二人世界：拉取 main，在临时目录构建，再发布到 dist 并重启。
# 用法：bash deploy/update.sh            发布
#       bash deploy/update.sh --dry-run  只构建并列出会变化的文件，不发布、不重启
#
# 发布顺序沿用以往做法：先放入新的带哈希资源（旧资源保留，已打开的页面仍能加载），
# 再原子替换 server.js 和首页入口，最后重启服务。重启会让进行中的对局回到大厅。
set -euo pipefail
cd "$(dirname "$0")/.."
APP=$(pwd)
SERVICE=${SERVICE:-duo-games}
export BASE_PATH=${BASE_PATH:-/}
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

git pull --ff-only
npm ci --no-audit --no-fund --loglevel=error

STAGE=$(mktemp -d /tmp/duo-games-build.XXXXXXXX)
cleanup() { git -C "$APP" worktree remove --force "$STAGE/src" 2>/dev/null || true; rm -rf -- "$STAGE"; }
trap cleanup EXIT
git worktree add --quiet --detach "$STAGE/src" HEAD
ln -s "$APP/node_modules" "$STAGE/src/node_modules"
(cd "$STAGE/src" && npm run --silent build >/dev/null)
NEW="$STAGE/src/dist"

changed=0
while IFS= read -r -d '' f; do
  rel=${f#"$NEW"/}
  if ! cmp -s "$f" "$APP/dist/$rel" 2>/dev/null; then echo "变化：$rel"; changed=$((changed + 1)); fi
done < <(find "$NEW" -type f -print0)
echo "共 $changed 个文件不同（$(git rev-parse --short HEAD)）"
if [ "$DRY" = 1 ] || [ "$changed" = 0 ]; then
  [ "$DRY" = 1 ] && echo "演练结束，未发布。" || echo "没有变化，不需要发布。"
  exit 0
fi

umask 022
put() { mkdir -p "$(dirname "$APP/dist/$1")"; cp "$NEW/$1" "$APP/dist/$1.new" && mv -f "$APP/dist/$1.new" "$APP/dist/$1"; }
# 1. 带哈希的资源：只新增，不删旧的
mkdir -p "$APP/dist/web/assets"
cp -n "$NEW"/web/assets/* "$APP/dist/web/assets/"
# 2. 其余静态文件（如 scenes/）：逐个覆盖
while IFS= read -r -d '' f; do
  rel=${f#"$NEW"/}
  case "$rel" in web/assets/*|server.js|web/index.html|web/.vite/manifest.json) continue ;; esac
  put "$rel"
done < <(find "$NEW" -type f -print0)
# 3. 入口最后替换
for rel in web/.vite/manifest.json server.js web/index.html; do put "$rel"; done
systemctl restart "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE" && echo "已发布并重启。" || { echo "重启失败：journalctl -u $SERVICE -n 30"; exit 1; }
