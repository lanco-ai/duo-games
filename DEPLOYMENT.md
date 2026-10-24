# 十款双人游戏部署记录

更新时间：2026-10-23T14:08:06Z（卡通风格前端，见文末「2026-10-23 卡通风格前端」）。上一次：2026-10-23T11:58:51.667Z，用户已授权部署，并在 M0 基础上要求补上其他游戏；那次未使用工作流。

入口：[二人世界](https://lancoai.site/duo/)。十款游戏均已开放。一个人创建房间，把邀请链接发给另一人即可。旧页面需要刷新一次以载入协议 v2。

## 运行位置

| 项目 | 位置 / 设置 |
|---|---|
| 源码 | `/root/duo-games` |
| 当前发布 | `/opt/duo-games/releases/20261023T140722Z`（卡通风格前端） |
| 前一版 | `/opt/duo-games/releases/20261023T115820Z`（十款游戏，原画面） |
| 更早 M0 | `/opt/duo-games/releases/20261023T103156Z` |
| 发布指针 | `/opt/duo-games/current` |
| 进程 | `duo-games.service`，独立 `duo-games` 用户，开机自启 |
| 内存上限 | `MemoryMax=200M` |
| 监听 | `127.0.0.1:8790`，Node 端口仅本机可访问 |
| 持久数据 | `/var/lib/duo-games/duo.db`，SQLite WAL；目录 0700，数据库 0600 |
| 私有照片 | `/var/lib/duo-games/rooms/<room-code>/`，不在公开静态目录中 |
| 环境 | Node 22.23.2；`NODE_ENV=production`、`BASE_PATH=/duo/`、`DATA_DIR=/var/lib/duo-games`、`TRUST_PROXY=1` |
| HTTP 配置 | `/etc/nginx/conf.d/duo-games.conf` |
| 路由配置 | `/etc/nginx/snippets/duo-games.conf` |
| 接入位置 | 现有 `/etc/nginx/sites-available/hysteria-panel-https.conf` 的游戏 include |
| 本次备份 | `/var/backups/duo-games/20261023T140722Z`：在线 SQLite 备份（quick_check ok，3 个房间、3 条战绩）、私有照片目录、nginx snippet、systemd unit、`previous-release.txt` |
| 上次备份 | `/var/backups/duo-games/20261023T115820Z` |

现有域名、证书、SNI 转发和其他应用配置保持原样。本次仅替换游戏发布指针、更新游戏 service 的描述，以及把游戏 nginx 路由上传上限由 16 KiB 调至 2 MiB。应用的 JSON / WS 消息仍限制 16 KiB，照片接口需要房间鉴权。每房间照片累计最多 20 MiB。

程序只可写自己的 StateDirectory 和私有临时目录，使用非 root 用户。发布文件由 root 持有，生产依赖只有 `ws`。日志不记录查询参数、凭证、聊天或回答正文。构建使用 `BASE_PATH=/duo/`；初始 JS gzip 26.10 KiB、CSS 9.55 KiB，其余游戏按需加载。

## 数据保留与回退

切换前使用 Node SQLite `backup()` 在线备份，并执行 `PRAGMA quick_check`。在隔离临时目录中用该备份验证了新版本启动及增量建表，原有 1 个房间和 1 条战绩仍可读取。真实生产数据库继续原地使用，没有替换或清空。新增表为 gallery、custom_content、images，原有 rooms、journal、matches 结构不变。

进行中的局只存内存，服务重启会回大厅；收藏、回答、题目、照片、作品与战绩持久保留。还没有定时备份计划，后续备份应使用 SQLite 在线备份，并同时保存私有照片目录；不要只复制运行中的主数据库文件。

当前卡通版的前一版为 `/opt/duo-games/releases/20261023T115820Z`，支持全部十款游戏。紧急回退时原子切换 `current` 到该版本，重启服务并复验双人流程；页面需刷新。保留新增表和媒体目录；不要直接用发布前备份覆盖当前数据库，以免丢失上线后的内容。回退 nginx 配置时只恢复本次备份的游戏 snippet，经 `nginx -t` 后 reload，不覆盖整个虚拟主机。

## 验收记录

构建、测试、线上检查、产物 SHA-256 和截图保存在 `docs/evidence/`；本次发布路径和备份见 `release-metadata.json`。原 M0 的记录保存在 `DEPLOYMENT-M0.md`、`deployment-manifest-M0.json`、`deployment-status-M0.json` 和 `deployment-smoke-M0.log`。

本次公网验收全部通过，未发现 JavaScript/CSP 错误。发布后服务 active/enabled、`NRestarts=0`，健康检查返回协议 v2；原有网站根入口保持 200，8444/8445 根入口保持 302。`/duo` 正确相对跳转到 `/duo/`，资源 gzip 正常。原房间和战绩全部保留，测试房间已清理；数据库和数据目录权限仍为 0600/0700。

公网验收命令：

```bash
DUO_SMOKE_URL=https://lancoai.site/duo/ node scripts/check-deployment.mjs
```

脚本使用两个独立 Chromium 上下文，验证 HTTPS/WSS、聊天卡完整十张、刷新重连、收藏、回答与纪念图；随后逐一验证九款新游戏的双人进入、按需资源加载、退出结算，并通过代理上传大于 16 KiB 的照片。仅创建一个专用临时测试房间，结束后删除该测试房间及其内容。

自动浏览器运行在 VPS，通过公开 HTTPS 地址访问；不代表真实手机、微信内置浏览器或国内 Wi-Fi/4G 验收。详细玩法验收及差异见 `DELIVERY.md`。

**现有入口的容量限制：** 公网 443 经 SNI TCP 代理到 9444，后者看到 loopback IP。因此建房令牌桶共享：初始最多 10 次，每 6 分钟补充 1 次，上限 10 次。加入已有房间和继续游戏不消耗建房额度。nginx 的 30 请求/秒（额外 burst 80）与 100 并发连接也合并计算。开放更多用户前需配置保留真实 IP 的入口；本次沿用现有转发，不影响同机其他业务。

## 日常检查与更新

```bash
systemctl status duo-games.service --no-pager
journalctl -u duo-games.service -n 50 --no-pager
curl --fail https://lancoai.site/duo/api/health
```

后续更新：先备份 SQLite 与私有照片；在源码目录执行 `BASE_PATH=/duo/ npm run build`，将 `dist/server.js`、`dist/web/`、`package.json`、`package-lock.json` 复制到新的发布目录，再在该目录执行 `npm ci --omit=dev --ignore-scripts`。校验后原子切换 `current` 指针，重启服务并检查 HTTPS/WSS。数据继续保留在 `/var/lib/duo-games`，不要放进版本目录。

## 2026-10-23 卡通风格前端

用户确认上线。本次只换了网页资源：`server.js` 与上一版逐字节相同（SHA-256 `5ccdd57f…0baf`），依赖、nginx 和 systemd 均未改动。改动说明见 `docs/TOON-REDESIGN.md`。

步骤：
1. `BASE_PATH=/duo/ npm run build`，然后跑 `check:size`（首屏 JS 36.9 KiB、CSS 12.6 KiB gzip）和 `scripts/check-subpath.mjs`，都通过。
2. 以 `duo-games` 用户用 `node:sqlite` 的 `backup()` 做在线备份（避免以 root 打开时改掉 WAL/SHM 的属主），`PRAGMA quick_check` 为 ok。照片目录、nginx snippet、unit 一并复制到 `/var/backups/duo-games/20261023T140722Z`。
3. 新建 `/opt/duo-games/releases/20261023T140722Z`：`dist/server.js`、`dist/web`（不含 `.vite` 清单，服务端不读它）、package 文件，`node_modules` 从上一版复制（依赖锁文件相同）。
4. 用备份副本在 127.0.0.1:8794 隔离试启动：健康检查、首页、房间路由、脚本、样式、两个字体、游戏分块、接口全部正常，之后停止试启动进程并删除临时数据。
5. 原子切换 `current` 并重启 `duo-games.service`。服务 active，`NRestarts=0`，进程工作目录为新版本；本地和公网 `/duo/api/health` 都返回协议 v2。
6. 公网逐个检查新资源（间隔 0.4 秒，避开限流）：都是 200，脚本和样式走 gzip。
7. `DUO_SMOKE_URL=https://lancoai.site/duo/ node scripts/check-deployment.mjs` 全部 PASS：HTTPS/WSS、建房和入座、卡片同步与重连、九款游戏双人进入与结算、照片上传、完整十张卡和纪念图，无 JS/CSP 报错，测试房间已删除。
8. 复查：数据库仍是 3 个房间、3 条战绩，数据目录属主不变；`lancoai.site/` 返回 200，8444/8445 返回 302，`/duo` 308 跳到 `/duo/`。

回退（只回退前端，数据不动）：
```bash
ln -sfn /opt/duo-games/releases/20261023T115820Z /opt/duo-games/current.next && mv -Tf /opt/duo-games/current.next /opt/duo-games/current
systemctl restart duo-games.service
curl --fail https://lancoai.site/duo/api/health
```


## 2026-10-24 审核修订

前端坐标和迷宫兼容修复已通过独立审核、93项单测、14项浏览器回归及生产子路径检查。提交和新版本发布完成后更新本文件；过程和证据见 `docs/AUDIT-20261024.md`。原卡通版部署说明已归档到 `docs/evidence/releases/20261023T140722Z-DEPLOYMENT.md`。
