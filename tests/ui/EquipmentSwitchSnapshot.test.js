import rawCommon from '../../src/UI/Components/Inventory/InventoryCommon.js?raw';
import { describe, expect, it, vi } from 'vitest';
const common = rawCommon.replace(/\r\n/g, '\n');
function productionMethod(name, dependencies, indent = 2) {
 const start = common.indexOf(`Component.${name} = function`);
 const end = common.indexOf('\n' + '\t'.repeat(indent) + '};', start);
 const code = common.slice(common.indexOf('function', start), end + indent + 2);
 return new Function(...Object.keys(dependencies), `return (${code});`)(...Object.values(dependencies));
}
function fixture() {
 const root = document.createElement('div');
 root.innerHTML = '<div class="item" data-index="2"><i class="switch1"></i><i class="switch2"></i></div>';
 const callbacks = [];
 const SwitchEquip = {
  _list: { old: {} },
  clearItems: vi.fn(() => { SwitchEquip._list = {}; }),
  equip: vi.fn(item => { SwitchEquip._list[item.index] = item; }),
  unEquip: vi.fn(index => { delete SwitchEquip._list[index]; })
 };
 const Equipment = { getUI: () => ({ equipItemsToSwitch: () => { SwitchEquip._list.worn = { index: 1 }; } }) };
 const ChatBox = { addText: vi.fn(), TYPE: { BLUE: 1 }, FILTER: { ITEM: 1 } };
 const inventory = { equipswitchlist: [], getRoot: () => root, getItemByIndex: index => index === 2 ? { index: 2, ITID: 1201 } : null };
 const dependencies = { Component: inventory, Equipment, SwitchEquip, ChatBox,
  Client: { loadFile: (_path, callback) => callbacks.push(callback) },
  DB: { INTERFACE_PATH: '', getItemName: () => '短剑', getMessage: () => '切换配置' } };
 inventory.setSwitchItems = productionMethod('setSwitchItems', dependencies);
 inventory.addItemtoSwitch = productionMethod('addItemtoSwitch', dependencies);
 return { inventory, root, SwitchEquip, ChatBox, callbacks };
}
describe('complete equipment-switch snapshots', () => {
 it('replaces old entries, preserves the worn preview and ignores absent inventory indices', () => {
  const { inventory, SwitchEquip, ChatBox } = fixture();
  inventory.equipswitchlist.push({ index: 99, location: 2 });
  inventory.setSwitchItems([{ index: 2, location: 32 }, { index: 99, location: 2 }]);
  expect(inventory.equipswitchlist.map(item => [item.index, item.location])).toEqual([[2, 32]]);
  expect(Object.keys(SwitchEquip._list).sort()).toEqual(['2', 'worn']);
  expect(ChatBox.addText).not.toHaveBeenCalled();
 });
 it('clears an empty snapshot and rejects late marker callbacks from the previous snapshot', () => {
  const { inventory, root, SwitchEquip, callbacks } = fixture();
  inventory.setSwitchItems([{ index: 2, location: 32 }]);
  inventory.setSwitchItems([]);
  callbacks.forEach(callback => callback('old-image'));
  expect(inventory.equipswitchlist).toEqual([]);
  expect(Object.keys(SwitchEquip._list)).toEqual(['worn']);
  for (const marker of root.querySelectorAll('i')) expect(marker.style.backgroundImage).toBe('none');
 });
 it('still reports an individual equip-switch action', () => {
  const { inventory, ChatBox } = fixture();
  inventory.addItemtoSwitch(2, 32);
  expect(ChatBox.addText).toHaveBeenCalledOnce();
 });
});

 it('redraws switch markers using the selected slot and ignores obsolete redraw callbacks', () => {
  const { inventory, root, SwitchEquip } = fixture();
  root.innerHTML = '<div class="container"><div class="content"></div></div>';
  const callbacks = [];
  const selected = { index: 2, ITID: 1201, location: 32 };
  inventory.equipswitchlist = [selected];
  inventory.isNewItem = () => false;
  inventory.addItemSub = productionMethod('addItemSub', {
   Component: inventory, Equipment: {}, SwitchEquip,
   getItemTab: () => 1, favoriteTab: false, equipSwitch: true, enchantGrade: false,
   _preferences: { tab: 1 }, ItemType: {},
   Client: { loadFile: (path, callback) => { if (path.includes('swap_equipment')) callbacks.push(callback); } },
   DB: { INTERFACE_PATH: '', getItemInfo: () => ({ identifiedResourceName: 'dagger' }) }
  }, 1);
  inventory.addItemSub({ index: 2, ITID: 1201, location: 34, IsIdentified: true });
  expect(SwitchEquip.equip).toHaveBeenLastCalledWith(selected, 32, true);
  callbacks.forEach(callback => callback('current.bmp'));
  expect(root.querySelector('.switch1').style.backgroundImage).toContain('current.bmp');
  inventory.setSwitchItems([]);
  callbacks.forEach(callback => callback('obsolete.bmp'));
  expect(root.querySelector('.switch1').style.backgroundImage).toBe('none');
 });

 it('removes the selected switch slot rather than the item permission mask', () => {
  const { inventory, SwitchEquip, ChatBox } = fixture();
  const worn = { equipItemsToSwitch: vi.fn() };
  inventory.getItemByIndex = () => ({ index: 2, ITID: 1201, location: 34 });
  inventory.equipswitchlist = [{ index: 2, ITID: 1201, location: 32 }];
  inventory.equipAllFromSwitchList = vi.fn();
  inventory.removeItemFromSwitch = productionMethod('removeItemFromSwitch', {
   Component: inventory, SwitchEquip, Equipment: { getUI: () => worn }, ChatBox,
   DB: { getItemName: () => '短剑', getMessage: () => '移除配置' }
  });
  inventory.removeItemFromSwitch(2);
  expect(SwitchEquip.unEquip).toHaveBeenCalledWith(2, 32);
  expect(inventory.equipswitchlist).toEqual([]);
 });
