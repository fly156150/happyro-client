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
it('requires reviewing an order before opening and preserves native text input during updates',()=>{
 const t=openVendingSetup('sell',1);t.setOperationGuard(()=>true);t.set(3,t.snapshot().items[0].identity,2,10);const body=panelBody(),panel=createVendingPanel(body,t);body.querySelector('[data-title]').value='我的店';panel.update();expect(body.querySelector('[data-title]').value).toBe('我的店');body.querySelector('[data-submit]').click();expect(s.send).not.toHaveBeenCalled();body.querySelector('dialog [data-confirm]').click();expect(s.send).toHaveBeenCalledOnce();
});
it('automatically closes a sold-out vending store and retains the sale receipt',()=>{
 setOwnedVending('sell',{itemList:[{index:3,ITID:501,count:2,price:10}]});updateOwnedVending(3,2);expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'REQ_CLOSESTORE'}));expect(showOwnedVending()).toBe(false);expect(interactionSnapshot().title).toBe('商品已售完');
});

it('keeps draft amount and price inputs while item artwork loads',()=>{const t=openVendingSetup('sell',1);t.setOperationGuard(()=>true);const original=t.snapshot;let icon='';t.snapshot=()=>{const state=original();state.items=state.items.map(item=>({...item,icon}));return state;};const body=panelBody(),panel=createVendingPanel(body,t);body.querySelector('.inventory-list button').click();const amount=body.querySelector('[aria-label="数量"]'),price=body.querySelector('[aria-label="单价"]');amount.value='2';price.value='30';icon='icon.png';panel.update();expect(body.querySelector('[aria-label="数量"]')).toBe(amount);expect(price.value).toBe('30');});

it('allows stackable ammunition in buying-store candidates when the database permits it',()=>{s.items[0].type=10;const t=openVendingSetup('buy',1);expect(t.snapshot().items).toHaveLength(1);});
