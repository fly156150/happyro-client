# 冒险工具城市默认落点

仅用于地图列表未指定坐标时的默认位置。手动点选坐标、指定 NPC 的传送不使用此表。桌面与移动端共用 `src/UI/Components/GameTools/CityArrivalPoints.js`。

按已启用的服务端 `npc/kafras/kafras.txt`、`npc/re/kafras/kafras.txt` 和 `npc/kafras/cool_event_corp.txt` 选择常用服务区；这是产品预设，不代表基于玩家使用统计的排名。

| 城市 | 默认落点 | 服务 NPC 标识 | NPC 坐标 |
| --- | --- | --- | --- |
| 普隆德拉 | 149,89 | kaf_prontera5 | 146,89 |
| 吉芬 | 120,65 | kaf_geffen | 120,62 |
| 斐扬 | 181,101 | kaf_payon | 181,104 |
| 梦罗克 | 160,255 | kaf_morocc2 | 160,258 |
| 艾尔贝塔 | 31,229 | kaf_alberta | 28,229 |
| 艾尔帕兰 | 143,116 | kaf_aldebaran | 143,119 |

| 伊兹鲁德 | 128,145 | Kafra Employee#iz | 128,148 |
| 朱诺 | 152,184 | kaf_yuno | 152,187 |
| 里希塔乐镇 | 164,97 | kaf_lighthalzen | 164,100 |
| 艾因布罗克 | 62,203 | kaf_einbroch2 | 59,203 |
| 艾因贝赫 | 181,129 | kaf_einbech | 181,132 |
| 拉赫 | 109,135 | CoolEventCorpStaffRachel | 109,138 |
| 菲音斯 | 208,125 | CoolEventCorpStaffVeins | 208,128 |
| 毁葛 | 88,165 | CoolEventCorpStaffHugel | 88,168 |

后三城使用活动公司职员提供的存仓服务作为落点参考。


## 服务端选点与验证

十四城预设以 `CityArrivalPoints.js` 为准；其它地图发送默认请求，由服务端按已审核服务 NPC、公共入口及适用的中心规则选择安全位置。当前规则、来源清单及未验收边界统一见服务端 `docs/navigation-arrivals.md`，不在客户端重复保存批次进度。

地图传送请求 `0x0d00` 长度为 26 字节：`(0,0)` 请求默认落点，`(65535,65535)` 请求随机安全落点，其它值为显式坐标。自动战斗瞬移使用随机模式，无安全位置时拒绝，不回退默认入口。

服务端校验权限、冷却、地图限制、地形、占位和触发区。新增城市预设时同时核对真实服务 NPC、实际地形、连通性及协议测试；客户端与 map-server 配套部署。批量地形校验不代表逐图真人传送、住宿或任务流程验收。
