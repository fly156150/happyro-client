import { itemSubtypeNames } from 'UI/Game/ItemSubtypes.js';

/** Reconcile options only when the category's available subtypes change. */
export function createItemSubtypeFilter(changed) {
	const select = document.createElement('select');
	select.setAttribute('aria-label', '物品子类');
	select.onchange = changed;
	let previous = '';
	return {
		select,
		reset() {
			select.value = '';
		},
		update(items, category) {
			const available = new Set(category === 'all' ? [] : items.flatMap(item => item.subtypes));
			const keys = Object.keys(itemSubtypeNames).filter(key => available.has(key));
			const signature = JSON.stringify([category, keys]);
			if (signature === previous) return;
			previous = signature;
			const value = select.value;
			select.replaceChildren(
				new Option(keys.length || category === 'all' ? '全部子类' : '无子类', ''),
				...keys.map(key => new Option(itemSubtypeNames[key], key))
			);
			select.disabled = !keys.length;
			select.value = keys.includes(value) ? value : '';
		},
		matches(item) {
			return !select.value || item.subtypes.includes(select.value);
		}
	};
}
