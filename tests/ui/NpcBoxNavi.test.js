vi.mock('UI/Game/NpcNaviPrompt.js', () => ({ showNpcNaviPrompt: service.open }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const ui = vi.hoisted(() => ({ components: {} }));
const service = vi.hoisted(() => ({ available: vi.fn(() => true), open: vi.fn(() => true) }));
vi.mock('UI/Components/Navigation/NpcNaviService.js', () => ({
	isNpcNaviAvailable: service.available, openNpcNaviMap: service.open
}));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
	static MouseMode = { FREEZE: 1 };
	getRoot() { return this._host; }
	draggable() {}
	focus() { this._host.dataset.focused = 'true'; }
	append() {
		if (!this._host) {
			this._host = document.createElement('div');
			this._host.innerHTML = this.render();
			this.init();
		}
		document.body.append(this._host); this.onAppend?.();
	}
	remove() { this.onRemove?.(); this._host?.remove(); }
} }));
vi.mock('UI/UIManager.js', () => ({ default: { components: ui.components, addComponent: component => component } }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1000, height: 800 } }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: {} }));
vi.mock('UI/Components/NpcMenu/NpcMenu.js', () => ({ default: {} }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: {} }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { SPACE: 32, ENTER: 13, ESCAPE: 27 } }));
import NpcBox from '../../src/UI/Components/NpcBox/NpcBox.js';
import NpcMenu from 'UI/Components/NpcMenu/NpcMenu.js';
import InputBox from 'UI/Components/InputBox/InputBox.js';
const page = '<NAVI>^4D4DFF[工具店]^000000<INFO>alberta,98,154,0,000,0</INFO></NAVI>';
beforeEach(() => { vi.clearAllMocks(); service.available.mockReturnValue(true); NpcBox.append(); });
afterEach(() => { NpcMenu.__active=false; InputBox.__active=false; NpcMenu._host?.remove(); InputBox._host?.remove(); NpcBox.remove(); for (const key of Object.keys(ui.components)) { ui.components[key]._host?.remove(); delete ui.components[key]; } });
it('opens the existing map without sending an NPC response or adding footer controls', () => {
 NpcBox.setText(page, 7); NpcBox.addNext(7);
 const root = NpcBox.getRoot(), next = vi.fn(), close = vi.fn();
 NpcBox.onNextPressed = next; NpcBox.onClosePressed = close;
 root.querySelector('.navi-link span').click();
 expect(service.open).toHaveBeenCalledExactlyOnceWith('alberta,98,154,0,000,0', expect.objectContaining({label:'[工具店]'}));
 expect(root.querySelector('.npc-navi-teleport')).toBeNull();
 expect(root.querySelector('.content').textContent).toContain('[工具店]');
 expect(next).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
 expect(NpcBox.ownerID).toBe(7);
});
it('keeps the dialogue page and scroll while showing the retained prompt', () => {
 NpcBox.setText(page,7);NpcBox.addNext(7);const content=NpcBox.getRoot().querySelector('.content');content.scrollTop=55;
 content.querySelector('.navi-link').click();expect(service.open).toHaveBeenCalledOnce();expect(content.scrollTop).toBe(55);expect(NpcBox.ownerID).toBe(7);
});
it('clears the old dialogue naturally and supports a new NPC without stale state', () => {
 NpcBox.setText(page, 7); NpcBox.remove(); NpcBox.append(); NpcBox.setText(page, 8);
 expect(NpcBox.getRoot().querySelectorAll('.navi-link')).toHaveLength(1);
 NpcBox.getRoot().querySelector('.navi-link').click();
 expect(service.open).toHaveBeenCalledOnce(); expect(NpcBox.ownerID).toBe(8);
});
it('shows missing or unsafe targets as non-clickable text on desktop', () => {
 service.available.mockReturnValue(false); NpcBox.setText(page, 7);
 const root = NpcBox.getRoot(); expect(root.querySelector('.navi-link')).toBeNull();
 expect(root.querySelector('.content').textContent).toContain('[工具店]');
 root.querySelector('[data-navi-info]').click(); expect(service.open).not.toHaveBeenCalled();
});

it.each([13,32,27])('does not advance or close dialogue for key %s while the map window is above it', key => {
 NpcBox.setText(page,7); NpcBox.addNext(7); NpcBox._host.style.zIndex='60';
 const next=vi.fn(), close=vi.fn(); NpcBox.onNextPressed=next; NpcBox.onClosePressed=close;
 const host=document.body.appendChild(document.createElement('div')); host.style.zIndex='61';
 ui.components.GameTools={__active:true,needFocus:true,_host:host};
 const event={which:key,stopImmediatePropagation:vi.fn()};
 expect(NpcBox.onKeyDown(event)).toBe(true); expect(next).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
 host.style.display='none';
 if (key===27) { NpcBox.addClose(7); NpcBox.getRoot().querySelector('.next').style.display='none'; }
 NpcBox.onKeyDown(event); expect(key===27?close:next).toHaveBeenCalledOnce();
});
