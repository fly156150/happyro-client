import { requestMobileInput } from './MobileInputEditor.js';
import { createMenuField } from './MenuFormControls.js';
import { createItemSubtypeFilter } from './ItemSubtypeFilter.js';
import ItemType from 'DB/Items/ItemType.js';
import { createQuantityStepper } from 'UI/Components/QuantityStepper.js';
import { interactionColumns, interactionFooter, inputDraft } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';

export function createTradePanel(body, service) {
	const layout = interactionColumns(body, [
		{ title: '可交易物品', className: 'inventory-list' },
		{ title: '我方', className: 'trade-own' },
		{ title: '对方', className: 'trade-peer' }
	]);
	layout.dataset.menuLayout = 'trade';
	layout.querySelector('.trade-own').dataset.own = '';
	layout.querySelector('.trade-peer').dataset.peer = '';
	for (const side of ['own', 'peer']) {
		const money = document.createElement('span');
		money.dataset.tradeMoney = side;
		layout.querySelector(`[data-${side}]`).previousElementSibling.append(money);
	}
	const toolbar = document.createElement('div');
	toolbar.className = 'trade-money-toolbar';
	toolbar.classList.add('menu-form-row');
	const category = createMenuField('select');
	category.setAttribute('aria-label', '交易物品分类');
	for (const [value, label] of [
		['all', '全部'], ['usable', '消耗品'], ['equipment', '装备'], ['weapon', '武器'],
		['armor', '防具'], ['card', '卡片'], ['ammo', '弹药'], ['pet', '宠物用品'],
		['shadow', '影子装备'], ['other', '其他']
	]) category.add(new Option(label, value));
	const itemTypes = {
		weapon: [ItemType.WEAPON], armor: [ItemType.ARMOR], card: [ItemType.CARD],
		ammo: [ItemType.AMMO], pet: [ItemType.PETEGG, ItemType.PETARMOR], shadow: [ItemType.SHADOWGEAR]
	};
	const changeFilter = () => { update(); body.querySelector('.inventory-list').scrollTop = 0; };
	const subtype = createItemSubtypeFilter(changeFilter);
	category.onchange = () => { subtype.reset(); changeFilter(); };
	const search = createMenuField();
	search.type = 'search';
	search.placeholder = '搜索名称或 ID';
	search.setAttribute('aria-label', '搜索交易物品');
	search.oninput = changeFilter;
	const moneyButton = document.createElement('button');
	moneyButton.type = 'button';
	moneyButton.dataset.sendMoney = '';
	moneyButton.textContent = '设置金额';
	toolbar.append(category, subtype.select, search, moneyButton);
	body.prepend(toolbar);
	const pickerContent = document.createElement('div');
	pickerContent.dataset.picker = '';
	function showPicker() {
		const add = pickerContent.querySelector('[data-add-item]');
		confirmAction(
			body,
			service.snapshot().items.find(item => item.index === selected)?.name || '交易数量',
			() => {
				add?.click();
				quantityDraft = null;
				pickerKey = '';
			},
			{
				content: pickerContent,
				cancelled: () => {
					quantityDraft = null;
					pickerKey = '';
				}
			}
		);
	}

	const feedback = createFeedback(body);
	const $ = selector => (selector === '[data-picker]' ? pickerContent : body.querySelector(selector)),
		nodes = new Map();
	const { footer, status } = interactionFooter(body);
	status.remove();
	for (const [key, text] of [
		['lock', '锁定交易'],
		['execute', '确认成交'],
		['cancel', '取消交易']
	]) {
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset[key] = '';
		button.textContent = text;
		footer.append(button);
	}
	let quantityDraft, quantityInput;
	function ready() {
		if (quantityDraft?.dirty()) {
			feedback('物品数量尚未加入交易，请先加入或撤销修改', 'error');
			quantityDraft.focus();
			return false;
		}
		return true;
	}
	let selected = null,
		pickerKey = '';
	function action(result) {
		feedback(
			result,
			[
				'等待服务器确认物品',
				'金额已发送，请核对后锁定报价',
				'等待服务器锁定报价',
				'已确认，等待交易结果',
				'正在等待交易结果',
				'等待服务器取消交易'
			].includes(result)
				? 'pending'
				: 'error'
		);
		update();
	}
	$('[data-send-money]').onclick = () => {
		const state = service.snapshot();
		const amount = createMenuField();
		amount.type = 'number';
		amount.inputMode = 'numeric';
		amount.min = '0';
		amount.max = String(Math.min(state.balance ?? 2147483647, 2147483647));
		amount.step = '1';
		amount.value = state.money ? String(state.money) : '';
		amount.setAttribute('aria-label', '交易金额');
		requestMobileInput(body.getRootNode().host, {
			fields: [amount], title: '设置金额', doneLabel: '确认',
			onConfirm: ([value]) => action(service.setMoney(Number(value)))
		});
	};
	$('[data-lock]').onclick = () => {
		if (ready()) action(service.lock());
	};
	$('[data-execute]').onclick = () => {
		if (!ready()) return;
		const state = service.snapshot();
		const content = document.createElement('div');
		content.className = 'trade-confirm-columns';
		for (const [label, rows, money] of [
			['我方', state.offered, state.money],
			['对方', state.received, state.peerMoney]
		]) {
			const column = document.createElement('section');
			const heading = document.createElement('h3');
			heading.textContent = label;
			const amount = document.createElement('span');
			amount.textContent = `${money} Z`;
			heading.append(amount);
			const list = document.createElement('div');
			list.className = 'trade-confirm-items';
			for (const item of rows) {
				const row = document.createElement('p');
				row.textContent = `${item.name} × ${item.count}`;
				list.append(row);
			}
			column.append(heading, list);
			content.append(column);
		}
		const signature = JSON.stringify([state.offered, state.received, state.money, state.peerMoney]);
		confirmAction(
			body,
			'确认成交？',
			() => {
				const current = service.snapshot();
				if (
					JSON.stringify([current.offered, current.received, current.money, current.peerMoney]) !== signature
				) {
					feedback('报价已变化，请重新确认', 'error');
					return;
				}
				action(service.execute());
			},
			{ content }
		);
	};
	$('[data-cancel]').onclick = () => action(service.cancel());
	function update() {
		const state = service.snapshot();
		const active = state.allowed && !state.pending;
		for (const [id, node] of nodes)
			if (!state.items.some(item => item.index === id)) {
				node.remove();
				nodes.delete(id);
			}
		const categoryItems = state.items.filter(item => category.value === 'all' || item.category === category.value || itemTypes[category.value]?.includes(item.type));
		subtype.update(categoryItems, category.value);
		const query = search.value.trim().toLocaleLowerCase();
		const visible = new Set(categoryItems.filter(item => subtype.matches(item) && (!query || item.name.toLocaleLowerCase().includes(query) || String(item.ID).includes(query))).map(item => item.index));
		for (const item of state.items) {
			let node = nodes.get(item.index);
			if (!node) {
				node = document.createElement('button');
				node.className = 'inventory-item';
				node.onclick = () => {
					if (!ready()) return;
					selected = item.index;
					pickerKey = '';
					update();
					showPicker();
				};
				nodes.set(item.index, node);
				$('.inventory-list').append(node);
			}
			node.hidden = !visible.has(item.index);
			node.disabled = !active || state.ownLocked;
			setListItemIcon(node, item);
			setListItemText(node, item.name, `× ${item.count}`);
			node.setAttribute('aria-pressed', String(selected === item.index));
		}
		const item = state.items.find(entry => entry.index === selected);
		const key = JSON.stringify([item?.index, item?.ID, item?.identity]);
		if (key !== pickerKey) {
			pickerKey = key;
			const picker = $('[data-picker]');
			picker.replaceChildren();
			quantityDraft = null;
			if (item) {
				const stepper = createQuantityStepper({ label: '交易数量', value: 1, min: 1, max: item.count });
				const input = stepper.input;
				quantityInput = input;
				input.type = 'number';
				input.required = true;
				input.step = '1';
				input.min = '1';
				input.max = String(item.count);
				input.value = '1';
				input.setAttribute('aria-label', '交易数量');
				const button = document.createElement('button');
				button.textContent = '加入交易';
				button.dataset.addItem = '';
				button.hidden = true;
				button.disabled = !active || state.ownLocked;
				button.onclick = () => {
					if (!input.reportValidity()) return;
					const result = service.add(item.index, item.identity, Number(input.value));
					if (result === '等待服务器确认物品') quantityDraft?.accept();
					action(result);
				};
				{
					const revert = document.createElement('button');
					revert.type = 'button';
					revert.textContent = '撤销修改';
					revert.dataset.revertQuantity = '';
					revert.onclick = () => quantityDraft.reset();
					revert.hidden = true;
					picker.append(stepper.element, button);
					quantityDraft = inputDraft([input], update);
				}
			} else picker.textContent = '点击左侧物品设置数量';
		}
		if (item && quantityInput) quantityInput.max = String(item.count);
		for (const control of $('[data-picker]').querySelectorAll('input,button'))
			control.disabled = !active || state.ownLocked;
		const revert = $('[data-revert-quantity]');
		if (revert) revert.hidden = !quantityDraft?.dirty();
		for (const [selector, side, money] of [
			['[data-own]', 'offered', state.money],
			['[data-peer]', 'received', state.peerMoney]
		]) {
			$(`[data-trade-money="${side === 'offered' ? 'own' : 'peer'}"]`).textContent = `${money} Z`;
			const parent = $(selector),
				rows = state[side];
			const signature = JSON.stringify([
				money,
				rows.map(({ index, name, count, description, icon }) => ({ index, name, count, description, icon }))
			]);
			if (parent.dataset.signature === signature) continue;
			parent.dataset.signature = signature;
			parent.replaceChildren();
			for (const entry of rows) {
				const button = document.createElement('button');
				button.type = 'button';
				setListItemText(button, entry.name, `× ${entry.count}`);
				setListItemIcon(button, entry);
				button.className = 'inventory-item';

				parent.append(button);
			}
		}
		$('[data-send-money]').disabled = !active || state.ownLocked;
		$('[data-lock]').disabled = !active || state.ownLocked;
		$('[data-lock]').textContent = state.ownLocked ? '交易已锁定' : '锁定交易';
		$('[data-execute]').disabled = !active || !state.ownLocked || !state.peerLocked;
		$('[data-execute]').textContent = '确认成交';
		$('[data-cancel]').disabled = !state.allowed;
	}
	update();
	return { update };
}
