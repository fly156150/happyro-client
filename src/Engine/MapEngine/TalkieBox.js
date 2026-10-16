import { confirmAction } from 'UI/Components/Confirmation.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';

export function talkieMessageError(value) {
	if (!value.trim()) return '请输入留言';
	if (value.includes('\0') || new TextEncoder().encode(value).length > 79) return '留言最多 79 字节（中文通常最多 26 字）';
	return '';
}

export function requestTalkieMessage() {
	return new Promise(resolve => {
		const content = document.createElement('label');
		content.className = 'ui-confirm-field';
		const input = document.createElement('input');
		input.type = 'text';
		input.required = true;
		input.maxLength = 79;
		input.placeholder = '输入留言';
		input.setAttribute('aria-label', '话匣子留言');
		content.append(input);
		input.addEventListener('input', () => input.setCustomValidity(talkieMessageError(input.value)));
		input.addEventListener('keydown', event => {
			event.stopPropagation();
			if (event.key === 'Enter' && !event.isComposing) {
				event.preventDefault();
				input.closest('dialog').querySelector('[data-confirm]').click();
			}
		});
		const finish = value => { unsubscribe(); resolve(value); };
		const dismiss = confirmAction(document.body, '话匣子留言', () => finish(input.value), {
			content, cancelled: () => finish(null)
		});
		const unsubscribe = onConnectionEnd(dismiss);
	});
}

export function showTalkieMessage(packet, entities) {
	entities.get(packet.AID)?.dialog.set(packet.contents);
}
