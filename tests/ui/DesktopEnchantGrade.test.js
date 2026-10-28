import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ items: [], hooks: {}, send: vi.fn(), confirm: null, session: { zeny: 1000 } }));
vi.mock('UI/Platform.js', () => ({ default: { isMobile: false } }));
vi.mock('UI/Game/GameRefinement.js', () => ({ openGameRefinement: vi.fn(), updateRefinementMaterials: vi.fn(), finishRefinement: vi.fn() }));
vi.mock('DB/DBManager.js', () => ({ default: { INTERFACE_PATH: '', getItemInfo: () => ({ identifiedDisplayName: '材料' }), getMessage: String } }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: (_path, cb) => cb('data:image/png;base64,') } }));
vi.mock('DB/Effects/EffectConst.js', () => ({ default: {} }));
vi.mock('Renderer/EffectManager.js', () => ({ default: { spam: vi.fn() } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: s.send, hookPacket: (type, fn) => { s.hooks[type] = fn; } } }));
vi.mock('Network/PacketStructure.js', () => ({ default: {
 CZ: Object.fromEntries(['GRADE_ENCHANT_REQ', 'GRADE_ENCHANT_SELECT_EQUIPMENT', 'GRADE_ENCHANT_CLOSE_UI'].map(type => [type, class { constructor() { this.type = type; } }])),
 ZC: { GRADE_ENCHANT_MATERIAL_LIST: 'materials', GRADE_ENCHANT_ACK: 'result', GRADE_ENCHANT_BROADCAST_RESULT: 'broadcast' }
} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: v => v, showPromptBox: (_m, _o, _c, cb) => { s.confirm = cb; }, showMessageBox: vi.fn() } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class { draggable() {} remove() { this.onRemove(); this._host.remove(); } } }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('UI/Components/Announce/Announce.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: {} }));
vi.mock('UI/Components/Equipment/Equipment.js', () => ({ default: {} }));
vi.mock('UI/Components/ItemCompare/ItemCompare.js', () => ({ default: {} }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: {} }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: { getUI: () => ({
 getItemByIndex: index => s.items.find(i => i.index === index), getItemById: id => s.items.find(i => i.ITID === id),
 removeItem: index => { const i = s.items.findIndex(i => i.index === index); return i < 0 ? null : s.items.splice(i, 1)[0]; },
 addItem: item => s.items.push(item)
}) } }));
import Grade from '../../src/UI/Components/EnchantGrade/EnchantGrade.js';
const root = () => Grade._shadow;
const click = selector => root().querySelector(selector).click();
const offer = (index = 2, success_chance = 70) => s.hooks.materials({ index, success_chance,
 materialList: [{ itemId: 501, amount: 1, price: 100, breakable: 1 }, { itemId: 501, amount: 5, price: 500, breakable: 0 }],
 blessing_info: { id: 502, amount: 1, max_blessing: 10, bonus: 1 }
});
beforeEach(() => {
 vi.useFakeTimers(); vi.clearAllMocks(); s.session.zeny = 1000; s.confirm = null;
 s.items = [2, 3].map(index => ({ index, ITID: 1341, RefiningLevel: 11, enchantgrade: 0, IsIdentified: true }));
 s.items.push({ index: 4, ITID: 501, count: 10 }, { index: 5, ITID: 502, count: 10 });
 Grade._host = document.createElement('div'); Grade._shadow = Grade._host.attachShadow({ mode: 'open' });
 const wrapper = document.createElement('div'); wrapper.className = 'ui-component-root'; wrapper.innerHTML = Grade.render();
 Grade._shadow.append(wrapper); document.body.append(Grade._host); Grade.init(); Grade.onAppend();
});
afterEach(() => { Grade.onRemove(); Grade._host.remove(); vi.useRealTimers(); });
it('keeps replacement equipment visible and resets blessings and start', () => {
 offer(); click('.material_slot1'); click('.add_material_btn'); offer(3);
 expect(root().querySelector('.enchant_container').style.visibility).toBe('visible');
 expect(root().querySelector('.enchant_container .item').dataset.index).toBe('3');
 expect(root().querySelector('.probability').textContent).toBe('70%');
 expect(root().querySelector('.start_grade').disabled).toBe(true);
});
it('disables a previously valid action when selecting an unaffordable option', () => {
 offer(); click('.material_slot1'); s.items.find(i => i.ITID === 501).count = 1;
 click('.material_slot2'); click('.start_grade'); expect(s.confirm).toBeNull(); expect(s.send).not.toHaveBeenCalled();
});
it.each(['materials', 'zeny', 'equipment'])('rechecks %s at confirmation', change => {
 offer(); click('.material_slot1'); click('.start_grade');
 if (change === 'materials') s.items.find(i => i.ITID === 501).count = 0;
 if (change === 'zeny') s.session.zeny = 0;
 if (change === 'equipment') s.items[0].WearState = 2;
 s.confirm(); expect(s.send).not.toHaveBeenCalled();
});
it('sends once and prevents switching while waiting', () => {
 offer(); click('.material_slot1'); click('.start_grade'); s.confirm(); s.confirm();
 Grade.onRequestItemEnchantGrade(s.items[1]);
 expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'GRADE_ENCHANT_REQ', index: 2 }));
});
it.each([0, 1, 2, 3, 4])('clears result %s and allows the next equipment', result => {
 offer(); click('.material_slot1'); click('.start_grade'); s.confirm();
 if (result === 3) s.items = s.items.filter(i => i.index !== 2);
 s.hooks.result({ index: 2, grade: result === 0 ? 1 : 0, result }); vi.advanceTimersByTime(4000);
 expect(root().querySelector('.enchant_container .item')).toBeNull();
 expect(root().querySelector('.grade-wheel').style.visibility).toBe('hidden');
 offer(3); click('.material_slot1'); click('.start_grade'); s.confirm(); expect(s.send).toHaveBeenCalledTimes(2);
 if (result === 0) expect(s.items.find(i => i.index === 2)).toMatchObject({ enchantgrade: 1, RefiningLevel: 0 });
 if (result === 3) expect(s.items.find(i => i.index === 2)).toBeUndefined();
});
it('clears the previous choice when the server rejects an item', () => {
 offer(); click('.material_slot1'); s.hooks.materials({ index: -1, materialList: [] }); click('.start_grade');
 expect(root().querySelector('.enchant_container .item')).toBeNull(); expect(s.confirm).toBeNull();
});
it('does not enable grading at zero base chance', () => {
 offer(2, 0); click('.material_slot1'); click('.add_material_btn'); click('.start_grade'); expect(s.confirm).toBeNull();
});
it('cancels effects on removal', () => {
 offer(); s.hooks.result({ index: 2, grade: 1, result: 0 }); Grade.onRemove(); expect(vi.getTimerCount()).toBe(0);
});

it('allows retry when the request could not be sent', () => {
 offer(); click('.material_slot1'); click('.start_grade');
 s.send.mockReturnValueOnce(false); s.confirm();
 expect(root().querySelector('.start_grade').disabled).toBe(false);
 click('.start_grade'); s.confirm(); expect(s.send).toHaveBeenCalledTimes(2);
});

it('updates inventory if a result arrives after the window is removed', () => {
 offer(); Grade.remove(); s.hooks.result({ index: 2, grade: 1, result: 0 });
 expect(s.items.find(i => i.index === 2)).toMatchObject({ enchantgrade: 1, RefiningLevel: 0 });
 expect(vi.getTimerCount()).toBe(0);
});

it('explains zero chance immediately and preserves the explanation when selecting materials', () => {
 s.items[0].RefiningLevel = 0; s.items[0].enchantgrade = 1;
 offer(2, 0);
 expect(root().querySelector('.notification_container').textContent).toContain('当前精炼 +0 不满足升阶条件');
 click('.material_slot2');
 expect(root().querySelector('.notification_container').textContent).toContain('先提高精炼等级');
 expect(root().querySelector('.start_grade').disabled).toBe(true);
});
