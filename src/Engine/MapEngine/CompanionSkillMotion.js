import SkillId from 'DB/Skills/SkillConst.js';

const targetAttackSkills = new Set([
	SkillId.HT_BLITZBEAT,
	SkillId.SN_FALCONASSAULT,
	SkillId.WH_HAWKRUSH,
	SkillId.WH_HAWKBOOMERANG,
	SkillId.WH_WILD_WALK
]);

export function isFalconTargetAttackSkill(skillId) {
	return targetAttackSkills.has(skillId);
}

// A damage packet can arrive after its target has left the visible entity set.
// Keep processing the packet, but do not start companion movement without a target.
export function moveSkillCompanions(source, target, skillId) {
	if (!target) return;
	const falcon = isFalconTargetAttackSkill(skillId);
	const warg = skillId === SkillId.RA_WUGSTRIKE || skillId === SkillId.RA_WUGBITE;
	const companion = falcon ? source.falcon : warg ? source.wug : null;
	if (!companion) return;
	companion.action = source.action;
	companion.walk.speed = 35;
	companion.walkToNonWalkableGround(
		companion.position[0], companion.position[1], target.position[0], target.position[1],
		falcon ? 0 : 1, falcon, true
	);
}
