import { createMenuField } from './MenuFormControls.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';
import { interactionColumns, interactionReview, interactionFooter } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createEnchantPanel(body, service) {
	interactionColumns(body, [
		{ title: '可附魔装备', className: 'inventory-list' },
		{ title: '附魔配置', className: 'inventory-detail' },
		{ title: '装备与结果', className: 'interaction-result' }
	]);
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector),
		list = $('.inventory-list'),
		detail = $('.inventory-detail');
	let key = '',
		choiceKey = null,
		editingId = '';
	const nodes = new Map();
	const { footer, status } = interactionFooter(body);
	function update() {
		const state = service.snapshot();
		status.textContent = state.message || (state.pending ? '等待服务器回复…' : '请选择装备和附魔方式');
		const ids = new Set(state.items.map(item => item.index));
		for (const [id, node] of nodes)
			if (!ids.has(id)) {
				node.remove();
				nodes.delete(id);
			}
		for (const item of state.items) {
			let b = nodes.get(item.index);
			if (!b) {
				b = document.createElement('button');
				b.className = 'inventory-item';
				b.onclick = () => {
					const live = service.snapshot().items.find(row => row.index === item.index);
					const error = live ? service.select(live.index, live.ID) : '装备已变化';
					if (error) {
						feedback(error, 'error');
						return;
					}
					key = '';
					choiceKey = null;
					update();
				};
				nodes.set(item.index, b);
				list.append(b);
			}
			setListItemText(b, item.name);
			setListItemIcon(b, item);
			b.disabled = !state.allowed;
			b.setAttribute('aria-pressed', String(state.selected?.index === item.index));
		}
		const identity = JSON.stringify(state.selected);
		if (identity !== editingId) choiceKey = null;
		editingId = identity;
		const next = JSON.stringify([state.selected, state.choices, state.allowed, choiceKey]);
		if (next === key) return;
		key = next;
		const result = $('.interaction-result');
		result.replaceChildren();
		const selectedItem = state.items.find(row => row.index === state.selected?.index);
		const title = document.createElement('h3');
		title.textContent = selectedItem?.name || '请选择装备';
		const description = document.createElement('p');
		description.className = 'item-description';
		description.textContent = selectedItem?.description || '';
		result.append(title, description);
		detail.replaceChildren();
		footer.querySelector('button')?.remove();
		if (!state.selected) {
			detail.textContent = '请选择装备';
			return;
		}
		const select = createMenuField('select');
		select.setAttribute('aria-label', '附魔方式');
		select.add(new Option('请选择附魔方式', ''));
		for (const choice of state.choices) select.add(new Option(choice.name, choice.key));
		if (!state.choices.some(choice => choice.key === choiceKey)) choiceKey = null;
		select.value = choiceKey || '';
		select.disabled = !state.allowed;
		select.onchange = () => {
			choiceKey = select.value;
			key = '';
			update();
		};
		detail.append(select);
		const choice = state.choices.find(entry => entry.key === choiceKey);
		if (!choice) return;
		const summary = document.createElement('p');
		summary.textContent = `成功率：${choice.rate / 1000}% · 费用：${choice.zeny} Z\n${choice.materials.map(material => `${material.name} × ${material.count}`).join('\n')}`;
		summary.className = 'item-description';
		detail.append(summary);
		if (choice.results?.length) {
			const outcomes = document.createElement('p');
			outcomes.textContent = `可能获得：${choice.results.join('、')}`;
			result.insertBefore(outcomes, description);
		}
		const warning = document.createElement('p');
		warning.textContent = '附魔会消耗费用与材料，重置会清除现有附魔。';
		const confirm = document.createElement('button');
		confirm.textContent = '核对附魔';
		confirm.disabled = !state.allowed;
		confirm.onclick = () => {
			const selectedIdentity = JSON.stringify(state.selected);
			const item = state.items.find(row => row.index === state.selected.index);
			const content = interactionReview(
				[
					`装备：${item?.name || '已选装备'}`,
					`方式：${choice.name}`,
					summary.textContent,
					...(choice.results?.length ? [`可能获得：${choice.results.join('、')}`] : [])
				],
				`费用：${choice.zeny} Z`,
				warning.textContent
			);
			confirmAction(
				body,
				'确认附魔？',
				() => {
					if (JSON.stringify(service.snapshot().selected) !== selectedIdentity) {
						feedback('装备已变化，请重新核对', 'error');
						return;
					}
					const error = service.confirm(choice.key, JSON.stringify(choice));
					if (error) feedback(error, 'error');
				},
				{ content }
			);
		};
		warning.className = 'interaction-warning';
		result.insertBefore(warning, description);
		footer.append(confirm);
	}
	update();
	return { update };
}
