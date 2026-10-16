import { createMenuField } from './MenuFormControls.js';
import { interactionColumns, interactionReview, interactionFooter, inputDraft } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';

export function createVendingPanel(body, service) {
	const initial = service.snapshot();
	body.dataset.vendingOwned = String(Boolean(initial.owned));
	const layout = interactionColumns(body, [
		{ title: initial.owned ? (initial.mode === 'buy' ? '收购商品' : '在售商品') : '可选商品', className: 'inventory-list' },
		{ title: initial.owned ? '成交记录' : '摊位清单', content: '<div data-order></div>' },
		{ title: '物品说明与定价', className: 'inventory-detail', content: '<div data-selected></div>' }
	]);
	for (const [index, section] of ['items', 'order', 'detail'].entries()) layout.children[index].dataset.vendingSection = section;
	const fields = document.createElement('div');
	fields.dataset.fields = '';
	fields.className = 'interaction-toolbar';
	body.prepend(fields);
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector),
		nodes = new Map();
	const { footer, status } = interactionFooter(body);
	for (const [key, text] of [
		['submit', '核对开店'],
		['cancel', '取消开店']
	]) {
		const b = document.createElement('button');
		b.type = 'button';
		b.dataset[key] = '';
		b.textContent = text;
		footer.append(b);
	}
	let draft, amountInput, priceInput;
	function ready() {
		if (!draft?.dirty()) return true;
		feedback('数量或单价尚未保存，请先保存或撤销修改', 'error');
		draft.focus();
		return false;
	}
	let selected = null,
		key = '';
	$('[data-cancel]').hidden = Boolean(initial.owned);
	$('[data-cancel]').onclick = () => service.close();
	if (!initial.owned) {
		$('[data-fields]').innerHTML =
			'<label>摊位名称<input data-menu-control="field" data-title maxlength="24"></label><label data-budget-label>收购预算<input data-menu-control="field" data-budget type="number" min="1" step="1"></label>';
		$('[data-budget-label]').hidden = initial.mode !== 'buy';
		$('[data-title]').required = true;
		$('[data-budget]').required = initial.mode === 'buy';
		$('[data-budget]').setAttribute('aria-label', '收购预算');
		$('[data-title]').setAttribute('aria-label', '摊位名称');
		$('[data-fields]').oninput = () => {
			update();
		};
	}
	$('[data-submit]').onclick = () => {
		if (!ready()) return;
		const snapshot = service.snapshot();
		if (
			!snapshot.owned &&
			(!$('[data-title]').reportValidity() || (snapshot.mode === 'buy' && !$('[data-budget]').reportValidity()))
		)
			return;
		const signature = JSON.stringify(snapshot.order);
		const title = $('[data-title]')?.value,
			budget = Number($('[data-budget]')?.value);
		const rows = snapshot.owned ? snapshot.items : snapshot.order;
		const content = interactionReview(
			rows.map(row => `${row.name} × ${row.count} · 单价 ${row.price} Z`),
			snapshot.owned
				? '关闭后停止摆摊'
				: `合计：${snapshot.total} Z${snapshot.mode === 'buy' ? '\n收购预算：' + budget + ' Z' : ''}`
		);
		confirmAction(
			body,
			snapshot.owned ? '确认关闭摊位？' : `确认开店「${title}」？`,
			() => {
				if (JSON.stringify(service.snapshot().order) !== signature) {
					feedback('订单已变化，请重新核对', 'error');
					return;
				}
				const result = snapshot.owned ? service.closeStore() : service.submit(title, budget);
				feedback(result, ['已请求关闭摊位', '等待服务器开店结果'].includes(result) ? 'pending' : 'error');
				update();
			},
			{ content }
		);
	};
	function update() {
		const phone = body.getRootNode().host.hasAttribute('data-phone-screen');
		layout.children[2].querySelector('.interaction-column-title').textContent =
			phone && initial.owned ? '物品详情' : '物品说明与定价';
		const state = service.snapshot();
		$('[data-cancel]').disabled = Boolean(state.pending);
		status.textContent = state.pending
			? '等待服务器回复…'
			: draft?.dirty()
				? '数量或单价已修改，尚未保存'
				: state.owned
					? '摊位营业中'
					: `已选 ${state.order.length}/${state.slots} 栏`;
		for (const field of $('[data-fields]').querySelectorAll('input')) field.disabled = !state.allowed;
		if ($('[data-budget]')) $('[data-budget]').max = String(Math.min(state.money ?? 2147483647, 2147483647));
		for (const [id, node] of nodes)
			if (!state.items.some(item => item.index === id)) {
				node.remove();
				nodes.delete(id);
			}
		for (const item of state.items) {
			let node = nodes.get(item.index);
			if (!node) {
				node = document.createElement('button');
				node.className = 'inventory-item';
				node.onclick = () => {
					if (!ready()) return;
					selected = item.index;
					key = '';
					update();
				};
				nodes.set(item.index, node);
				$('.inventory-list').append(node);
			}
			node.disabled = !state.allowed;
			setListItemIcon(node, item);
			setListItemText(node, item.name, `× ${item.count}${state.owned ? ' · ' + item.price + ' Z' : ''}`);
			node.setAttribute('aria-pressed', String(selected === item.index));
		}
		const item = state.items.find(row => row.index === selected),
			next = JSON.stringify([item?.index, item?.ID, item?.identity, state.owned]);
		if (next !== key) {
			key = next;
			const panel = $('[data-selected]');
			panel.replaceChildren();
			draft = null;
			if (item) {
				const description = document.createElement('p');
				description.className = 'item-description';
				description.textContent = item.description;
				const title = document.createElement('h3');
				title.textContent = item.name;
				panel.append(title);
				if (!state.owned) {
					const pricing = document.createElement('div');
					pricing.className = 'interaction-pricing';
					panel.append(pricing);
					const amount = createMenuField(),
						price = createMenuField();
					amountInput = amount;
					priceInput = price;
					for (const input of [amount, price]) {
						input.required = true;
						input.type = 'number';
						input.min = '0';
						input.step = '1';
					}
					amount.value = String(item.quantity || 1);
					amount.setAttribute('aria-label', '数量');
					price.value = String(item.price);
					price.setAttribute('aria-label', '单价');
					const button = document.createElement('button');
					button.textContent = '保存数量与单价';
					const hint = document.createElement('p');
					hint.textContent = '数量设为 0 可移除商品';
					button.disabled = !state.allowed;
					button.onclick = () => {
						if (!amount.reportValidity() || !price.reportValidity()) return;
						const error = service.set(item.index, item.identity, Number(amount.value), Number(price.value));
						if (error) feedback(error, 'error');
						else {
							draft.accept();
							feedback('数量与单价已保存', 'success');
						}
						update();
					};
					const revert = document.createElement('button');
					revert.type = 'button';
					revert.textContent = '撤销修改';
					revert.dataset.revertVending = '';
					revert.onclick = () => draft.reset();
					for (const [text, field] of [
						['数量', amount],
						['单价（Z）', price]
					]) {
						const label = document.createElement('label');
						label.className = 'interaction-field';
						label.append(text, field);
						pricing.append(label);
					}
					panel.append(button, revert, hint);
					draft = inputDraft([amount, price], update);
				}
				panel.append(description);
			} else panel.textContent = '点选物品查看详情';
		}
		if (item && !state.owned && amountInput) {
			amountInput.max = String(state.mode === 'sell' ? Math.min(item.count, 32767) : 9999);
			priceInput.max = '2147483647';
		}
		for (const control of $('[data-selected]').querySelectorAll('input,button')) control.disabled = !state.allowed;
		if ($('[data-revert-vending]')) $('[data-revert-vending]').hidden = !draft?.dirty();
		const order = $('[data-order]');
		const orderKey = JSON.stringify([
			phone,
			state.owned,
			state.order,
			state.owned ? state.items : null,
			state.allowed,
			state.log,
			state.budget
		]);
		if (order.dataset.key !== orderKey) {
			order.dataset.key = orderKey;
			order.replaceChildren();
			if (state.owned) {
				const log = document.createElement('p');
				log.textContent =
					state.mode === 'buy'
						? `剩余预算：${state.budget ?? '—'} Z\n${state.log.join('\n') || (phone ? '暂无成交记录' : '')}`
						: state.log.join('\n') || (phone ? '暂无成交记录' : '');
				log.className = 'vending-transactions';
				order.append(log);
			}
			for (const row of state.owned ? [] : state.order) {
				const entry = document.createElement('button');
				entry.className = 'interaction-order-item';
				setListItemText(entry, row.name, `× ${row.count} · 单价 ${row.price} Z`);
				entry.disabled = !state.allowed;
				entry.onclick = () => {
					if (!ready()) return;
					selected = row.index;
					key = '';
					update();
				};
				order.append(entry);
			}
			if (!state.owned && !state.order.length) order.textContent = '尚未选择商品';
		}
		if (!state.pending && !draft?.dirty() && !state.owned)
			status.textContent = `摊位：${state.order.length}/${state.slots} · 合计：${state.total} Z`;
		fields.hidden = Boolean(state.owned);
		$('[data-submit]').textContent = state.owned ? '关闭摊位' : '核对开店';
		$('[data-submit]').disabled = !state.allowed;
	}
	update();
	return { update };
}
