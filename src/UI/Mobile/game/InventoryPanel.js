import { createInventoryDescription } from './InventoryDescription.js';
import { createMenuField } from './MenuFormControls.js';
import { createItemSubtypeFilter } from './ItemSubtypeFilter.js';
import ItemType from 'DB/Items/ItemType.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText } from './ListItemText.js';

const itemTypes = {
	weapon: [ItemType.WEAPON],
	armor: [ItemType.ARMOR],
	card: [ItemType.CARD],
	ammo: [ItemType.AMMO],
	pet: [ItemType.PETEGG, ItemType.PETARMOR],
	shadow: [ItemType.SHADOWGEAR]
};

/** Touch-only inventory presentation. Actions receive inventory indices, never DOM-derived item data. */
export function createInventoryPanel(body, actions) {
	body.innerHTML =
		'<div class="inventory-toolbar menu-form-row"></div><div class="inventory-layout" data-menu-layout="split"><div class="inventory-list" aria-label="物品列表"></div><section class="inventory-detail inventory-item-detail" aria-label="物品详情"></section></div>';
	const $ = selector => body.querySelector(selector);
	const list = $('.inventory-list'),
		detail = $('.inventory-detail');
	let selected = null,
		state = [],
		detailKey = '',
		binding = false,
		dismiss;
	const buttons = new Map();
	const sort = createMenuField('select');
	sort.setAttribute('aria-label', '背包排序');
	for (const [key, name] of [
		['index', '原始顺序'],
		['name', '名称排序'],
		['count', '数量排序'],
		['category', '分类排序']
	])
		sort.add(new Option(name, key));
	sort.onchange = () => render();

	const status = createFeedback(body);
	function button(label, fn) {
		const node = document.createElement('button');
		node.type = 'button';
		node.textContent = label;
		node.onclick = fn;
		return node;
	}
	function disabledAction(label) {
		const node = document.createElement('button');
		node.type = 'button';
		node.textContent = label;
		node.disabled = true;
		node.className = 'inventory-placeholder-action';
		return node;
	}
	const category = createMenuField('select');
	category.setAttribute('aria-label', '背包分类');
	for (const [key, label] of [
		['all', '全部'],
		['usable', '消耗品'],
		['equipment', '装备'],
		['weapon', '武器'],
		['armor', '防具'],
		['card', '卡片'],
		['ammo', '弹药'],
		['pet', '宠物用品'],
		['shadow', '影子装备'],
		['other', '其他'],
		['worn', '已穿戴']
	])
		category.add(new Option(label, key));
	const subtype = createItemSubtypeFilter(() => {
		render();
		list.scrollTop = 0;
	});
	category.onchange = () => {
		subtype.reset();
		render();
		list.scrollTop = 0;
	};
	const search = createMenuField();
	search.type = 'search';
	search.className = 'inventory-search';
	search.placeholder = '搜索名称或物品 ID';
	search.setAttribute('aria-label', '搜索背包物品');
	search.oninput = () => { render(); list.scrollTop = 0; };
	$('.inventory-toolbar').append(category, subtype.select, sort, search);
	function renderDetail() {
		const item = state.find(entry => entry.index === selected?.index && entry.ID === selected?.ID);
		if (!item) {
			dismiss?.();
			dismiss = null;
			selected = null;
			binding = false;
			detailKey = '';
			const hint = document.createElement('div');
			hint.className = 'inventory-empty-message';
			hint.textContent = '点击物品查看详情和操作';
			const ops = document.createElement('div');
			ops.className = 'inventory-actions inventory-empty-actions menu-footer menu-footer--trailing';
			ops.append(...['使用', '设置快捷键', '丢弃'].map(disabledAction));
			detail.replaceChildren(hint, ops);
			return;
		}
		const key = JSON.stringify(item);
		if (binding || key === detailKey) return;
		detailKey = key;
		const ops = document.createElement('div');
		ops.className = 'inventory-actions menu-footer menu-footer--trailing';
		if (item.action) {
			const label = { use: '使用', equip: '穿戴', unequip: '卸下', card: '镶嵌卡片' }[item.action];
			const perform = () => {
				const error = actions.act(item.index, item.ID, item.action);
				if (error) status(error, 'error');
				update();
			};
			const use = button(label, () => {
				if (['equip', 'unequip', 'card'].includes(item.action)) perform();
				else dismiss = confirmAction(body, `确认${label}「${item.name}」？`, perform);
			});
			use.disabled = Boolean(item.reason);
			ops.append(use);
		} else ops.append(disabledAction('使用'));
		if (item.shortcut) ops.append(button('设置快捷键', () => chooseBinding(item)));
		else ops.append(disabledAction('设置快捷键'));
		if (!item.worn) ops.append(button('丢弃', () => chooseDrop(item)));
		else ops.append(disabledAction('丢弃'));
		const content = createInventoryDescription(item, actions.preview);
		detail.replaceChildren(content, ops);

	}
	function chooseDrop(item) {
		binding = true;
		const warning = document.createElement('p');
		warning.textContent = `确认丢弃「${item.name}」？`;
		const input = createMenuField();
		input.type = 'number';
		input.min = '1';
		input.max = String(Math.min(item.count, 65535));
		input.step = '1';
		input.value = '1';
		input.setAttribute('aria-label', '丢弃数量');
		const content = document.createElement('div');
		content.className = 'ui-confirm-field drop-quantity';
		content.append(input);
		const controls = document.createElement('div');
		controls.className = 'drop-quantity-buttons';
		const maximum = Number(input.max);
		function changeQuantity(delta) {
			const value = Number.isFinite(input.valueAsNumber) ? Math.trunc(input.valueAsNumber) : 1;
			input.value = String(Math.max(1, Math.min(maximum, delta === 'max' ? maximum : value + delta)));
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}
		const increase = button('+', () => changeQuantity(1));
		increase.setAttribute('aria-label', '增加数量');
		const decrease = button('−', () => changeQuantity(-1));
		decrease.setAttribute('aria-label', '减少数量');
		const max = button('MAX', () => changeQuantity('max'));
		max.setAttribute('aria-label', '最大数量');
		controls.append(increase, decrease, max);
		content.append(controls);
		dismiss = confirmAction(
			body,
			warning.textContent,
			() => {
				const error = actions.drop(item.index, item.ID, Number(input.value));
				if (error) status(error, 'error');
				binding = false;
				detailKey = '';
				update();
			},
			{
				content,
				cancelled: () => {
					binding = false;
					detailKey = '';
					renderDetail();
				}
			}
		);
	}
	function chooseBinding(item) {
		binding = true;
		const select = createMenuField('select');
		select.setAttribute('aria-label', '位置');
		const page = actions.shortcuts();
		for (let i = 0; i < page.total; i++)
			select.add(new Option(`位置 ${i + 1} · ${actions.slotName(i)}`, String(i)));
		select.value = String(page.slots[0].index);
		const content = document.createElement('div');
		content.className = 'shortcut-fields';
		const field = document.createElement('div');
		field.className = 'ui-confirm-field';
		field.append(select);
		content.append(field);
		dismiss = confirmAction(
			body,
			`设置「${item.name}」的快捷键？`,
			() => {
				const success = actions.bind(item.index, item.ID, Number(select.value));
				status(
					success ? `已设置到位置 ${Number(select.value) + 1}` : '设置失败，物品或角色状态已经变化',
					success ? 'success' : 'error'
				);
				binding = false;
				detailKey = '';
				update();
			},
			{
				content,
				cancelled: () => {
					binding = false;
					detailKey = '';
					renderDetail();
				}
			}
		);
	}
	function render() {
		const categoryItems = state.filter(
			item =>
				category.value === 'all' ||
				(category.value === 'worn' ? item.worn : item.category === category.value) ||
				itemTypes[category.value]?.includes(item.type)
		);
		subtype.update(categoryItems, category.value);
		const query = search.value.trim().toLocaleLowerCase();
		const filtered = categoryItems.filter(item => subtype.matches(item) && (!query || item.name.toLocaleLowerCase().includes(query) || String(item.ID).includes(query)));
		filtered.sort((a, b) =>
			sort.value === 'name'
				? a.name.localeCompare(b.name, 'zh-CN')
				: sort.value === 'count'
					? b.count - a.count || a.index - b.index
					: sort.value === 'category'
						? a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'zh-CN')
						: a.index - b.index
		);
		const keys = new Set(filtered.map(item => `${item.index}:${item.ID}`));
		for (const [key, node] of buttons)
			if (!keys.has(key)) {
				node.remove();
				buttons.delete(key);
			}
		list.querySelector('p')?.remove();
		if (!filtered.length) {
			const empty = document.createElement('p');
			empty.className = 'inventory-list-empty';
			empty.textContent = '该分类暂无物品';
			list.append(empty);
		}
		for (const [position, item] of filtered.entries()) {
			const key = `${item.index}:${item.ID}`;
			let node = buttons.get(key);
			if (!node) {
				node = button('', () => {
					dismiss?.();
					dismiss = null;
					selected = { index: item.index, ID: item.ID };
					binding = false;
					detailKey = '';
					status('');
					render();
					detail.querySelector('.inventory-item-description')?.scrollTo?.(0, 0);
				});
				node.className = 'inventory-item';
				node.dataset.index = item.index;
				node.append(document.createElement('img'), document.createElement('span'));
				buttons.set(key, node);
				list.append(node);
			}
			if (list.children[position] !== node) list.insertBefore(node, list.children[position] || null);
			const image = node.querySelector('img');
			image.alt = '';
			if (item.icon && image.getAttribute('src') !== item.icon) image.src = item.icon;
			setListItemText(node, item.name, `×${item.count}${item.worn ? ' · 已穿戴' : ''}`);
			node.setAttribute('aria-pressed', String(selected?.index === item.index && selected?.ID === item.ID));
		}
		renderDetail();
	}
	function update() {
		state = actions.snapshot();
		render();
	}
	update();
	return { update };
}
