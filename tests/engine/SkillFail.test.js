import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { skillFailMessage, skillFailReasons, requiredStateReasons } from '../../src/Engine/MapEngine/SkillFail.js';

const names = { 152: '投掷石头', 10: '火狩' };
const lookups = { skillName: id => names[id], itemName: id => ({ 7049: '石头' })[id] };
const failure = (cause, extra = {}) => skillFailMessage({ result: 0, SKID: 152, cause, ...extra }, lookups);

function serverEnum(path, name) {
	const source = readFileSync(new URL(path, import.meta.url), 'utf8');
	const body = source.match(new RegExp(`enum ${name}[^;\\{]*\\{([\\s\\S]*?)\\};`))[1].replace(/\/\/[^\n]*/g, '');
	let value = -1;
	return body.split(',').map(entry => entry.trim()).filter(Boolean).map(entry => {
		const [key, explicit] = entry.split('=').map(part => part.trim());
		value = explicit === undefined ? value + 1 : Number(explicit);
		return [key, value];
	});
}

describe('skill failure explanations', () => {
	it('includes the actual missing item and required quantity', () => {
		expect(failure(71, { itemId: 7049, NUM: 1 })).toBe('「投掷石头」使用失败：需要「石头」 ×1，当前数量不足。');
		expect(failure(71, { itemId: 999999, NUM: 10 })).toContain('物品 #999999」 ×10');
	});
	it('distinguishes equipped items from inventory materials', () => {
		expect(failure(72, { itemId: 7049 })).toContain('需要装备「石头」');
	});
	it.each([[1, 'SP 不足'], [2, 'HP 不足'], [4, '冷却'], [100, 'AP 不足'], [87, '当前地图']])('explains reason %i', (cause, expected) => {
		expect(failure(cause)).toContain(expected);
	});
	it('preserves orb counts and prerequisite skill names', () => {
		expect(failure(74, { NUM: 5 })).toContain('需要 5 个');
		expect(failure(113, { NUM: 10 })).toContain('需要先获得「火狩」状态');
		expect(failure(73, { NUM: 10 })).toContain('「火狩」的连招期间');
	});
	it('explains server-verified environmental and ammunition requirements', () => {
		expect(failure(112, { NUM: 3 })).toContain('携带猎鹰');
		expect(failure(112, { NUM: 8 })).toContain('水域');
		expect(failure(114, { NUM: 1 << 1 })).toContain('需要装备箭矢');
		expect(failure(114, { NUM: (1 << 3) | (1 << 5) })).toContain('需要装备子弹或榴弹');
	});
	it('does not invent a level failure from the ambiguous default code', () => {
		expect(failure(0)).toContain('服务端未提供具体原因');
		expect(failure(10)).toContain('服务端未提供具体原因');
		expect(failure(0, { SKID: 1 })).toContain('基础技能等级不足');
		expect(failure(250)).toContain('未识别的失败原因（250）');
	});
	it('ignores successful acknowledgements', () => {
		expect(skillFailMessage({ result: 1, cause: 71 })).toBe('');
		expect(skillFailMessage(null)).toBe('');
	});
	it('covers every active reason code in the server protocol', () => {
		const causes = serverEnum('../../../happyro-server/src/map/clif.hpp', 'useskill_fail_cause');
		for (const [name, value] of causes.filter(([name]) => name !== 'USESKILL_FAIL_MAX')) {
			expect(skillFailReasons[value], `${name} (${value})`).toBeTruthy();
		}
	});
	it('covers every required state in the server database', () => {
		const states = serverEnum('../../../happyro-server/src/map/skill.hpp', 'e_require_state');
		for (const [name, value] of states.filter(([name]) => name !== 'ST_NONE')) {
			expect(requiredStateReasons[value], name).toBeTruthy();
		}
	});
});

it('explains emotion prerequisites without mislabeling cooldown or blocked state', () => {
 const emotion = cause => skillFailMessage({ result: 0, SKID: 1, NUM: 1, cause });
 expect(emotion(0)).toContain('「基础技能」Lv.2');
 expect(emotion(0)).toContain('「新基础技能」Lv.1');
 expect(emotion(4)).toBe('表情发送太快了，请稍后再试。');
 expect(emotion(11)).toContain('不能主动发送');
 expect(emotion(23)).toContain('当前状态不能发送表情');
 expect(skillFailMessage({ result: 0, SKID: 1, NUM: 2, cause: 0 })).not.toContain('发送表情');
 expect(skillFailMessage({ result: 1, SKID: 1, NUM: 1, cause: 0 })).toBe('');
});
