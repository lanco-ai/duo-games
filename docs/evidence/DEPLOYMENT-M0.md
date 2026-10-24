# M0 部署记录

上线日期：2026-10-23。用户明确要求“你帮我部署”；依此完成部署，未使用工作流。

入口：**https://lancoai.site/duo/**。一人创建房间，把邀请链接发给另一人；当前只有深夜聊天卡可玩。

## 运行位置

| 项目 | 位置 / 设置 |
|---|---|
| 源码 | `/root/duo-games` |
| 当前发布 | `/opt/duo-games/releases/20261023T103156Z` |
| 发布指针 | `/opt/duo-games/current` |
| 进程 | `duo-games.service`，独立 `duo-games` 系统用户，开机自启 |
| 内存上限 | `MemoryMax=200M` |
| 监听 | `127.0.0.1:8790`，不对外开放 Node 端口 |
| 持久数据 | `/var/lib/duo-games/duo.db`，SQLite WAL；目录 0700，数据库 0600 |
| 环境 | Node 22.23.2；`NODE_ENV=production`、`BASE_PATH=/duo/`、`DATA_DIR=/var/lib/duo-games`、`TRUST_PROXY=1` |
| HTTP 配置 | `/etc/nginx/conf.d/duo-games.conf` |
| 路由配置 | `/etc/nginx/snippets/duo-games.conf` |
| 接入位置 | `/etc/nginx/sites-available/hysteria-panel-https.conf` 增加一行 include |
| 原配置备份 | `/var/backups/duo-games/20261023T103240Z/hysteria-panel-https.conf` |

现有域名、DNS 和 HTTPS 证书继续使用。未修改其他应用源码、证书、认证规则或 SNI 分流。nginx 的游戏限流区域与既有业务分开；日志不记录查询参数、凭证、聊天或回答正文。程序只可写自己的 StateDirectory 和私有临时目录。

仓库的 `deploy/` 保存本次安装的配置；发布目录只安装 `ws` 一个生产依赖。已对 `/duo/` 重新构建；初始 JS gzip 24.34 KiB、CSS 6.74 KiB。产物校验值见 `docs/evidence/deployment-manifest.json`。

## 验收与限制

- HTTPS 证书正常校验；`/duo` 返回相对地址 `/duo/`，不会泄漏内部 9444 端口。
- 双独立 Chromium 上下文通过公开域名建房、加入、WSS、同步翻牌、刷新重连、收藏、保存回答、完整 10 张结算及图片展示，无 JavaScript/CSP 错误。
- 首页资源 gzip 正常。服务开机自启、非 root 运行、仅本机监听。nginx 配置检查通过，原有商店返回 200，8444/8445 根入口保持原来的 302 跳转。
- 验收证据：`docs/evidence/deployment-smoke.log`、`deployed-home-mobile.png`、`deployed-game-mobile.png`。复验命令：`DUO_SMOKE_URL=https://lancoai.site/duo/ node scripts/check-deployment.mjs`。脚本仅创建一个临时测试房间，并在结束时删除自己的测试房间，不操作其他房间。
- 第一次自动验收因建房导航后读取响应正文失败而中断，已改为读取浏览器保存的凭证；原日志保留在 `deployment-smoke-attempt1.log`。该次遗留的唯一测试房间通过精确核对房间码、创建时间和测试昵称后清理。首次 systemd 启动也修正了 symlink 入口路径与直接执行检查不匹配的问题；最终使用发布工作目录中的相对 `server.js`，无需更改应用代码。
- 浏览器运行在 VPS 上，通过公开 HTTPS 地址访问；没有真实手机、微信内置浏览器及国内 Wi-Fi/4G 实测。外部网页读取工具未能访问该地址，不能用它作为独立网络可达性的证据。

**现有入口的限流限制：** 公网 443 先经 SNI TCP 代理到 9444，后者看到的是 loopback IP。应用的建房令牌桶因此在此入口共享：初始最多 10 次，每 6 分钟补充 1 次，最多积累 10 次；不是每位访客各有 10 次。游戏 nginx 区域的 30 请求/秒（额外 burst 80）与 100 并发连接也合并计算。已创建房间的加入、继续游戏不消耗建房额度。不能信任浏览器自行发送的 IP 头来绕过此限制；后续开放更多用户时应配置保留真实 IP 的独立 HTTPS 入口，再恢复真正按 IP 限流。现阶段保留现有 SNI 转发，避免影响同机的其他服务。

正在进行的对局仍只存内存；重启后回大厅并提示，收藏、已聊卡片及回答保留。没有新增定时数据库备份任务；生产数据备份需要同时考虑 WAL，应使用 SQLite 在线备份或 `VACUUM INTO`，不要只在运行时复制主数据库文件。

## 日常检查

```bash
systemctl status duo-games.service --no-pager
journalctl -u duo-games.service -n 50 --no-pager
curl --fail https://lancoai.site/duo/api/health
```

需要维护重启时执行 `systemctl restart duo-games.service`，会中断正在进行的局。首次上线前无正式用户，对测试进程做过重启；上线后请先安排维护时间。

## 更新与回退

更新时在源码目录执行 `BASE_PATH=/duo/ npm run build`，把 `dist/server.js`、`dist/web/`、`package.json`、`package-lock.json` 放进新的发布目录，在该目录运行 `npm ci --omit=dev --ignore-scripts`。校验后切换 `current` 指针、重启服务并检查 HTTPS/WSS。保留旧发布目录和 `/var/lib/duo-games`，不要把数据放进发布目录。

后续发布回退时，将 `current` 重新指向本次目录 `/opt/duo-games/releases/20261023T103156Z`，重启 `duo-games.service`，然后检查健康接口；数据库迁移须另行检查兼容性。

若要撤下本次首次部署：仅从现有 HTTPS 虚拟主机删除 `include /etc/nginx/snippets/duo-games.conf;` 这一行，通过 `nginx -t` 后 reload nginx，再执行 `systemctl disable --now duo-games.service`。保留发布文件和数据以便恢复。备份的完整虚拟主机文件只适用于未发生其他配置修改时的即时恢复；不要用旧备份覆盖后续其他业务的配置变更。
