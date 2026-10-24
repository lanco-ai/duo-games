# 双人游戏部署记录

更新时间：2026-10-24 10:16:54（北京时间）。用户授权核查、测试、审核、提交和部署，按原有发布方式逐项核验；未使用工作流。

入口：[二人世界](https://lancoai.site/duo/)。十款游戏均开放。旧页面刷新一次，载入本次画板/拼图坐标和迷宫兼容修复。应用通信协议保持 v2。

## 当前版本

| 项目 | 当前设置 |
|---|---|
| 当前发布 | `/opt/duo-games/releases/20261024T021608Z` |
| 前一版 | `/opt/duo-games/releases/20261023T140722Z`，卡通界面原版 |
| Git 源码提交 | `46d39935baca13a2872ea67b895a8246564b7848` |
| 发布指针 | `/opt/duo-games/current` |
| 私有备份 | `/var/backups/duo-games/20261024T021608Z` |
| 源码目录 | `/root/duo-games` |
| 服务 | `duo-games.service`，`duo-games` 用户，开机自启 |
| 监听 | `127.0.0.1:8790`；公网通过 nginx `/duo/` 接入 |
| 持久数据 | `/var/lib/duo-games/duo.db`；照片在同目录 `rooms/<room-code>/` |
| 权限与资源 | 数据目录 0700、DB/WAL/SHM 0600；`MemoryMax=200M` |
| 环境 | Node 22.23.2，`BASE_PATH=/duo/`，`TRUST_PROXY=1` |

本次仅改变网页资源及审核/发布记录。`server.js` 与前一版 SHA-256 相同，依赖锁文件相同；nginx、systemd unit、证书和其他站点配置没有改动。发布目录记录 `SOURCE_COMMIT`，私有数据和备份不进入 Git。

## 已执行的发布步骤

1. 独立审核修复画板/拼图内容坐标和旧浏览器迷宫宽度；93 项单测、14 项完整双人浏览器回归通过。
2. `BASE_PATH=/duo/ npm run build`，体积检查及双人 `/duo/` 子路径自检通过。初始 JS 36.88 KiB、CSS 12.66 KiB gzip，两款字体随项目提供。
3. 创建本地 Git 提交 `46d3993`。仓库没有配置远端，因此没有推送远端或创建 PR。
4. 以服务账号执行 SQLite `backup()` 在线快照，`PRAGMA quick_check` 为 ok；备份包含 6 个房间、7 条战绩、4 件作品。复制照片后按快照图片表校验文件存在、类型及大小（本次图片记录为 0），再将备份标为有效。服务配置、nginx 片段、上一版路径和校验记录一并保存，数据属主保持不变。
5. 新发布目录复用锁文件相同的生产依赖。使用备份副本，以服务账号在 8794 端口隔离试启动，健康检查、页面、房间路由、30 个资源（含两款字体）逐字节校验通过；临时进程和数据已清理。
6. 校验原指针及配置未发生其他改动后，原子切换 `current` 并重启游戏服务。确认进程工作目录为新版本，本地及公网健康检查均正常。
7. 公网按间隔逐个读取 30 个资源，全部与发布目录一致；JS/CSS gzip 正常。公网双人冒烟全部通过：完整十张聊天卡、其余九款游戏、照片上传、纪念图及两款字体正常，无浏览器报错，脚本自建房间已清理。
8. 发布后独立复核 33 个运行文件与构建/包文件一致。数据库完整性为 ok，备份中的全部原始记录仍在，保留 6 个房间、7 条战绩、4 件作品；服务运行正常，意外重启计数为 0。主站 200、8444/8445 入口 302、`/duo` 跳转 308 均符合预期。本地及公网健康接口均为 200/v2，结果见 `docs/evidence/audit-20261024/`。

## 验收证据

审核结论、修复和测试范围见 [AUDIT-20261024.md](docs/AUDIT-20261024.md)。当前发布指针及备份见 `docs/evidence/release-metadata.json`，产物摘要见 `deployment-manifest.json`，复查结果见 `deployment-status.json`。历史证据在 `docs/evidence/releases/`，不再把历史版本当作当前发布。

复验命令：

```bash
DUO_SMOKE_URL=https://lancoai.site/duo/ DUO_SMOKE_DIR=docs/evidence/audit-20261024 node scripts/check-deployment.mjs
```

冒烟检查两款字体真正加载、HTTPS/WSS、建房入座、完整十张聊天卡、刷新重连、收藏和回答、纪念图、九款游戏双人进入与退出结算及大于 16 KiB 的照片上传。捕获浏览器 `pageerror` 和控制台 error；只删除脚本新建的测试房间。

## 回退

回退到本次发布前的卡通版，数据保持原位：

```bash
ln -s /opt/duo-games/releases/20261023T140722Z /opt/duo-games/current.rollback-20261024
mv -Tf /opt/duo-games/current.rollback-20261024 /opt/duo-games/current
systemctl restart duo-games.service
curl --fail https://lancoai.site/duo/api/health
```

先确认临时回退指针不存在，避免覆盖其他维护任务的文件。回退后应复验公开页面及双人流程。不要用旧数据库备份直接覆盖运行中的数据库，否则会丢失备份之后的内容。本次无 schema、nginx 或 unit 修改，代码回退不需要恢复配置或数据库。

## 后续维护与限制

数据库使用 WAL。备份必须使用 SQLite 在线备份，以服务账号运行；复制照片后，从**备份数据库**核对**备份照片目录**里的全部引用。缺文件或大小不符时整轮重做，并保留上一份有效备份。图片使用不可变 UUID 文件，校验后的副本满足快照引用；本次备份脚本保存在私有备份目录的 `snapshot.mjs`。没有建立自动备份计划。

服务重启会让正在进行的局回大厅；房间、收藏、回答、照片、作品和战绩持久保留。未做真实 iPhone、Android、微信内置浏览器或国内 Wi-Fi/4G 验证。

现有公网 443 经 SNI TCP 代理到 9444，应用看到 loopback IP，因此建房配额在入口共享：初始 10 次，每 6 分钟恢复 1 次，上限 10 次；加入旧房间不消耗建房额度。nginx 的 30 请求/秒（burst 80）与 100 并发连接也合并计算。JSON/WS 上限 16 KiB；鉴权图片上传上限 2 MiB、每房间累计 20 MiB。本次保留已有入口结构。

日常检查：

```bash
systemctl status duo-games.service --no-pager
journalctl -u duo-games.service -n 50 --no-pager
curl --fail https://lancoai.site/duo/api/health
```
