import { createMenuField } from './MenuFormControls.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';
import { interactionColumns, interactionReview, interactionFooter } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createRefinementPanel(body, service) {
	interactionColumns(body, [
		{ title: '可强化装备', className: 'inventory-list', list: true },
		{ title: '强化配置', className: 'inventory-detail' },
		{ title: '装备与结果', className: 'interaction-result' }
	]);
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector),
		list = $('.inventory-list'),
		detail = $('.inventory-detail'),
		nodes = new Map();
	const { footer, status } = interactionFooter(body);
	let lastResultId = 0;
	let key = '',
		editingId = '';
	function update() {
		const state = service.snapshot();
		if (state.resultId && state.resultId !== lastResultId) {
			lastResultId = state.resultId;
			feedback(state.message, state.messageKind);
		}

		status.textContent = state.message || `余额：${state.zeny ?? 0} Z`;
		const ids = new Set(state.items.map(item => item.index));
		for (const [id, node] of nodes)
			if (!ids.has(id)) {
				node.remove();
				nodes.delete(id);
			}
		for (const item of state.items) {
			let button = nodes.get(item.index);
			if (!button) {
				button = document.createElement('button');
				button.className = 'inventory-item';
				button.onclick = () => {
					const current = service.snapshot().items.find(entry => entry.index === item.index);
					const error = current ? service.select(current.index, current.ID) : '装备已经变化';
					if (error) feedback(error, 'error');
					key = '';
					update();
				};
				nodes.set(item.index, button);
				list.append(button);
			}
			setListItemText(button, item.name);
			setListItemIcon(button, item);
			button.disabled = !state.allowed;
			button.setAttribute('aria-pressed', String(state.selected?.index === item.index));
		}
		const next = JSON.stringify([
			state.selected,
			state.offer,
			state.pending,
			state.allowed,
			state.zeny,
			state.materials
		]);
		if (key === next) return;
		key = next;
		const result = $('.interaction-result');
		result.replaceChildren();
		const selectedItem = state.items.find(item => item.index === state.selected?.index);
		const title = document.createElement('h3');
		title.textContent = selectedItem?.name || '请选择装备';
		const description = document.createElement('p');
		description.className = 'item-description';
		description.textContent = selectedItem?.description || '';
		result.append(title, description);
		const identity = JSON.stringify(state.selected);
		const previous =
			identity === editingId
				? {
						material: detail.querySelector('select')?.value,
						blessing: detail.querySelector('input')?.value,
						checked: detail.querySelector('input')?.checked
					}
				: {};
		editingId = identity;
		detail.replaceChildren();
		footer.querySelector('button')?.remove();
		if (!state.offer) {
			detail.textContent = '请选择装备';
			return;
		}
		const warning = document.createElement('p');
		warning.textContent = '强化会消耗材料与 Z，失败可能降低等级或损坏装备。';
		const materials = createMenuField('select');
		materials.setAttribute('aria-label', '强化材料');
		for (const material of state.materials) materials.add(new Option(material.name, material.index));
		const cost = document.createElement('p');
		cost.className = 'item-description';
		if ([...materials.options].some(option => option.value === previous.material))
			materials.value = previous.material;
		materials.disabled = !state.allowed;
		const chance = document.createElement('p');
		const blessing = createMenuField();
		blessing.type = 'number';
		blessing.min = '0';
		blessing.step = '1';
		blessing.value = previous.blessing ?? '0';
		blessing.required = true;
		blessing.setAttribute('aria-label', '祝福次数');
		let protection;
		if (state.kind === 'refine') {
			blessing.type = 'checkbox';
			blessing.required = false;
			blessing.setAttribute('aria-label', '使用铁匠的祝福');
			blessing.checked = Boolean(previous.checked && state.offer.blacksmithBlessing);
			blessing.disabled = !state.allowed || !state.offer.blacksmithBlessing;
			protection = `使用铁匠的祝福：${state.offer.blacksmithBlessing || 0} 个`;
		} else {
			blessing.max = state.offer.blessing_info?.max_blessing || 0;
			blessing.disabled = !state.allowed;
			protection = `祝福次数（每次消耗 ${state.offer.blessing_info?.amount || 0} 个）`;
		}
		const label = document.createElement('label');
		label.className = 'interaction-field';
		label.textContent = protection;
		label.append(blessing);
		const confirm = document.createElement('button');
		confirm.textContent = '下一步';
		function selected() {
			return {
				material: Number(materials.value),
				blessing:
					state.kind === 'refine'
						? blessing.checked
							? state.offer.blacksmithBlessing
							: 0
						: Number(blessing.value)
			};
		}
		function details() {
			const material = state.materials.find(row => row.index === Number(materials.value));
			cost.textContent = `材料：${material?.name || '—'} × ${material?.amount ?? 1}\n持有：${material?.owned ?? 0}\n费用：${material?.zeny ?? material?.price ?? 0} Z`;
			chance.textContent =
				state.kind === 'refine'
					? `成功率：${material?.chance ?? 0}%`
					: `成功率：${Math.min(100, (state.offer.success_chance || 0) + Number(blessing.value) * (state.offer.blessing_info?.bonus || 0))}% · 失败降级：${material?.downgrade || 0} · 可能损坏：${material?.breakable ? '是' : '否'}`;
			confirm.textContent = '下一步';
		}
		materials.onchange = details;
		blessing.onchange = details;
		details();
		confirm.disabled = !state.allowed || !state.materials.length;
		confirm.onclick = () => {
			if (!blessing.reportValidity()) return;
			const choice = selected();
			const terms = value => [value.selected, value.offer, value.materials.map(({ owned, ...row }) => row)];
			const signature = JSON.stringify(terms(state));
			const material = state.materials.find(row => row.index === choice.material);
			const item = state.items.find(row => row.index === state.selected?.index);
			const content = interactionReview(
				[
					`装备：${item?.name || '已选装备'}`,
					`材料：${material?.name} × ${material?.amount ?? 1}`,
					`祝福：${choice.blessing}`,
					chance.textContent
				],
				`费用：${material?.zeny ?? material?.price ?? 0} Z`,
				warning.textContent
			);
			confirmAction(
				body,
				'确认强化？',
				() => {
					const current = service.snapshot();
					if (JSON.stringify(terms(current)) !== signature) {
						feedback('强化内容已变化，请重新核对', 'error');
						return;
					}
					const error = service.confirm(choice.material, choice.blessing);
					if (error) {
						feedback(error, 'error');
						return;
					}
					key = '';
					update();
				},
				{ content }
			);
		};
		detail.append(materials, cost, label);
		warning.className = 'interaction-warning';
		result.insertBefore(chance, description);
		result.insertBefore(warning, description);
		footer.append(confirm);
	}
	update();
	return { update };
}
