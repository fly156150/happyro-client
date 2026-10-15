import catalog from 'DB/Items/ItemSubtypes.generated.json';
import { weaponSubtypeNames, armorSlotNames } from './ItemSubtypeNames.js';
const jobs = {
	Novice: '初心者',
	Swordman: '剑士',
	Mage: '魔法师',
	Archer: '弓箭手',
	Acolyte: '服事',
	Merchant: '商人',
	Thief: '盗贼',
	Knight: '骑士',
	Priest: '牧师',
	Wizard: '巫师',
	Blacksmith: '铁匠',
	Hunter: '猎人',
	Assassin: '刺客',
	Crusader: '十字军',
	Monk: '武僧',
	Sage: '贤者',
	Rogue: '流氓',
	Alchemist: '炼金术士',
	BardDancer: '诗人／舞娘',
	SuperNovice: '超级初心者',
	Gunslinger: '神枪手',
	Ninja: '忍者',
	Taekwon: '跆拳道',
	StarGladiator: '拳圣',
	SoulLinker: '悟灵士',
	KagerouOboro: '影狼／胧',
	Rebellion: '反叛者',
	Summoner: '召唤师',
	Spirit_Handler: '灵导士'
};
export function createEquipmentFilters(container, entries, changed) {
	const type = document.createElement('select'),
		job = document.createElement('select');
	type.setAttribute('aria-label', '装备类型');
	job.setAttribute('aria-label', '职业');
	type.add(new Option('全部装备', ''));
	job.add(new Option('全部职业', ''));
	const types = new Set(entries.map(e => catalog.items[e.itemId]));
	for (const [id, name] of Object.entries({ ...weaponSubtypeNames, ...armorSlotNames }))
		if (types.has(id)) type.add(new Option(name, id));
	for (const [id, name] of Object.entries(jobs)) job.add(new Option(name, id));
	type.onchange = job.onchange = changed;
	container.append(type, job);
	return entry => {
		const allowed = catalog.equipment[entry.itemId]?.jobs;
		return (
			(!type.value || catalog.items[entry.itemId] === type.value) &&
			(!job.value || Boolean(allowed && (allowed[job.value] ?? allowed.All ?? false)))
		);
	};
}
