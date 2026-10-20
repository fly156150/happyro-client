import { createQuantityStepper } from 'UI/Components/QuantityStepper.js';
import { interactionColumns, interactionReview, interactionFooter, inputDraft } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';

export function createTradePanel(body, service) {
	const layout = interactionColumns(body, [
		{ title: '可交易物品', className: 'inventory-list', list: true },
		{
			title: '双方报价',
			className: 'trade-offers',
			content:
				'<section><h3>我方物品</h3><div data-menu-list="" data-own></div></section><section><h3>对方物品</h3><div data-menu-list="" data-peer></div></section>'
		}
	]);
	layout.dataset.menuLayout = 'trade';
	const toolbar = document.createElement('div');
	toolbar.className = 'trade-money-toolbar';
	toolbar.innerHTML =
		'<label class="interaction-field">交易金额<input data-menu-control="field" data-money type="number" min="0" step="1" value="0"></label><div class="interaction-inline-actions"><button data-send-money>设置金额</button><button data-revert-money>撤销金额</button></div>';
	body.prepend(toolbar);
	const pickerContent = document.createElement('div');
	pickerContent.dataset.picker = '';
	function showPicker() {
		const add = pickerContent.querySelector('[data-add-item]');
		confirmAction(
			body,
			add ? '加入交易' : '物品详情',
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
	status.dataset.phase = '';
	for (const [key, text] of [
		['lock', '锁定报价'],
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
	$('[data-money]').required = true;
	$('[data-money]').setAttribute('aria-label', '交易金额');
	$('[data-money]').value = String(service.snapshot().money);
	$('[data-money]').oninput = () => update();
	$('[data-revert-money]').onclick = () => {
		$('[data-money]').value = String(service.snapshot().money);
		update();
	};
	function ready() {
		if (Number($('[data-money]').value) !== service.snapshot().money || !$('[data-money]').checkValidity()) {
			feedback('金额尚未设置，请先设置或撤销金额', 'error');
			$('[data-money]').focus();
			return false;
		}
		if (quantityDraft?.dirty()) {
			feedback('物品数量尚未加入交易，请先加入或撤销修改', 'error');
			quantityDraft.focus();
			return false;
		}
		return true;
	}
	let preview = null;
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
		if ($('[data-money]').reportValidity()) action(service.setMoney(Number($('[data-money]').value)));
	};
	$('[data-lock]').onclick = () => {
		if (ready()) action(service.lock());
	};
	$('[data-execute]').onclick = () => {
		if (!ready()) return;
		const state = service.snapshot();
		const content = interactionReview(
			[
				'我方物品：',
				...state.offered.map(row => `${row.name} × ${row.count}`),
				'对方物品：',
				...state.received.map(row => `${row.name} × ${row.count}`)
			],
			`我方金额：${state.money} Z\n对方金额：${state.peerMoney} Z`,
			'请核对双方物品和金额，确认后等待服务器完成交易。'
		);
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
		for (const item of state.items) {
			let node = nodes.get(item.index);
			if (!node) {
				node = document.createElement('button');
				node.className = 'inventory-item';
				node.onclick = () => {
					if (!ready()) return;
					selected = item.index;
					preview = null;
					pickerKey = '';
					update();
					showPicker();
				};
				nodes.set(item.index, node);
				$('.inventory-list').append(node);
			}
			node.disabled = !active || state.ownLocked;
			setListItemIcon(node, item);
			setListItemText(node, item.name, `× ${item.count}`);
			node.setAttribute('aria-pressed', String(selected === item.index));
		}
		const item = preview
			? state[preview.side].find(entry => entry.index === preview.index)
			: state.items.find(entry => entry.index === selected);
		const key = JSON.stringify([item?.index, item?.ID, item?.identity, preview]);
		if (key !== pickerKey) {
			pickerKey = key;
			const picker = $('[data-picker]');
			picker.replaceChildren();
			quantityDraft = null;
			if (item) {
				const text = document.createElement('p');
				text.textContent = item.description;
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
				const title = document.createElement('h3');
				title.textContent = item.name;
				picker.append(title);
				if (preview) picker.append(text);
				else {
					const revert = document.createElement('button');
					revert.type = 'button';
					revert.textContent = '撤销修改';
					revert.dataset.revertQuantity = '';
					revert.onclick = () => quantityDraft.reset();
					revert.hidden = true;
					picker.append(stepper.element, button, text);
					quantityDraft = inputDraft([input], update);
				}
			} else picker.textContent = '点击左侧物品设置数量';
		}
		if (item && !preview && quantityInput) quantityInput.max = String(item.count);
		for (const control of $('[data-picker]').querySelectorAll('input,button'))
			control.disabled = !active || state.ownLocked;
		const revert = $('[data-revert-quantity]');
		if (revert) revert.hidden = !quantityDraft?.dirty();
		$('[data-revert-money]').hidden =
			Number($('[data-money]').value) === state.money && $('[data-money]').checkValidity();
		$('[data-revert-money]').disabled = !active || state.ownLocked;
		$('[data-money]').max = String(Math.min(state.balance ?? 2147483647, 2147483647));
		for (const [selector, side, money] of [
			['[data-own]', 'offered', state.money],
			['[data-peer]', 'received', state.peerMoney]
		]) {
			const parent = $(selector),
				rows = state[side];
			const signature = JSON.stringify([
				money,
				rows.map(({ index, name, count, description, icon }) => ({ index, name, count, description, icon }))
			]);
			if (parent.dataset.signature === signature) continue;
			parent.dataset.signature = signature;
			const balance = document.createElement('p');
			balance.textContent = `金额：${money} Z`;
			parent.replaceChildren(balance);
			for (const entry of rows) {
				const button = document.createElement('button');
				setListItemText(button, entry.name, `× ${entry.count}`);
				setListItemIcon(button, entry);
				button.className = 'interaction-order-item';
				button.onclick = () => {
					if (!ready()) return;
					preview = { side, index: entry.index };
					selected = null;
					pickerKey = '';
					update();
					showPicker();
				};
				parent.append(button);
			}
		}
		$('[data-phase]').textContent = state.status;
		$('[data-money]').disabled = !active || state.ownLocked;
		$('[data-send-money]').disabled = !active || state.ownLocked;
		$('[data-lock]').disabled = !active || state.ownLocked;
		$('[data-lock]').textContent = state.ownLocked ? '报价已锁定' : '锁定报价';
		$('[data-execute]').disabled = !active || !state.ownLocked || !state.peerLocked;
		$('[data-execute]').textContent = '确认成交';
		$('[data-cancel]').disabled = !state.allowed;
	}
	update();
	return { update };
}
