import catalog from '../../../applications/pwa/data/combat/affinities.json';
import Skill from 'DB/Skills/SkillConst.js';
import Status from 'DB/Status/StatusConst.js';
import StatusState from 'DB/Status/StatusState.js';
import { buffRule } from './CombatBuffRules.js';
import { COMBAT_SKILL_RULES } from './CombatSkillRules.js';

// These are caster-centred attacks, not counter stances, auras or combo prompts.
const selfAttacks = new Set(
	`SM_MAGNUM WZ_SIGHTRASHER WZ_FROSTNOVA RG_RAID
 ASC_METEORASSAULT RK_WINDCUTTER RK_IGNITIONBREAK GC_COUNTERSLASH GC_PHANTOMMENACE
 GC_ROLLINGCUTTER NC_AXETORNADO LG_OVERBRAND LG_MOONSLASHER LG_RAYOFGENESIS LG_EARTHDRIVE
 SR_SKYNETBLOW SR_EARTHSHAKER SR_RAMPAGEBLASTER SR_WINDMILL SR_HOWLINGOFLION SR_TIGERCANNON
 GN_CART_TORNADO AG_DESTRUCTIVE_HURRICANE AG_RAIN_OF_CRYSTAL AG_CRYSTAL_IMPACT AG_FROZEN_SLASH
 IQ_OLEUM_SANCTUM IQ_MASSIVE_F_BLASTER IQ_EXPOSION_BLASTER SHC_IMPACT_CRATER
 MT_AXE_STOMP ABC_ABYSS_DAGGER MT_MIGHTY_SMASH BO_EXPLOSIVE_POWDER`.split(/\s+/)
);
// Unknown non-damage spells never become attacks just because their inf is ENEMY/PLACE.
const utilities = new Set(
	`SM_PROVOKE MG_STONECURSE AL_DECAGI TF_STEAL RG_STEALCOIN
 PR_LEXAETERNA PR_LEXDIVINA SA_SPELLBREAKER RG_STRIPWEAPON RG_STRIPSHIELD RG_STRIPARMOR
 RG_STRIPHELM ST_FULLSTRIP GC_VENOMIMPRESS NC_ANALYZE DK_SERVANT_W_SIGN WH_WIND_SIGN
 WL_MARSHOFABYSS WL_SIENNAEXECRATE AB_VITUPERATUM`.split(/\s+/)
);
const excluded = new Set(
	`PF_SOULBURN EM_ACTIVITY_BURN PF_SOULCHANGE PF_MINDBREAKER
 NC_DISJOINT NC_MAGICDECOY HT_TALKIEBOX AL_WARP CR_SLIMPITCHER MG_SAFETYWALL AL_PNEUMA
 SC_DIMENSIONDOOR SC_BLOODYLUST SC_GRAFFITI GN_FIRE_EXPANSION RA_DETONATOR WL_RELEASE
 WM_RANDOMIZESPELL`.split(/\s+/)
);
const faith = [Status.FIRST_FAITH_POWER, Status.SECOND_JUDGE, Status.THIRD_EXOR_FLAME];
const requiredAnyStatus = {
	IQ_SECOND_FAITH: faith,
	IQ_THIRD_PUNISH: faith,
	IQ_SECOND_JUDGEMENT: faith.slice(1),
	IQ_THIRD_CONSECRATION: faith.slice(1),
	IQ_SECOND_FLAME: faith.slice(2),
	IQ_THIRD_FLAME_BOMB: faith.slice(2)
};

export function levelValue(value, level, field = 'Amount') {
	return Array.isArray(value) ? (value.find(row => row.Level === level)?.[field] ?? 0) : (value ?? 0);
}
export function combatCapability(id, level, actor) {
	const entry = catalog.skills[id];
	if (!entry || excluded.has(entry.name)) return null;
	const buff = buffRule(id);
	if (buff) return { kind: 'buff', aim: 'self', entry };
	const rule = COMBAT_SKILL_RULES[entry.name];
	const damage = entry.damage || rule?.convertsDamage;
	if (selfAttacks.has(entry.name)) {
		const radius = levelValue(entry.radius, level, 'Area') || levelValue(entry.radius, level, 'Size');
		return radius > 0 ? { kind: 'attack', aim: 'self', radius, entry } : null;
	}
	if (
		['AG_ALL_BLOOM', 'AG_VIOLENT_QUAKE'].includes(entry.name) &&
		actor?.hasStatus(Status.CLIMAX) && actor.statusValue(Status.CLIMAX, 0) === 4
	) return { kind: 'utility', aim: 'ground', entry };
	if (utilities.has(entry.name)) return { kind: 'utility', aim: 'enemy', entry };
	if (entry.trap && entry.noFootSet) return { kind: damage ? 'attack' : 'utility', aim: 'trap', entry };
	if (!damage) return null;
	if (entry.targetType === 'Attack' || rule?.offensiveSupport) return { kind: 'attack', aim: 'enemy', entry };
	if (entry.targetType === 'Ground') return { kind: 'attack', aim: entry.noFootSet ? 'trap' : 'ground', entry };
	return null;
}

/** Runtime-only conditions absent from YAML. Unknown conditions are not assumed true. */
export function specialSkillReason(entry, context, target) {
	const required = requiredAnyStatus[entry.name];
	if (required && !required.some(context.hasStatus)) return '需要信仰前置状态';
	if (
		context.hasStatus(Status.CLIMAX) &&
		((entry.name === 'AG_CRYSTAL_IMPACT' && context.statusValue(Status.CLIMAX, 0) === 1) ||
			(entry.name === 'AG_DESTRUCTIVE_HURRICANE' && context.statusValue(Status.CLIMAX, 0) === 4))
	)
		return '当前巅峰状态将技能转为增益';
	if (entry.name === 'RA_WUGSTRIKE' && !(context.effects & (StatusState.EffectState.WUG | StatusState.EffectState.WUGRIDER)))
		return '需要猎狼或骑乘猎狼';
	if (entry.name === 'EM_PSYCHIC_STREAM' && context.hasStatus(Status.ENERGYCOAT)) return '能量外套期间无法使用';
	if (entry.name === 'WL_TETRAVORTEX' && context.spheres < 4) return '需要四颗属性球';
	if (entry.name === 'SA_SPELLBREAKER' && target && !target.casting) return '目标未在施法';
	if (entry.name === 'PR_LEXDIVINA' && target && (!Number.isInteger(target.healthState) || target.healthState & 4))
		return '目标沉默状态不适用';
	return '';
}

// Only audited result aliases; ground spells already receive their parent confirmation.
export const COMBAT_EXECUTION_IDS = Object.freeze({
	[Skill.WL_CHAINLIGHTNING]: [Skill.WL_CHAINLIGHTNING_ATK],
	[Skill.WL_TETRAVORTEX]: [
		Skill.WL_TETRAVORTEX_FIRE,
		Skill.WL_TETRAVORTEX_WATER,
		Skill.WL_TETRAVORTEX_WIND,
		Skill.WL_TETRAVORTEX_GROUND
	],
	[Skill.ABC_ABYSS_FLAME]: [Skill.ABC_ABYSS_FLAME_ATK]
});

/** Maximum remaining child sequence after the first hit (server timer schedule). */
export function executionDrainMs(id, level) {
	if (id === Skill.WL_CHAINLIGHTNING) return (3 + level) * 650;
	if (id === Skill.WL_TETRAVORTEX) return 600;
	return 0;
}
