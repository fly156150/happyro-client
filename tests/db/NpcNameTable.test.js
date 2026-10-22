import { describe, expect, it } from 'vitest';
import DB from '../../src/DB/DBManager.js';
import NpcNameTable from '../../src/DB/NpcNameTable.js';
import PronteraNpcNameTable from '../../src/DB/PronteraNpcNameTable.js';
import SecondStageNpcNameTable from '../../src/DB/SecondStageNpcNameTable.js';
import P0P1FieldNpcNameTable from '../../src/DB/P0P1FieldNpcNameTable.js';
import P2MjolnirFieldNpcNameTable from '../../src/DB/P2MjolnirFieldNpcNameTable.js';
import P2YunoFieldNpcNameTable from '../../src/DB/P2YunoFieldNpcNameTable.js';
import P2MajorCityFieldNpcNameTable from '../../src/DB/P2MajorCityFieldNpcNameTable.js';
import P3CoreDungeonNpcNameTable from '../../src/DB/P3CoreDungeonNpcNameTable.js';
import P3CoastalDungeonNpcNameTable from '../../src/DB/P3CoastalDungeonNpcNameTable.js';
import P3ClockTowerNpcNameTable from '../../src/DB/P3ClockTowerNpcNameTable.js';
import P3EarlyDungeonNpcNameTable from '../../src/DB/P3EarlyDungeonNpcNameTable.js';
import P3GlastHeimNpcNameTable from '../../src/DB/P3GlastHeimNpcNameTable.js';
import P3ClassicDungeonNpcNameTable from '../../src/DB/P3ClassicDungeonNpcNameTable.js';
import P3TurtleIslandNpcNameTable from '../../src/DB/P3TurtleIslandNpcNameTable.js';
import P3RegionalDungeonNpcNameTable from '../../src/DB/P3RegionalDungeonNpcNameTable.js';
import P3MidgameDungeonNpcNameTable from '../../src/DB/P3MidgameDungeonNpcNameTable.js';
import P3RemainingCommonNpcNameTable from '../../src/DB/P3RemainingCommonNpcNameTable.js';
import SpawnTownNpcNameTable from '../../src/DB/SpawnTownNpcNameTable.js';
import NpcNameTranslations from '../../src/DB/NpcNameTranslations.zh-CN.json';

describe('unified NPC name translations', () => {
	it('matches every full source name used by the runtime NPC table', () => {
		expect(Object.keys(NpcNameTranslations)).toHaveLength(4349);
		for (const [source, translated] of Object.entries(NpcNameTranslations)) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
		expect(
			Object.entries(NpcNameTranslations)
				.filter(([source, translated]) => NpcNameTable[source] !== translated)
				.map(([source, translated]) => [source, translated, NpcNameTable[source]])
		).toEqual([]);
	});
});

describe('PronteraNpcNameTable', () => {
	it('localizes every registered visible name', () => {
		const entries = Object.entries(PronteraNpcNameTable);

		expect(entries).toHaveLength(487);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('contains the reported and representative NPC names', () => {
		expect(NpcNameTable['Eden Teleport Officer']).toBe('乐园团空间传送员');
		expect(NpcNameTable['King of Prontera']).toBe('普隆德拉国王');
		expect(NpcNameTable['Warmhearted woman']).toBe('热心女士');
		expect(NpcNameTable['Apprentice Craftsman']).toBe('工匠学徒');
		expect(NpcNameTable['Phantasmagorika Spokesp']).toBe('幻影机构发言人');
		expect(NpcNameTable.Arthail).toBe('阿尔泰尔');
		expect(NpcNameTable.Mage).toBe('魔法师');
		expect(NpcNameTable['New Guild Master']).toBe('新任公会会长');
		expect(NpcNameTable['Unknown Machine']).toBe('未知机器');
		expect(NpcNameTable.Aaron).toBe('亚伦');
		expect(NpcNameTable['Archer Zakk']).toBe('弓箭手扎克');
		expect(NpcNameTable['Chief Guardsman']).toBe('卫兵队长');
		expect(NpcNameTable.Guardsman).toBe('卫兵');
		expect(NpcNameTable.Hadenheim).toBe('哈登海姆');
		expect(NpcNameTable['Merchant Daven']).toBe('商人达文');
		expect(NpcNameTable.Skyler).toBe('斯凯勒');
		expect(NpcNameTable['Wounded Swordsman']).toBe('受伤的剑士');
		expect(NpcNameTable['Captain Carocc']).toBe('卡洛克船长');
		expect(NpcNameTable.Carocc).toBe('卡洛克船长');
		expect(NpcNameTable['Con-Chliina Crewman']).toBe('康·奇利纳船员');
		expect(NpcNameTable.Lumin).toBe('卢敏');
		expect(NpcNameTable['Vigilante Ajegna']).toBe('治安队员阿杰尼亚');
		expect(NpcNameTable['Applicant Paul']).toBe('申请者保罗');
		expect(NpcNameTable['Applicant MacCarnie']).toBe('申请者麦卡尼');
		expect(NpcNameTable['Vigilante Gnocchi']).toBe('治安队员尼奥基');
		expect(NpcNameTable['Vigilante Aglio']).toBe('治安队员阿利奥');
		expect(NpcNameTable.Sloth).toBe('懒汉');
		expect(NpcNameTable['Well-known Troublemaker']).toBe('知名捣蛋鬼');
	});

	it('covers every name truncated by the 24-byte packet field', () => {
		for (const [source, translated] of Object.entries(PronteraNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});

	it('preserves internal suffixes while localizing the visible name', () => {
		expect(DB.getNpcName('Eden Teleport Officer#1')).toBe('乐园团空间传送员#1');
		expect(DB.getNpcName('Maroll Battle Recruiter::BatRecruit1')).toBe(
			'马洛尔战斗招募员::BatRecruit1'
		);
		expect(DB.getNpcName('Unknown NPC#1')).toBe('Unknown NPC#1');
		expect(DB.getNpcName('Phantasmagorika Spokesp')).toBe('幻影机构发言人');
		expect(DB.getNpcName('Vigilante Ajegna#doram0')).toBe('治安队员阿杰尼亚#doram0');
		expect(DB.getNpcName('Con-Chliina Crewman#doi')).toBe('康·奇利纳船员#doi');
	});
});

describe('SpawnTownNpcNameTable', () => {
	it('covers every audited Izlude and Lasagna name', () => {
		const entries = Object.entries(SpawnTownNpcNameTable);

		expect(entries).toHaveLength(89);
		for (const [source, translated] of entries) {
			expect(source).toMatch(/^[\u0020-\u007e]+$/);
			expect(translated).toMatch(/[\u3400-\u9fff]/);
			expect(NpcNameTable[source]).toBe(translated);
		}
	});

	it('covers the reported and representative spawn-town NPCs', () => {
		expect(NpcNameTable['Academy Student']).toBe('学院学生');
		expect(NpcNameTable['Channel Warp Official']).toBe('分流传送员');
		expect(NpcNameTable['Chief Peperoncino']).toBe('佩佩罗奇诺首领');
		expect(NpcNameTable['Honeymoon Helper']).toBe('蜜月助手');
		expect(NpcNameTable.Odgnalam).toBe('奥德格纳拉姆');
		expect(NpcNameTable.Shepherd).toBe('牧羊人');
		expect(NpcNameTable['Tool Merchant']).toBe('工具商人');
		expect(NpcNameTable['Vigilante Penne']).toBe('巡逻队佩内');
	});
});

describe('SecondStageNpcNameTable', () => {
	it('contains a Chinese translation for every audited name', () => {
		const entries = Object.entries(SecondStageNpcNameTable);

		expect(entries).toHaveLength(877);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names from all eight towns', () => {
		expect(NpcNameTable['Bell Keeper']).toBe('钟楼管理员');
		expect(NpcNameTable['Juno Soldier']).toBe('朱诺士兵');
		expect(NpcNameTable['Comodo Guide']).toBe('科摩多向导');
		expect(NpcNameTable['High Priestess Niren']).toBe('大祭司妮伦');
		expect(NpcNameTable['Veins Guide']).toBe('维因斯向导');
		expect(NpcNameTable['Einbroch Smog Alert']).toBe('艾因布洛克烟雾警报器');
		expect(NpcNameTable['Rekenber Guard Oscar']).toBe('雷根贝勒守卫奥斯卡');
		expect(NpcNameTable['Monster Race Manager']).toBe('魔物竞速管理员');
	});

	it('covers every phase-two name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(SecondStageNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});

	it('does not disguise an unaudited English name as translated', () => {
		expect(DB.getNpcName('Unaudited NPC')).toBe('Unaudited NPC');
	});
});

describe('P0P1FieldNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P0P1FieldNpcNameTable);

		expect(entries).toHaveLength(98);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names from all four field batches', () => {
		expect(NpcNameTable['Culvert Guardian']).toBe('地下水道守卫');
		expect(NpcNameTable['Map Examiner Gefil']).toBe('地图调查员杰菲尔');
		expect(NpcNameTable['Continental Guard']).toBe('大陆卫队');
		expect(NpcNameTable.Zoologist).toBe('动物学家');
	});

	it('uses context-neutral translations for names shared with town maps', () => {
		expect(NpcNameTable.Signpost).toBe('告示牌');
		expect(NpcNameTable['Mad Scientist']).toBe('疯狂科学家');
		expect(NpcNameTable['Suspicious Man']).toBe('可疑男子');
	});

	it('covers every P0/P1 field name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P0P1FieldNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P2MjolnirFieldNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P2MjolnirFieldNpcNameTable);

		expect(entries).toHaveLength(15);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative service, quest, and collection NPC names', () => {
		expect(NpcNameTable['Kafra Employee']).toBe('卡普拉员工');
		expect(NpcNameTable['Dwarf Blacksmith']).toBe('矮人铁匠');
		expect(NpcNameTable["Muriniel's Cottage"]).toBe('穆里涅尔的小屋');
		expect(NpcNameTable['Animal Skin']).toBe('兽皮');
	});

	it('covers every Mjolnir field name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P2MjolnirFieldNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P2YunoFieldNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P2YunoFieldNpcNameTable);

		expect(entries).toHaveLength(19);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative story, service, and object names', () => {
		expect(NpcNameTable['Border Guards']).toBe('边境守卫');
		expect(NpcNameTable['Helmut Roegenburg']).toBe('赫尔穆特·罗根堡');
		expect(NpcNameTable['Excavator Guide']).toBe('挖掘向导');
		expect(NpcNameTable['Security Guard']).toBe('保安');
		expect(NpcNameTable['Wooden Board']).toBe('木板');
	});

	it('covers every Yuno field name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P2YunoFieldNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P2MajorCityFieldNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P2MajorCityFieldNpcNameTable);

		expect(entries).toHaveLength(77);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names from all six remaining P2 field families', () => {
		expect(NpcNameTable['Artifact Appraiser']).toBe('神器鉴定师');
		expect(NpcNameTable['Map Examiner Lucia']).toBe('地图调查员露西亚');
		expect(NpcNameTable['Silk Sand Camel']).toBe('丝质沙漠骆驼');
		expect(NpcNameTable['Striker Unit Commander']).toBe('突击部队指挥官');
		expect(NpcNameTable['Mysterious Woman']).toBe('神秘女子');
		expect(NpcNameTable['Moks Mushrooms']).toBe('莫克斯蘑菇');
	});

	it('covers every remaining P2 field name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P2MajorCityFieldNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3CoreDungeonNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3CoreDungeonNpcNameTable);

		expect(entries).toHaveLength(13);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names from all four core dungeon families', () => {
		expect(NpcNameTable['Timid Cat']).toBe('胆小的猫');
		expect(NpcNameTable['Great Merchant']).toBe('大商人');
		expect(NpcNameTable['Shimmering Portal']).toBe('闪烁的传送门');
		expect(NpcNameTable['Rotten Bandages']).toBe('腐烂绷带');
	});

	it('covers every core dungeon name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3CoreDungeonNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3CoastalDungeonNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3CoastalDungeonNpcNameTable);

		expect(entries).toHaveLength(11);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names from both coastal dungeon families', () => {
		expect(NpcNameTable['Eden Member Callandiva']).toBe('伊甸园成员卡兰迪瓦');
		expect(NpcNameTable['Immortal Hearts']).toBe('不死心脏');
		expect(NpcNameTable['Gemstone Bagger']).toBe('宝石装袋员');
		expect(NpcNameTable.Signposts).toBe('路标');
	});

	it('covers every coastal dungeon name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3CoastalDungeonNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3ClockTowerNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3ClockTowerNpcNameTable);

		expect(entries).toHaveLength(17);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers characters, materials, and random portals on both sides', () => {
		expect(NpcNameTable['Belljamin Button']).toBe('贝尔贾明·巴顿');
		expect(NpcNameTable['Evil Horns']).toBe('邪恶角');
		expect(NpcNameTable.clt006r).toBe('钟楼随机传送点');
		expect(NpcNameTable.ald008r).toBe('钟楼地下随机传送点');
	});

	it('covers every Clock Tower name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3ClockTowerNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3EarlyDungeonNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3EarlyDungeonNpcNameTable);

		expect(entries).toHaveLength(6);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names from the populated dungeon families', () => {
		expect(NpcNameTable['Eden Member Cloud']).toBe('伊甸园成员克劳德');
		expect(NpcNameTable.Mirko).toBe('米尔科');
		expect(NpcNameTable['Flaming Spirit Man']).toBe('恩格尔·霍华德');
		expect(NpcNameTable['Spirit Detecting Staff']).toBe('精灵探测杖');
	});

	it('covers every early dungeon name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3EarlyDungeonNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3GlastHeimNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3GlastHeimNpcNameTable);

		expect(entries).toHaveLength(21);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names across the classic Glast Heim complex', () => {
		expect(NpcNameTable['Rune Leader Jungberg']).toBe('符文团长荣贝尔格');
		expect(NpcNameTable['Delicate trace']).toBe('细微痕迹');
		expect(NpcNameTable['Mysterious Energy']).toBe('神秘能量');
		expect(NpcNameTable.Zealotus).toBe('吉尔塔斯');
		expect(NpcNameTable['Hugin\'s Craftsman']).toBe('胡金的雕刻工匠');
	});

	it('covers every Glast Heim name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3GlastHeimNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3ClassicDungeonNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3ClassicDungeonNpcNameTable);

		expect(entries).toHaveLength(4);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers every visible name in the populated classic dungeon maps', () => {
		expect(NpcNameTable['Fishing Novice']).toBe('钓鱼初心者');
		expect(NpcNameTable.Nigirboran).toBe('尼吉尔博兰');
		expect(NpcNameTable.mag02a_mag03a).toBe('熔岩洞窟三层入口');
		expect(NpcNameTable['Republic Guard']).toBe('共和国卫兵');
	});

	it('covers every classic dungeon name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3ClassicDungeonNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3TurtleIslandNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3TurtleIslandNpcNameTable);

		expect(entries).toHaveLength(21);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names across Turtle Island', () => {
		expect(NpcNameTable['Map Examiner Tural']).toBe('调查员特尔');
		expect(NpcNameTable['Map Examiner Tidun']).toBe('调查员提顿');
		expect(NpcNameTable['Map Examiner Tsensor']).toBe('调查员特森泽');
		expect(NpcNameTable['Expert Flute Crafter']).toBe('专业笛子工匠');
		expect(NpcNameTable['A pile of turtle crystal']).toBe('海龟水晶堆');
		expect(NpcNameTable.Mudasamu).toBe('穆达萨姆');
	});

	it('covers every Turtle Island name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3TurtleIslandNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3RegionalDungeonNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3RegionalDungeonNpcNameTable);

		expect(entries).toHaveLength(42);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names across the populated regional dungeons', () => {
		expect(NpcNameTable.Soldier).toBe('士兵');
		expect(NpcNameTable.AyoFootprint8).toBe('足迹8');
		expect(NpcNameTable['Haggard Man']).toBe('阿农');
		expect(NpcNameTable.Iara).toBe('伊亚拉');
		expect(NpcNameTable['Gatekeeper of Krakatau']).toBe('克拉卡托火山守门人');
		expect(NpcNameTable['Strange dead body']).toBe('奇怪的尸体');
		expect(NpcNameTable['Baba Yaga']).toBe('芭芭雅嘎');
		expect(NpcNameTable['Maria Morebna']).toBe('玛丽亚·莫雷布娜');
	});

	it('covers every regional dungeon name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3RegionalDungeonNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3MidgameDungeonNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3MidgameDungeonNpcNameTable);

		expect(entries).toHaveLength(37);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names across the midgame dungeon families', () => {
		expect(NpcNameTable['Trace of an adventurer']).toBe('冒险者的痕迹');
		expect(NpcNameTable.jupe_goto2F).toBe('朱诺斯二层入口');
		expect(NpcNameTable['Unethical Machine']).toBe('非伦理机器');
		expect(NpcNameTable.Elysia).toBe('艾莉西亚');
		expect(NpcNameTable['Map Examiner Dove']).toBe('调查员多布');
		expect(NpcNameTable.sanctuary01).toBe('拉赫圣域随机传送点');
		expect(NpcNameTable['Rune Device']).toBe('符文装置');
		expect(NpcNameTable.Maram).toBe('马拉姆');
	});

	it('covers every midgame dungeon name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3MidgameDungeonNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});

describe('P3RemainingCommonNpcNameTable', () => {
	it('contains a Chinese translation for every audited ASCII name', () => {
		const entries = Object.entries(P3RemainingCommonNpcNameTable);

		expect(entries).toHaveLength(33);
		for (const [source, translated] of entries) {
			expect(translated, source).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('covers representative names across the remaining common maps', () => {
		expect(NpcNameTable.enter_ein_dun03).toBe('艾因贝赫矿山三层入口');
		expect(NpcNameTable['Entrance Device']).toBe('入口装置');
		expect(NpcNameTable['Valkyrie Illusion']).toBe('女武神幻影');
		expect(NpcNameTable.Larjes).toBe('拉尔杰斯');
		expect(NpcNameTable['Map Examiner Mother One']).toBe('调查员马德尔翁');
		expect(NpcNameTable['Linguist Devore']).toBe('语言学家德沃尔');
	});

	it('covers every remaining common name truncated by the packet field', () => {
		for (const [source, translated] of Object.entries(P3RemainingCommonNpcNameTable)) {
			if (/^[\u0020-\u007e]+$/.test(source) && source.length > 23) {
				expect(NpcNameTable[source.slice(0, 23)], source).toBe(translated);
			}
		}
	});
});
