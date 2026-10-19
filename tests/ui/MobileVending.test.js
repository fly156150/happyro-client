import {createMobileInputEditor} from '../../src/UI/Mobile/game/MobileInputEditor.js';
vi.mock('UI/Platform.js',()=>({default:{isMobile:true}}));
vi.mock('UI/Components/VendingShop/VendingShop.js',()=>({default:{append:vi.fn()}}));
import {beforeEach,expect,it,vi} from 'vitest';
const s=vi.hoisted(()=>({items:[],cart:[],session:{Playing:true,zeny:1000,Entity:{action:0,ACTION:{DIE:99}}},send:vi.fn()}));
vi.mock('Engine/SessionStorage.js',()=>({default:s.session}));
vi.mock('UI/Components/Inventory/Inventory.js',()=>({default:{getUI:()=>({list:s.items})}}));
vi.mock('UI/Components/CartItems/CartItems.js',()=>({default:{get list(){return s.cart;}}}));
vi.mock('DB/DBManager.js',()=>({default:{isBuyable:id=>id===501,getItemName:item=>`物品${item.ITID}`}}));
vi.mock('UI/Game/GameInventory.js',()=>({createGameInventory:()=>({describe:item=>({index:item.index,ID:item.ITID,count:item.count,name:`物品${item.ITID}`,description:'物品说明'})})}));
vi.mock('Network/NetworkManager.js',()=>({default:{sendPacket:s.send}}));
vi.mock('Network/PacketStructure.js',()=>({default:{CZ:new Proxy({}, {get:(target,key)=>target[key]||=(class {constructor(){this.packet=key;this.result=0;this.storeList=[];}})})}}));
import {openVendingSetup,setOwnedVending,updateOwnedVending,showOwnedVending,resetGameVending,finishOwnedBuying} from '../../src/UI/Game/GameVending.js';
import {clearInteraction,interactionSnapshot} from '../../src/UI/Game/ServerInteraction.js';
import {createVendingPanel} from '../../src/UI/Mobile/game/VendingPanel.js';
function panelBody() {
 const host=document.body.appendChild(document.createElement('div'));
 host.setAttribute('data-phone-screen','');
 return host.attachShadow({mode:'open'}).appendChild(document.createElement('div'));
}
beforeEach(()=>{vi.clearAllMocks();clearInteraction();resetGameVending();s.session.Playing=true;s.session.zeny=1000;s.items=[{index:2,ITID:501,type:0,IsIdentified:1,count:5}];s.cart=[{index:3,ITID:501,type:0,IsIdentified:1,count:8,slot:{card1:0}}];});
it('checks cart quantity, identity and slot count before sending an opening request once',()=>{
 const t=openVendingSetup('sell',1),item=t.snapshot().items[0];expect(t.set(3,item.identity,9,100)).toContain('变化');expect(t.set(3,item.identity,2,100)).toBe('');s.cart[0].slot.card1=4001;expect(t.submit('商店',0)).toContain('变化');expect(s.send).not.toHaveBeenCalled();s.cart[0].slot.card1=0;t.submit('商店',0);t.submit('商店',0);expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'REQ_OPENSTORE2',result:1,storeName:'商店',storeList:[{index:3,ITID:501,count:2,price:100}]}));expect(s.cart[0].count).toBe(8);
});
it('validates buying budget and duplicate item types, and keeps cancel separate from opening',()=>{
 const t=openVendingSetup('buy',2),item=t.snapshot().items[0];t.set(2,item.identity,6,10);expect(t.submit('收购',1001)).toContain('预算');expect(s.send).not.toHaveBeenCalled();t.submit('收购',100);expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'REQ_OPEN_BUYING_STORE',LimitZeny:100,storeList:[{index:2,ITID:501,count:6,price:10}]}));
 const next=openVendingSetup('buy',2);t.close();next.close();next.close();expect(s.send).toHaveBeenCalledTimes(2);expect(s.send.mock.calls[1][0].result).toBe(0);
});
it('keeps owned stock updated while hidden and sends close once; auto close removes the owned store',()=>{
 setOwnedVending('buy',{limitZeny:100,itemList:[{index:0,ITID:501,count:10,price:10}]});interactionSnapshot().close();updateOwnedVending(501,2,true,80);expect(showOwnedVending()).toBe(true);const t=interactionSnapshot().service;t.setOperationGuard(()=>true);expect(t.snapshot()).toMatchObject({budget:80,items:[{count:8}]});t.closeStore();t.closeStore();expect(s.send).toHaveBeenCalledOnce();expect(showOwnedVending()).toBe(false);
 setOwnedVending('buy',{itemList:[]});finishOwnedBuying();expect(showOwnedVending()).toBe(false);
});
it.each(['sell', 'buy'])('opens %s directly in the keyboard editor and submits all fields once', mode => {
 const t=openVendingSetup(mode,1);t.setOperationGuard(()=>true);
 const item=t.snapshot().items[0];t.set(item.index,item.identity,2,10);
 const body=panelBody(),dispose=createMobileInputEditor(body.getRootNode().host),panel=createVendingPanel(body,t);
 body.querySelector('[data-submit]').click();
 expect(body.querySelector('dialog')).toBeNull();
 const editor=document.querySelector('[data-mobile-input-editor]').shadowRoot;
 const fields=editor.querySelectorAll('input');expect(fields).toHaveLength(mode==='buy'?2:1);
 fields[0].value='我的店';
 if(mode==='buy') {
  fields[1].value='1001';editor.querySelector('[data-done]').click();expect(s.send).not.toHaveBeenCalled();
  fields[1].value='100';
 }
 panel.update();expect(fields[0].value).toBe('我的店');expect(s.send).not.toHaveBeenCalled();
 editor.querySelector('[data-done]').click();expect(s.send).toHaveBeenCalledOnce();
 expect(s.send.mock.calls[0][0].storeName).toBe('我的店');
 expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();dispose();
});
it('automatically closes a sold-out vending store and retains the sale receipt',()=>{
 setOwnedVending('sell',{itemList:[{index:3,ITID:501,count:2,price:10}]});updateOwnedVending(3,2);expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'REQ_CLOSESTORE'}));expect(showOwnedVending()).toBe(false);expect(interactionSnapshot().title).toBe('商品已售完');
});

it('keeps draft amount and price inputs while item artwork loads',()=>{const t=openVendingSetup('sell',1);t.setOperationGuard(()=>true);const original=t.snapshot;let icon='';t.snapshot=()=>{const state=original();state.items=state.items.map(item=>({...item,icon}));return state;};const body=panelBody(),panel=createVendingPanel(body,t);body.querySelector('.inventory-list button').click();body.querySelector('[aria-label="加入摊位清单"]').click();const amount=body.querySelector('[aria-label="数量"]'),price=body.querySelector('[aria-label="单价"]');amount.value='2';price.value='30';icon='icon.png';panel.update();expect(body.querySelector('[aria-label="数量"]')).toBe(amount);expect(price.value).toBe('30');});

it('allows stackable ammunition in buying-store candidates when the database permits it',()=>{s.items[0].type=10;const t=openVendingSetup('buy',1);expect(t.snapshot().items).toHaveLength(1);});

it('moves quantities with arrow dialogs and retains icons in the two-column order',()=>{
 const t=openVendingSetup('sell',1);t.setOperationGuard(()=>true);const body=panelBody(),panel=createVendingPanel(body,t);
 expect(body.querySelectorAll('.interaction-column')).toHaveLength(2);
 body.querySelector('.inventory-list button').click();body.querySelector('[aria-label="加入摊位清单"]').click();
 body.querySelector('[aria-label="数量"]').value='3';body.querySelector('[aria-label="单价"]').value='20';body.querySelector('dialog [data-confirm]').click();
 expect(t.snapshot().order[0]).toMatchObject({count:3,price:20});expect(body.querySelector('[data-order] img')).not.toBeNull();
 body.querySelector('[aria-label="移回可选商品"]').click();body.querySelector('[aria-label="数量"]').value='2';body.querySelector('dialog [data-confirm]').click();expect(t.snapshot().order[0].count).toBe(1);
 body.querySelector('[aria-label="加入摊位清单"]').click();s.cart[0].count=0;body.querySelector('dialog [data-confirm]').click();expect(t.snapshot().order[0].count).toBe(1);panel.update();
});

it('keeps item rows stable as icons arrive so a pointer click is not lost',()=>{
 const t=openVendingSetup('sell',1),snapshot=t.snapshot;let icon='';t.snapshot=()=>{const state=snapshot();state.items=state.items.map(item=>({...item,icon}));return state;};
 const body=panelBody(),panel=createVendingPanel(body,t),row=body.querySelector('.inventory-list button');icon='icon.png';panel.update();expect(body.querySelector('.inventory-list button')).toBe(row);row.click();expect(body.querySelector('[aria-label="加入摊位清单"]').disabled).toBe(false);
});

it('filters source goods by category and subtype without filtering the order', () => {
 const items = [
  { index: 1, ID: 1201, identity: 'a', name: '短剑', category: 'equipment', type: 4, subtypes: ['Dagger'], count: 2, quantity: 1, price: 10 },
  { index: 2, ID: 1101, identity: 'b', name: '长剑', category: 'equipment', type: 4, subtypes: ['1hSword'], count: 1, quantity: 0, price: 10 },
  { index: 3, ID: 501, identity: 'c', name: '药水', category: 'usable', subtypes: [], count: 1, quantity: 0, price: 10 }
 ];
 const service = { snapshot: () => ({ items, order: [items[0]], mode: 'sell', allowed: true, slots: 3, total: 10 }) };
 const body = panelBody(); createVendingPanel(body, service);
 const category = body.querySelector('[aria-label="摆摊物品分类"]');
 category.value = 'equipment'; category.dispatchEvent(new Event('change'));
 expect(body.querySelectorAll('.inventory-list .inventory-item')).toHaveLength(2);
 const subtype = body.querySelector('[aria-label="物品子类"]');
 subtype.value = 'Dagger'; subtype.dispatchEvent(new Event('change'));
 expect(body.querySelectorAll('.inventory-list .inventory-item')).toHaveLength(1);
 expect(body.querySelector('.inventory-list').textContent).toContain('短剑');
 category.value = 'usable'; category.dispatchEvent(new Event('change'));
 expect(subtype.value).toBe('');
 expect(body.querySelector('.inventory-list').textContent).toContain('药水');
 expect(body.querySelector('[data-order]').textContent).toContain('短剑');
});
