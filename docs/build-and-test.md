# 构建与测试

在客户端仓库执行：

```bash
npm test
npm run lint
npm run catalog:world
npm run catalog:monsters
npm run build:pwa
```

图鉴命令会生成版本化资源，输入变化时才执行并审查差异；普通 UI 修改不要求重新生成图鉴。`build:pwa` 使用 `--all`，将启动页和全部查看器写到 `dist/Web`，Gateway 读取该目录。不要用只构建 Online 的产物覆盖正式验收入口。

## 评审与验收

- 检查固定 `PACKETVER=20211103`、封包长度及客户端／服务端一致性；业务数字 ID 必须来自现有表。
- 路径别名同步核对 `vite.config.js` 与 `applications/tools/builder-web.mjs`。
- 解析器测试使用合成 fixture，不提交受版权保护的游戏资源；Canvas 测试按需模拟 API。
- 不把 `dist/`、缓存或运行凭据加入提交。第三方库变动需单独审查。
- 涉及 UI、导航、图鉴、物品名或技能窗时，经 Gateway 进入游戏检查资源、缓存和 Service Worker；相关单测不能替代浏览器与真机验收。
- 提交规则见 [AGENTS.md](../AGENTS.md)，具体 CI 触发条件以 `.github/workflows/` 为准，不复制阶段测试数量或分支快照。
