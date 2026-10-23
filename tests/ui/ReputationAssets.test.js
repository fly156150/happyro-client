import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ loads: new Map(), hooks: new Map() }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: (path, done) => state.loads.set(path, done) } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { hookPacket: (id, hook) => state.hooks.set(id, hook) } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { ZC: { REPUTE_INFO: 1 }, ZC_REPUTE_OPEN: 2 } }));
vi.mock('DB/DBManager.js', () => ({ default: {
 INTERFACE_PATH: 'interface/', getReputeGroup: () => ({ 1: { Name: '部落' } }),
 getReputeInfo: () => ({ 1: {} }), getReputeData: () => ({ Name: '兽人部落', MaxPoint_Positive: 3000, Invisible: 'VISIBLE_TRUE' }),
 getReputeGroupList: () => [1]
} }));
vi.mock('Core/Preferences.js', () => ({ default: { get: () => ({ x: 0, y: 0, save: vi.fn() }) } }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c, components: {} } }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
 constructor() { this._host = document.createElement('div'); this._shadow = this._host.attachShadow({mode:'open'}); }
 draggable() {}
 append() { this._shadow.innerHTML=this.render(); this.init(); this.onAppend(); this.__active=true; }
} }));
import Reputation from '../../src/UI/Components/Reputation/Reputation.js';
it('renders packets before skin images arrive and updates the existing view when they finish', () => {
 state.hooks.get(1)({ reputeInfo: [{ type: 1, points: 1500 }] });
 const root = Reputation._shadow;
 const entry = root.querySelector('.rep_group_wrapper');
 expect(root.innerHTML).not.toContain('undefined');
 expect(entry.querySelector('.rep_id_points').textContent).toBe('500 / 1000');
 expect(entry.querySelector('.indicator_1').style.backgroundImage).toBe('var(--reputation-blue)');
 expect(Reputation._host.style.getPropertyValue('--reputation-blue')).toBe('none');
 const selector=root.querySelector('#repute_groups');selector.value='1';selector.dispatchEvent(new Event('change'));
 for (const [path,done] of state.loads) done('blob:'+path.split('/').pop());
 expect(root.querySelector('.rep_group_wrapper')).toBe(entry);
 expect(selector.value).toBe('1');
 expect(entry.querySelector('.rep_id_points').textContent).toBe('500 / 1000');
 expect(Reputation._host.style.getPropertyValue('--reputation-blue')).toBe('url("blob:light_blue.bmp")');
 expect(Reputation._host.outerHTML + root.innerHTML).not.toContain('undefined');
});
