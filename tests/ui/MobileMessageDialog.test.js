import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Session from '../../src/Engine/SessionStorage.js';
import { showMobileDialog, removeMobileDialogs } from '../../src/UI/Mobile/MessageDialog.js';
const originalMethods = Object.fromEntries(['showModal', 'close'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeEach(() => {
	Session.Playing = false;
	Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function () { this.open = true; } });
	Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function () { this.open = false; } });
});
afterEach(() => {
	Session.Playing = false;
	removeMobileDialogs(); document.body.replaceChildren(); vi.restoreAllMocks();
	for (const [name, descriptor] of Object.entries(originalMethods)) {
		if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
		else delete HTMLDialogElement.prototype[name];
	}
});
it('focuses the heading and completes confirmation only once', () => {
	const confirm = vi.fn(), cancel = vi.fn();
	const box = showMobileDialog({ text: '<b>确认</b>', buttons: [{ name: 'cancel', callback: cancel }, { name: 'ok', callback: confirm, primary: true }], onCancel: cancel });
	expect(box._shadow.activeElement.tagName).toBe('H2');
	expect(box._shadow.querySelector('.text').textContent).toBe('<b>确认</b>');
	expect(box._shadow.querySelector('.text b')).toBeNull();
	const button = box._shadow.querySelector('.primary');
	expect(button.textContent).toBe('确定');
	button.click(); button.click();
	expect(confirm).toHaveBeenCalledOnce();
	expect(cancel).not.toHaveBeenCalled();
	expect(box._host.isConnected).toBe(false);
});
it('allows cancel and silent programmatic removal without firing confirmation', () => {
	const confirm = vi.fn(), cancel = vi.fn();
	const box = showMobileDialog({ text: '确认', buttons: [{ name: 'ok', callback: confirm }], onCancel: cancel });
	box._shadow.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
	expect(cancel).toHaveBeenCalledOnce();
	box.append(); box.remove();
	expect(cancel).toHaveBeenCalledOnce(); expect(confirm).not.toHaveBeenCalled();
});
it('isolates keyboard input and supports enabled message shortcuts', () => {
	const callback = vi.fn(), underlying = vi.fn();
	document.body.addEventListener('keydown', underlying, { once: true });
	const box = showMobileDialog({ text: '错误', buttons: [{ name: 'ok', callback }], keyboardAccept: true });
	box._shadow.querySelector('h2').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
	expect(callback).toHaveBeenCalledOnce(); expect(underlying).not.toHaveBeenCalled();
	document.body.removeEventListener('keydown', underlying);
});

it('keeps touch events native and clears all dialogs on a screen reset', () => {
	const gameTouch = vi.fn(event => event.preventDefault());
	window.addEventListener('touchstart', gameTouch);
	const callback = vi.fn();
	try {
		const box = showMobileDialog({ text: '密码错误', buttons: [{ name: 'ok', callback }] });
		const event = new Event('touchstart', { bubbles: true, composed: true, cancelable: true });
		box._shadow.querySelector('button').dispatchEvent(event);
		expect(gameTouch).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
		removeMobileDialogs();
		expect(box._host.isConnected).toBe(false);
		expect(callback).not.toHaveBeenCalled();
	} finally { window.removeEventListener('touchstart', gameTouch); }
});

it('uses registration styling before play and restores it after leaving the game', () => {
	for (const playing of [false, true, false]) {
		Session.Playing = playing;
		const callback = vi.fn();
		const box = showMobileDialog({ text: '连接提示', buttons: [{ name: 'ok', primary: true, callback }] });
		const dialog = box._shadow.querySelector('dialog');
		expect(dialog.classList.contains('m-signup')).toBe(!playing);
		expect(dialog.classList.contains('ui-confirm')).toBe(playing);
		expect(box._shadow.querySelector('button').classList.contains('m-login__btn--primary')).toBe(!playing);
		box._shadow.querySelector('button').click();
		expect(callback).toHaveBeenCalledOnce();
	}
});
