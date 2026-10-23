import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({ searchAdventureItems: vi.fn() }));
import { pickupDefaults, validPickupSettings } from '../../src/UI/Game/PickupSettings.js';
import { createAutoCombatView } from '../../src/UI/Components/AutoCombat/AutoCombatView.js';
let view, root, state, actions, pickup, saved;
beforeEach(() => {
	const host = document.createElement('div'); document.body.append(host);
	root = host.attachShadow({ mode: 'open' });
	state = { active: false, status: '自动战斗已停止', species: [], skills: [], ranges: { search: 20, activity: 30 } };
	actions = {
		snapshot: () => state,
		start: vi.fn(() => { state.active = true; state.status = '寻找附近目标'; return true; }),
		stop: vi.fn(message => { state.active = false; state.status = message || '自动战斗已停止'; }),
		targets: () => [{ species: 1002, name: '波利' }],
		skills: () => [{ id: 5, name: '狂击', level: 3 }], configure: vi.fn(() => true)
	};
	saved = pickupDefaults();
 pickup = { load: () => structuredClone(saved), save: vi.fn(value => { if (!validPickupSettings(value)) return false; saved = structuredClone(value); return true; }) };
 view = createAutoCombatView(root, actions, pickup);
});
afterEach(() => { view.destroy(); document.body.replaceChildren(); });
const click = selector => root.querySelector(selector).click();
it('offers a visible start/stop control with accessible state', () => {
	click('[data-settings]'); click('[data-toggle]'); expect(actions.start).toHaveBeenCalledOnce();
	expect(root.querySelector('[data-toggle]').getAttribute('aria-checked')).toBe('true');
	expect(root.querySelector('[data-status]')).toBeNull();
	click('[data-toggle]'); expect(actions.stop).toHaveBeenCalledOnce();
	expect(root.querySelector('[data-toggle]').getAttribute('aria-checked')).toBe('false');
});
it('uses the shared species, skill and range editor and saves without starting combat', () => {
	click('[data-settings]'); expect(view.isOpen()).toBe(true); expect(actions.stop).not.toHaveBeenCalled();
	click('[data-species="1002"]'); root.querySelector('[data-auto-skills] [data-skill="5"]').click();
	click('[data-range="search"][data-delta="1"]');
	expect(actions.configure).toHaveBeenLastCalledWith([{ id: 1002, name: '波利' }], [5], { search: 21, activity: 30 }, { enabled: true, waitSeconds: 2, intervalSeconds: 2 });
	expect(view.isOpen()).toBe(true); expect(actions.start).not.toHaveBeenCalled();
 click('[data-close]');
	expect(root.activeElement).toBe(root.querySelector('[data-settings]'));
});
it('cancels unsaved settings with Escape and keeps keyboard focus inside the dialog', () => {
	click('[data-settings]');
	root.querySelector('[data-close]').focus();
	root.querySelector('[data-close]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
	expect(root.activeElement).toBe(root.querySelector('[data-skill="5"]'));
	root.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	expect(view.isOpen()).toBe(false); expect(actions.configure).not.toHaveBeenCalled();
});
it('stops after a rejected start and retains unsaved settings after persistence failure', () => {
	actions.start.mockReturnValue(false); click('[data-settings]'); click('[data-toggle]');
	expect(actions.stop).toHaveBeenCalledWith('当前不能开始自动战斗');
 expect(root.querySelector('[data-toggle]').getAttribute('aria-checked')).toBe('false');
	click('[data-settings]'); actions.configure.mockReturnValue(false); click('[data-range="search"][data-delta="1"]');
	expect(view.isOpen()).toBe(true); expect(root.querySelector('[data-auto-save-status]').textContent).toContain('保存失败');
});

it('does not forward dialog keystrokes to gameplay shortcuts', () => {
	const gameplay = vi.fn();
	window.addEventListener('keydown', gameplay);
	try {
		click('[data-settings]');
		root.querySelector('[data-close]').dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true, composed: true }));
		expect(gameplay).not.toHaveBeenCalled();
	} finally { window.removeEventListener('keydown', gameplay); }
});

it('keeps combat running when opening the editor', () => {
 actions.start(); view.open(); expect(state.active).toBe(true); expect(actions.stop).not.toHaveBeenCalled();
});
it('saves changes immediately and closes without confirmation', () => {
 view.open(); click('[data-range="search"][data-delta="1"]');
 click('[data-tab="pickup"]');
 const toggle=root.querySelector('[data-pickup="enabled"]'); toggle.checked=true; toggle.dispatchEvent(new Event('input'));
 expect(saved.enabled).toBe(true); click('[data-close]'); expect(view.isOpen()).toBe(false);
 view.open(); expect(root.querySelector('[data-pickup="enabled"]').checked).toBe(true);
});
it('flushes numeric changes on close and preserves the last valid value for invalid input', () => {
 view.open(); click('[data-tab="pickup"]');
 const toggle=root.querySelector('[data-pickup="enabled"]'); toggle.checked=true; toggle.dispatchEvent(new Event('input'));
 const range=root.querySelector('[data-pickup="range"]'); range.value='99'; range.dispatchEvent(new Event('input'));
 expect(saved.range).toBe(5); expect(range.getAttribute('aria-invalid')).toBe('true');
 range.value='8'; range.dispatchEvent(new Event('input')); click('[data-close]'); expect(saved.range).toBe(8);
 expect(actions.configure).not.toHaveBeenCalled(); expect(view.isOpen()).toBe(false);
});

it('keeps combat controls inside their tab across closing and reopening', () => {
 click('[data-settings]');
 const toggle = root.querySelector('[data-toggle]');
 expect(toggle.closest('[role="tabpanel"]').id).toBe('combat-panel');
 click('[data-toggle]');
 click('[data-tab="pickup"]');
 expect(toggle.closest('[hidden]')).not.toBeNull();
 expect(root.querySelector('#pickup-panel').hidden).toBe(false);
 expect(root.querySelector('.combat-indicator')).toBeNull();
 expect(actions.stop).not.toHaveBeenCalled();
 click('[data-close]'); click('[data-settings]');
 expect(root.querySelector('[data-toggle]')).toBe(toggle);
 expect(toggle.closest('[hidden]')).toBeNull();
 expect(toggle.getAttribute('aria-checked')).toBe('true');
 click('[data-toggle]');
 expect(actions.stop).toHaveBeenCalledOnce();
});

it('keeps the pickup master switch outside scrolling content across reopening', () => {
 view.open();
 const row=root.querySelector('.pickup-enabled');
 expect(row.parentElement.matches('.desktop-pickup-panel')).toBe(true);
 expect(root.querySelector('.desktop-pickup-scroll .pickup-enabled')).toBeNull();
 const toggle=row.querySelector('input');toggle.checked=true;toggle.dispatchEvent(new Event('input'));
 expect(saved.enabled).toBe(true);
 click('[data-close]');expect(root.querySelector('.pickup-enabled')).toBeNull();
 view.open();expect(root.querySelectorAll('.pickup-enabled')).toHaveLength(1);
 expect(root.querySelector('.pickup-enabled input').checked).toBe(true);
});

it('opens skill details on desktop right-click without changing combat selection', () => {
 view.destroy();
 const showSkillDescription = vi.fn();
 view = createAutoCombatView(root, actions, pickup, { showSkillDescription });
 view.open();
 const skill = root.querySelector('[data-skill="5"]');
 const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
 skill.querySelector('strong').dispatchEvent(event);
 expect(event.defaultPrevented).toBe(true);
 expect(showSkillDescription).toHaveBeenCalledWith(5);
 expect(actions.configure).not.toHaveBeenCalled();
 expect(skill.getAttribute('aria-checked')).toBe('false');
 skill.click();
 expect(skill.getAttribute('aria-checked')).toBe('true');
});
