# 宠物、生命体与佣兵

[游戏行为索引](README.md)

## 组件职责

| 入口 | 职责 |
| --- | --- |
| `src/UI/Game/GamePet.js` | 宠物状态、资格及操作适配 |
| `src/UI/Game/GameCompanions.js` | 生命体／佣兵状态、操作和技能 |
| `src/UI/Game/CompanionPrompt.js` | 绑定主人与单位的确认生命周期 |
| `src/UI/Mobile/game/PetPanel.js` | 移动端宠物状态、操作及进化入口 |
| `src/UI/Components/PetEvolution/PetEvolution.js` | 桌面进化目标、条件与提交状态 |
| `scripts/generate-pet-rules.mjs` | 从服务端 Renewal 数据生成宠物与进化规则 |

宠物外观仍来自 Lua 资源；进化规则来自服务端生成数据，更新配方时运行生成器的帮助了解输入与校验参数，不直接修改产物。跨仓库来源与验证见根仓库[随行专题](../../../../docs/development/companion-review/README.md)。

## 状态与确认约束

- 收到增量状态时按协议字段合并，接受零值；他人宠物饰品广播不能写入自己的 Session 或窗口。
- 攻击模式以实际状态保存，重登读取保存值；主动／被动切换沿用同一个业务入口。
- 确认绑定主人、单位 GID 及实体引用。消失、主人死亡、切图、断线后清理确认和所属窗口，旧回调不能作用于新单位。
- 进化还需绑定原物种、所选目标，提交前复核亲密、饰品和材料；等待回包期间阻止重复请求。
- 改名按 UTF-8 23 字节上限校验，拒绝空白、控制字符和超限；资格由服务器状态决定，不能在客户端保留一次性改名限制。

## 技能与验证

生命体／佣兵地面技能按真实施放范围追近，不额外增加一格。技能学习、SP 消耗、伤害和连段是否成功以服务器结果判断，仅发送请求不算成功。

检查正常操作、单位替换、失败回包、重复确认、切图及断线；桌面与移动入口分别验证。已完成范围和剩余缺口见根仓库[覆盖](../../../../docs/development/companion-review/coverage.md)及[待办](../../../../docs/development/companion-review/pending.md)，不在本页重复历史测试计数。
