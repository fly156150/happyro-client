import { createQuantityStepper } from 'UI/Components/QuantityStepper.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText } from './ListItemText.js';

/** Move quantities between the catalogue and order; submit through the original service. */
export function createShopPanel(body, service) {
	body.innerHTML =
		'<div class="shop-layout" data-menu-layout="shop"><section class="shop-catalog"><h3>商品列表</h3><div class="inventory-list shop-catalog-list" data-menu-list="" aria-label="商店物品"></div></section><div class="shop-transfer"></div><section class="shop-order"><h3>待购买物品</h3><div class="inventory-list shop-order-list" data-menu-list="" aria-label="待交易物品"></div></section><section class="inventory-detail" aria-label="物品详情">请选择物品查看说明</section></div><div class="shop-footer menu-footer"><span class="shop-summary"><span data-balance></span><span class="shop-summary-separator"> · </span><span data-total></span></span><div class="shop-actions"></div></div>';
	const $ = selector => body.querySelector(selector);
	const feedback = createFeedback(body);
	const lists = [new Map(), new Map()];
	let state,
		selected = null,
		quantityDialog = null;
	const keyOf = item => `${item.index}:${item.ID}`;
	const currency = () => (!state.currency || state.currency === 'Zeny' ? 'Z' : state.currency);
	function button(label, action) {
		const node = document.createElement('button');
		node.type = 'button';
		node.textContent = label;
		node.onclick = action;
		return node;
	}
	const selectedItem = () => state.items.find(item => keyOf(item) === selected);
	const capacity = (item, direction) => Math.max(0, direction === 1 ? item.limit - item.quantity : item.quantity);
	function transfer(direction) {
		update();
		const item = selectedItem();
		if (!state.allowed || !item || !capacity(item, direction) || quantityDialog) return;
		const key = selected;
		const stepper = createQuantityStepper({
			label: '交易数量', value: 1, min: 1, max: capacity(item, direction),
			beforeStep: () => { update(); return Boolean(quantityDialog); }
		});
		const { element: content, input } = stepper;
		const dismiss = confirmAction(
			body,
			item.name,
			() => {
				quantityDialog = null;
				state = service.snapshot();
				const current = state.items.find(entry => keyOf(entry) === key);
				const count = Number(input.value);
				if (
					!state.allowed ||
					!current ||
					!Number.isInteger(count) ||
					count < 1 ||
					count > capacity(current, direction)
				) {
					feedback('数量或物品状态已变化，请重新选择', 'error');
					update();
					return;
				}
				const error = service.set(current.index, current.ID, current.quantity + direction * count);
				if (error) feedback(error, 'error');
				update();
			},
			{
				content,
				cancelled: () => {
					quantityDialog = null;
					update();
				}
			}
		);
		quantityDialog = { key, direction, input, dismiss, stepper };
		// Native form submission also supports the mobile keyboard's Done key.
		input.addEventListener('keydown', event => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			body.querySelector('dialog [data-confirm]')?.click();
		});
		update();
	}
	const add = button('→', () => transfer(1));
	add.setAttribute('aria-label', '加入待交易列表');
	add.title = '加入待交易列表';
	const remove = button('←', () => transfer(-1));
	remove.setAttribute('aria-label', '移回商品列表');
	remove.title = '移回商品列表';
	$('.shop-transfer').append(add, remove);
	const submit = button('购买', () => {
		update();
		if (!state.allowed || quantityDialog || !state.items.some(item => item.quantity)) return;
		const result = service.submit();
		// Submission can synchronously replace the shop with a result window.
		if (!body.querySelector('.shop-layout')) return;
		feedback(result, result === '已提交，等待服务器回复' ? 'pending' : 'error');
		update();
	});
	const clear = button('清空', () => {
		if (service.clear()) update();
	});
	$('.shop-actions').append(submit, clear);
	const emptyNodes = ['商店暂无商品', '尚未选择物品'].map((label, index) => {
		const empty = document.createElement('p');
		empty.className = 'shop-empty';
		empty.textContent = label;
		$(index ? '.shop-order-list' : '.shop-catalog-list').append(empty);
		return empty;
	});
	function updateList(items, index) {
		const nodes = lists[index];
		const keys = new Set();
		for (const item of items) {
			const key = keyOf(item);
			keys.add(key);
			let node = nodes.get(key);
			if (!node) {
				node = button('', () => {
					selected = key;
					update();
				});
				node.className = 'inventory-item';
				const image = document.createElement('img');
				image.alt = '';
				node.append(image, document.createElement('span'));
				$(index ? '.shop-order-list' : '.shop-catalog-list').append(node);
				nodes.set(key, node);
			}
			node.disabled = !state.allowed || Boolean(quantityDialog);
			node.setAttribute('aria-pressed', String(selected === key));
			setListItemText(
				node,
				item.name,
				index
					? `× ${item.quantity} · ${item.price * item.quantity} ${currency()}`
					: `${item.price} ${currency()}`
			);
			const image = node.querySelector('img');
			image.hidden = !item.icon;
			if (item.icon && image.getAttribute('src') !== item.icon) image.src = item.icon;
		}
		for (const [key, node] of nodes)
			if (!keys.has(key)) {
				node.remove();
				nodes.delete(key);
			}
		emptyNodes[index].hidden = items.length > 0;
	}
	function update() {
		if (!body.querySelector('.shop-layout')) return;
		state = service.snapshot();
		const order = state.items.filter(item => item.quantity);
		const selling = state.mode === 'sell';
		const money = state.money.toLocaleString('en-US');
		const total = state.total.toLocaleString('en-US');
		$('[data-balance]').textContent = `余额：${money} ${currency()}`;
		$('[data-total]').textContent = `合计：${total} ${currency()}`;
		$('.shop-catalog h3').textContent = selling ? '可出售物品' : '商品列表';
		$('.shop-order h3').textContent = selling ? '待出售物品' : '待购买物品';
		submit.textContent = selling ? '出售' : '购买';
		submit.disabled = clear.disabled = !state.allowed || !order.length || Boolean(quantityDialog);
		emptyNodes[0].textContent = selling ? '没有可出售的物品' : '商店暂无商品';
		updateList(state.items, 0);
		updateList(order, 1);
		const item = selectedItem();
		if (selected && !item) selected = null;
		add.disabled = !state.allowed || !item || !capacity(item, 1) || Boolean(quantityDialog);
		remove.disabled = !state.allowed || !item || !capacity(item, -1) || Boolean(quantityDialog);
		const detail = $('.inventory-detail');
		if (!item) detail.textContent = '请选择物品查看说明';
		else {
			if (!detail.querySelector('h3'))
				detail.innerHTML = '<h3></h3><p class="shop-price"></p><p class="item-description"></p>';
			detail.querySelector('h3').textContent = item.name;
			detail.querySelector('.shop-price').textContent =
				`单价：${item.price} ${currency()}` +
				(item.materials?.length
					? '\n每件材料：' +
						item.materials
							.map(m => `${m.name}${m.refine_level ? `（精炼 +${m.refine_level}）` : ''} × ${m.amount}`)
							.join('、')
					: '');
			detail.querySelector('.item-description').textContent = item.description || '';
		}
		if (quantityDialog) {
			const current = state.items.find(entry => keyOf(entry) === quantityDialog.key);
			if (!state.allowed || !current || !capacity(current, quantityDialog.direction)) {
				quantityDialog.dismiss();
				return;
			}
			quantityDialog.stepper.setBounds({ min: 1, max: capacity(current, quantityDialog.direction) });
		}
	}
	update();
	return { update };
}
