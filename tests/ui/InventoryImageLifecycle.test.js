import { expect, it, vi } from 'vitest';
import rawInventory from '../../src/UI/Components/Inventory/InventoryCommon.js?raw';
import rawEquipment from '../../src/UI/Components/Equipment/EquipmentCommon.js?raw';

// Run the production render methods with controllable image completion order.
function method(raw, name, dependencies) {
 const source = raw.replace(/\r\n/g, '\n');
 const start = source.indexOf(`Component.${name} = function`);
 const end = source.indexOf('\n\t};', start);
 return new Function(...Object.keys(dependencies), `return (${source.slice(source.indexOf('function', start), end + 3)});`)(...Object.values(dependencies));
}
function resources() {
 const callbacks = [];
 return {
  callbacks,
  Client: { loadFile: (path, callback) => callbacks.push({ path, callback }) },
  DB: {
   INTERFACE_PATH: '',
   getItemInfo: id => ({ identifiedResourceName: `item${id}`, unidentifiedResourceName: 'unknown' }),
   getItemName: item => `装备${item.ITID}`,
  },
 };
}

it('keeps new inventory icons and grades when a refreshed snapshot reuses an index', () => {
 const root = document.createElement('div');
 root.innerHTML = '<div class="container"><div class="content"></div></div>';
 const image = resources();
 const inventory = { getRoot: () => root, isNewItem: vi.fn(() => false) };
 inventory.addItemSub = method(rawInventory, 'addItemSub', {
  Component: inventory, ...image, getItemTab: () => 1, favoriteTab: false,
  equipSwitch: false, enchantGrade: true, _preferences: { tab: 1 }, ItemType: {},
 });
 inventory.addItemSub({ index: 2, ITID: 1, IsIdentified: true, enchantgrade: 1 });
 const stale = image.callbacks.splice(0);
 root.querySelector('.content').replaceChildren();
 inventory.addItemSub({ index: 2, ITID: 2, IsIdentified: true, enchantgrade: 2 });
 image.callbacks.forEach(({ callback }) => callback('new.bmp'));
 stale.forEach(({ callback }) => callback('old.bmp'));
 for (const selector of ['.icon', '.grade']) {
  expect(root.querySelector(selector).style.backgroundImage).toContain('new.bmp');
 }
});

it('does not restore an unread-item badge after it was cleared while the image loaded', () => {
 const root = document.createElement('div');
 root.innerHTML = '<div class="container"><div class="content"></div></div>';
 const image = resources();
 const inventory = { getRoot: () => root, isNewItem: vi.fn(() => true) };
 inventory.addItemSub = method(rawInventory, 'addItemSub', {
  Component: inventory, ...image, getItemTab: () => 1, favoriteTab: false,
  equipSwitch: false, enchantGrade: false, _preferences: { tab: 1 }, ItemType: {},
 });
 inventory.addItemSub({ index: 2, ITID: 1, IsIdentified: true });
 inventory.isNewItem.mockReturnValue(false);
 image.callbacks.find(({ path }) => path.endsWith('new_item.bmp')).callback('badge.bmp');
 expect(root.querySelector('.new_item').style.backgroundImage).toBe('');
});

it('keeps the latest equipment images even when the same item object is redrawn', () => {
 const root = document.createElement('div');
 root.innerHTML = '<div class="col1 left"></div><div class="col3 right"></div>';
 const image = resources();
 const equipment = { getRoot: () => root };
 equipment.equip = method(rawEquipment, 'equip', {
  Component: equipment, ...image, entityRender: true, _list: {},
  enchantGrade: true, switchEquip: false, escapeHTML: text => text,
  Inventory: { getUI: () => ({ equippedItems: [] }) },
  getSelectorFromLocation: () => '.left, .right',
 });
 const item = { index: 2, ITID: 1, enchantgrade: 1 };
 equipment.equip(item, 34);
 const stale = image.callbacks.splice(0);
 item.ITID = 2;
 item.enchantgrade = 2;
 equipment.equip(item, 34);
 image.callbacks.forEach(({ callback }) => callback('new.bmp'));
 stale.forEach(({ callback }) => callback('old.bmp'));
 expect(root.querySelectorAll('button')).toHaveLength(2);
 for (const element of root.querySelectorAll('button, .grade')) {
  expect(element.style.backgroundImage).toContain('new.bmp');
 }
});

it('does not restore the unread badge for a stack increment after marking it read', () => {
 const root = document.createElement('div');
 root.innerHTML = '<div class="item" data-index="2"><div class="new_item"></div><span class="count">1</span></div>';
 const image = resources();
 const item = { index: 2, ITID: 1, count: 1 };
 const inventory = {
  getRoot: () => root, getItemByIndex: () => item, newItems: [], equippedItems: [],
  onUpdateItem: vi.fn(), isNewItem: index => inventory.newItems.includes(index),
 };
 inventory.addItem = method(rawInventory, 'addItem', {
  Component: inventory, ...image, getItemTab: () => 1, _preferences: { tab: 1 },
  BasicInfo: { getUI: () => ({}) }, refineEnchant: false,
 });
 inventory.addItem({ index: 2, ITID: 1, count: 1 });
 expect(item.count).toBe(2);
 inventory.newItems.length = 0;
 image.callbacks.find(({ path }) => path.endsWith('new_item.bmp')).callback('badge.bmp');
 expect(root.querySelector('.new_item').style.backgroundImage).toBe('');
});
