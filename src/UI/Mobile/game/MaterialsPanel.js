import { renderDescriptionMarkup } from './DescriptionMarkup.js';
import { createMenuField } from './MenuFormControls.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { interactionColumns, interactionReview, interactionFooter, inputDraft } from './InteractionPanel.js';
export function createMaterialsPanel(body, service) {
	interactionColumns(body, [
		{ title: '可用材料', className: 'inventory-list' },
		{ title: '已选材料', className: 'material-order' },
		{ title: '物品说明', className: 'inventory-detail' }
	]);
	const $ = selector => body.querySelector(selector);
	const { footer, status } = interactionFooter(body);
	const feedback = createFeedback(body),
		nodes = new Map();
	let selected, draft, input, title, description, revert, state;
	const keyOf = item => `${item.index}:${item.ID}`;
	const review = button('核对材料', () => {
		update();
		if (!ready() || !state.allowed || !state.order.length) return;
		const signature = JSON.stringify(state.order);
		const content = interactionReview(
			state.order.map(row => `${row.name} × ${row.count}${row.description ? '\n' + row.description : ''}`),
			`共 ${state.order.length} 种材料`,
			'确认后会消耗材料或改变物品，请核对数量与结果。'
		);
		confirmAction(
			body,
			'确认提交以下材料？',
			() => {
				if (JSON.stringify(service.snapshot().order) !== signature) {
					feedback('材料已变化，请重新核对', 'error');
					return;
				}
				const error = service.confirm();
				if (error) feedback(error, 'error');
				update();
			},
			{ content }
		);
	});
	const clear = button('清空材料', () => {
		service.clear();
		selected = null;
		draft = null;
		update();
	});
	footer.append(review, clear);
	function button(text, action) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = text;
		b.onclick = action;
		return b;
	}
	function ready() {
		if (!draft?.dirty()) return true;
		feedback('数量尚未加入材料，请先加入或撤销修改', 'error');
		draft.focus();
		return false;
	}
	function select(item) {
		if (!ready()) return;
		selected = keyOf(item);
		title = document.createElement('h3');
		description = document.createElement('p');
		description.className = 'item-description';
		const form = document.createElement('form');
		form.className = 'interaction-form';
		const label = document.createElement('label');
		label.textContent = '数量';
		input = createMenuField();
		input.type = 'number';
		input.min = 0;
		input.step = 1;
		input.required = true;
		input.setAttribute('aria-label', '材料数量');
		input.value = String(state.order.find(row => row.index === item.index)?.count ?? item.requiredCount ?? 1);
		label.append(input);
		const save = button('加入材料', () => {});
		save.type = 'submit';
		revert = button('撤销修改', () => draft.reset());
		form.append(label, save, revert);
		form.onsubmit = event => {
			event.preventDefault();
			if (!input.reportValidity()) return;
			const error = service.set(item.index, item.ID, Number(input.value));
			if (error) feedback(error, 'error');
			else {
				draft.accept();
				feedback('材料已更新', 'success');
			}
			update();
		};
		$('.inventory-detail').replaceChildren(title, form, description);
		draft = inputDraft([input], update);
		update();
	}
	function update() {
		state = service.snapshot();
		const order = $('.material-order');
		const orderKey = JSON.stringify([state.order, state.allowed, state.items.map(item => item.icon)]);
		if (order.dataset.key !== orderKey) {
			order.dataset.key = orderKey;
			order.replaceChildren();
			if (!state.order.length) order.textContent = '尚未选择材料';
			for (const row of state.order) {
				const entry = button(`${row.name} × ${row.count}`, () => {
					const item = service
						.snapshot()
						.items.find(candidate => candidate.index === row.index && candidate.ID === row.ID);
					if (item) select(item);
				});
				entry.className = 'interaction-order-item';
				setListItemText(entry, row.name, `× ${row.count}`);
				setListItemIcon(entry, state.items.find(item => item.index === row.index && item.ID === row.ID) || row);
				entry.disabled = !state.allowed;
				order.append(entry);
			}
		}
		status.textContent = state.pending
			? '等待服务器回复…'
			: draft?.dirty()
				? '数量已修改，尚未加入材料'
				: state.message || `已选 ${state.order.length} 种材料`;
		clear.disabled = !state.allowed;
		review.disabled = !state.allowed || (!state.order.length && !draft?.dirty());
		const keys = new Set(state.items.map(keyOf));
		for (const [key, node] of nodes)
			if (!keys.has(key)) {
				node.remove();
				nodes.delete(key);
			}
		for (const item of state.items) {
			const key = keyOf(item);
			let node = nodes.get(key);
			if (!node) {
				node = button('', () => {
					const live = service.snapshot().items.find(row => keyOf(row) === key);
					if (live) select(live);
				});
				node.className = 'inventory-item';
				nodes.set(key, node);
				$('.inventory-list').append(node);
			}
			const count = state.order.find(row => row.index === item.index)?.count;
			setListItemText(node, item.name, `× ${item.count}${count ? ' · 已选 ' + count : ''}`);
			setListItemIcon(node, item);
			node.disabled = !state.allowed;
			node.setAttribute('aria-pressed', String(selected === key));
		}
		const item = state.items.find(row => keyOf(row) === selected);
		if (!item) {
			selected = null;
			draft = null;
			const hint = state.items.length
				? state.instruction || '点选物品，输入数量后加入材料'
				: '没有可用材料';
			if ($('.inventory-detail').textContent !== hint) $('.inventory-detail').textContent = hint;
		} else {
			title.textContent = item.name;
			renderDescriptionMarkup(description, item.descriptionMarkup || item.description || '');
			input.max = String(item.count);
			revert.hidden = !draft?.dirty();
			for (const control of $('.inventory-detail').querySelectorAll('button,input'))
				control.disabled = !state.allowed;
		}
	}
	update();
	return { update };
}
