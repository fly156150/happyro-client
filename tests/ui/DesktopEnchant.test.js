import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ items: [], group: null, send: vi.fn(), result: null, session: { zeny: 1000 } }));
vi.mock('UI/Platform.js', () => ({ default: { isMobile: false } }));
vi.mock('UI/Game/GameEnchant.js', () => ({ openGameEnchant: vi.fn(), finishGameEnchant: vi.fn() }));
vi.mock('DB/DBManager.js', () => ({ default: {
 getEnchantGroup: () => state.group, getItemInfo: id => ({ slotCount: id === 610039 ? 2 : 0 }),
 getBasefromItemID: id => state.bases?.[id] || String(id), getItemIdfromBase: Number,
 getItemName: item => String(item.ITID), getItemIcon: () => '', getItemIllustration: () => '',
 getMessage: () => '附魔结果', INTERFACE_PATH: ''
} }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn(), loadFiles: vi.fn() } }));
vi.mock('DB/Effects/EffectTable.js', () => ({ default: {} }));
vi.mock('DB/Effects/EffectConst.js', () => ({ default: {} }));
vi.mock('Renderer/Camera.js', () => ({ default: {} }));
vi.mock('Renderer/Renderer.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/StrEffect.js', () => ({ default: {} }));
vi.mock('Utils/WebGL.js', () => ({ default: {} }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: state.send, hookPacket: (_type, fn) => { state.result = fn; } } }));
vi.mock('Network/PacketStructure.js', () => ({ default: {
 CZ: Object.fromEntries(['REQUEST_RANDOM_ENCHANT','REQUEST_PERFECT_ENCHANT','REQUEST_UPGRADE_ENCHANT','REQUEST_RESET_ENCHANT','CLOSE_UI_ENCHANT'].map(type => [type, class { constructor() { this.type = type; } }])),
 ZC: { RESPONSE_ENCHANT: class {} }
} }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: value => value, showErrorBox: vi.fn() } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
 static processDataAttrs() {}
 constructor() { this.ui = { css() {}, show() {}, is: () => false }; }
 draggable() {} focus() {} append() {} remove() { this.onRemove?.(); }
} }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: { addText: vi.fn(), TYPE: { BLUE: 1 }, FILTER: { PUBLIC_LOG: 1 } } }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: { getUI: () => ({
 list: state.items, getItemByIndex: index => state.items.find(item => item.index === index),
 getItemById: id => state.items.find(item => item.ITID === id)
}) } }));
import Enchant from '../../src/UI/Components/Enchant/Enchant.js';
const root = () => Enchant._host;
const click = selector => root().querySelector(selector).click();
beforeEach(() => {
 vi.clearAllMocks(); state.session.zeny = 1000;
	state.bases = null;
 state.items = [2,3].map(index => ({ index, ITID: 610039, RefiningLevel: 0, IsIdentified: true, slot: { card1: 0, card2: 0, card3: 0, card4: 0 } }));
 state.items.push({ index: 4, ITID: 501, count: 3 });
 state.group = { targetItems: [{ id: 610039 }], condition: { minRefine: 0, minGrade: 0 }, allowRandomOption: true, slotOrder: [3,2], slots: {
  3: { random: { 0: [{ id: 4001 }] }, successRate: 100000, require: { zeny: 100, materials: [{ id: 501, count: 2 }] } },
  2: { random: { 0: [{ id: 4002 }] }, successRate: 100000, require: { zeny: 100, materials: [] } }
 }, reset: { enabled: true, rate: 100000, zeny: 100, materials: [] } };
 Enchant._host = document.createElement('div'); Enchant._host.innerHTML = Enchant.render(); Enchant._shadow = null;
 Enchant.init(); Enchant.onOpenEnchantUI(33); Enchant.onRequestItemEnchant(state.items[0]);
});
it('locks the selected equipment and sends only one request until the result', () => {
 click('.action_btn');
 Enchant.onRequestItemEnchant(state.items[1]);
 click('.action_btn');
 expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'REQUEST_RANDOM_ENCHANT', index: 2 }));
 state.result({ msgId: 3857, ITID: 4001 });
 expect(state.items[0].slot.card4).toBe(4001);
 expect(state.items[1].slot.card4).toBe(0);
});
it.each(['materials', 'zeny', 'equipment'])('rechecks %s at submission instead of leaving a rejected request pending', change => {
 if (change === 'materials') state.items[2].count = 0;
 if (change === 'zeny') state.session.zeny = 0;
 if (change === 'equipment') state.items[0].WearState = 2;
 click('.action_btn'); expect(state.send).not.toHaveBeenCalled();
 click('.close'); expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'CLOSE_UI_ENCHANT' }));
});
it('leaves slots unchanged after a failed random enchant', () => {
 click('.action_btn'); state.result({ msgId: 3856, ITID: 0 });
 expect(state.items[0].slot.card4).toBe(0);
});
it('unlocks controls when reopening after a server result', () => {
 click('.action_btn'); state.result({ msgId: 3857, ITID: 4001 });
 Enchant.onOpenEnchantUI(33); Enchant.onRequestItemEnchant(state.items[0]);
 expect(root().querySelector('.perfect_select').disabled).toBe(false);
 expect(root().querySelector('.tab[data-action="random"]').disabled).toBe(false);
 click('.action_btn'); expect(state.send).toHaveBeenCalledTimes(2);
 state.result({ msgId: 3857, ITID: 4002 }); expect(state.items[0].slot.card3).toBe(4002);
});

it('runs real OSAD perfect, upgrade and reset selections while preserving card slots', async () => {
 const { default: catalog } = await import('../../src/DB/Items/ItemServices.json');
 state.group = catalog.enchant['33'];
 state.bases = Object.fromEntries(Object.entries(catalog.items).map(([id, value]) => [id, value.base]));
 state.session.zeny = 5000000;
 state.items[0].slot.card1 = 4001; state.items[0].slot.card2 = 4002;
 state.items.push({ index: 5, ITID: 25669, count: 100 }, { index: 6, ITID: 25723, count: 100 });
 Enchant.onOpenEnchantUI(33); Enchant.onRequestItemEnchant(state.items[0]);
 const select = root().querySelector('.perfect_select'); select.value = 'Sharp1'; select.dispatchEvent(new Event('change'));
 click('.action_btn');
 expect(state.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'REQUEST_PERFECT_ENCHANT', ITID: 4818, index: 2 }));
 state.result({ msgId: 3857, ITID: 4818 });
 expect(state.items[0].slot.card4).toBe(4818);
 Enchant.onOpenEnchantUI(33); Enchant.onRequestItemEnchant(state.items[0]); click('.tab[data-action="upgrade"]'); click('.action_btn');
 expect(state.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'REQUEST_UPGRADE_ENCHANT', slot: 3, index: 2 }));
 state.result({ msgId: 3857, ITID: 4817 });
 expect(state.items[0].slot.card4).toBe(4817);
 Enchant.onOpenEnchantUI(33); Enchant.onRequestItemEnchant(state.items[0]); click('.tab[data-action="reset"]'); click('.action_btn');
 expect(state.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'REQUEST_RESET_ENCHANT', index: 2 }));
 state.result({ msgId: 3857, ITID: 0 });
 expect(state.items[0].slot).toEqual({ card1: 4001, card2: 4002, card3: 0, card4: 0 });
});
