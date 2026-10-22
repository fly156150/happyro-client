import {createMobileInputEditor} from '../../src/UI/Mobile/game/MobileInputEditor.js';
import { afterEach, expect, it, vi } from 'vitest';
import { createMaterialsPanel } from '../../src/UI/Mobile/game/MaterialsPanel.js';
import { createRefinementPanel } from '../../src/UI/Mobile/game/RefinementPanel.js';
import { createEnchantPanel } from '../../src/UI/Mobile/game/EnchantPanel.js';
import { createSelectionPanel } from '../../src/UI/Mobile/game/SelectionPanel.js';
import { createTradePanel } from '../../src/UI/Mobile/game/TradePanel.js';
import { createVendingPanel } from '../../src/UI/Mobile/game/VendingPanel.js';
import { createContainerPanel } from '../../src/UI/Mobile/game/ContainerPanel.js';
const editors = [];
const mount = () => {
 const host = document.body.appendChild(document.createElement('div'));
 const body = host.attachShadow({mode:'open'}).appendChild(document.createElement('div'));
 editors.push(createMobileInputEditor(host));
 return body;
};
const editor = () => document.querySelector('[data-mobile-input-editor]')?.shadowRoot;
const item = {
	index: 1,
	ID: 501,
	id: 1,
	identity: 'one',
	name: '红色药水',
	count: 20,
	description: '说明',
	quantity: 2,
	price: 10
};
const button = (body, text) => [...body.querySelectorAll('button')].find(b => b.textContent === text);
const input = (field, value) => {
	field.value = value;
	field.dispatchEvent(new Event('input', { bubbles: true }));
};
afterEach(() => {
 for (const dispose of editors.splice(0)) dispose();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});
it('preserves material drafts during refresh, blocks unreviewed edits, and rejects changed orders', () => {
	const body = mount(),
		state = {
			items: [item, { ...item, index: 2 }],
			order: [{ ...item, count: 2, description: '改造结果' }],
			allowed: true
		};
	const service = { snapshot: () => state, set: vi.fn(() => ''), clear: vi.fn(), confirm: vi.fn() };
	const panel = createMaterialsPanel(body, service);
	body.querySelector('.inventory-item').click();
	const field = body.querySelector('input');
	input(field, '3');
	state.items[0] = { ...item, count: 10 };
	panel.update();
	expect(body.querySelector('input')).toBe(field);
	expect(field.max).toBe('10');
	body.querySelectorAll('.inventory-item')[1].click();
	expect(body.querySelector('input')).toBe(field);
	button(body, '核对材料').click();
	expect(body.querySelector('dialog')).toBeNull();
	button(body, '撤销修改').click();
	button(body, '核对材料').click();
	expect(body.querySelector('dialog').textContent).toContain('改造结果');
	state.order = [];
	body.querySelector('[data-confirm]').click();
	expect(service.confirm).not.toHaveBeenCalled();
	state.allowed = false;
	panel.update();
	expect(field.disabled).toBe(true);
});
it('keeps refinement material and optional protection through refresh without requiring protection', () => {
	const body = mount(),
		state = {
			items: [item],
			selected: { index: 1, ID: 501 },
			allowed: true,
			kind: 'refine',
			offer: { blacksmithBlessing: 2 },
			zeny: 2000,
			materials: [
				{ index: 0, name: '普通矿石', owned: 3, zeny: 100, chance: 70 },
				{ index: 1, name: '高级矿石', owned: 4, zeny: 1000, chance: 90 }
			]
		};
	const service = { snapshot: () => state, confirm: vi.fn(() => ''), select: vi.fn() };
	const panel = createRefinementPanel(body, service);
	body.querySelector('select').value = '1';
	body.querySelector('input').checked = true;
	state.zeny = 3000;
	panel.update();
	expect(body.querySelector('select').value).toBe('1');
	expect(body.querySelector('input').checked).toBe(true);
	body.querySelector('input').checked = false;
	button(body, '下一步').click();
	expect(body.querySelector('dialog').textContent).toContain('1000 Z');
	body.querySelector('[data-confirm]').click();
	expect(service.confirm).toHaveBeenCalledWith(1, 0);
	button(body, '下一步').click();
	state.materials[1].zeny = 2000;
	body.querySelector('[data-confirm]').click();
	expect(service.confirm).toHaveBeenCalledTimes(1);
});
it('keeps enchant choice for current equipment but clears it when equipment changes', () => {
	const body = mount(),
		state = {
			items: [item],
			selected: { index: 1, ID: 501 },
			allowed: true,
			choices: [{ key: 'a', name: '附魔', rate: 100000, zeny: 100, materials: [], results: ['力量 + 3'] }]
		};
	const panel = createEnchantPanel(body, { snapshot: () => state, confirm: vi.fn() });
	let select = body.querySelector('select');
	select.value = 'a';
	select.dispatchEvent(new Event('change'));
	state.allowed = false;
	panel.update();
	expect(body.querySelector('select').value).toBe('a');
	expect(body.querySelector('select').disabled).toBe(true);
	state.allowed = true;
	state.selected = { index: 2, ID: 502 };
	panel.update();
	expect(body.querySelector('select').value).toBe('');
});
it('preserves smithing materials only for the same recipe and refreshes material availability', () => {
	const body = mount(),
		state = {
			entries: [
				{ id: 1, name: '武器一', materials: true },
				{ id: 2, name: '武器二', materials: true }
			],
			materials: [{ id: 1000, name: '材料', count: 3 }],
			allowed: true
		};
	const panel = createSelectionPanel(body, { snapshot: () => state, choose: vi.fn() });
	body.querySelector('.inventory-item').click();
	body.querySelector('select').value = '1000';
	state.materials[0].count = 2;
	panel.update();
	expect(body.querySelector('select').value).toBe('1000');
	expect(body.querySelector('select').textContent).toContain('× 2');
	body.querySelectorAll('.inventory-item')[1].click();
	expect(body.querySelector('select').value).toBe('0');
});
it('confirms money separately, blocks unsaved quantity and rejects changed final offers', () => {
	const body = mount(),
		state = {
			items: [item],
			money: 0,
			peerMoney: 20,
			balance: 1000,
			allowed: true,
			pending: false,
			ownLocked: false,
			peerLocked: false,
			offered: [{ ...item, count: 2 }],
			received: [{ ...item, name: '蓝色药水', count: 3 }],
			status: '交易'
		};
	const service = {
		snapshot: () => state,
		lock: vi.fn(),
		execute: vi.fn(),
		setMoney: vi.fn(),
		add: vi.fn(),
		cancel: vi.fn()
	};
	const panel = createTradePanel(body, service);
 body.querySelector('[data-send-money]').click();
 input(editor().querySelector('input'), '50');
 expect(service.setMoney).not.toHaveBeenCalled();
 editor().querySelector('[data-done]').click();
 expect(service.setMoney).toHaveBeenCalledExactlyOnceWith(50);
	body.querySelector('.inventory-item').click();
	const quantity = body.querySelector('[aria-label="交易数量"]');
	input(quantity, '5');
	panel.update();
	body.querySelector('[data-lock]').click();
	expect(service.lock).not.toHaveBeenCalled();
	expect(quantity.value).toBe('5');
	body.querySelector('dialog [data-cancel]').click();
	body.querySelector('[data-lock]').click();
	expect(service.lock).toHaveBeenCalledOnce();
	state.ownLocked = state.peerLocked = true;
	panel.update();
	body.querySelector('[data-execute]').click();
	expect(body.querySelector('dialog').textContent).toContain('蓝色药水 × 3');
	state.peerMoney = 30;
	body.querySelector('[data-confirm]').click();
	expect(service.execute).not.toHaveBeenCalled();
});
it('preserves vending price drafts and requires saving before opening a store', () => {
	const body = mount(),
		state = {
			items: [item],
			order: [{ ...item, count: 2 }],
			allowed: true,
			mode: 'sell',
			slots: 10,
			total: 20,
			money: 1000
		};
	const service = { snapshot: () => state, set: vi.fn(() => ''), submit: vi.fn(), close: vi.fn() };
	const panel = createVendingPanel(body, service);
 body.querySelector('.inventory-item').click();
 body.querySelector('[aria-label="加入摊位清单"]').click();
	const price = body.querySelector('[aria-label="单价"]');
	input(price, '30');
	state.items[0] = { ...item, count: 10 };
	panel.update();
	expect(body.querySelector('[aria-label="单价"]')).toBe(price);
	body.querySelector('[data-submit]').click();
 expect(editor()).toBeUndefined();
 expect(service.submit).not.toHaveBeenCalled();
 body.querySelector('dialog [data-confirm]').click();
 expect(service.set).toHaveBeenCalledWith(1, 'one', 3, 30);
 body.querySelector('[data-submit]').click();
 editor().querySelector('input').value = '商店';
 expect(service.submit).not.toHaveBeenCalled();
 editor().querySelector('[data-done]').click();
 expect(service.submit).toHaveBeenCalledExactlyOnceWith('商店', NaN);
});
it('updates transfer limits and destinations without discarding quantity edits', () => {
	const body = mount(),
		state = {
			items: [item],
			containers: ['inventory', 'storage', 'cart'],
			allowed: true,
			storageCapacity: { current: 1, limit: 600 },
			capacity: { current: 1, limit: 100 }
		};
	const service = { snapshot: () => state, setCapacity: vi.fn(), preview: vi.fn(async () => null), transfer: vi.fn() };
	const panel = createContainerPanel(body, service, 'storage');
 const destination = body.querySelector('[aria-label="背包或手推车"]');
 destination.value = 'cart'; destination.dispatchEvent(new Event('change'));
	body.querySelector('.inventory-item').click();
	const field = body.querySelector('.interaction-footer [aria-label="取出数量"]');
	expect(field).not.toBeNull();
	input(field, '15');
	state.items[0] = { ...item, count: 10 };
	state.containers = ['storage', 'cart'];
	panel.update();
	expect(body.querySelector('.container-transfer-target select').parentElement.hidden).toBe(true);
	expect(service.setCapacity).toHaveBeenLastCalledWith(state.storageCapacity);
	expect(field.value).toBe('15');
	expect(field.max).toBe('10');
	expect(body.querySelector('.container-transfer-target select').value).toBe('cart');
	button(body, '确认取出').click();
	expect(service.transfer).not.toHaveBeenCalled();
	body.querySelector('[aria-label="全部数量"]').click();
	button(body, '确认取出').click();
	expect(service.transfer).toHaveBeenCalledWith('storage', 'cart', 1, 501, 10, item.identity);
	state.allowed = false;
	panel.update();
	expect(button(body, '确认取出').disabled).toBe(true);
});

it('rejects an enchant confirmation when the selected equipment changed', () => {
	const body = mount(),
		state = {
			items: [item],
			selected: { index: 1, ID: 501 },
			allowed: true,
			choices: [{ key: 'a', name: '附魔', rate: 100000, zeny: 100, materials: [], results: [] }]
		};
	const service = { snapshot: () => state, confirm: vi.fn() };
	createEnchantPanel(body, service);
	const select = body.querySelector('select');
	select.value = 'a';
	select.dispatchEvent(new Event('change'));
	button(body, '核对附魔').click();
	state.selected = { index: 2, ID: 502 };
	body.querySelector('[data-confirm]').click();
	expect(service.confirm).not.toHaveBeenCalled();
});

it('filters warehouse selection and separates deposits from withdrawals', () => {
 const body = mount();
 const state = {items:[{...item,identity:'a',name:'红色药水',category:'usable'}],containers:['inventory','storage','cart'],allowed:true,capacity:{current:1,limit:600}};
 const service = {snapshot:vi.fn(() => state),setCapacity: vi.fn(), preview: vi.fn(async () => null), transfer:vi.fn()};
 const panel = createContainerPanel(body,service,'storage');
 body.querySelector('.inventory-item').click();
 expect(body.querySelector('.inventory-item').getAttribute('aria-pressed')).toBe('true');
 input(body.querySelector('[type=search]'),'不存在');
 expect(body.querySelector('.inventory-item')).toBeNull();
 expect(body.querySelector('.container-amount')).toBeNull();
 expect(body.querySelector('.container-empty').textContent).toContain('没有符合');
 input(body.querySelector('[type=search]'),'501');
 const mode=body.querySelector('[aria-label="存取操作"]');mode.value='deposit';mode.dispatchEvent(new Event('change'));
 expect(service.snapshot).toHaveBeenCalledWith('inventory');
 body.querySelector('.inventory-item').click();
 expect([...body.querySelector('.container-transfer-target select').options].map(o=>o.value)).toEqual(['storage']);
 expect(body.querySelector('.container-transfer-target select').parentElement.hidden).toBe(true);
 expect(body.querySelector('[aria-label="存入数量"]')).not.toBeNull();
 state.pending=true; panel.update();
 expect(button(body,'确认存入').disabled).toBe(true);
 state.pending=false; state.items[0].identity='b'; panel.update();
 expect(body.querySelector('.container-amount')).toBeNull();
});

it('filters container item types together with search and clears stale quantity controls', () => {
 const body=mount();
 const types=[5,4,6,10,7,8,12];
 const state={allowed:true,containers:['inventory','storage'],items:types.map((type,index)=>({...item,index,type,ID:500+index,name:`物品${index}`,category:'other'}))};
 createContainerPanel(body,{snapshot:()=>state,setCapacity: vi.fn(), preview: vi.fn(async () => null), transfer:vi.fn()},'storage');
 const category=body.querySelector('[aria-label="物品分类"]');
 for(const [key,count] of [['weapon',1],['armor',1],['card',1],['ammo',1],['pet',2],['shadow',1]]) {
  body.querySelector('.inventory-list').scrollTop=200;
  category.value=key; category.dispatchEvent(new Event('change'));
  expect(body.querySelector('.inventory-list').scrollTop).toBe(0);
  expect(body.querySelectorAll('.inventory-item')).toHaveLength(count);
 }
 body.querySelector('.inventory-item').click();
 expect(body.querySelector('.interaction-footer .container-amount')).not.toBeNull();
 input(body.querySelector('[type=search]'),'没有匹配');
 expect(body.querySelectorAll('.inventory-item')).toHaveLength(0);
 expect(body.querySelector('.container-amount')).toBeNull();
});

it('keeps selected material rows stable and protects drafts when selecting from the order', () => {
 const body=mount();
 const state={items:[item,{...item,index:2,ID:502}],order:[{...item,index:2,ID:502,count:4}],allowed:true};
 const service={snapshot:()=>state,set:vi.fn(()=>''),clear:vi.fn(),confirm:vi.fn()};
 const panel=createMaterialsPanel(body,service);
 const row=body.querySelector('.interaction-order-item');
 panel.update();expect(body.querySelector('.interaction-order-item')).toBe(row);
 row.click();expect(body.querySelector('input').value).toBe('4');
 input(body.querySelector('input'),'6');
 body.querySelector('.inventory-item').click();
 expect(body.querySelector('input').value).toBe('6');
 state.allowed=false;panel.update();expect(body.querySelector('.interaction-order-item').disabled).toBe(true);
});

it('moves cart quantities from the footer in both directions without offering unrelated storage', () => {
 const body=mount();
 const service={snapshot:source=>({items:[item],containers:['inventory','cart','storage'],allowed:true,capacity:source==='cart'?{current:1,limit:100,weight:10,maxWeight:8000}:null}),setCapacity: vi.fn(), preview: vi.fn(async () => null), transfer:vi.fn(()=> '')};
 createContainerPanel(body,service,'cart');
 body.querySelector('.inventory-item').click();
 const field=body.querySelector('[aria-label="取出数量"]');
 expect(field.closest('.interaction-footer')).not.toBeNull();
 expect([...body.querySelector('[aria-label="转移到"]').options].map(option=>option.value)).toEqual(['inventory']);
 field.value='3';button(body,'确认取出').click();
 expect(service.transfer).toHaveBeenLastCalledWith('cart','inventory',1,501,3,'one');
 button(body,'存入').click();body.querySelector('.inventory-item').click();
 body.querySelector('[aria-label="存入数量"]').value='5';button(body,'确认存入').click();
 expect(service.transfer).toHaveBeenLastCalledWith('inventory','cart',1,501,5,'one');
 expect(service.setCapacity).toHaveBeenLastCalledWith({current:1,limit:100,weight:10,maxWeight:8000});
});

it('loads refinement list icons and announces every result once including repeated outcomes', () => {
 const body = mount();
 const state = { items: [{ ...item, icon: '' }], allowed: true, selected: null, materials: [], resultId: 0 };
 const panel = createRefinementPanel(body, { snapshot: () => state });
 expect(body.querySelector('.inventory-item img').hidden).toBe(true);
 state.items[0].icon = 'data:image/png;base64,a';
 panel.update();
 expect(body.querySelector('.inventory-item img').hidden).toBe(false);
 expect(body.querySelector('.inventory-item img').getAttribute('src')).toBe(state.items[0].icon);
 state.resultId = 1; state.message = '强化成功'; state.messageKind = 'success';
 panel.update();
 const first = document.querySelector('.ui-toast');
 expect(first.textContent).toBe('强化成功');
 panel.update();
 expect(document.querySelector('.ui-toast')).toBe(first);
 state.resultId = 2;
 panel.update();
 expect(document.querySelector('.ui-toast')).not.toBe(first);
 state.resultId = 3; state.message = '强化失败'; state.messageKind = 'error';
 panel.update();
 expect(document.querySelector('.ui-toast').textContent).toBe('强化失败');
 expect(document.querySelector('.ui-toast').classList.contains('error')).toBe(true);
});
