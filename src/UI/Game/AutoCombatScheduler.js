import { createAutoCombatSkillState } from './AutoCombatSkillState.js';
import { buffRule, chooseCombatBuff } from './CombatBuffRules.js';

/** Coordinates self maintenance and offense; packet I/O stays in the runtime adapter. */
export function createAutoCombatScheduler() {
	const execution = createAutoCombatSkillState();
	const nextBuff = new Map();
	let consecutiveBuffs = 0;
	return {
		execution,
		reset() {
			execution.reset();
			nextBuff.clear();
			consecutiveBuffs = 0;
		},
		chooseBuff(skills, selected, hasStatus, now, hasTargets) {
			if (execution.waiting() || (hasTargets && consecutiveBuffs >= 2)) return null;
			return chooseCombatBuff(
				skills,
				selected,
				hasStatus,
				id => (nextBuff.get(id) || 0) <= now && execution.available(id, 'self', now)
			);
		},
		beginBuff(skill, now, selfId) {
			consecutiveBuffs++;
			// A continuously dispelled effect must not consume every action opportunity.
			nextBuff.set(skill.id, now + 10000);
			execution.begin(skill.id, 'self', now, {
				kind: 'buff',
				effect: buffRule(skill.id).status,
				wireTarget: selfId
			});
		},
		attack() {
			consecutiveBuffs = 0;
		}
	};
}
