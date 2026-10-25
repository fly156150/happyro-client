import { expect, it, vi } from 'vitest';
vi.mock('UI/Components/Navigation/NaviActionService.js', () => ({ prepareNaviLinks:vi.fn(), isNaviAvailable:vi.fn(()=>true),  handleNaviClick: vi.fn() }));
import { createInventoryPanel } from '../../src/UI/Mobile/game/InventoryPanel.js';
it('supports category dropdowns, exact-index actions, live server updates and shortcut confirmation without losing selection', () => {
 const body = document.body.appendChild(document.createElement('div'));
 let items = [{ index: 2, ID: 501, name: '药水', count: 3, category: 'usable', descriptionMarkup: '<img onerror=alert(1)>', action: 'use', reason: '', identified: true, shortcut: true }, { index: 3, ID: 1201, name: '短剑', count: 1, category: 'equipment', action: 'equip', reason: '', identified: true, shortcut: true }];
 const actions = { preview: vi.fn(async () => ({ image: '', art: '' })), snapshot: () => items, act: vi.fn(() => ''), bind: vi.fn(() => true), shortcuts: () => ({ page: 1, pages: 8, total: 36, slots: [{ index: 5 }] }), slotName: () => '旧技能' };
 const panel = createInventoryPanel(body, actions);
 const category = value => { const select = body.querySelector('[aria-label="背包分类"]'); select.value = value; select.dispatchEvent(new Event('change')); };
 const click = text => [...body.querySelectorAll('button')].find(b => b.textContent === text).click();
 body.querySelector('[data-index="2"]').click(); expect(body.querySelector('.item-description img')).toBeNull(); click('使用'); expect(actions.act).not.toHaveBeenCalled(); body.querySelector('dialog [data-confirm]').click(); expect(actions.act).toHaveBeenCalledExactlyOnceWith(2, 501, 'use');
 const original = body.querySelector('[data-index="2"]'); items[0].count = 2; panel.update(); expect(body.querySelector('[data-index="2"]')).toBe(original); expect(original.textContent).toContain('×2');
 expect(body.querySelector('.inventory-detail').lastElementChild.classList.contains('inventory-actions')).toBe(true);
 const description = body.querySelector('.item-description');
 click('设置快捷键'); expect(body.querySelector('.item-description')).toBe(description); expect(body.querySelector('dialog').open).toBe(true); expect(body.querySelector('[aria-label="位置"]').value).toBe('5'); body.querySelector('[aria-label="位置"]').value = '35'; panel.update(); expect(body.querySelector('[aria-label="位置"]').value).toBe('35'); click('确认'); expect(actions.bind).toHaveBeenCalledExactlyOnceWith(2, 501, 35);
 category('equipment'); expect(body.querySelector('[data-index="2"]')).toBeNull(); body.querySelector('[data-index="3"]').click(); click('穿戴'); expect(body.querySelector('dialog')).toBeNull(); expect(actions.act).toHaveBeenLastCalledWith(3, 1201, 'equip');
 items[1] = { ...items[1], worn: true, action: 'unequip', shortcut: false }; panel.update(); category('worn'); click('卸下'); expect(body.querySelector('dialog')).toBeNull(); expect(actions.act).toHaveBeenLastCalledWith(3, 1201, 'unequip');
 items = []; panel.update(); expect(body.textContent).toContain('暂无物品'); expect(body.querySelector('.inventory-detail').textContent).toContain('点击物品');
});

it('adjusts discard quantity within the stack and packet limits before confirming', () => {
 const body = document.body.appendChild(document.createElement('div'));
 const item = { index: 2, ID: 501, name: '药水', count: 70000, category: 'usable', identified: true };
 const actions = { preview: vi.fn(async () => ({ image: '', art: '' })), snapshot: () => [item], drop: vi.fn(() => '') };
 createInventoryPanel(body, actions);
 body.querySelector('[data-index="2"]').click();
 [...body.querySelectorAll('button')].find(b => b.textContent === '丢弃').click();
 const quantity = body.querySelector('[aria-label="丢弃数量"]');
 const press = label => body.querySelector(`[aria-label="${label}"]`).click();
 press('减少数量'); expect(quantity.value).toBe('1');
 press('增加数量'); expect(quantity.value).toBe('2');
 press('最大数量'); expect(quantity.value).toBe('65535');
 press('增加数量'); expect(quantity.value).toBe('65535');
 quantity.value = ''; press('增加数量'); expect(quantity.value).toBe('2');
 quantity.value = '8'; press('减少数量'); expect(quantity.value).toBe('7');
 body.querySelector('[data-confirm]').click();
 expect(actions.drop).toHaveBeenCalledExactlyOnceWith(2, 501, 7);
});

it('ignores stale image loads and displays the selected illustration directly without item actions', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 const items = [1,2].map(index => ({ index, ID: index, name: `物品${index}`, count: 1, identified: true, worn: true }));
 const pending = [];
 createInventoryPanel(body, { snapshot: () => items, preview: () => new Promise(resolve => pending.push(resolve)) });
 body.querySelector('[data-index="1"]').click();
 body.querySelector('[data-index="2"]').click();
 pending[0]({ image: 'old.bmp', art: 'old-card.bmp' });
 await Promise.resolve();
 expect(body.querySelector('.inventory-item-picture')).toBeNull();
 pending[1]({ image: 'new.bmp', art: 'new-card.bmp' });
 await Promise.resolve();
 expect(body.querySelector('.inventory-item-picture').getAttribute('src')).toBe('new-card.bmp');
 expect(body.querySelector('.inventory-item-picture').classList.contains('is-illustration')).toBe(true);
 expect(body.querySelector('.inventory-picture-action')).toBeNull();
 expect(body.querySelector('dialog')).toBeNull();
 body.querySelector('[data-index="1"]').click();
 expect(body.querySelector('.inventory-item-picture')).toBeNull();
});

it('moves numeric weight and count below the picture without removing descriptive text',async()=>{
 const body=document.body.appendChild(document.createElement('div'));
 const item={index:1,ID:1,name:'材料',count:12,identified:true,worn:true,reason:'此物品没有直接使用操作',descriptionMarkup:'制作材料\n数量：999\n重量 : 3.5\n携带重量增加 10%。'};
 createInventoryPanel(body,{snapshot:()=>[item],preview:async()=>({image:'material.bmp'})});
 body.querySelector('[data-index="1"]').click();await Promise.resolve();
 const media=body.querySelector('.inventory-item-media');
 expect(media.firstElementChild.tagName).toBe('IMG');
 expect(media.textContent).toBe('数量：12重量：3.5');
 expect(body.querySelector('.item-description').textContent).toBe('制作材料\n携带重量增加 10%。');
 expect(body.textContent).not.toContain('此物品没有直接使用操作');
 expect(body.querySelector('.inventory-item-summary').textContent).toContain('已穿戴');
});

it('filters detailed item types and resets scroll when switching categories', () => {
 const body = document.body.appendChild(document.createElement('div'));
 const types = [5,4,6,10,7,8,12,3];
 const items = types.map((type,index)=>({index,ID:index+1,type,name:`物品${index}`,count:1,category:'other'}));
 createInventoryPanel(body,{snapshot:()=>items});
 const select=body.querySelector('[aria-label="背包分类"]');
 const list=body.querySelector('.inventory-list');
 for(const [category,indices] of [['weapon',[0]],['armor',[1]],['card',[2]],['ammo',[3]],['pet',[4,5]],['shadow',[6]],['all',[0,1,2,3,4,5,6,7]]]) {
  list.scrollTop=100;select.value=category;select.dispatchEvent(new Event('change'));
  expect([...list.querySelectorAll('[data-index]')].map(node=>Number(node.dataset.index))).toEqual(indices);
  expect(list.scrollTop).toBe(0);
 }
});

it('shows inserted cards and enchants and refreshes them from the equipment state',()=>{
 const body=document.body.appendChild(document.createElement('div'));
 const item={index:1,ID:100,name:'装备',count:1,identified:true,worn:true,sockets:[{kind:'card',slot:1,name:'卡片',descriptionMarkup:'攻击 +10'},{kind:'enchant',slot:4,name:'锐利',descriptionMarkup:'暴击 +6'}]};
 const panel=createInventoryPanel(body,{snapshot:()=>[item],preview:async()=>null});
 body.querySelector('[data-index="1"]').click();
 expect([...body.querySelectorAll('.inventory-sockets h4')].map(e=>e.textContent)).toEqual(['已插卡片','附魔']);
 expect(body.querySelectorAll('.inventory-sockets details')).toHaveLength(2);
 expect(body.querySelector('.inventory-sockets details p').textContent).toBe('攻击 +10');
 item.sockets=[];panel.update();expect(body.querySelector('.inventory-sockets')).toBeNull();
});

it('keeps the empty selection DOM stable across repeated inventory refreshes', () => {
 const body=document.body.appendChild(document.createElement('div'));
 const items=Array.from({length:80},(_,i)=>({index:i+1,ID:501,name:`物品${i}`,count:1,identified:true}));
 const panel=createInventoryPanel(body,{snapshot:()=>items,preview:async()=>null});
 const detail=body.querySelector('.inventory-detail');const children=[...detail.childNodes];
 const list=body.querySelector('.inventory-list');const rows=[...list.children];list.scrollTop=1000;
 for(let i=0;i<20;i++)panel.update();
 expect([...detail.childNodes]).toEqual(children);expect([...list.children]).toEqual(rows);expect(list.scrollTop).toBe(1000);
 rows[0].click();items.splice(0,1);panel.update();
 const empty=[...detail.childNodes];panel.update();expect([...detail.childNodes]).toEqual(empty);
});
