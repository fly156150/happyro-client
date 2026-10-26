import StatusState from 'DB/Status/StatusState.js';
import Status from 'DB/Status/StatusConst.js';
import Skill from 'DB/Skills/SkillConst.js';
import { levelValue } from './CombatSkillCapabilities.js';

const effect = StatusState.EffectState;
const dragonRiding = effect.DRAGON1 | effect.DRAGON2 | effect.DRAGON3 | effect.DRAGON4 | effect.DRAGON5;
const states = {
	Riding: effect.RIDING | dragonRiding,
	Ridingdragon: dragonRiding,
	Falcon: effect.FALCON,
	Wug: effect.WUG,
	Mado: effect.MADOGEAR
};
const stances = {
	Sunstance: Status.SUNSTANCE,
	Moonstance: Status.LUNARSTANCE,
	Starstance: Status.STARSTANCE,
	Universestance: Status.UNIVERSESTANCE
};
const extraAmmoSkills = new Set(['WM_SEVERE_RAINSTORM', 'RL_FIREDANCE', 'RL_R_TRIP', 'RL_FIRE_RAIN']);
const soulSkills = new Set([
	'SP_SOULGOLEM', 'SP_SOULSHADOW', 'SP_SOULFALCON', 'SP_SOULFAIRY', 'SP_SOULCURSE',
	'SP_SPA', 'SP_SHA', 'SP_SWHOO', 'SP_SOULUNITY', 'SP_SOULDIVISION', 'SP_SOULREAPER',
	'SP_SOULEXPLOSION', 'SP_KAUTE', 'SOA_EXORCISM_OF_MALICIOUS_SOUL'
]);
const partialSphereSkills = new Set(['MO_FINGEROFFENSIVE', 'GS_FLING', 'SR_RIDEINLIGHTNING', 'DK_SERVANT_W_DEMOL']);
const sphereExemptions = {
	MO_BODYRELOCATION: [Status.EXPLOSIONSPIRITS],
	SR_FALLENEMPIRE: [Status.FIRST_FAITH_POWER, Status.SECOND_JUDGE, Status.THIRD_EXOR_FLAME],
	SR_TIGERCANNON: [Status.THIRD_EXOR_FLAME],
	SR_RAMPAGEBLASTER: [Status.MASSIVE_F_BLASTER],
	SR_RIDEINLIGHTNING: [Status.MASSIVE_F_BLASTER],
	SR_FLASHCOMBO: [Status.SECOND_JUDGE, Status.THIRD_EXOR_FLAME]
};
/** Pure, live character-level checks. Server validation remains authoritative. */
export function skillRequirementReason(req, level, actor, skillName) {
	const cost = key => levelValue(req[key], level);
	if (cost('ApCost') > 0 && Number.isFinite(actor.ap) && actor.ap < cost('ApCost')) return 'AP 不足';
	const rate = cost('HpRateCost');
	const hpCost =
		cost('HpCost') + (rate ? Math.floor((Math.abs(rate) * (rate >= 0 ? actor.hp : actor.hpMax)) / 100) : 0);
	if (hpCost > 0 && Number.isFinite(actor.hp) && actor.hp <= hpCost) return 'HP 不足';
	if (
		req.Status?.some(status =>
			status.name === 'Sight'
				? !(actor.effects & effect.SIGHT)
				: status.name === 'Hiding'
					? !(actor.effects & effect.HIDE)
					: Number.isInteger(status.icon) && !actor.hasStatus(status.icon)
		)
	)
		return '缺少前置状态';
	if (
		req.Weapon && actor.weapons?.length &&
		actor.weapons.every(type => typeof type === 'string' && type.length > 0) &&
		!actor.weapons.some(type => req.Weapon[type])
	) return '武器类型不符';
	if (req.State in states && !(actor.effects & states[req.State])) return '缺少骑乘或随行状态';
	if (req.State in stances && !actor.hasStatus(stances[req.State]) && !actor.hasStatus(Status.UNIVERSESTANCE))
		return '缺少所需姿态';
	if (
		req.State === 'Cart' &&
		!actor.hasStatus(Status.ON_PUSH_CART) &&
		!(actor.effects & (effect.CART1 | effect.CART2 | effect.CART3 | effect.CART4 | effect.CART5))
	)
		return '需要手推车';
	if (req.State === 'Shield' && !actor.shield) return '需要盾牌';
	const soulSkill = soulSkills.has(skillName);
	const sphereCount = soulSkill ? actor.soulCount : actor.spiritCount;
	let sphereCost = cost('SpiritSphereCost');
	if (skillName === 'DK_SERVANT_W_PHANTOM' || sphereExemptions[skillName]?.some(actor.hasStatus)) sphereCost = 0;
	if (sphereCost > 0 && partialSphereSkills.has(skillName)) sphereCost = 1;
	if (skillName === 'LG_RAGEBURST') sphereCost = 1;
	// Renewal combos can consume any positive sphere count; their state is not fully visible.
	if (skillName === 'MO_EXTREMITYFIST')
		sphereCost = actor.hasStatus(Status.BLADESTOP) ? Math.max(0, sphereCost - 1) : 1;
	if (sphereCost > 0 && Number.isFinite(sphereCount) && sphereCount < sphereCost) return soulSkill ? '灵魂球不足' : '气弹或仆从球不足';
	let zenyCost = cost('ZenyCost');
	if (['MC_MAMMONITE', 'WS_CARTTERMINATION'].includes(skillName) && actor.hasSkill(Skill.BS_UNFAIRLYTRICK))
		zenyCost -= Math.floor(zenyCost * 20 / 100);
	if (zenyCost > 0 && !(actor.zeny >= zenyCost)) return 'Zeny 不足';
	const ammoCost = Math.max(1, cost('AmmoAmount') + (extraAmmoSkills.has(skillName) ? 1 : 0));
	if (req.Ammo && (!req.Ammo[actor.ammoType] || actor.ammoCount < ammoCost))
		return '弹药不足或类型不符';
	const discountedAcid = ['BO_ACIDIFIED_ZONE_WATER', 'BO_ACIDIFIED_ZONE_GROUND', 'BO_ACIDIFIED_ZONE_WIND', 'BO_ACIDIFIED_ZONE_FIRE'].includes(skillName) && actor.hasStatus(Status.RESEARCHREPORT);
	const items = (req.ItemCost || []).filter(item => !item.Level || item.Level === level);
	const materialCount = item => Math.max(1, item.Amount - (discountedAcid && item === req.ItemCost[0] ? 1 : 0));
	if (
		items.some(
			item =>
				!item.variable &&
				actor.itemCount(item.Item) < materialCount(item) &&
				!(item.alternative && actor.hasSkill(item.requiresSkill) && actor.itemCount(item.alternative) >= 1)
		)
	)
		return '材料不足';
	// Equipment means inventory possession for Mado devices; pile bunkers/bullets must be equipped.
	if (
		req.Equipment?.length &&
		!req.Equipment.some(id => (req.equippedRequired ? actor.equippedItem(id) : actor.itemCount(id) > 0))
	)
		return '缺少所需装备';
	return '';
}
