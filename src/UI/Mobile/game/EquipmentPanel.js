import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
/** Independent touch equipment view; server snapshots own all item and stat values. */
export function createEquipmentPanel(body, actions) {
	body.innerHTML =
		'<nav class="equipment-tabs" aria-label="装备分类"></nav><div class="equipment-layout" data-menu-layout="split"><div class="equipment-slots" aria-label="装备部位"></div><section class="equipment-detail inventory-item-detail" aria-label="装备详情"></section></div><dl class="equipment-stats" hidden></dl>';
	const $ = selector => body.querySelector(selector);
	const slotsRoot = $('.equipment-slots'),
		detail = $('.equipment-detail');
	let group = 'normal',
		selected = 'HEAD_TOP',
		dismiss,
		detailKey = '';
	let state;
	const slots = new Map(),
		statNodes = new Map();
	function button(text, fn) {
		const node = document.createElement('button');
		node.type = 'button';
		node.textContent = text;
		node.onclick = fn;
		return node;
	}
	const message = createFeedback(body);
	function select(slot) {
		selected = slot.key;
		dismiss?.();
		dismiss = null;
		detailKey = '';
		message('');
		render();
		detail.scrollTop = 0;
	}
	for (const [key, label] of [
		['normal', '装备'],
		['costume', '时装'],
		['shadow', '影子'],
		['stats', '属性']
	]) {
		const tab = button(label, () => {
			dismiss?.();
			group = key;
			const first = state.slots.find(slot => slot.group === group);
			if (first) select(first);
			else render();
		});
		tab.dataset.group = key;
		$('.equipment-tabs').append(tab);
	}
	function itemDetails(item) {
		const title = document.createElement('h3');
		title.textContent = item.name;
		const description = document.createElement('p');
		description.className = 'item-description';
		description.textContent = item.description || '暂无装备说明';
		const status = document.createElement('p');
		status.textContent = `数量：${item.count}${item.worn ? ' · 已穿戴' : ''}${!item.identified ? ' · 未鉴定' : ''}${item.damaged ? ' · 已损坏' : ''}`;
		return [title, status, description];
	}
	function perform(slot, item, action) {
		message(actions.act(slot.key, item.index, item.ID, action), 'error');
		update();
	}
	function chooseEquipment(slot) {
		const content = document.createElement('div');
		content.className = 'equipment-picker-layout';
		const preview = document.createElement('div');
		preview.className = 'equipment-picker-preview';
		preview.setAttribute('aria-label', '装备说明');
		preview.textContent = '选择装备查看说明';
		const list = document.createElement('div');
		list.className = 'equipment-picker-list';
		list.dataset.slot = slot.key;
		list.setAttribute('aria-label', '可更换装备');
		content.append(list);
		let choice = null;
		if (!slot.candidates.length) list.textContent = '背包中没有此部位的装备';
		for (const item of slot.candidates) {
			const candidate = button(item.name, () => {
				choice = item;
				preview.replaceChildren(...itemDetails(item));
				preview.scrollTop = 0;
				for (const node of content.querySelectorAll('.equipment-candidate'))
					node.setAttribute('aria-pressed', String(node === candidate));
				content.closest('dialog').querySelector('[data-confirm]').disabled = Boolean(item.reason);
			});
			candidate.className = 'equipment-candidate';
			candidate.dataset.index = item.index;
			candidate.dataset.id = item.ID;
			const icon = document.createElement('img');
			icon.alt = '';
			icon.hidden = !item.icon;
			if (item.icon) icon.src = item.icon;
			const label = document.createElement('span');
			label.textContent = item.name;
			candidate.replaceChildren(icon, label);
			list.append(candidate);
		}
		content.append(preview);
		dismiss = confirmAction(
			body,
			`选择${slot.label}装备`,
			() => {
				if (choice) perform(slot, choice, 'equip');
			},
			{ content, bounds: body.closest('.panel') }
		);
		content.closest('dialog').querySelector('[data-confirm]').disabled = true;
	}
	function renderDetail() {
		const slot = state.slots.find(entry => entry.key === selected);
		if (!slot) return;
		const key = JSON.stringify(slot);
		if (key === detailKey) return;
		detailKey = key;
		const content = document.createElement('div');
		content.className = 'inventory-item-description';
		const heading = document.createElement('h3');
		heading.textContent = slot.label;
		content.append(heading);
		const ops = document.createElement('div');
		ops.className = 'inventory-actions';
		if (slot.item) {
			content.append(...itemDetails(slot.item));
			const remove = button('卸下', () => perform(slot, slot.item, 'unequip'));
			remove.disabled = Boolean(slot.item.reason);
			ops.append(remove);
			if (slot.item.reason) {
				const reason = document.createElement('p');
				reason.textContent = slot.item.reason;
				content.append(reason);
			}
		} else content.append(document.createTextNode('此部位未穿戴装备'));
		ops.append(button(slot.item ? '更换' : '选择装备', () => chooseEquipment(slot)));
		detail.replaceChildren(content, ops);
	}
	function render() {
		for (const tab of $('.equipment-tabs').children)
			tab.setAttribute('aria-pressed', String(tab.dataset.group === group));
		$('.equipment-layout').hidden = group === 'stats';
		$('.equipment-stats').hidden = group !== 'stats';
		for (const slot of state.slots) {
			let node = slots.get(slot.key);
			if (!node) {
				node = button('', () => select(state.slots.find(entry => entry.key === slot.key)));
				node.className = 'equipment-slot';
				node.dataset.slot = slot.key;
				node.append(
					document.createElement('img'),
					document.createElement('strong'),
					document.createElement('span')
				);
				slots.set(slot.key, node);
				slotsRoot.append(node);
			}
			node.hidden = slot.group !== group;
			node.setAttribute('aria-pressed', String(selected === slot.key));
			node.querySelector('strong').textContent = slot.label;
			node.querySelector('span').textContent = slot.item?.name || '＋ 选择装备';
			const image = node.querySelector('img');
			image.alt = '';
			image.hidden = !slot.item?.icon;
			if (slot.item?.icon && image.getAttribute('src') !== slot.item.icon) image.src = slot.item.icon;
		}
		for (const stat of state.stats) {
			if (!statNodes.has(stat.key)) {
				const dt = document.createElement('dt');
				dt.textContent = stat.label;
				const dd = document.createElement('dd');
				dd.dataset.stat = stat.key;
				$('.equipment-stats').append(dt, dd);
				statNodes.set(stat.key, dd);
			}
			statNodes.get(stat.key).textContent = stat.value;
		}
		const picker = body.querySelector('.equipment-picker-list');
		if (picker) {
			const candidates = state.slots.find(slot => slot.key === picker.dataset.slot)?.candidates || [];
			for (const node of picker.querySelectorAll('.equipment-candidate')) {
				const item = candidates.find(
					candidate =>
						String(candidate.index) === node.dataset.index && String(candidate.ID) === node.dataset.id
				);
				const icon = node.querySelector('img');
				icon.hidden = !item?.icon;
				if (item?.icon && icon.getAttribute('src') !== item.icon) icon.src = item.icon;
			}
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
