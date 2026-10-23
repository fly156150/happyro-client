# 架构

HappyRO Client 在浏览器中渲染世界、处理输入，并把登录与地图会话交给 Gateway 的 WebSocket 代理。它不直连 rAthena TCP 端口。

## 主要部分

| 路径 | 职责 |
| --- | --- |
| `applications/pwa/` | 正式入口、HappyRO 配置、导航与世界 JSON |
| `src/Engine/` | 登录、角色、地图引擎 |
| `src/Network/` | 封包注册与 `PACKETVER` |
| `src/DB/` | 静态表、中文名称、生成的技能 / NPC 目录 |
| `src/UI/` | 游戏窗口 |
| `scripts/` | 魔物与世界图鉴资源生成 |

## 与其它仓库

- Gateway：PWA 静态文件、`/data` 资源、`/ws/`、Web API 代理。
- Server：封包、地图传送 `0xd00`/`0xd01`、NPC 传送和召唤的权威结果。
- API：happyro-api 提供冒险工具资料与 Game Control 接口，经 Gateway 同源代理访问。
- Admin：独立管理前端，调用 happyro-api 的管理员接口。
- 根仓库：`Config.happyro.js`、导航覆盖、技能 / 导航生成器。

静态数据与服务器权威的边界见根仓库 `docs/architecture/localization-runtime.md`。

游戏行为实现见[移动与自动战斗](gameplay/combat.md)，协议见[连接与协议](network/README.md)。
