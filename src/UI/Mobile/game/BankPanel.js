import { createMenuField } from './MenuFormControls.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';

export function createBankPanel(body, service) {
	body.innerHTML =
		'<div class="bank-layout"><section class="bank-account"><h3>当前余额</h3><strong data-wallet></strong></section><div class="bank-transfer"><button type="button" data-action="deposit" aria-label="存入银行">→</button><button type="button" data-action="withdraw" aria-label="从银行取出">←</button></div><section class="bank-account"><h3>银行余额</h3><strong data-bank></strong></section></div>';
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector);
	let draft = null;
	function open(action) {
		const state = service.snapshot();
		if (draft || !state.allowed || state[action + 'Max'] < 1) return;
		const content = document.createElement('div');
		content.className = 'bank-amount-field';
		const row = document.createElement('div');
		row.className = 'bank-amount-controls';
		const input = createMenuField();
		input.type = 'number';
		input.inputMode = 'numeric';
		input.dataset.amount = '';
		input.setAttribute('aria-label', '金额');
		input.min = '1';
		input.max = String(state[action + 'Max']);
		input.step = '1';
		input.required = true;
		input.value = '1';
		const minimum = document.createElement('button');
		const maximum = document.createElement('button');
		for (const [button, text, attribute] of [
			[minimum, 'MIN', 'min'],
			[maximum, 'MAX', 'max']
		]) {
			button.type = 'button';
			button.textContent = text;
			button.setAttribute('aria-label', text === 'MIN' ? '最小金额' : '最大金额');
			button.onclick = () => {
				update();
				if (draft) input.value = input[attribute];
			};
		}
		row.append(minimum, input, maximum);
		content.append(row);
		const dismiss = confirmAction(
			body,
			action === 'deposit' ? '存入银行' : '从银行取出',
			() => {
				draft = null;
				const result = service.submit(action, Number(input.value));
				feedback(result, result === '等待服务器回复' ? 'pending' : 'error');
				update();
			},
			{
				content,
				cancelled: () => {
					draft = null;
					update();
				}
			}
		);
		draft = { action, input, dismiss };
		input.onkeydown = event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				$('[data-confirm]')?.click();
			}
		};
		update();
	}
	for (const button of body.querySelectorAll('[data-action]')) button.onclick = () => open(button.dataset.action);
	function update() {
		const state = service.snapshot();
		$('[data-wallet]').textContent = Number(state.wallet).toLocaleString();
		$('[data-bank]').textContent = Number(state.balance).toLocaleString();
		if (draft) {
			if (!state.allowed || state[draft.action + 'Max'] < 1) draft.dismiss();
			else draft.input.max = String(state[draft.action + 'Max']);
		}
		for (const button of body.querySelectorAll('[data-action]'))
			button.disabled = Boolean(draft) || !state.allowed || state[button.dataset.action + 'Max'] < 1;
		feedback.update(state.message, state.messageKind);
	}
	update();
	return { update };
}
