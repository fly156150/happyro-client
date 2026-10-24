# 技能名称第二轮复核与改动表

本轮只修订名称及名称引用，不修改技能数值、效果、施放条件、物品属性或服务端脚本规则。对照表以本轮开始时的显示名称为基线；上一轮“祝福 → 天使之赐福”等改动不重复计入本轮技能改名数量。

## 范围与依据

- 扫描生成表中的 1,767 个技能条目；其中职业技能树涉及 1,138 个不同技能 ID，全部按 ID 与 Aegis 标识核对 Divine Pride 收录的 cRO／twRO 客户端名称，补齐上一轮缺少外部参考的扩展职业与新技能。
- 另核对两个非技能树条目，共取得 1,140 份外部记录。其余非玩家树条目核对内部派生关系和使用位置，没有将其宣称为全部经外部资料认证。
- 官方公告交叉核对：[2024 全职业调整](https://ro.gnjoy.com.tw/notice/Guide_View?id=216940)、[2025 四转及扩展职业调整](https://ro.gnjoy.com.tw/Notice/Notice_View?id=218253)、[2026 新增技能](https://event.gnjoy.com.tw/Ro/ACT_20260202_horseYear/job)。官方资料用于核对名称，不照搬不同版本的数值。
- Divine Pride 是客户端资料汇编，并非官方命名规范。地区译名不同不自动判错：保留项目已有合理译名，以官方公告、客户端资料与同系列术语共同校验。繁体名称转为简体，统一“炮”等用字。
- “钢铁之心”技能与“霸体”状态保留各自名称；异常状态、日月阶段、施法者／目标、副作用不强制改成同一个标题。
- 同名词必须按 ID 判断：机匠“强力挥击”保留，新技能 MT_POWERFUL_SWING 使用“爆发横扫”；物品 6213“爆炸粉末”保留，技能对应附魔材料使用“爆破粉末”；“影舞者”装备及“狩猎影子”装备不按技能词片段替换。

完整逐项核对记录见 [JSON 清单](skill-name-review-2.json)。

## 本轮技能名称变更（86 项）

| ID | Aegis 标识 | 原名称 | 新名称 | 核对资料 |
| --- | --- | --- | --- | --- |
| 71 | `PR_SLOWPOISON` | 缓慢中毒 | 缓毒术 | [客户端资料](https://www.divine-pride.net/database/skill/71) |
| 280 | `SA_FLAMELAUNCHER` | 火焰附加 | 火属性附加 | [客户端资料](https://www.divine-pride.net/database/skill/280) |
| 281 | `SA_FROSTWEAPON` | 寒冰附加 | 水属性附加 | [客户端资料](https://www.divine-pride.net/database/skill/281) |
| 282 | `SA_LIGHTNINGLOADER` | 雷电附加 | 风属性附加 | [客户端资料](https://www.divine-pride.net/database/skill/282) |
| 283 | `SA_SEISMICWEAPON` | 地震附加 | 地属性附加 | [客户端资料](https://www.divine-pride.net/database/skill/283) |
| 481 | `HP_MANARECHARGE` | 魔力充能 | 魔力减免 | [客户端资料](https://www.divine-pride.net/database/skill/481) |
| 2417 | `WM_DOMINION_IMPULSE` | 支配冲动 | 支配动力 | [客户端资料](https://www.divine-pride.net/database/skill/2417) |
| 5068 | `CG_SPECIALSINGER` | 熟练特殊歌手 | 职业演奏家 | [客户端资料](https://www.divine-pride.net/database/skill/5068) |
| 5416 | `SOA_TALISMAN_MASTERY` | 符咒精通 | 符咒研究 | [客户端资料](https://www.divine-pride.net/database/skill/5416) |
| 5417 | `SOA_SOUL_MASTERY` | 灵魂精通 | 引魂术研究 | [客户端资料](https://www.divine-pride.net/database/skill/5417) |
| 5418 | `SOA_TALISMAN_OF_PROTECTION` | 守护符 | 护身符 | [客户端资料](https://www.divine-pride.net/database/skill/5418) |
| 5420 | `SOA_TALISMAN_OF_MAGICIAN` | 魔法师符 | 法师符 | [客户端资料](https://www.divine-pride.net/database/skill/5420) |
| 5422 | `SOA_TOTEM_OF_TUTELARY` | 守护图腾 | 城隍庙 | [客户端资料](https://www.divine-pride.net/database/skill/5422) |
| 5424 | `SOA_TALISMAN_OF_SOUL_STEALING` | 摄魂符 | 窃魂平安符 | [客户端资料](https://www.divine-pride.net/database/skill/5424) |
| 5433 | `SH_MYSTICAL_CREATURE_MASTERY` | 灵物理解 | 灵物互动 | [客户端资料](https://www.divine-pride.net/database/skill/5433) |
| 5434 | `SH_COMMUNE_WITH_CHUL_HO` | 与铁虎共鸣 | 灵物交流：铁虎 | [客户端资料](https://www.divine-pride.net/database/skill/5434) |
| 5435 | `SH_CHUL_HO_SONIC_CLAW` | 铁虎音速爪 | 铁虎空心爪 | [客户端资料](https://www.divine-pride.net/database/skill/5435) |
| 5437 | `SH_HOGOGONG_STRIKE` | 虎高功乱打 | 虎高空乱打 | [客户端资料](https://www.divine-pride.net/database/skill/5437) |
| 5438 | `SH_COMMUNE_WITH_KI_SUL` | 与龟雪共鸣 | 灵物交流：神龟 | [客户端资料](https://www.divine-pride.net/database/skill/5438) |
| 5439 | `SH_KI_SUL_WATER_SPRAYING` | 龟雪洒水 | 神龟洒水炮 | [客户端资料](https://www.divine-pride.net/database/skill/5439) |
| 5440 | `SH_MARINE_FESTIVAL_OF_KI_SUL` | 龟雪海洋祭典 | 神龟海洋庆典 | [客户端资料](https://www.divine-pride.net/database/skill/5440) |
| 5441 | `SH_SANDY_FESTIVAL_OF_KI_SUL` | 龟雪沙滩祭典 | 神龟沙滩节 | [客户端资料](https://www.divine-pride.net/database/skill/5441) |
| 5442 | `SH_KI_SUL_RAMPAGE` | 龟雪翻腾 | 神龟剧烈震荡 | [客户端资料](https://www.divine-pride.net/database/skill/5442) |
| 5443 | `SH_COMMUNE_WITH_HYUN_ROK` | 与玄鹿共鸣 | 灵物交流：玄鹿 | [客户端资料](https://www.divine-pride.net/database/skill/5443) |
| 5447 | `SH_TEMPORARY_COMMUNION` | 快速共鸣 | 急速交流 | [客户端资料](https://www.divine-pride.net/database/skill/5447) |
| 5463 | `SKE_SKY_MASTERY` | 天空精通 | 天机修炼 | [客户端资料](https://www.divine-pride.net/database/skill/5463) |
| 5464 | `SKE_WAR_BOOK_MASTERY` | 战争之书精通 | 兵法修炼 | [客户端资料](https://www.divine-pride.net/database/skill/5464) |
| 5465 | `SKE_RISING_SUN` | 朝阳 | 天地一阳 | [客户端资料](https://www.divine-pride.net/database/skill/5465) |
| 5466 | `SKE_NOON_BLAST` | 正午爆破 | 天晨一阳 | [客户端资料](https://www.divine-pride.net/database/skill/5466) |
| 5467 | `SKE_SUNSET_BLAST` | 日落爆破 | 天阳 | [客户端资料](https://www.divine-pride.net/database/skill/5467) |
| 5468 | `SKE_RISING_MOON` | 月升 | 天地一月 | [客户端资料](https://www.divine-pride.net/database/skill/5468) |
| 5469 | `SKE_MIDNIGHT_KICK` | 午夜踢 | 天晨一月 | [客户端资料](https://www.divine-pride.net/database/skill/5469) |
| 5470 | `SKE_DAWN_BREAK` | 破晓 | 天月 | [客户端资料](https://www.divine-pride.net/database/skill/5470) |
| 5471 | `SKE_TWINKLING_GALAXY` | 闪耀银河 | 天地万星 | [客户端资料](https://www.divine-pride.net/database/skill/5471) |
| 5472 | `SKE_STAR_BURST` | 星辰爆发 | 天命落星 | [客户端资料](https://www.divine-pride.net/database/skill/5472) |
| 5473 | `SKE_STAR_CANNON` | 星辰炮 | 天星 | [客户端资料](https://www.divine-pride.net/database/skill/5473) |
| 5474 | `SKE_ALL_IN_THE_SKY` | 天穹万象 | 天罗万象 | [客户端资料](https://www.divine-pride.net/database/skill/5474) |
| 5475 | `SKE_ENCHANTING_SKY` | 苍穹附魔 | 天气地神 | [客户端资料](https://www.divine-pride.net/database/skill/5475) |
| 5476 | `SS_TOKEDASU` | 消融 | 致命融化 | [客户端资料](https://www.divine-pride.net/database/skill/5476) |
| 5478 | `SS_AKUMUKESU` | 噩梦消除 | 消除噩梦 | [客户端资料](https://www.divine-pride.net/database/skill/5478) |
| 5479 | `SS_SHINKIROU` | 蜃景 | 海市蜃楼 | [客户端资料](https://www.divine-pride.net/database/skill/5479) |
| 5480 | `SS_KAGEGARI` | 猎影 | 诡影狩猎 | [客户端资料](https://www.divine-pride.net/database/skill/5480) |
| 5481 | `SS_KAGENOMAI` | 影舞 | 诡影舞动 | [客户端资料](https://www.divine-pride.net/database/skill/5481) |
| 5482 | `SS_KAGEGISSEN` | 影闪 | 诡影闪光 | [客户端资料](https://www.divine-pride.net/database/skill/5482) |
| 5483 | `SS_FUUMASHOUAKU` | 风魔手里剑·掌握 | 风魔飞镖·掌握 | [客户端资料](https://www.divine-pride.net/database/skill/5483) |
| 5484 | `SS_FUUMAKOUCHIKU` | 风魔手里剑 - 构筑 | 风魔飞镖·构筑 | [客户端资料](https://www.divine-pride.net/database/skill/5484) |
| 5485 | `SS_KUNAIWAIKYOKU` | 苦无 - 扭曲 | 飞刀·扭曲 | [客户端资料](https://www.divine-pride.net/database/skill/5485) |
| 5486 | `SS_KUNAIKAITEN` | 苦无 - 旋转 | 飞刀·旋转 | [客户端资料](https://www.divine-pride.net/database/skill/5486) |
| 5487 | `SS_KUNAIKUSSETSU` | 苦无 - 折射 | 飞刀·曲折 | [客户端资料](https://www.divine-pride.net/database/skill/5487) |
| 5488 | `SS_SEKIENHOU` | 红炎炮 | 火焰炮 | [客户端资料](https://www.divine-pride.net/database/skill/5488) |
| 5489 | `SS_REIKETSUHOU` | 冷血炮 | 冷焰炮 | [客户端资料](https://www.divine-pride.net/database/skill/5489) |
| 5492 | `SS_ANTENPOU` | 暗转炮 | 暗战炮 | [客户端资料](https://www.divine-pride.net/database/skill/5492) |
| 5493 | `SS_KAGEAKUMU` | 暗影·梦魇 | 诡影·噩梦 | [客户端资料](https://www.divine-pride.net/database/skill/5493) |
| 5494 | `SS_HITOUAKUMU` | 梦魇苦无 | 飞刀·噩梦 | [客户端资料](https://www.divine-pride.net/database/skill/5494) |
| 5495 | `SS_ANKOKURYUUAKUMU` | 暗黑龙·梦魇 | 暗黑龙·噩梦 | [客户端资料](https://www.divine-pride.net/database/skill/5495) |
| 5499 | `SS_FOUR_CHARM` | 四色护符 | 四色符 | [客户端资料](https://www.divine-pride.net/database/skill/5499) |
| 5500 | `NW_WILD_SHOT` | 野性射击 | 狂野射击 | [客户端资料](https://www.divine-pride.net/database/skill/5500) |
| 5501 | `NW_MIDNIGHT_FALLEN` | 午夜坠落 | 午夜殒落 | [客户端资料](https://www.divine-pride.net/database/skill/5501) |
| 5502 | `SKE_SKY_SUN` | 天空之日 | 天气神阳 | [客户端资料](https://www.divine-pride.net/database/skill/5502) |
| 5503 | `SKE_SKY_MOON` | 天空之月 | 天气神月 | [客户端资料](https://www.divine-pride.net/database/skill/5503) |
| 5504 | `SKE_STAR_LIGHT_KICK` | 星光踢 | 天星地行 | [客户端资料](https://www.divine-pride.net/database/skill/5504) |
| 5505 | `HN_OVERCOMING_CRISIS` | 克服危机 | 征服危机 | [客户端资料](https://www.divine-pride.net/database/skill/5505) |
| 5506 | `SH_CHUL_HO_BATTERING` | 铁虎重击 | 铁虎乱舞 | [客户端资料](https://www.divine-pride.net/database/skill/5506) |
| 5507 | `SH_HYUN_ROK_SPIRIT_POWER` | 玄禄灵力 | 玄鹿灵力释放 | [客户端资料](https://www.divine-pride.net/database/skill/5507) |
| 6001 | `DK_DRAGONIC_BREATH` | 龙之呼吸 | 天龙气息 | [客户端资料](https://www.divine-pride.net/database/skill/6001) |
| 6002 | `MT_SPARK_BLASTER` | 火花爆破 | 火花四溅 | [客户端资料](https://www.divine-pride.net/database/skill/6002) |
| 6005 | `BO_EXPLOSIVE_POWDER` | 爆炸粉末 | 爆破粉末 | [客户端资料](https://www.divine-pride.net/database/skill/6005) |
| 6502 | `DK_DRAGONIC_PIERCE` | 龙之穿刺 | 神龙贯刺 | [客户端资料](https://www.divine-pride.net/database/skill/6502) |
| 6503 | `IG_RADIANT_SPEAR` | 光辉长矛 | 光辉刺击 | [客户端资料](https://www.divine-pride.net/database/skill/6503) |
| 6504 | `IG_IMPERIAL_CROSS` | 帝国十字 | 帝国十字斩 | [客户端资料](https://www.divine-pride.net/database/skill/6504) |
| 6505 | `IG_IMPERIAL_PRESSURE` | 帝国压力 | 霸权震域 | [客户端资料](https://www.divine-pride.net/database/skill/6505) |
| 6506 | `MT_RUSH_STRIKE` | 冲锋打击 | 冲锋斩击 | [客户端资料](https://www.divine-pride.net/database/skill/6506) |
| 6507 | `MT_POWERFUL_SWING` | 强力挥击 | 爆发横扫 | [客户端资料](https://www.divine-pride.net/database/skill/6507) |
| 6508 | `MT_ENERGY_CANNONADE` | 能量炮击 | 能量轰炸 | [客户端资料](https://www.divine-pride.net/database/skill/6508) |
| 6510 | `BO_DUST_EXPLOSION` | 粉尘爆炸 | 星尘炸裂 | [客户端资料](https://www.divine-pride.net/database/skill/6510) |
| 6511 | `SHC_CROSS_SLASH` | 交叉斩 | 十字斩击 | [客户端资料](https://www.divine-pride.net/database/skill/6511) |
| 6512 | `ABC_HIT_AND_SLIDING` | 滑步打击 | 突击滑行 | [客户端资料](https://www.divine-pride.net/database/skill/6512) |
| 6513 | `ABC_CHASING_BREAK` | 追击破坏 | 追击突断 | [客户端资料](https://www.divine-pride.net/database/skill/6513) |
| 6514 | `ABC_CHASING_SHOT` | 追击射击 | 追袭射击 | [客户端资料](https://www.divine-pride.net/database/skill/6514) |
| 6515 | `ABC_ABYSS_FLAME` | 深渊烈焰 | 深渊之焰 | [客户端资料](https://www.divine-pride.net/database/skill/6515) |
| 6516 | `AG_ENERGY_CONVERSION` | 能量转换 | 能量转化 | [客户端资料](https://www.divine-pride.net/database/skill/6516) |
| 6517 | `EM_PSYCHIC_STREAM` | 念力洪流 | 心灵波流 | [客户端资料](https://www.divine-pride.net/database/skill/6517) |
| 6518 | `CD_DIVINUS_FLOS` | 神圣之花 | 神圣花雨 | [客户端资料](https://www.divine-pride.net/database/skill/6518) |
| 6519 | `IQ_BLAZING_FLAME_BLAST` | 炽焰爆破 | 烈焰爆弹 | [客户端资料](https://www.divine-pride.net/database/skill/6519) |
| 6520 | `WH_WILD_WALK` | 荒野疾行 | 狂野疾行 | [客户端资料](https://www.divine-pride.net/database/skill/6520) |
| 6521 | `TR_RHYTHMICAL_WAVE` | 节奏波 | 节奏战波 | [客户端资料](https://www.divine-pride.net/database/skill/6521) |

## 状态标题变更（66 项）

新增 58 项状态与技能名的关联；已有绑定随技能词表同步更新。以下只列实际显示标题改变的状态，不把原先运行时已经一致的静态文本同步重复计为新改名。圣体降福补入标题后，倒数行索引同步顺延。

| 状态 ID | 标识 | 原标题 | 新标题 |
| --- | --- | --- | --- |
| 14 | `SLOWPOISON` | 缓慢中毒 | 缓毒术 |
| 18 | `BENEDICTIO` | %s | 圣体降福 |
| 59 | `REFLECTSHIELD` | 反射盾 | 盾牌反射 |
| 68 | `SPEARQUICKEN` | 长矛加速 | 长枪加速术 |
| 87 | `STEELBODY` | 钢铁之躯 | 金刚不坏 |
| 88 | `EXTREMITYFIST` | 阿修罗霸凰拳（修罗霸凰拳） | 阿修罗霸凰拳 |
| 90 | `PROPERTYFIRE` | 火焰发射器 | 火属性附加 |
| 91 | `PROPERTYWATER` | 冰霜武器（赋予海啸） | 水属性附加 |
| 92 | `PROPERTYWIND` | 闪电装填 | 风属性附加 |
| 93 | `PROPERTYGROUND` | 地震武器 | 地属性附加 |
| 106 | `TENSIONRELAX` | 紧张放松 | 放松 |
| 115 | `TRUESIGHT` | 真视 | 狙杀瞄准 |
| 116 | `WINDWALK` | 风行术 | 风之步 |
| 120 | `SWORDREJECT` | 剑术反击 | 霸王魂 |
| 122 | `MARIONETTE` | 傀儡控制（目标） | 木偶操控（目标） |
| 125 | `JOINTBEAT` | 关节打击 | 关节攻击 |
| 135 | `STORMKICK_ON` | 旋风踢（龙卷踢） | 龙卷姿态 |
| 137 | `DOWNKICK_ON` | 准备下段踢 | 脚跟落击姿态 |
| 139 | `TURNKICK_ON` | 回旋踢准备 | 回旋踢架势 |
| 141 | `COUNTER_ON` | 准备反击踢 | 反击踢架势 |
| 161 | `ONEHANDQUICKEN` | 单手剑加速 | 单手加速 |
| 186 | `DOUBLECASTING` | 双重吟唱 | 双重施法 |
| 188 | `OVERTHRUSTMAX` | 最大过度加速 | 最大力量挥击 |
| 198 | `WZ_SIGHTBLASTER` | 视爆 | 视线爆破 |
| 200 | `RG_CCONFINE_M` | 关闭禁锢 | 近身禁锢（施法者） |
| 201 | `RG_CCONFINE_S` | 关闭禁锢 | 近身禁锢（目标） |
| 203 | `GS_MADNESSCANCEL` | 疯狂取消者（最后一搏） | 疯狂取消 |
| 205 | `EARTHSCROLL` | 快乐休息（愉悦休息） | 快乐休息 |
| 316 | `ENCHANTBLADE` | 附魔之刃 | 附魔刀刃 |
| 331 | `LAUDAAGNUS` | 羔羊赞歌 | 羔羊歌颂 |
| 332 | `LAUDARAMUS` | 枝条赞歌 | 折枝赞颂 |
| 334 | `HALLUCINATIONWALK` | 幻影步 | 幻觉行走 |
| 355 | `RECOGNIZEDSPELL` | 认知魔法 | 识别魔法 |
| 375 | `INFRAREDSCAN` | 红外线扫描 | 红外扫描 |
| 377 | `NEUTRALBARRIER` | 中立屏障 | 中性屏障 |
| 390 | `LG_REFLECTDAMAGE` | 伤害反射 | 反射伤害减免 |
| 399 | `BODYPAINT` | 身体彩绘 | 身体绘制 |
| 416 | `CURSEDCIRCLE_ATKER` | 咒缚阵 | 诅咒圆环（施法者） |
| 417 | `CURSEDCIRCLE_TARGET` | 咒缚阵 | 诅咒圆环（目标） |
| 425 | `GENTLETOUCH_ENERGYGAIN` | 温柔触摸－能量获得 | 点穴·球 |
| 430 | `SYMPHONY_LOVE` | 爱的交响曲 | 恋人交响曲 |
| 436 | `SIRCLEOFNATURE` | 自然之声 | 自然之声圆环 |
| 438 | `GLOOMYDAY` | 阴郁之日 | 羞怯一天的忧郁 |
| 439 | `SONG_OF_MANA` | 魔力之歌 | 法力之歌 |
| 442 | `RUSH_WINDMILL` | 疾风车攻击 | 风车冲刺 |
| 451 | `LERADS_DEW` | 莱拉的露水 | 莱拉德的露水 |
| 730 | `DARKCROW` | 黑色利爪 | 暗黑之爪 |
| 894 | `CATNIPPOWDER` | 撒粉 | 猫薄荷撒粉 |
| 896 | `SV_ROOTTWIST` | 银藤根缠绕 | 猕猴桃根茎缠绕 |
| 918 | `ARCLOUSEDASH` | 阿克鲁兹冲刺 | 卷甲虫暴冲 |
| 1053 | `SOULCOLLECT` | 禅 | 灵魂收集 |
| 1247 | `PROTECTSHADOWEQUIP` | 影子保护 | 影子化学保护 |
| 1250 | `WINDSIGN` | 风之印记 | 风之符 |
| 1258 | `SOUNDBLEND` | 声音融合 | 混声烙印 |
| 1356 | `TALISMAN_OF_PROTECTION` | 守护符 | 护身符 |
| 1358 | `TALISMAN_OF_MAGICIAN` | 魔法师符 | 法师符 |
| 1366 | `HOGOGONG` | 弧光 | 铁虎咆哮 |
| 1367 | `MARINE_FESTIVAL` | 龟雪海洋祭典 | 神龟海洋庆典 |
| 1368 | `SANDY_FESTIVAL` | 龟雪沙滩祭典 | 神龟沙滩节 |
| 1369 | `KI_SUL_RAMPAGE` | 龟雪翻腾 | 神龟剧烈震荡 |
| 1377 | `TEMPORARY_COMMUNION` | 快速共鸣 | 急速交流 |
| 1379 | `BLESSING_OF_M_C_DEBUFF` | 英灵祝福副作用 | 灵物祝福（副作用） |
| 1385 | `RISING_SUN` | 朝阳 | 天地一阳 |
| 1388 | `RISING_MOON` | 月升 | 天地一月 |
| 1391 | `STAR_BURST` | 星辰爆发 | 天命落星 |
| 1392 | `SKY_ENCHANT` | 苍穹附魔 | 天气地神 |

## 含技能名的附魔／装备名称（29 项）

| 物品 ID | 原名称 | 新名称 |
| --- | --- | --- |
| 311051 | 正午爆破调谐装置 | 天晨一阳调谐装置 |
| 311052 | 朝阳调谐装置 | 天地一阳调谐装置 |
| 311059 | 精准调谐装置（暗影舞） | 精准调谐装置（诡影舞动） |
| 311444 | 冰川花咒语（火花爆破） | 冰川花咒语（火花四溅） |
| 311447 | 冰川花咒语（爆炸粉末） | 冰川花咒语（爆破粉末） |
| 312269 | 真闪/不知火之魂（冷血炮） | 真闪/不知火之魂（冷焰炮） |
| 312275 | 真闪/不知火之魂（暗影舞） | 真闪/不知火之魂（诡影舞动） |
| 312276 | 真闪/不知火之魂（暗影闪） | 真闪/不知火之魂（诡影闪光） |
| 312277 | 天帝之魂（正午爆破） | 天帝之魂（天晨一阳） |
| 312278 | 天帝之魂（日落爆破） | 天帝之魂（天阳） |
| 312279 | 天帝之魂（午夜踢） | 天帝之魂（天晨一月） |
| 312280 | 天帝之魂（破晓） | 天帝之魂（天月） |
| 312282 | 天帝之魂（星辰炮） | 天帝之魂（天星） |
| 313376 | 帝国卫士之魂（帝国十字） | 帝国卫士之魂（帝国十字斩） |
| 313380 | 机匠之魂（能量炮击） | 机匠之魂（能量轰炸） |
| 313385 | 深渊追迹者之魂（追击破坏） | 深渊追迹者之魂（追击突断） |
| 313386 | 深渊追迹者之魂（追击射击） | 深渊追迹者之魂（追袭射击） |
| 313387 | 吟游诗人和歌姬之魂（节奏波） | 吟游诗人和歌姬之魂（节奏战波） |
| 313388 | 夜巡者之魂（野性射击） | 夜巡者之魂（狂野射击） |
| 313389 | 夜巡者之魂（午夜坠落） | 夜巡者之魂（午夜殒落） |
| 313800 | 冰川花法术(帝国十字) | 冰川花法术(帝国十字斩) |
| 313813 | 冰川花法术（炽焰爆破） | 冰川花法术（烈焰爆弹） |
| 313815 | 冰川花法术（野性射击） | 冰川花法术（狂野射击） |
| 313816 | 冰川花法术（午夜坠落） | 冰川花法术（午夜殒落） |
| 313819 | 冰川花法术（星光踢） | 冰川花法术（天星地行） |
| 1270099 | 午夜踢击影子耳环 | 天晨一月影子耳环 |
| 1270100 | 午夜踢击影子坠子 | 天晨一月影子坠子 |
| 1270101 | 破晓射击影子铠甲 | 天月影子铠甲 |
| 1270102 | 破晓影子鞋 | 天月影子鞋 |

## 其他引用与验证

- 78 件物品共 152 行名称引用同步；包括本轮冷焰炮、诡影舞动等名称，也补齐上一轮天使之赐福、讴歌等名称的直接引用。治疗／治愈、十字驱魔、精神冲击、螺旋击刺按实际技能 ID 和上下文区分，普通叙述不做全局替换。
- 技能说明只替换技能名称引用，天地万星使用失败提示同步；客户端生成 JS、TXT、Renewal 技能数据库、附魔目录与 API 物品目录保持一致。
- 物品 LUB 重新编译并逐键比较源 JSON；本机运行文件与 Gateway HTTP 返回的 SHA-256 一致。官方源材料未修改。
- 技能生成器检查通过；31 项客户端相关测试、14 项目录测试通过（旧物品本地化测试文件按其已有配置跳过）；PWA 全量构建与 Gateway 构建核对通过，文档站构建通过。没有以名称审查声称全职业技能效果已实机验证。
- 未启用的 pre-renewal 数据、旧 SkillInfo.js 生成种子和既有历史报告不是当前运行名称来源，未按本轮名称覆写。
