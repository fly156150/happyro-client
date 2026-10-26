import { describe, expect, it } from 'vitest';
import catalog from '../../applications/pwa/data/combat/affinities.json';
import { combatCapability, specialSkillReason } from '../../src/UI/Game/CombatSkillCapabilities.js';
import Status from '../../src/DB/Status/StatusConst.js';
import StatusState from '../../src/DB/Status/StatusState.js';

const actor = (statuses = [], climax = 0) => ({
	hasStatus: id => statuses.includes(id),
	statusValue: (id, index) => id === Status.CLIMAX && index === 0 ? climax : 0,
	spheres: 4
});

describe('Arch Mage Climax attack modes', () => {
	// The server converts Crystal Impact level 1 and Hurricane level 4 into buffs.
	// Other modes remain attacks, including level 2 (extra hits/knockback).
	it.each([1, 2, 3, 4, 5])('checks Climax level %i against each spell separately', level => {
		const context = actor([Status.CLIMAX], level);
		expect(Boolean(specialSkillReason({ name: 'AG_CRYSTAL_IMPACT' }, context))).toBe(level === 1);
		expect(Boolean(specialSkillReason({ name: 'AG_DESTRUCTIVE_HURRICANE' }, context))).toBe(level === 4);
	});
	it('does not block either attack without Climax', () => {
		for (const name of ['AG_CRYSTAL_IMPACT', 'AG_DESTRUCTIVE_HURRICANE'])
			expect(specialSkillReason({ name }, actor())).toBe('');
	});
});

it('rejects Psychic Stream during Energy Coat and allows it when the effect ends', () => {
	const entry = { name: 'EM_PSYCHIC_STREAM' };
	expect(specialSkillReason(entry, actor([Status.ENERGYCOAT]))).toBe('能量外套期间无法使用');
	expect(specialSkillReason(entry, actor())).toBe('');
	expect(specialSkillReason({ name: 'SO_PSYCHIC_WAVE' }, actor([Status.ENERGYCOAT]))).toBe('');
});

it('requires either a following or ridden Warg for Warg Strike', () => {
	const entry = { name: 'RA_WUGSTRIKE' };
	for (const effects of [StatusState.EffectState.WUG, StatusState.EffectState.WUGRIDER])
		expect(specialSkillReason(entry, { ...actor(), effects })).toBe('');
	expect(specialSkillReason(entry, { ...actor(), effects: 0 })).toBe('需要猎狼或骑乘猎狼');
});

describe('Climax ground debuffs retain bounded utility execution', () => {
	it.each(['AG_ALL_BLOOM', 'AG_VIOLENT_QUAKE'])('%s is a debuff only at Climax level 4', name => {
		const id = Number(Object.keys(catalog.skills).find(id => catalog.skills[id].name === name));
		for (const level of [1, 2, 3, 4, 5]) {
			const capability = combatCapability(id, 5, actor([Status.CLIMAX], level));
			expect(capability).toMatchObject({ kind: level === 4 ? 'utility' : 'attack', aim: 'ground' });
			expect(specialSkillReason(capability.entry, actor([Status.CLIMAX], level))).toBe('');
		}
		expect(combatCapability(id, 5, actor())).toMatchObject({ kind: 'attack', aim: 'ground' });
	});
});
