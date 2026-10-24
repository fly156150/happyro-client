import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDeathPrompt } from '../../src/UI/Mobile/game/DeathPrompt.js';

let parent, root, prompt, actions, state;
const click = selector => root.querySelector(selector).click();
beforeEach(() => {
	vi.useFakeTimers();
	parent = document.body.appendChild(document.createElement('div'));
	state = { dead: true, tokenCount: 0 };
	actions = { snapshot: () => state, open: vi.fn(), close: vi.fn(), revive: vi.fn(), returnToSavePoint: vi.fn() };
	prompt = createDeathPrompt(parent, actions, parent);
	root = parent.querySelector('.mobile-death-host').shadowRoot;
});
afterEach(() => { prompt.destroy(); parent.remove(); vi.useRealTimers(); });

it('opens once on death, waits without repeated popups, and allows reopening', () => {
	prompt.update(state);
	expect(root.querySelector('dialog').open).toBe(true);
	expect(root.querySelector('[data-revive]').hidden).toBe(true);
	expect(root.querySelector('[data-return]').classList.contains('primary')).toBe(true);
	click('[data-wait]');
	prompt.update(state);
	expect(root.querySelector('dialog').open).toBe(false);
	expect(parent.querySelector('.death-reopen').hidden).toBe(false);
	expect(actions.open).toHaveBeenCalledOnce();
	parent.querySelector('.death-reopen').click();
	expect(root.querySelector('dialog').open).toBe(true);
	expect(actions.open).toHaveBeenCalledTimes(2);
});

it('requires confirmation before spending a token and prevents duplicate requests', () => {
	state.tokenCount = 3;
	prompt.update(state);
	expect(root.querySelector('[data-revive]').textContent).toContain('×3');
	click('[data-revive]');
	expect(actions.revive).not.toHaveBeenCalled();
	expect(root.querySelector('#death-description').textContent).toContain('消耗 1 个');
	click('[data-confirm]'); click('[data-confirm]'); click('[data-return]');
	expect(actions.revive).toHaveBeenCalledOnce();
	expect(actions.returnToSavePoint).not.toHaveBeenCalled();
	expect(state.tokenCount).toBe(3);
	vi.advanceTimersByTime(5000);
	expect(actions.revive).toHaveBeenCalledOnce();
	expect(root.querySelector('.death-message').textContent).toContain('查看系统提示');
});

it('rechecks inventory and life state when confirming instead of trusting stale UI', () => {
	state.tokenCount = 1; prompt.update(state); click('[data-revive]');
	state = { dead: true, tokenCount: 0 }; click('[data-confirm]');
	expect(actions.revive).not.toHaveBeenCalled();
	expect(root.querySelector('[data-revive]').hidden).toBe(true);
	state = { dead: false, tokenCount: 0 }; click('[data-return]');
	expect(actions.returnToSavePoint).not.toHaveBeenCalled();
	expect(root.querySelector('dialog').open).toBe(false);
});

it('closes confirmation and waiting entry when revived, then opens on the next death', () => {
	state.tokenCount = 1; prompt.update(state); click('[data-revive]');
	state = { dead: false, tokenCount: 0 }; prompt.update(state);
	expect(root.querySelector('dialog').open).toBe(false);
	expect(parent.querySelector('.death-reopen').hidden).toBe(true);
	expect(actions.close).toHaveBeenCalledOnce();
	state = { dead: true, tokenCount: 0 }; prompt.update(state);
	expect(root.querySelector('dialog').open).toBe(true);
	expect(root.querySelector('[data-confirm]').hidden).toBe(true);
});

it('ignores a touch released after opening and isolates a new tap from game input', () => {
	prompt.update(state);
	const button = root.querySelector('[data-return]');
	button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
	expect(actions.returnToSavePoint).not.toHaveBeenCalled();
	const bubble = vi.fn(); document.addEventListener('click', bubble);
	try {
		button.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
		button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
		expect(actions.returnToSavePoint).toHaveBeenCalledOnce();
		expect(bubble).not.toHaveBeenCalled();
	} finally { document.removeEventListener('click', bubble); }
});

it('cancels confirmation without sending and removes pending timers with the map', () => {
	state.tokenCount = 1; prompt.update(state); click('[data-revive]');
	root.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
	expect(root.querySelector('dialog').open).toBe(true);
	expect(root.querySelector('[data-confirm]').hidden).toBe(true);
	click('[data-return]');
	prompt.destroy();
	expect(vi.getTimerCount()).toBe(0);
	expect(parent.childElementCount).toBe(0);
});
