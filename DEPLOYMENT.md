# 双人游戏部署记录

更新时间：2026-10-24 17:19:54（北京时间）。用户授权修复四项问题、上线，并要求测试期间可亲自试玩。未使用工作流。

- 正式站：[二人世界](https://lancoai.site/duo/)
- 独立测试站：[修复版试玩](https://lancoai.site/duo-preview/)，使用独立房间和战绩；邀请另一人时请使用测试站生成的链接。

## 当前版本

| 项目 | 当前设置 |
|---|---|
| 正式发布 | `/opt/duo-games/releases/20261024T091913Z` |
| 回退目标 | `/opt/duo-games/releases/20261024T021608Z` |
| Git 源码提交 | `1c8e738f8cdb68a1d02e1edbbbad73516a48b340` |
| 正式指针 | `/opt/duo-games/current` |
| 在线备份 | `/var/backups/duo-games/20261024T091913Z` |
| 正式服务/监听 | `duo-games.service`，`127.0.0.1:8790` |
| 正式数据 | `/var/lib/duo-games/duo.db` 及同目录 `rooms/` |
| 测试指针 | `/opt/duo-games/preview-current` → `/opt/duo-games/previews/rope-fix-20261024` |
| 测试服务/监听 | `duo-games-preview.service`，`127.0.0.1:8795` |
| 测试数据 | `/var/lib/duo-games-preview/duo.db` 及同目录 `rooms/` |
| 运行环境 | Node 22.23.2，服务账号 `duo-games`，协议 v3 |

本次更新前端和双方共享的物理模拟；依赖锁文件、数据库结构及正式 systemd unit 不变。协议升级至 v3，防止旧页面继续使用旧物理；旧页面需刷新。单独增加了测试服务及 nginx `/duo-preview/` 入口、独立请求配额、禁止搜索索引标记。测试服务仅能写自己的 StateDirectory；浏览器的测试房间凭证和最近房间也单独保存。

## 发布与验收

1. 修复红绳端点、攀绳横向累加、输入粘住/同义键干扰、自抓墙救援误计，见 [修复说明](docs/ROPE-FIX-20261024.md)。
2. 类型检查、整数物理检查、98/98 单元/集成测试通过；2/2 专项浏览器回归通过，包含动画端点、双人弱网重连及聊天焦点和同义键输入。
3. 独立测试入口公网十款游戏冒烟通过，测试房间已清理。测试入口继续开放，不合并测试数据到正式站。
4. `/duo/` 构建、体积和双人子路径检查通过；首屏 JS 36.97 KiB、CSS 12.67 KiB gzip。
5. 服务账号 SQLite `backup()` 在线快照完整性为 ok；备份 7 个房间、8 条战绩、4 件作品。照片目录与引用校验通过，配置一并备份，数据属主未变。
6. 备份副本在 8794 隔离试启动，健康、路由及 30 个资源/两款字体校验通过；临时进程和数据已清理。
7. 原子切换并重启正式游戏服务，工作目录正确、内外网健康 v3 正常；已验证旧 v2 客户端收到刷新提示。30 个公网资源逐字节一致，JS/CSS gzip 正常。
8. 正式公网完整冒烟最终通过：十张聊天卡和其余九款游戏、照片、纪念图、字体及重连正常，无浏览器报错。所有自建测试房间已清理；中断遗留房间在缓存释放后按精确条件删除，无需再次重启服务。数据库完整性为 ok，原有 7 个房间、8 条战绩、4 件作品全部保留，属主/权限未变。服务意外重启计数为 0，主站及其他入口响应正常。证据见 `docs/evidence/rope-fix-20261024/`。

## 回退

确认临时指针不存在，再执行：

```bash
ln -s /opt/duo-games/releases/20261024T021608Z /opt/duo-games/current.rollback-rope
mv -Tf /opt/duo-games/current.rollback-rope /opt/duo-games/current
systemctl restart duo-games.service
curl --fail https://lancoai.site/duo/api/health
```

回退目标协议为 v2，回退后页面也需刷新；测试站继续独立运行。本次没有数据迁移，回退只切服务代码，不恢复旧数据库覆盖新数据。

## 测试入口维护

测试服务已设置开机自启。nginx 增加 `/etc/nginx/snippets/duo-games-preview.conf`、`/etc/nginx/conf.d/duo-games-preview.conf`，由游戏原 snippet 引入。配置变更前的副本在 `/var/backups/duo-games-preview/20261024T091525Z`。测试房间供用户试玩保留；冒烟脚本仅删除自己的临时房间。

冒烟可通过 `DUO_SMOKE_URL` 指定正式或测试入口，`DUO_SMOKE_DIR` 指定证据目录。可选 `DUO_SMOKE_STATE` 必须指向 Git 之外的私有文件，用于中断恢复；含临时房间凭证，权限 0600，正常清理房间后删除，不能提交到仓库。

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
