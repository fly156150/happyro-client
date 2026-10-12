# HappyRO Client

HappyRO 的浏览器客户端，基于 [roBrowserLegacy](https://github.com/MrAntares/roBrowserLegacy)。玩家通过 Gateway 提供的 PWA 进入游戏，不安装桌面客户端。

固定基线：`PACKETVER=20211103`、Renewal、kRO 2021-11-05。封包设置必须与 Server 一致。

本仓库只维护客户端。编排、资源覆盖和跨仓库说明在根仓库 [happyro](https://github.com/happyro/happyro)。

## 文档

- [文档索引](docs/README.md)：架构、开发、构建、UI、移动端及协议。
- [构建与测试](docs/build-and-test.md)：日常检查与评审约束。

## 本机入口

在根仓库中配置并随 Gateway 提供：

```bash
make configure-client
make gateway-start
```

浏览器打开 <http://127.0.0.1:3338/applications/pwa/index.html>。HappyRO PWA 配置为 `applications/pwa/Config.happyro.js`，由根仓库 `configs/Config.happyro.js` 安装，不要只改本仓库副本后当作编排源。

单独调试 UI：

```bash
npm install
npm run pwa
```

开发页不替代 Gateway 的资源查找、WebSocket 代理和中文覆盖。

## 常用命令

```bash
npm test
npm run lint
npm run catalog:world
npm run catalog:monsters
npm run build:pwa
```

产物位于 `dist/Web`，由 Gateway `ROBROWSER_PATH` 提供。
