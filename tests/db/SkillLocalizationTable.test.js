import { describe, expect, it } from 'vitest';
import SkillInfo from '../../src/DB/Skills/SkillInfo.generated.js';
import SkillLocalizationTable from '../../src/DB/Skills/SkillLocalizationTable.generated.js';
import SkillTreeView from '../../src/DB/Skills/SkillTreeView.generated.js';

const HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;

describe('SkillLocalizationTable', () => {
	it('distinguishes independent cooldown, action delay and casting', () => {
		expect(SkillLocalizationTable[28].description).toContain('独立冷却：无');
		expect(SkillLocalizationTable[28].description).toContain('施放后延迟：500 毫秒');
		expect(SkillLocalizationTable[2006].description).toContain('独立冷却：2 秒');
		expect(SkillLocalizationTable[2006].description).toContain('可变吟唱：1 秒');
		expect(SkillLocalizationTable[2006].description).toContain('固定吟唱：无');
		expect(SkillLocalizationTable[5].description).toContain('无独立冷却不代表不受动作间隔限制');
		expect(SkillLocalizationTable[3].description).not.toContain('独立冷却');
		expect(SkillLocalizationTable[391].description).toContain('施放时间资料：未提供');
		expect(SkillLocalizationTable[391].description).not.toContain('独立冷却：无');
	});
	it('preserves repeated cooldown levels instead of losing their mapping', () => {
		expect(SkillLocalizationTable[375].description).toContain('独立冷却：Lv.1：10 秒 / Lv.2：10 秒 / Lv.3：10 秒 / Lv.4：10 秒 / Lv.5：15 秒');
	});
	it('contains the complete generated skill catalog', () => {
		expect(Object.keys(SkillLocalizationTable)).toHaveLength(1767);
		expect(SkillLocalizationTable[5]).toMatchObject({ key: 'SM_BASH', name: '狂击' });
		expect(SkillLocalizationTable[5014].name).toBe('全力推进');
		expect(SkillLocalizationTable[5014].description).toContain('独立冷却：50 分钟');
		expect(SkillLocalizationTable[6].description).toContain('降低玩家目标的 VIT 防御力');
		expect(SkillLocalizationTable[5201].description).toContain('操纵最多 5 个');
		expect(SkillLocalizationTable[8001].description).toContain('红色纤细药水');
		expect(SkillLocalizationTable[10019].description).toContain('攻城模式');
		expect(SkillLocalizationTable[559]).toMatchObject({
			key: 'MB_MUNAKKNOWLEDGE',
			name: '驯养大师'
		});
		expect(SkillLocalizationTable[487].description).toContain('合奏期间可以自由移动');
		expect(SkillLocalizationTable[12].description).toContain(
			'习得条件：心灵爆破 Lv.7、圣灵召唤 Lv.5；或光耀之堂 Lv.3、圣水洗礼 Lv.4'
		);
		expect(SkillLocalizationTable[143].description).toContain('习得条件：完成任务，且仅限初心者');
		expect(SkillLocalizationTable[317].description).toContain('类型：演奏技能');
		expect(SkillLocalizationTable[2425].description).toContain('目标：敌对玩家');
		expect(SkillLocalizationTable[5210].description).toContain('消耗 150 AP');
		expect(SkillLocalizationTable[5201].description).toContain('每级恢复「技能等级 × 6」AP');
		expect(SkillLocalizationTable[82].description).toContain('最高等级：1');
		expect(SkillLocalizationTable[404].description).toContain('最高等级：1');
		expect(SkillLocalizationTable[2564].description).toContain('最高等级：1');
		expect(SkillLocalizationTable[129].description).toContain('苍鹰之眼射程再加 3 格');
		expect(SkillLocalizationTable[131].description).toContain('习得条件：猎鹰精通、拆除陷阱 Lv.1');
		expect(SkillLocalizationTable[387].description).toContain('手推车革命、更换手推车');
		expect(SkillLocalizationTable[444].description).toContain('且处于灵魂状态');
		expect(SkillLocalizationTable[3036].description).toContain('范围：自身周围 7 格');
		expect(SkillLocalizationTable[5452].description).toContain('伤害受自学战术');
		expect(SkillLocalizationTable[2430].description).toContain('施法者乐理课程等级');
		expect(SkillLocalizationTable[5481].description).toContain('伤害受诡影狩猎等级');
		expect(SkillLocalizationTable[5489].description).toContain('伤害受暗战炮等级');
		expect(SkillLocalizationTable[298].description).toContain('目标：单个敌人');
		expect(SkillLocalizationTable[407].description).toContain('类型：辅助');
		expect(SkillLocalizationTable[5204].name).toBe('侍从武器·幻影');
		expect(SkillLocalizationTable[5392].name).toBe('元素破坏·地');
		expect(SkillLocalizationTable[5424].description).toContain('属性：赋予属性');
		expect(SkillLocalizationTable[5029].description).toContain('Boss 魔物');
		expect(SkillLocalizationTable[2249].description).toContain('周围 3×3 格时触发');
		expect(SkillLocalizationTable[2249].description).toContain('周围 5×5 格内所有魔物');
		expect(SkillLocalizationTable[2465].description).toContain('按技能等级消耗 1 / 2 / 3 个火灵原石');
		expect(SkillLocalizationTable[2465].description).toContain('每 5 秒恢复 1% HP');
		expect(SkillLocalizationTable[2465].description).toContain('每 5 秒损失 1% HP');
		expect(SkillLocalizationTable[26].description).toContain('地面保护效果范围内不能使用');
		expect(SkillLocalizationTable[233].description).toContain('气泡虫 HP');
		expect(SkillLocalizationTable[513].description).toContain('施放范围：9');
		expect(SkillLocalizationTable[2581].description).toContain('并施加沉默');
		expect(SkillLocalizationTable[3031].description).toContain('解除着火、出血、深度睡眠和睡眠');
		expect(SkillLocalizationTable[3032].description).toContain('解除冰冻、冷冻和冻结');
		expect(SkillLocalizationTable[2253].description).toContain('周围 3×3 格时触发');
		expect(SkillLocalizationTable[5463].description).toContain('天地一阳、天晨一阳、天阳');
		expect(SkillLocalizationTable[5479].description).toContain('分身均施放暗战炮');
		expect(SkillLocalizationTable[2414].description).toContain('箭矢不足 5 支时不会发动');
		expect(SkillLocalizationTable[2418].description).toContain('箭矢不足 10 支时不会发动');
		expect(SkillLocalizationTable[2494].description).toContain('准确的物品名称和数量');
		expect(SkillLocalizationTable[2574].description).toContain('提高满月踢的威力');
		expect(SkillLocalizationTable[2590].description).toContain('提高太阳爆发的威力');
		expect(SkillLocalizationTable[241].description).toContain('自动归自己饲养');
		expect(SkillLocalizationTable[387].description).toContain('无视敏捷下降等减速效果');
		expect(SkillLocalizationTable[495].description).toContain('使用后服用的攻速药水仍会生效');
		expect(SkillLocalizationTable[2231].description).toContain('不能保存尚未学会的魔法');
		expect(SkillLocalizationTable[2422].description).toContain('无法对话');
		expect(SkillLocalizationTable[2495].description).toContain('制作时必须持有对应食谱');
		expect(SkillLocalizationTable[5068].description).toContain('立即解除');
		expect(SkillLocalizationTable[210].name).toBe('自动偷窃');
		expect(SkillLocalizationTable[214].name).toBe('潜击');
		expect(SkillLocalizationTable[219].name).toBe('胁持');
		expect(SkillLocalizationTable[221].name).toBe('旗帜涂鸦');
		expect(SkillLocalizationTable[222].name).toBe('清洗');
		expect(SkillLocalizationTable[223].name).toBe('流氓天国');
		expect(SkillLocalizationTable[224].name).toBe('强制减价');
		expect(SkillLocalizationTable[225].name).toBe('抄袭');
		const auditedNames = {
			33: '天使之障壁',
			57: '长矛挥击',
			66: '神威祈福',
			69: '圣体降福',
			81: '火之猎杀',
			88: '霜冻之术',
			91: '崩裂术',
			111: '速度激发',
			135: '伪装',
			233: '召唤气泡虫',
			234: '化学武器保护',
			255: '牺牲',
			260: '运气调息',
			269: '真剑百破道',
			290: '随机魔法',
			307: '金先生发财了',
			310: '尼贝隆根之戒',
			318: '冷笑话',
			326: '惊声尖叫',
			369: '福音',
			373: 'HP转换',
			379: '气功炮',
			400: '念力连击',
			459: '高级速度激发',
			478: '投掷纤细药水',
			490: '强酸火烟瓶投掷',
			515: '五连击',
			516: '亡命之徒',
			533: '忍术修炼',
			2238: '电击陷阱',
			2251: '淡黄陷阱',
			2424: '不确定要素的语言',
			2456: '精灵控制',
			2608: '灵魂循环',
			3001: '暗云',
			5024: '灵魂珠',
			5045: '群体之力',
			5254: '最终章·驱魔之火',
			5277: '魂飞魄散',
			5284: '圣灵镇魂',
			5360: '矿工狂想曲',
			5362: '晚霞小夜曲',
			5434: '灵物交流：铁虎',
			5438: '灵物交流：神龟',
			5443: '灵物交流：玄鹿',
			5460: '念力连击·冲击',
			5488: '火焰炮',
			5492: '暗战炮',
			5506: '铁虎乱舞',
			8024: '抹杀切割',
			8029: '银脉冲锋',
			8219: '光之盾',
			8220: '自动防御',
			8221: '牺牲',
			8237: '怪物情报'
		};
		for (const [id, name] of Object.entries(auditedNames)) {
			expect(SkillLocalizationTable[id].name).toBe(name);
			expect(SkillLocalizationTable[id].description.startsWith(`${name}\n`)).toBe(true);
		}
		expect(SkillLocalizationTable[369].description).toContain('天使之障壁 Lv.3');
		expect(SkillLocalizationTable[406].description).toContain('气功炮 Lv.1');
		expect(SkillLocalizationTable[459].description).toContain('速度激发 Lv.5');
	});

	it('contains Chinese names and descriptions without Korean text', () => {
		const allVisibleText = Object.values(SkillLocalizationTable)
			.map(entry => `${entry.name}\n${entry.description}`)
			.join('\n');
		expect(allVisibleText).not.toContain('首领');
		expect(allVisibleText).not.toMatch(/[\u3400-\u9fff]Boss|Boss[\u3400-\u9fff]/);
		for (const entry of Object.values(SkillLocalizationTable)) {
			expect(entry.name).toMatch(/[\u3400-\u9fff]/);
			expect(entry.description).toMatch(/[\u3400-\u9fff]/);
			expect(entry.description.startsWith(`${entry.name}\n`)).toBe(true);
			expect(entry.name).not.toMatch(HANGUL);
			expect(entry.description).not.toMatch(HANGUL);
			expect(entry.description).not.toContain('undefined');
			expect(entry.description).not.toMatch(/^施放范围：-/mu);
			expect(entry.description).not.toMatch(/官方技能效果数据已收录|尚未收录|相关技能效果/);
			expect(`${entry.name}\n${entry.description}`).not.toMatch(
				/\b(?:Attack|Demolition|Endowed|Fire|Ground|MAX|Phantom|Poison|Random|Sign|Smoke Powder|Tear Gas|Water|Wind)\b/i
			);
			expect(`${entry.name}\n${entry.description}`).not.toMatch(
				/\bFlee\b|\bzeny\b|\d+z\b|\s[Xx](?=\s?\d)|受课程|按课程|施法者课程|课程和职业|教训|符咒修炼|灵道术修炼|神秘生物精通|战斗自学|独学·魔导学|自学巫术|天空精通|影子猎杀|冰闪炮|风魔手里剑－|苦无－|\(掌握等级/
			);
		}
	});

	it('contains the complete static runtime definitions and job trees', () => {
		expect(Object.keys(SkillInfo)).toHaveLength(1625);
		expect(Object.keys(SkillTreeView)).toHaveLength(251);
		expect(SkillInfo[5]).toMatchObject({
			Name: 'SM_BASH',
			SkillName: '狂击',
			MaxLv: 10,
			SpAmount: [8, 8, 8, 8, 8, 15, 15, 15, 15, 15],
			AttackRange: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		});
		expect(SkillTreeView[1]).toMatchObject({ list: 1, beforeJob: 0, 5: 3 });
		for (const skill of Object.values(SkillInfo)) {
			expect(skill.SkillName).toMatch(/[\u3400-\u9fff]/);
			expect(skill.SkillName).not.toMatch(HANGUL);
		}
	});
});
