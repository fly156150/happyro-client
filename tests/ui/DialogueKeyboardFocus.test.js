import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const ui = vi.hoisted(() => ({ components: {} }));
vi.mock('UI/UIManager.js', () => ({ default: {
	components: ui.components,
	addComponent: component => { ui.components[component.name] = component; return component; }
} }));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
	static MouseMode = { FREEZE: 1 };
	constructor(name) { this.name = name; this.needFocus = true; }
	getRoot() { return this._host; }
	isEditableFocused() { return false; }
} }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('Renderer/Renderer.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { SPACE: 32, ENTER: 13, ESCAPE: 27, UP: 38, DOWN: 40 } }));
import { hasHigherFocusedWindow } from '../../src/UI/Game/DialogueKeyboardFocus.js';
import NpcMenu from '../../src/UI/Components/NpcMenu/NpcMenu.js';
import InputBox from '../../src/UI/Components/InputBox/InputBox.js';
function host(z) { const node = document.body.appendChild(document.createElement('div')); node.style.zIndex = String(z); return node; }
beforeEach(() => {
	for (const component of [NpcMenu, InputBox]) {
		component._host = host(60); component._host.innerHTML = component.render(); component.__active = false;
	}
	ui.components.GameTools = { __active: true, needFocus: true, _host: host(61) };
});
afterEach(() => { document.body.replaceChildren(); delete ui.components.GameTools; });
it.each([13, 32, 27])('protects the retained NPC menu from key %s while the map is above it', key => {
	NpcMenu.__active = true; NpcMenu.setMenu('继续:离开', 7); NpcMenu.onSelectMenu = vi.fn();
	const event = { which: key, stopImmediatePropagation: vi.fn() };
	expect(NpcMenu.onKeyDown(event)).toBe(true); expect(NpcMenu.onSelectMenu).not.toHaveBeenCalled();
	ui.components.GameTools._host.style.display = 'none'; NpcMenu.onKeyDown(event);
	expect(NpcMenu.onSelectMenu).toHaveBeenCalledWith(7, key === 27 ? 255 : 1);
});
it('does not submit or clear an NPC input when Enter is pressed in the map', () => {
	InputBox.__active = true; InputBox.onSubmitRequest = vi.fn(); InputBox.getRoot().querySelector('input').value = '保留输入';
	const event = { which: 13, stopImmediatePropagation: vi.fn() };
	expect(InputBox.onKeyDown(event)).toBe(true); expect(InputBox.onSubmitRequest).not.toHaveBeenCalled();
	expect(InputBox.getRoot().querySelector('input').value).toBe('保留输入');
	ui.components.GameTools._host.style.display = 'none'; InputBox.onKeyDown(event);
	expect(InputBox.onSubmitRequest).toHaveBeenCalledWith('保留输入');
});
it('ignores inactive, hidden, detached, nonfocusable and lower windows', () => {
	const tool = ui.components.GameTools;
	expect(hasHigherFocusedWindow(NpcMenu, ui.components)).toBe(true);
	tool.__active = false; expect(hasHigherFocusedWindow(NpcMenu, ui.components)).toBe(false); tool.__active = true;
	tool._host.hidden = true; expect(hasHigherFocusedWindow(NpcMenu, ui.components)).toBe(false); tool._host.hidden = false;
	tool.needFocus = false; expect(hasHigherFocusedWindow(NpcMenu, ui.components)).toBe(false); tool.needFocus = true;
	tool._host.style.zIndex = '59'; expect(hasHigherFocusedWindow(NpcMenu, ui.components)).toBe(false);
	tool._host.style.zIndex = '61'; tool._host.remove(); expect(hasHigherFocusedWindow(NpcMenu, ui.components)).toBe(false);
});
