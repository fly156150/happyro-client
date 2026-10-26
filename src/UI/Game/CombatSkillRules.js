import Status from '../../DB/Status/StatusConst.js';

/**
 * Audited exceptions to ordinary Renewal element matching.
 * Add a skill by its server name, with target eligibility and/or a bonus predicate.
 * Predicates receive { skill, target, entry, monster, undead }; they never send
 * packets, mutate state, or decide cooldowns. Eligibility always precedes ranking.
 */
const undeadAttack = {
	requiresKnownMonster: true,
	canTarget: ({ undead }) => undead,
	bonus: () => true
};
const undeadSupport = { ...undeadAttack, offensiveSupport: true, convertsDamage: true };
const statusVulnerable = { canTarget: ({ monster }) => !monster?.statusImmune };
const raceBonus = (...races) => ({ bonus: ({ monster }) => races.includes(monster.race) });

export const COMBAT_SKILL_RULES = Object.freeze({
	WL_CHAINLIGHTNING: { convertsDamage: true, element: 'Wind' },
	WL_TETRAVORTEX: { dynamic: true },
	KN_BRANDISHSPEAR: { convertsDamage: true },
	SR_TIGERCANNON: { convertsDamage: true },
	GN_CRAZYWEED: { convertsDamage: true },
	AS_SPLASHER: { ...statusVulnerable, convertsDamage: true },
	LK_HEADCRUSH: { canTarget: ({ monster }) => monster?.class !== 'Boss' },
	TF_STEAL: statusVulnerable,
	RG_STEALCOIN: statusVulnerable,
	RG_STRIPWEAPON: statusVulnerable,
	RG_STRIPSHIELD: statusVulnerable,
	RG_STRIPARMOR: statusVulnerable,
	RG_STRIPHELM: statusVulnerable,
	ST_FULLSTRIP: statusVulnerable,
	TR_SOUNDBLEND: { convertsDamage: true },
	AL_HEAL: undeadSupport,
	ALL_RESURRECTION: undeadSupport,
	AB_HIGHNESSHEAL: undeadSupport,
	PR_ASPERSIO: undeadSupport,
	PR_TURNUNDEAD: undeadAttack,
	PR_SANCTUARY: {
		convertsDamage: true,
		requiresKnownMonster: true,
		canTarget: ({ undead, monster }) => undead || monster.race === 'Demon'
	},
	AM_DEMONSTRATION: { convertsDamage: true },
	HT_POWER: {
		requiresKnownMonster: true,
		canTarget: ({ monster }) => ['Brute', 'Insect'].includes(monster.race),
		bonus: () => true
	},
	MG_STONECURSE: { canTarget: ({ monster }) => !monster?.statusImmune },
	SM_PROVOKE: { canTarget: ({ monster, undead }) => !monster?.statusImmune && !undead },
	PR_MAGNUS: { bonus: ({ monster, undead }) => undead || monster.race === 'Demon' },
	GS_BULLSEYE: { bonus: ({ monster }) => !monster.statusImmune && ['Brute', 'DemiHuman'].includes(monster.race) },
	KN_PIERCE: { bonus: ({ monster }) => ['Medium', 'Large'].includes(monster.size) },
	CD_FRAMEN: raceBonus('Undead', 'Demon'),
	CD_EFFLIGO: raceBonus('Undead', 'Demon'),
	CD_PNEUMATICUS_PROCELLA: raceBonus('Undead', 'Demon'),
	IQ_MASSIVE_F_BLASTER: raceBonus('Brute', 'Demon'),
	AG_ASTRAL_STRIKE: raceBonus('Undead', 'Dragon'),
	WH_HAWKBOOMERANG: raceBonus('Brute', 'Fish'),
	ABC_ABYSS_STRIKE: raceBonus('Demon', 'Angel'),
	DK_DRAGONIC_AURA: raceBonus('DemiHuman', 'Angel'),
	IG_GRAND_JUDGEMENT: raceBonus('Plant', 'Insect'),
	IG_JUDGEMENT_CROSS: raceBonus('Plant', 'Insect'),
	SHC_FATAL_SHADOW_CROW: raceBonus('DemiHuman', 'Dragon'),
	MT_RUSH_QUAKE: raceBonus('Formless', 'Insect')
});

// These marks are server-reported effects on the individual target. In particular,
// a visible servant sign is not sufficient unless its owner matches this actor.
const targetMarks = {
	DK_SERVANT_W_PHANTOM: { statuses: [Status.SERVANT_SIGN], own: true, reason: '需要本人标记的目标' },
	IQ_SECOND_FAITH: { statuses: [Status.FIRST_BRAND, Status.SECOND_BRAND], reason: '需要带有烙印的目标' },
	IQ_SECOND_JUDGEMENT: { statuses: [Status.FIRST_BRAND, Status.SECOND_BRAND], reason: '需要带有烙印的目标' },
	IQ_SECOND_FLAME: { statuses: [Status.FIRST_BRAND, Status.SECOND_BRAND], reason: '需要带有烙印的目标' },
	IQ_THIRD_PUNISH: { statuses: [Status.SECOND_BRAND], reason: '需要第二击烙印目标' },
	IQ_THIRD_CONSECRATION: { statuses: [Status.SECOND_BRAND], reason: '需要第二击烙印目标' },
	IQ_THIRD_FLAME_BOMB: { statuses: [Status.SECOND_BRAND], reason: '需要第二击烙印目标' }
};

/** Unknown data never blocks a request or produces a speculative warning. */
export function targetMarkReason(name, actorId, targets) {
	const rule = targetMarks[name];
	if (!rule || !targets.length) return '';
	const rejected = target => {
		const states = rule.statuses.map(status => {
			if (!target.statuses?.known(status)) return undefined;
			if (!target.statuses.has(status)) return false;
			if (!rule.own) return true;
			const owner = target.statuses.values(status)?.[0];
			if (!Number.isInteger(actorId) || !Number.isInteger(owner)) return undefined;
			return owner === actorId;
		});
		return states.every(state => state === false);
	};
	return targets.every(rejected) ? rule.reason : '';
}
