import { afterEach, expect, it, vi } from 'vitest';
import { getFocusedNativeModal } from '../../src/UI/NativeModalCursor.js';

afterEach(() => document.body.replaceChildren());

it('follows focus into shadow-root dialogs and restores after closing', () => {
	const host = document.body.appendChild(document.createElement('div'));
	const root = host.attachShadow({ mode: 'open' });
	root.innerHTML = '<button>打开</button><dialog><input><button>取消</button></dialog>';
	const dialog = root.querySelector('dialog');
	root.querySelector('button').focus();
	expect(getFocusedNativeModal()).toBe(null);
	dialog.showModal();
	// jsdom does not maintain the browser's native modal top layer.
	vi.spyOn(root.querySelector('input'), 'closest').mockImplementation(selector =>
		selector === 'dialog:modal' && dialog.open ? dialog : null
	);
	root.querySelector('input').focus();
	expect(getFocusedNativeModal()).toBe(dialog);
	dialog.close();
	root.querySelector('button').focus();
	expect(getFocusedNativeModal()).toBe(null);
});

it('does not hide the game cursor for ordinary nonmodal windows', () => {
	document.body.innerHTML = '<dialog open><input></dialog>';
	document.querySelector('input').focus();
	expect(getFocusedNativeModal()).toBe(null);
});

it('retains an open modal when disabling a paging button loses focus', () => {
 const dialog = document.body.appendChild(document.createElement('dialog'));
 const button = dialog.appendChild(document.createElement('button'));
 dialog.showModal();
 vi.spyOn(button, 'closest').mockImplementation(() => dialog.open ? dialog : null);
 vi.spyOn(dialog, 'matches').mockImplementation(() => dialog.open);
 button.focus();
 expect(getFocusedNativeModal()).toBe(dialog);
 button.disabled = true;
 button.blur();
 expect(getFocusedNativeModal()).toBe(dialog);
 dialog.close();
 expect(getFocusedNativeModal()).toBe(null);
});
