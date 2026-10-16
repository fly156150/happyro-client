import { createEquipmentFilters } from 'UI/Game/EquipmentFilters.js';
import { interactionReview, interactionFooter } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createSelectionPanel(body, service) {
	body.innerHTML =
		'<p data-warning></p><div class="inventory-layout" data-menu-layout="split"><div class="inventory-list" aria-label="可选列表"></div><section class="inventory-detail" aria-label="选项详情"></section></div>';
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector),
		list = $('.inventory-list'),
		detail = $('.inventory-detail');
	let selected = null,
		key = '',
		editingId = null;
	const nodes = new Map();
	const { footer, status } = interactionFooter(body);
	let matches = () => true;
	if (service.snapshot().equipment) {
		body.classList.add('equipment-selection');
		const filters = document.createElement('div');
		filters.className = 'equipment-filters';
		body.prepend(filters);
		matches = createEquipmentFilters(filters, service.snapshot().entries, () => {
			selected = null;
			key = '';
			update();
		});
	}
	function update() {
		const state = service.snapshot();
		$('[data-warning]').textContent = state.warning || '';
		$('[data-warning]').hidden = !state.warning;
		status.textContent = state.allowed ? '选择条目后核对确认' : '当前不可操作，请等待服务器回复';
		for (const entry of state.entries) {
			let b = nodes.get(entry.id);
			if (!b) {
				b = document.createElement('button');
				b.className = 'inventory-item';
				b.innerHTML = '<img alt=""><span></span>';
				b.onclick = () => {
					selected = entry.id;
					key = '';
					update();
				};
				nodes.set(entry.id, b);
				list.append(b);
			}
			b.querySelector('span').textContent = entry.name;
			b.querySelector('img').hidden = !entry.icon;
			if (entry.icon) b.querySelector('img').src = entry.icon;
			b.hidden = !matches(entry);
			b.setAttribute('aria-pressed', String(selected === entry.id));
		}
		for (const [id, node] of nodes) {
			if (!state.entries.some(entry => entry.id === id)) {
				node.remove();
				nodes.delete(id);
			} else node.disabled = !state.allowed;
		}
		const entry = state.entries.find(e => e.id === selected);
		if (!entry) selected = null;
		const preview = detail.querySelector('.selection-preview');
		if (preview && entry) {
			preview.hidden = !entry.icon;
			if (entry.icon) preview.src = entry.icon;
		}
		const next = JSON.stringify([entry && { ...entry, icon: undefined }, state.allowed, state.materials]);
		if (next === key) return;
		key = next;
		const previous =
			editingId === selected ? [...detail.querySelectorAll('select')].map(select => select.value) : [];
		editingId = selected;
		detail.replaceChildren();
		footer.querySelector('button')?.remove();
		if (!entry) {
			detail.textContent = state.entries.length ? '点选条目后确认' : '没有可选条目';
			return;
		}
		const title = document.createElement('h3');
		title.textContent = entry.name;
		const description = document.createElement('p');
		description.className = 'item-description';
		description.textContent = entry.description || '';
		const materials = [];
		if (entry.materials) {
			for (let index = 0; index < 3; index++) {
				const select = document.createElement('select');
				select.setAttribute('aria-label', `附加材料 ${index + 1}`);
				select.add(new Option('不使用附加材料', '0'));
				for (const material of state.materials)
					select.add(new Option(`${material.name} × ${material.count}`, material.id));
				if ([...select.options].some(option => option.value === previous[index]))
					select.value = previous[index];
				select.disabled = !state.allowed;
				materials.push(select);
				detail.append(select);
			}
		}
		const button = document.createElement('button');
		button.textContent = '确认选择';
		button.disabled = !state.allowed;
		button.onclick = () => {
			const chosen = materials.map(select => Number(select.value)).filter(Boolean);
			const content = interactionReview(
				[
					entry.description || entry.name,
					...materials
						.filter(select => select.value !== '0')
						.map(select => select.selectedOptions[0].textContent)
				],
				`选择：${entry.name}`,
				state.warning || ''
			);
			if (state.equipment) {
				content.prepend(content.querySelector('.interaction-review-summary'));
			}
			confirmAction(
				body,
				state.equipment ? '' : `确认选择「${entry.name}」？`,
				() => {
					feedback(service.choose(entry.id, chosen), 'error');
				},
				{ content }
			);
		};
		if (entry.preview) {
			const img = document.createElement('img');
			img.className = 'selection-preview';
			img.alt = entry.name;
			img.width = img.height = 100;
			img.hidden = !entry.icon;
			if (entry.icon) img.src = entry.icon;
			detail.append(img);
		}
		detail.prepend(title);
		detail.append(description);
		footer.append(button);
	}
	update();
	return { update };
}
