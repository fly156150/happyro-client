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
const raceBonus = (...races) => ({ bonus: ({ monster }) => races.includes(monster.race) });

export const COMBAT_SKILL_RULES = Object.freeze({
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
	ABC_ABYSS_STRIKE: raceBonus('Demon', 'Angel')
});
