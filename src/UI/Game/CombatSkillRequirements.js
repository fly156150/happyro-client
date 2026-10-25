import StatusState from 'DB/Status/StatusState.js';
import Status from 'DB/Status/StatusConst.js';
import { levelValue } from './CombatSkillCapabilities.js';

const effect = StatusState.EffectState;
const states = {
	Riding: effect.RIDING,
	Ridingdragon: effect.DRAGON1 | effect.DRAGON2 | effect.DRAGON3 | effect.DRAGON4 | effect.DRAGON5,
	Falcon: effect.FALCON,
	Wug: effect.WUG,
	Mado: effect.MADOGEAR
};
/** Pure, live character-level checks. Server validation remains authoritative. */
export function skillRequirementReason(req, level, actor) {
	const cost = key => levelValue(req[key], level);
	if (cost('ApCost') > 0 && !(actor.ap >= cost('ApCost'))) return 'AP 不足';
	const rate = cost('HpRateCost');
	const hpCost =
		cost('HpCost') + (rate ? Math.floor((Math.abs(rate) * (rate >= 0 ? actor.hp : actor.hpMax)) / 100) : 0);
	if (hpCost > 0 && !(actor.hp > hpCost)) return 'HP 不足';
	if (
		req.Status?.some(status =>
			status.name === 'Sight'
				? !(actor.effects & effect.SIGHT)
				: status.name === 'Hiding'
					? !(actor.effects & effect.HIDE)
					: !actor.hasStatus(status.icon)
		)
	)
		return '缺少前置状态';
	if (req.Weapon && !req.Weapon[actor.weapon]) return '武器类型不符';
	if (req.State in states && !(actor.effects & states[req.State])) return '缺少骑乘或随行状态';
	if (
		req.State === 'Cart' &&
		!actor.hasStatus(Status.ON_PUSH_CART) &&
		!(actor.effects & (effect.CART1 | effect.CART2 | effect.CART3 | effect.CART4 | effect.CART5))
	)
		return '需要手推车';
	if (req.State === 'Shield' && !actor.shield) return '需要盾牌';
	if (cost('SpiritSphereCost') > 0 && !(actor.spiritCount >= cost('SpiritSphereCost'))) return '气弹或仆从球不足';
	if (cost('ZenyCost') > 0 && !(actor.zeny >= cost('ZenyCost'))) return 'Zeny 不足';
	if (req.Ammo && (!req.Ammo[actor.ammoType] || actor.ammoCount < Math.max(1, cost('AmmoAmount'))))
		return '弹药不足或类型不符';
	const items = (req.ItemCost || []).filter(item => !item.Level || item.Level === level);
	if (
		items.some(
			item =>
				!item.variable &&
				actor.itemCount(item.Item) < item.Amount &&
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
