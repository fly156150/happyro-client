import { afterEach, expect, it, vi } from 'vitest';
import { preserveCharacterListPosition } from '../../src/UI/Mobile/auth/CharacterListPosition.js';
let component;
afterEach(() => { component.onRemove(); component._host.remove(); vi.restoreAllMocks(); });
function setup(slotBounds) {
 const host = document.body.appendChild(document.createElement('div'));
 host.innerHTML = '<div class="char_list"><button aria-pressed="true">新角色</button></div>';
 const list = host.firstChild;
 Object.defineProperty(list, 'clientHeight', { value: 300 });
 list.getBoundingClientRect = () => ({ top: 100, bottom: 400 });
 list.firstChild.getBoundingClientRect = () => slotBounds;
 component = preserveCharacterListPosition({ _host: host, getRoot: () => host, onAppend() {}, onRemove() {}, setInfo() {} });
 list.scrollTop = 900; component.onRemove(); list.scrollTop = 0;
 component.onAppend();
 return list;
}
it('moves only the list by the minimum needed when the selected slot is below the viewport', () => {
 const list = setup({ top: 350, bottom: 450 });
 expect(list.scrollTop).toBe(950);
 expect(document.documentElement.scrollTop).toBe(0);
});
it('keeps the exact previous position when the selection is already visible', () => {
 expect(setup({ top: 150, bottom: 250 }).scrollTop).toBe(900);
});
it('reveals a selection above the viewport after layout changes', () => {
 expect(setup({ top: 80, bottom: 180 }).scrollTop).toBe(880);
});
