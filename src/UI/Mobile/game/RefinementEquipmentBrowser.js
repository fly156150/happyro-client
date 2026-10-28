import { createMenuField } from './MenuFormControls.js';
import { createItemSubtypeFilter } from './ItemSubtypeFilter.js';
import { frameMenuScroll } from './MenuScrollPane.js';
import ItemType from 'DB/Items/ItemType.js';

/** Equipment filtering shares inventory subtype semantics and stable list nodes. */
export function createRefinementEquipmentBrowser(body, changed, operation = '精炼') {
	body.classList.add('refinement-inventory');
	body.innerHTML = `<div class="refinement-browser"><div class="refinement-filters"></div><div class="refinement-search"></div><div class="inventory-list" aria-label="待${operation}装备"></div><section class="inventory-detail" aria-label="${operation}配置"></section></div>`;
	const category = createMenuField('select');
	category.setAttribute('aria-label', '装备分类');
	for (const [value, label] of [
		['equipment', '装备'],
		['weapon', '武器'],
		['armor', '防具'],
		['shadow', '影子装备']
	])
		category.add(new Option(label, value));
	const subtype = createItemSubtypeFilter(refresh);
	const search = createMenuField();
	search.type = 'search';
	search.placeholder = '搜索名称或物品 ID';
	search.setAttribute('aria-label', `搜索${operation}装备`);
	function refresh() {
		changed();
		body.querySelector('.inventory-list').scrollTop = 0;
	}
	category.onchange = () => {
		subtype.reset();
		refresh();
	};
	search.oninput = refresh;
	body.querySelector('.refinement-filters').append(category, subtype.select);
	body.querySelector('.refinement-search').append(search);
	for (const kind of ['list', 'detail']) {
		const frame = frameMenuScroll(body.querySelector(`.inventory-${kind}`), { kind });
		frame.classList.add(`refinement-${kind}-frame`);
	}
	const types = { weapon: ItemType.WEAPON, armor: ItemType.ARMOR, shadow: ItemType.SHADOWGEAR };
	return {
		filter(items) {
			const categoryItems = items.filter(
				item => category.value === 'equipment' || item.type === types[category.value]
			);
			subtype.update(categoryItems, category.value);
			const query = search.value.trim().toLocaleLowerCase();
			return categoryItems.filter(
				item =>
					subtype.matches(item) &&
					(!query || item.name.toLocaleLowerCase().includes(query) || String(item.ID).includes(query))
			);
		}
	};
}
