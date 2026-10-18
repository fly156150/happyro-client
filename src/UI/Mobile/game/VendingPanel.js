import { createMenuField } from './MenuFormControls.js';
import { createQuantityStepper } from 'UI/Components/QuantityStepper.js';
import { interactionColumns, interactionReview, interactionFooter } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';

export function createVendingPanel(body, service) {
	const initial = service.snapshot();
	body.dataset.vendingOwned = String(Boolean(initial.owned));
	const layout = interactionColumns(body, [
		{
			title: initial.owned ? (initial.mode === 'buy' ? '收购商品' : '在售商品') : '可选商品',
			className: 'inventory-list'
		},
		{ title: initial.owned ? '成交记录' : '摊位清单', content: '<div data-order></div>' }
	]);
	layout.dataset.menuLayout = 'vending';
	const feedback = createFeedback(body);
	const { footer, status } = interactionFooter(body);
	const $ = selector => body.querySelector(selector);
	let selected = null,
		modal = null;
	function button(text, action) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = text;
		b.onclick = action;
		return b;
	}
	function showItem(item, direction) {
		const state = service.snapshot();
		if (!state.allowed || modal) return;
		const content = document.createElement('div');
		const description = document.createElement('p');
		description.className = 'item-description';
		description.textContent = item.description || '';
		if (state.owned) {
			content.append(description);
			confirmAction(body, item.name, () => {}, { content });
			return;
		}
		const max =
			direction < 0
				? item.quantity
				: state.mode === 'sell'
					? Math.min(item.count - item.quantity, 32767 - item.quantity)
					: 9999 - item.quantity;
		if (max < 1) return;
		const stepper = createQuantityStepper({ label: '数量', value: 1, min: 1, max });
		content.append(stepper.element);
		const price = createMenuField();
		price.type = 'number';
		price.min = '1';
		price.max = '2147483647';
		price.step = '1';
		price.required = true;
		price.value = String(item.price || 1);
		price.setAttribute('aria-label', '单价');
		if (direction > 0) {
			const label = document.createElement('label');
			label.className = 'interaction-field';
			label.append('单价（Z）', price);
			content.append(label);
		}
		content.append(description);
		const dismiss = confirmAction(
			body,
			`${direction > 0 ? '加入摊位' : '移回物品'}：${item.name}`,
			() => {
				modal = null;
				const current = service
					.snapshot()
					.items.find(row => row.index === item.index && row.identity === item.identity);
				const count = Number(stepper.input.value);
				if (
					!current ||
					current.quantity !== item.quantity ||
					!Number.isInteger(count) ||
					count < 1 ||
					count > max
				)
					feedback('物品或数量已变化，请重新选择', 'error');
				else {
					const error = service.set(
						item.index,
						item.identity,
						current.quantity + direction * count,
						direction > 0 ? Number(price.value) : current.price
					);
					if (error) feedback(error, 'error');
				}
				update();
			},
			{
				content,
				cancelled: () => {
					modal = null;
					update();
				}
			}
		);
		modal = { dismiss, index: item.index, identity: item.identity };
		update();
	}
	const arrows = document.createElement('div');
	arrows.className = 'vending-transfer';
	const add = button('→', () => {
		const item = service.snapshot().items.find(row => row.index === selected);
		if (item) showItem(item, 1);
	});
	add.setAttribute('aria-label', '加入摊位清单');
	const remove = button('←', () => {
		const item = service.snapshot().items.find(row => row.index === selected);
		if (item) showItem(item, -1);
	});
	remove.setAttribute('aria-label', '移回可选商品');
	if (!initial.owned) {
		arrows.append(add, remove);
		layout.insertBefore(arrows, layout.children[1]);
		layout.classList.add('vending-transfer-layout');
	}
	const submit = button(initial.owned ? '关闭摊位' : '核对开店', () => {
		const state = service.snapshot();
		if (!state.allowed || modal || (!state.owned && !state.order.length)) return;
		const signature = JSON.stringify(state.order);
		const content = interactionReview(
			(state.owned ? state.items : state.order).map(row => `${row.name} × ${row.count} · 单价 ${row.price} Z`),
			state.owned ? '关闭后停止摆摊' : `合计：${state.total} Z`
		);
		const title = createMenuField();
		title.placeholder = '请输入摊位名称';
		title.setAttribute('aria-label', '摊位名称');
		title.maxLength = 24;
		title.required = true;
		title.dataset.title = '';
		const budget = createMenuField();
		budget.type = 'number';
		budget.min = '1';
		budget.max = String(Math.min(state.money ?? 2147483647, 2147483647));
		budget.step = '1';
		budget.required = true;
		budget.placeholder = '请输入收购预算';
		budget.setAttribute('aria-label', '收购预算');
		if (!state.owned) {
			content.prepend(title);
			if (state.mode === 'buy') content.append(budget);
		}
		confirmAction(
			body,
			state.owned ? '确认关闭摊位？' : '核对开店',
			() => {
				if (JSON.stringify(service.snapshot().order) !== signature) {
					feedback('订单已变化，请重新核对', 'error');
					return;
				}
				const result = state.owned ? service.closeStore() : service.submit(title.value, Number(budget.value));
				feedback(result, ['已请求关闭摊位', '等待服务器开店结果'].includes(result) ? 'pending' : 'error');
				update();
			},
			{ content }
		);
	});
	submit.dataset.submit = '';
	const cancel = button('取消开店', () => service.close());
	cancel.dataset.cancel = '';
	cancel.hidden = Boolean(initial.owned);
	footer.append(submit, cancel);
	const listNodes = [new Map(), new Map()];
	function renderList(parent, items, side, state) {
		const nodes = listNodes[side];
		for (const [index, node] of nodes)
			if (!items.some(item => item.index === index)) {
				node.remove();
				nodes.delete(index);
			}
		for (const item of items) {
			let node = nodes.get(item.index);
			if (!node) {
				node = button('', () => {
					selected = item.index;
					const current = service.snapshot();
					if (current.owned) {
						const row = current.items.find(entry => entry.index === selected);
						if (row) showItem(row, 0);
					} else update();
				});
				node.className = side ? 'inventory-item interaction-order-item' : 'inventory-item';
				nodes.set(item.index, node);
				parent.append(node);
			}
			node.disabled = !state.allowed || Boolean(modal);
			setListItemIcon(node, item);
			setListItemText(
				node,
				item.name,
				`× ${item.count}${side ? ' · 单价 ' + item.price + ' Z' : state.owned ? ' · ' + item.price + ' Z' : ''}`
			);
			node.setAttribute('aria-pressed', String(selected === item.index));
		}
	}

	function update() {
		const state = service.snapshot();
		status.textContent = state.pending
			? '等待服务器回复…'
			: state.owned
				? '摊位营业中'
				: `摊位：${state.order.length}/${state.slots} · 合计：${state.total} Z`;
		submit.disabled = !state.allowed || Boolean(modal) || (!state.owned && !state.order.length);
		cancel.disabled = Boolean(state.pending);

		renderList($('.inventory-list'), state.items, 0, state);
		const order = $('[data-order]');
		if (state.owned) {
			let log = order.querySelector('.vending-transactions');
			if (!log) {
				log = document.createElement('p');
				log.className = 'vending-transactions';
				order.append(log);
			}
			log.textContent =
				(state.mode === 'buy' ? `剩余预算：${state.budget ?? '—'} Z\n` : '') + state.log.join('\n');
		} else renderList(order, state.order, 1, state);

		const item = state.items.find(row => row.index === selected);
		add.disabled =
			!state.allowed ||
			Boolean(modal) ||
			!item ||
			(state.mode === 'sell' ? item.quantity >= item.count : item.quantity >= 9999);
		remove.disabled = !state.allowed || Boolean(modal) || !item?.quantity;
		if (
			modal &&
			(!state.allowed || !state.items.some(row => row.index === modal.index && row.identity === modal.identity))
		)
			modal.dismiss();
	}
	update();
	return { update };
}
