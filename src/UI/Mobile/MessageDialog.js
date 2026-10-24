import Session from 'Engine/SessionStorage.js';
import loginDialogCSS from './LoginDialog.css?raw';
import menuLayoutCSS from './game/MenuLayout.css?raw';
import { bindMobileViewport } from './game/MobileViewport.js';
import confirmationCSS from '../Components/Confirmation.css?raw';
import backdropCSS from './game/MobileModalBackdrop.css?raw';
import inputCSS from './game/MobileModalInput.css?raw';
import css from './MessageDialog.css?raw';

const activeDialogs = new Set();
export function removeMobileDialogs() {
	for (const dialog of activeDialogs) dialog.remove();
}

const labels = { ok: '确定', yes: '确定', cancel: '取消', no: '取消', close: '关闭', next: '继续' };

/** Shared mobile presentation for UIManager messages, confirmations and errors. */
export function showMobileDialog({
	text,
	title = '提示',
	buttons,
	onCancel,
	keyboardAccept = false,
	preserveLineBreaks = false
}) {
	const host = document.createElement('div');
	host.className = 'mobile-message-host';
	const root = host.attachShadow({ mode: 'open' });
	const inGame = Session.Playing;
	const themeCSS = inGame ? menuLayoutCSS + confirmationCSS + backdropCSS + inputCSS : loginDialogCSS;
	root.innerHTML = `<style>${themeCSS}${css}</style><dialog class="${inGame ? 'mobile-menu-dialog ui-confirm' : 'm-signup'}" aria-labelledby="message-title" aria-describedby="message-text">
		<div class="container ${inGame ? 'ui-confirm-body' : ''}"><h2 id="message-title" tabindex="-1" autofocus></h2><p id="message-text" class="text"></p></div>
		<div class="btns ${inGame ? 'ui-confirm-actions' : 'm-signup__actions'}"></div></dialog>`;
	const dialog = root.querySelector('dialog');
	const heading = root.querySelector('h2');
	heading.textContent = title;
	root.querySelector('.text').textContent = text;
	root.querySelector('.text').classList.toggle('preserve-line-breaks', preserveLineBreaks);
	let finished = false;
	let unbindViewport;
	const component = {
		_host: host,
		_shadow: root,
		append() {
			if (dialog.open) return;
			finished = false;
			document.body.append(host);
			activeDialogs.add(component);
			unbindViewport = bindMobileViewport(host);
			dialog.showModal();
			heading.focus({ preventScroll: true });
		},
		remove() {
			finished = true;
			unbindViewport?.();
			if (dialog.open) dialog.close();
			host.remove();
			activeDialogs.delete(component);
		}
	};
	const finish = callback => {
		if (finished) return;
		component.remove();
		callback?.();
	};
	for (const { name, callback, primary } of buttons) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = labels[name.toLowerCase()] || name;
		button.classList.toggle('primary', !!primary);
		if (!inGame) button.classList.add('m-login__btn', primary ? 'm-login__btn--primary' : 'm-login__btn--secondary');
		button.addEventListener('click', () => finish(callback));
		root.querySelector('.btns').append(button);
	}
	// Keep native button clicks and scrolling out of the game's touch handlers.
	for (const type of ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click']) {
		dialog.addEventListener(type, event => event.stopPropagation(), { passive: true });
	}
	dialog.addEventListener('cancel', event => {
		event.preventDefault();
		if (onCancel) finish(onCancel);
		else if (keyboardAccept) finish(buttons[0]?.callback);
	});
	dialog.addEventListener('keydown', event => {
		event.stopPropagation();
		if (keyboardAccept && event.key === 'Enter' && event.target === heading) {
			event.preventDefault();
			finish(buttons[0]?.callback);
		}
	});
	dialog.addEventListener('keyup', event => event.stopPropagation());
	component.append();
	return component;
}
