# 宠物规则数据

`PetRules.generated.json` 是当前 Renewal 服务端宠物数据库的客户端规则快照。它包含宠物／蛋对应关系、食物、自动喂食资格和完整进化材料；`sources` 保存实际读取的数据库文件 SHA-256。客户端构建只读取此文件，不依赖服务端仓库或本机部署路径。

在服务端修改宠物规则后，从客户端仓库显式生成并核对：

```sh
node scripts/generate-pet-rules.mjs --server ../happyro-server
node scripts/generate-pet-rules.mjs --server ../happyro-server --check --no-color
```

生成器按服务端入口数据库中的 Renewal imports 顺序读取宠物、魔物及物品数据；不可手工编辑快照。生成脚本需要客户端开发依赖中的 `js-yaml`。

运行时 `petinfo.lub` 仅提供宠物外观、饰品动作和插画信息。游戏规则不再从旧版 `PetEvolutionCln.lub` 读取，避免服务端已有配方在客户端缺失。未提供插画的物种仍使用对应蛋的名称和材料完成进化操作。
