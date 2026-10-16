import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const listSource = readFileSync('src/UI/Components/MakeItemSelection/ItemListWindowSelection.js', 'utf8').replaceAll('\r\n', '\n');
const convertSource = readFileSync('src/UI/Components/MakeItemSelection/ItemConvertSelection/ConvertItems.js', 'utf8').replaceAll('\r\n', '\n');
function method(source, object, name) {
 const start = source.indexOf(`${object}.${name} = function`);
 if (start < 0) throw new Error(`Missing ${object}.${name}`);
 return source.slice(start, source.indexOf('\n};', start) + 3);
}
function setup() {
 const root = { querySelector: vi.fn(() => ({ innerHTML: '', textContent: '', remove: vi.fn() })) };
 const list = { getRoot: () => root, addItem: vi.fn(), append: vi.fn(), setTitle: vi.fn(), remove: vi.fn(), onItemListWindowSelected: vi.fn() };
 const convert = { setTitle: vi.fn(), remove: vi.fn(), material: [{ index: 2, count: 3 }] };
 const modal = { remove: vi.fn() };
 const code = ['open', 'setList', 'removeItem'].map(name => method(listSource, 'ItemListWindowSelection', name)).join('\n') + method(convertSource, 'ConvertItems', 'validItemSend');
 new Function('ItemListWindowSelection', 'ConvertItems', 'MakeModelMessage', 'getItemIndexById', code)(list, convert, modal, index => list.list.findIndex(item => item.index === index));
 return { list, convert };
}
describe('desktop material selection', () => {
 it('keeps inventory quantities and entries intact while moving selected materials', () => {
  const inventory = [{ index: 2, ITID: 501, count: 10 }, { index: 3, ITID: 502, count: 1 }];
  const { list } = setup();
  list.setList(inventory);
  list.removeItem(2, 4);
  list.removeItem(3, 1);
  expect(list.list).toEqual([{ index: 2, ITID: 501, count: 6 }]);
  expect(inventory).toEqual([{ index: 2, ITID: 501, count: 10 }, { index: 3, ITID: 502, count: 1 }]);
 });
 it.each([0, 1, 2])('retains server mode %s on confirm and cancel', type => {
  for (const confirm of [true, false]) {
   const { list, convert } = setup();
   list.open(type);
   expect(list.append).toHaveBeenCalledOnce();
   expect(list.setTitle).toHaveBeenCalledWith(type === 0 ? '材料转换' : type === 1 ? '元素分析：纯矿转原石' : '元素分析：原石转纯矿');
   convert.validItemSend(confirm);
   expect(list.onItemListWindowSelected).toHaveBeenCalledExactlyOnceWith({ Type: type, Action: confirm ? 1 : 0, MaterialList: confirm ? [{ index: 2, count: 3 }] : [] });
  }
 });
});
