import Skill from 'DB/Skills/SkillConst.js';
import Status from 'DB/Status/StatusConst.js';

/** Audited against Renewal skill_db.yml and src/map/skills implementations.
 * Only ordinary, non-toggle buffs whose effect on the caster is observable.
 * Party skills are cast once on self; no party-member maintenance is implied.
 */
export const COMBAT_BUFF_RULES = Object.freeze({
	[Skill.AL_BLESSING]: { status: Status.BLESSING, blockedBy: [Status.PROPERTYUNDEAD] },
	[Skill.AL_INCAGI]: { status: Status.INC_AGI, hpCost: 15, blockedBy: [Status.PROPERTYUNDEAD] },
	[Skill.AL_ANGELUS]: { status: Status.ANGELUS },
	[Skill.PR_IMPOSITIO]: { status: Status.IMPOSITIO },
	[Skill.PR_MAGNIFICAT]: { status: Status.MAGNIFICAT },
	[Skill.PR_GLORIA]: { status: Status.GLORIA },
	[Skill.AC_CONCENTRATION]: { status: Status.CONCENTRATION }
});

export function buffRule(id) {
	return COMBAT_BUFF_RULES[id];
}

/** Pure candidate selection; execution, cooldowns and fairness belong to the scheduler. */
export function chooseCombatBuff(skills, selected, hasStatus, available) {
	return (
		skills.find(skill => {
			const rule = buffRule(skill.id);
			return (
				rule &&
				selected.includes(skill.id) &&
				skill.available &&
				available(skill.id) &&
				!hasStatus(rule.status) &&
				!(rule.blockedBy || []).some(hasStatus)
			);
		}) || null
	);
}
