# HappyRO 运行时

## 连接

`Config.happyro.js` 把资源根设为当前页面 origin，把 WebSocket 设为同源 `/ws/`。Gateway 再转到 login `6900`、char `6121`、map `5121`。

`loadLua=true`。任务说明走 `OngoingQuestInfoList.lub`，物品走 `itemInfo_true.lub`。不要把旧 TXT 覆盖当成当前主显示来源。

## 静态化数据

进入游戏后，技能定义、技能树和导航目录来自构建产物，不再执行对应数据 LUB。NavigationCatalog 在打开导航或图鉴时加载；NavigationGraph 只在开始算路时加载。细节在根仓库 `docs/architecture/client-static-runtime-data.md`。

## 中文资源

散装覆盖由 Gateway `HAPPYRO_GATEWAY_RESOURCE_OVERRIDE_DIRS` 提供。卡片前缀以 UTF-8 读取。物品显示名来自运行目录 LUB。完整链路见根仓库 `docs/localization/client-resources.md`。

## 部署默认值

`src/Core/ClientDefaults.schema.json` 定义 53 项客户端默认值，完整 PWA 构建发布同一份 schema；Gateway 动态下发 `Config.runtime.js`。玩家已保存设置优先，脚本文字对比度属于部署策略。完整变量、范围和生效方式见[环境变量参考](https://happyro.kugarocks.com/deploy/environment-variables)。
