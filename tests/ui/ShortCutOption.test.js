import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c, getComponent: () => null } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
 static MouseMode = { STOP: 1 };
 getRoot() { return this.root; }
 draggable() {}
} }));
vi.mock('Controls/BattleMode.js', () => ({ default: { reload: vi.fn() } }));
import Controls from '../../src/Preferences/Controls.js';
import ShortCutOption from '../../src/UI/Components/ShortCutOption/ShortCutOption.js';

beforeEach(() => {
 document.body.innerHTML = ShortCutOption.render();
 ShortCutOption.root = document.querySelector('#ShortCutOption');
 ShortCutOption._host = ShortCutOption.root;
 ShortCutOption.init();
});

it('preserves fractional gamepad dead zones in persisted preferences', () => {
 const input = ShortCutOption.root.querySelector('.joyDeadline');
 input.value = '0.3';
 input.dispatchEvent(new Event('change'));
 expect(Controls.joyDeadline).toBe(0.3);
 expect(JSON.parse(localStorage.getItem('Controls')).joyDeadline).toBe(0.3);
});

it('populates reopened gamepad controls from the actual saved values', () => {
 Object.assign(Controls, { joyDeadline: 0.4, joySense: 66, joyQuick: 2, attackTargetMode: 1, joyReverseStick: true });
 ShortCutOption.onAppend();
 for (const [key, value] of Object.entries({ joyDeadline: '0.4', joySense: '66', joyQuick: '2', attackTargetMode: '1' })) {
  expect(ShortCutOption.root.querySelector('.' + key).value).toBe(value);
 }
 expect(ShortCutOption.root.querySelector('.joyReverseStick').checked).toBe(true);
});

it('stops capturing keys when the settings window closes', () => {
 const cell = ShortCutOption.root.querySelector('td.customize');
 cell.click();
 expect(ShortCutOption.isCapturing).toBe(true);
 ShortCutOption.onRemove();
 expect(ShortCutOption.isCapturing).toBe(false);
 expect(ShortCutOption.root.querySelector('td.selected')).toBeNull();
});

it('labels a cleared shortcut immediately and restores it on cancel', () => {
 const cell = ShortCutOption.root.querySelector('td[data-button="Inventory"]');
 const original = cell.textContent;
 cell.click();
 ShortCutOption.onKeyDown({ which: 27, preventDefault() {}, stopImmediatePropagation() {} });
 expect(cell.textContent).toBe('未设置');
 ShortCutOption.root.querySelector('.button.cancel').click();
 expect(cell.textContent).toBe(original);
});
