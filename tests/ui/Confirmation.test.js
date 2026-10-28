import { describe, expect, it } from 'vitest';
import { requestConfirmation } from '../../src/UI/Components/Confirmation.js';

describe('game tools confirmation', () => {
	it('opens a native modal and resolves cancellation', async () => {
		document.body.innerHTML = '<div class="game-tools-window"><div class="game-tools-tab"></div></div>';
		const window = document.querySelector('.game-tools-window');
		const tab = document.querySelector('.game-tools-tab');
		const confirmation = requestConfirmation(tab, '确认发放？');

		expect(tab.querySelector('dialog.ui-confirm').open).toBe(true);
		window.querySelector('[data-cancel]').click();

		await expect(confirmation).resolves.toBe(false);
	});
});

it('cancels a replaced confirmation and a removed owner without accepting', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 const first = requestConfirmation(body, 'first');
 const second = requestConfirmation(body, 'second');
 await expect(first).resolves.toBe(false);
 body.remove();
 await expect(second).resolves.toBe(false);
});
it('accepts once and cancels with Escape', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 const accepted = requestConfirmation(body, 'accept');
 const button = body.querySelector('[data-confirm]'); button.click(); button.click();
 await expect(accepted).resolves.toBe(true);
 const cancelled = requestConfirmation(body, 'cancel');
 body.querySelector('dialog').dispatchEvent(new Event('cancel', {cancelable:true}));
 await expect(cancelled).resolves.toBe(false);
});

it('selects the original desktop card only for desktop adventure tools', async () => {
 const original = globalThis.ResizeObserver;
 globalThis.ResizeObserver = class { observe() {} disconnect() {} };
 try {
  const owner = document.createElement('section');
  owner.dataset.feedbackTheme = 'desktop';
  const container = owner.appendChild(document.createElement('div'));
  document.body.append(owner);
  const desktop = requestConfirmation(container, '确认发放？');
  expect(container.querySelector('dialog').style.getPropertyValue('--confirm-center-x')).toBe('0px');
  container.querySelector('[data-cancel]').click();
  await expect(desktop).resolves.toBe(false);
  delete owner.dataset.feedbackTheme;
  const mobile = requestConfirmation(container, '确认发放？');
  expect(container.querySelector('dialog').style.getPropertyValue('--confirm-center-x')).toBe('');
  container.querySelector('[data-cancel]').click();
  await expect(mobile).resolves.toBe(false);
 } finally { globalThis.ResizeObserver = original; }
});

it('keeps a mobile confirmation within its owner as the viewport changes', async () => {
 const original = globalThis.ResizeObserver;
 globalThis.ResizeObserver = class { observe() {} disconnect() {} };
 const host = document.body.appendChild(document.createElement('div'));
 host.dataset.menuDensity = 'compact';
 const root = host.attachShadow({ mode: 'open' });
 root.innerHTML = '<section class="panel"><div></div></section>';
 const owner = root.querySelector('section'), container = owner.firstElementChild;
 let rect = { left: 20, top: 40, right: 320, bottom: 400, width: 300, height: 360 };
 owner.getBoundingClientRect = () => rect;
 try {
  const answer = requestConfirmation(container, '确认操作？');
  const dialog = container.querySelector('dialog');
  expect(dialog.style.getPropertyValue('--confirm-max-height')).toBe('360px');
  rect = { left: 20, top: 20, right: 600, bottom: 250, width: 580, height: 230 };
  window.dispatchEvent(new Event('resize'));
  expect(dialog.style.getPropertyValue('--confirm-max-height')).toBe('230px');
  dialog.querySelector('[data-cancel]').click();
  await expect(answer).resolves.toBe(false);
  rect.bottom = 200;
  window.dispatchEvent(new Event('resize'));
  expect(dialog.style.getPropertyValue('--confirm-max-height')).toBe('230px');
 } finally { host.remove(); globalThis.ResizeObserver = original; }
});
