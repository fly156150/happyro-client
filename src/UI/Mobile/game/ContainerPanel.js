import ItemType from 'DB/Items/ItemType.js';
import { interactionColumns, interactionFooter } from './InteractionPanel.js';
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

const labels = { inventory: '背包', storage: '仓库', cart: '手推车' };
export function createContainerPanel(body, actions, initialSource) {
	body.innerHTML =
		'<div class="container-toolbar"></div><div class="inventory-layout" data-menu-layout="split"><div class="inventory-list"></div><section class="inventory-detail"></section></div>';
	const primary = initialSource;
	const isCart = primary === 'cart';
	if (isCart) {
		interactionColumns(body, [
			{ title: '物品列表', className: 'inventory-list' },
			{ title: '物品说明', className: 'inventory-detail' }
		]);
		const toolbar = document.createElement('div');
		toolbar.className = 'container-toolbar';
		body.prepend(toolbar);
	}
	body.classList.add('warehouse-body');
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector);
	const { footer, status } = interactionFooter(body);
	const sourceSelect = document.createElement('select');
	sourceSelect.setAttribute('aria-label', '物品所在位置');
	const category = document.createElement('select');
	category.setAttribute('aria-label', '物品分类');
	for (const [key, text] of [
		['all', '全部'],
		['usable', '消耗品'],
		['equipment', '装备'],
		['weapon', '武器'],
		['armor', '防具'],
		['card', '卡片'],
		['ammo', '弹药'],
		['pet', '宠物用品'],
		['shadow', '影子装备'],
		['other', '其他']
	])
		category.add(new Option(text, key));
	const capacityLabel = document.createElement('span');
	capacityLabel.className = 'container-capacity';
	const sourceField = document.createElement('div');
	sourceField.className = 'container-source';
	sourceField.append(sourceSelect);
	const search = document.createElement('input');
	search.type = 'search';
	search.placeholder = '搜索名称或物品 ID';
	search.setAttribute('aria-label', `搜索${labels[primary]}物品`);
	const modes = document.createElement('div');
	modes.className = 'storage-modes';
	{
		for (const [value, title] of [
			[primary, '取出'],
			['inventory', '存入']
		]) {
			const tab = button(title, () => {
				source = value;
				reset();
				update();
			});
			tab.dataset.mode = value;
			modes.append(tab);
		}
	}
	const filters = document.createElement('div');
	filters.className = 'container-filters';
	filters.append(modes, sourceField, category);
	$('.container-toolbar').append(filters, search);
	footer.prepend(capacityLabel);
	status.hidden = true;
	let source = initialSource,
		selected = null,
		state;
	const nodes = new Map();
	function button(text, fn) {
		const node = document.createElement('button');
		node.type = 'button';
		node.textContent = text;
		node.onclick = fn;
		return node;
	}
	function reset() {
		selected = null;
		footer.querySelectorAll('button, .container-quantity').forEach(node => node.remove());
		$('.inventory-detail').textContent = '点击物品选择数量';
	}
	sourceSelect.onchange = () => {
		source = sourceSelect.value;
		reset();
		update();
	};
	category.onchange = () => {
		update();
		$('.inventory-list').scrollTop = 0;
	};
	search.oninput = () => update();
	function targets() {
		return state.containers.filter(
			entry =>
				entry !== source &&
				(!isCart || ['inventory', 'cart'].includes(entry)) &&
				(source === primary || entry === primary)
		);
	}
	function select(item) {
		if (!item) return;
		footer.querySelectorAll('button, .container-quantity').forEach(node => node.remove());
		selected = { index: item.index, ID: item.ID, identity: item.identity };
		const title = document.createElement('h3');
		title.textContent = item.name;
		const description = document.createElement('p');
		description.textContent = item.description;
		description.className = 'item-description';
		const amount = document.createElement('input');
		amount.type = 'number';
		amount.inputMode = 'numeric';
		amount.className = 'container-amount';
		amount.required = true;
		amount.min = '1';
		amount.max = String(item.count);
		amount.step = '1';
		amount.value = '1';
		const operation = source === primary ? '取出' : '存入';
		amount.setAttribute('aria-label', `${operation}数量`);
		const destination = document.createElement('select');
		destination.setAttribute('aria-label', '转移到');
		for (const target of targets()) destination.add(new Option(labels[target], target));
		const count = document.createElement('p');
		count.className = 'container-item-count';
		count.textContent = `数量：${item.count}`;
		const transfer = button(`确认${operation}`, () => {
			if (!amount.reportValidity() || !destination.value) return;
			const result = actions.transfer(
				source,
				destination.value,
				item.index,
				item.ID,
				Number(amount.value),
				item.identity
			);
			feedback(result, result === '已请求转移，等待服务器更新' ? 'pending' : 'error');
			update();
		});
		const form = document.createElement('div');
		form.className = 'container-form';
		for (const [text, control] of [
			['转移到', destination],
			[`${operation}数量`, amount]
		]) {
			const label = document.createElement('label');
			if (control === amount) label.append(control);
			else label.append(document.createTextNode(text), control);
			if (control === amount) {
				label.className = 'container-quantity';
				footer.append(label);
			} else form.append(label);
		}
		const heading = document.createElement('div');
		heading.className = 'container-item-heading';
		heading.append(title, count);
		$('.inventory-detail').replaceChildren(heading, form, description);
		footer.append(
			button('全部数量', () => {
				amount.value = String(
					state.items.find(entry => entry.index === item.index && entry.ID === item.ID)?.count || 0
				);
			}),
			transfer
		);
		update();
	}
	function update() {
		state = actions.snapshot(source);
		if (source !== primary && !state.containers.includes(source) && state.containers.includes('inventory')) {
			source = 'inventory';
			reset();
			state = actions.snapshot(source);
		}
		feedback.update(state.transferStatus, state.pending ? 'pending' : 'error');
		for (const tab of modes.children) {
			tab.setAttribute('aria-pressed', String((source === primary) === (tab.dataset.mode === primary)));
			tab.disabled = !state.allowed || state.pending;
		}
		sourceField.hidden =
			source === primary ||
			state.containers.filter(entry => entry !== primary && (!isCart || entry === 'inventory')).length < 2;
		const sources = state.containers.filter(entry => entry !== primary && (!isCart || entry === 'inventory'));
		const optionsKey = sources.join(',');
		if (sourceSelect.dataset.options !== optionsKey) {
			sourceSelect.replaceChildren(...sources.map(key => new Option(labels[key], key)));
			sourceSelect.dataset.options = optionsKey;
		}
		sourceSelect.value = source;
		sourceSelect.disabled = !state.allowed || state.pending;
		const capacity = isCart ? actions.snapshot('cart').capacity : state.storageCapacity;
		const unavailable = !state.containers.includes(source);
		capacityLabel.hidden = unavailable || !capacity;
		capacityLabel.textContent =
			capacity && !unavailable
				? `${labels[primary]}格数：${capacity.current}/${capacity.limit}${capacity.weight === undefined ? '' : ` · 重量：${capacity.weight}/${capacity.maxWeight}`}`
				: '';
		if (unavailable && source !== 'cart') feedback.update(`${labels[source]}当前不可用`);

		const keys = new Set();
		const query = search.value.trim().toLocaleLowerCase();
		const visible = state.items.filter(
			entry =>
				(category.value === 'all' ||
					entry.category === category.value ||
					itemTypes[category.value]?.includes(entry.type)) &&
				(!query || entry.name.toLocaleLowerCase().includes(query) || String(entry.ID).includes(query))
		);
		for (const item of visible) {
			const key = `${source}:${item.index}:${item.ID}`;
			keys.add(key);
			let node = nodes.get(key);
			if (!node) {
				node = button('', () =>
					select(state.items.find(entry => entry.index === item.index && entry.ID === item.ID))
				);
				node.className = 'inventory-item';
				node.append(document.createElement('img'), document.createElement('span'));
				nodes.set(key, node);
				$('.inventory-list').append(node);
			}
			node.setAttribute(
				'aria-pressed',
				String(
					selected?.index === item.index && selected?.ID === item.ID && selected?.identity === item.identity
				)
			);
			setListItemText(node, item.name, `×${item.count}`);
			node.querySelector('img').hidden = !item.icon;
			node.querySelector('img').alt = '';
			if (item.icon && node.querySelector('img').getAttribute('src') !== item.icon)
				node.querySelector('img').src = item.icon;
			node.disabled = !state.allowed || state.pending;
		}
		for (const [key, node] of nodes)
			if (!keys.has(key)) {
				node.remove();
				nodes.delete(key);
			}
		let empty = $('.container-empty');
		if (!visible.length && !empty) {
			empty = document.createElement('p');
			empty.className = 'container-empty';
			$('.inventory-list').append(empty);
		}
		if (visible.length) empty?.remove();
		else
			empty.textContent = unavailable
				? `${labels[source]}当前不可用`
				: state.items.length
					? '没有符合条件的物品'
					: '这里没有可转移的物品';
		const item = visible.find(
			entry =>
				entry.index === selected?.index && entry.ID === selected?.ID && entry.identity === selected?.identity
		);
		if (selected && !item) reset();
		else if (item) {
			$('.container-item-count').textContent = `数量：${item.count}`;
			$('.container-amount').max = String(item.count);
			const destination = $('.inventory-detail select'),
				value = destination.value;
			const destinations = targets();
			destination.parentElement.hidden = destinations.length < 2;
			if ([...destination.options].map(option => option.value).join(',') !== destinations.join(',')) {
				destination.replaceChildren(...destinations.map(key => new Option(labels[key], key)));
				if (destinations.includes(value)) destination.value = value;
			}
		}
		for (const node of footer.querySelectorAll('button'))
			node.disabled = !state.allowed || state.pending || unavailable || !$('.inventory-detail select')?.value;
		for (const node of body.querySelectorAll(
			'.inventory-detail button, .inventory-detail input, .inventory-detail select, .container-amount'
		))
			node.disabled = !state.allowed || state.pending || unavailable;
	}
	reset();
	update();
	return { update };
}
