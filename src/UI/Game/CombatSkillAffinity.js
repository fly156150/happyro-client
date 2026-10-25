import data from '../../../applications/pwa/data/combat/affinities.json';
import { COMBAT_SKILL_RULES } from './CombatSkillRules.js';

const EMPERIUM_ID = 1288; // Server MOBID_EMPERIUM target exception.
const ordinaryPriority = () => [1, 100, 0];
function isUndead(monster, detection) {
	if (!monster) return false;
	switch (detection) {
		case 0:
		case 3:
			return monster.element === 'Undead';
		case 1:
			return monster.race === 'Undead';
		case 2:
			return monster.element === 'Undead' || monster.race === 'Undead';
		default:
			throw Error('Unknown undead detection rule');
	}
}

/** Pure evaluator: catalog facts -> eligibility -> element rate -> special bonus. */
export function createCombatSkillPolicy(catalog, rules) {
	return {
		isOffensiveSupportSkill: id => Boolean(rules[catalog.skills[id]?.name]?.offensiveSupport),
		priority(skill, target) {
			const entry = catalog.skills[skill.id];
			const monster = catalog.monsters[target?.species];
			if (monster?.skillImmune || (target?.species === EMPERIUM_ID && !entry?.targetEmperium)) return null;
			const rule = rules[entry?.name];
			if (rule?.requiresKnownMonster && !monster) return null;
			const context = { skill, target, entry, monster, undead: isUndead(monster, catalog.undeadDetection) };
			if (rule?.canTarget && !rule.canTarget(context)) return null;
			if (!entry || !monster) return ordinaryPriority();
			let element = entry.element;
			if (Array.isArray(element)) element = element.find(row => row.Level === skill.level)?.Element;
			const rate =
				entry.elemental && !entry.dynamic
					? (catalog.elements[monster.elementLevel]?.[element]?.[monster.element] ?? 100)
					: 100;
			if (rate <= 0) return null;
			const bonus = Boolean(rule?.bonus?.(context));
			// Resistances precede secondary bonuses. This is a preference, not total DPS.
			return [rate < 100 ? 0 : rate > 100 || bonus ? 2 : 1, rate, Number(bonus)];
		}
	};
}
const policy = createCombatSkillPolicy(data, COMBAT_SKILL_RULES);
export const isOffensiveSupportSkill = policy.isOffensiveSupportSkill;
/** null means known ineffective/invalid; tuples rank counters, not total DPS. */
export const combatSkillPriority = policy.priority;

export function chooseCombatSkill(skills, random) {
	let best = null;
	let candidates = [];
	for (const skill of skills) {
		if (skill.priority === null) continue;
		const priority = skill.priority ?? ordinaryPriority();
		const comparison = best ? priority.map((value, i) => value - best[i]).find(value => value !== 0) || 0 : 1;
		if (comparison > 0) {
			best = priority;
			candidates = [skill];
		} else if (comparison === 0) candidates.push(skill);
	}
	return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
}
