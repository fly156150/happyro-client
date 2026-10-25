import { describe, expect, it } from 'vitest';
import { questTargetName } from '../../src/DB/Quest/QuestTargetName.js';

describe('quest objective names', () => {
	it('restores the full name from the current server default label', () => {
		expect(questTargetName({ mobGID: 1708, mobName: '达纳托斯之忆' })).toBe('魔剑士 达纳托斯的记忆');
		expect(questTargetName({ mobGID: 2047, mobName: '沉醉于魔力的纳' })).toBe('沉醉于魔力的纳迦');
	});
	it('preserves generic objectives and custom names despite a known monster ID', () => {
		expect(questTargetName({ mobGID: 1002, mobName: 'Plant, Small' })).toBe('Plant, Small');
		expect(questTargetName({ mobGID: 1708, mobName: '特殊试炼目标' })).toBe('特殊试炼目标');
		expect(questTargetName({ mobGID: 1002, mobName: '达纳托斯之忆' })).toBe('达纳托斯之忆');
	});
	it('does not invent a name for count-only updates or unknown targets', () => {
		expect(questTargetName({ huntID: 123000, huntCount: 1 })).toBe('');
		expect(questTargetName({ mobGID: 999999, mobName: '自定义魔物' })).toBe('自定义魔物');
	});
});
