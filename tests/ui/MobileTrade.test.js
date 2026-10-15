import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(()=>({items:[],reserved:[],session:{Playing:true,zeny:100,Entity:{action:0,ACTION:{DIE:99}}},add:vi.fn(),lock:vi.fn(),execute:vi.fn(),cancel:vi.fn(),remove:vi.fn()}));
vi.mock('Engine/SessionStorage.js',()=>({default:s.session}));
vi.mock('UI/Components/Inventory/Inventory.js',()=>({default:{getUI:()=>({list:s.items,equipswitchlist:s.reserved,getItemByIndex:index=>s.items.find(item=>item.index===index),removeItem:s.remove})}}));
vi.mock('UI/Game/GameInventory.js',()=>({createGameInventory:()=>({describe:item=>({index:item.index,ID:item.ITID,count:item.count,name:`物品${item.ITID}`,description:'说明'})})}));
vi.mock('DB/DBManager.js',()=>({default:{getPetByEggID:id=>id===9001?{PetEggID:9001}:null}}));
import { openGameTrade } from '../../src/UI/Game/GameTrade.js';
import { clearInteraction } from '../../src/UI/Game/ServerInteraction.js';
import { createTradePanel } from '../../src/UI/Mobile/game/TradePanel.js';
beforeEach(()=>{vi.clearAllMocks();clearInteraction();s.session.Playing=true;s.session.zeny=100;s.reserved=[];s.items=[{index:2,ITID:501,count:5,slot:[0,0,0,0]}];});
function open(){const t=openGameTrade('对方',s);t.setOperationGuard(()=>true);return t;}
it('reserves only on server acknowledgement and waits for both locks before execution',()=>{
 const t=open(),item=t.snapshot().items[0];t.add(2,item.identity,2);t.add(2,item.identity,2);expect(s.add).toHaveBeenCalledExactlyOnceWith(2,2);expect(s.remove).not.toHaveBeenCalled();t.lock();expect(s.lock).not.toHaveBeenCalled();t.acknowledge(2,true);expect(s.remove).toHaveBeenCalledExactlyOnceWith(2,2);t.acknowledge(2,true);expect(s.remove).toHaveBeenCalledOnce();t.lock();t.lock();expect(s.lock).toHaveBeenCalledOnce();t.execute();expect(s.execute).not.toHaveBeenCalled();t.conclude(false);t.conclude(true);t.execute();t.execute();expect(s.execute).toHaveBeenCalledOnce();
});
it('rejects stale slot mutations, worn items, invalid amounts and disconnected actions',()=>{
 const t=open(),item=t.snapshot().items[0];s.items[0].slot[0]=4001;t.add(2,item.identity,1);expect(s.add).not.toHaveBeenCalled();s.items[0].equipped=1;t.add(2,item.identity,1);expect(s.add).not.toHaveBeenCalled();t.setMoney(101);t.setMoney(-1);expect(s.add).not.toHaveBeenCalled();t.setMoney(50);expect(s.add).toHaveBeenCalledExactlyOnceWith(0,50);s.session.Playing=false;t.lock();expect(s.lock).not.toHaveBeenCalled();
});
it('processes preceding item acknowledgement while cancel is pending and ignores stale owners',()=>{
 const t=open();t.add(2,t.snapshot().items[0].identity,1);t.cancel();t.cancel();t.acknowledge(2,true);expect(s.cancel).toHaveBeenCalledOnce();expect(s.remove).toHaveBeenCalledExactlyOnceWith(2,1);t.lock();expect(s.lock).not.toHaveBeenCalled();const newer=open();t.finish('旧结果');newer.setMoney(10);expect(s.add).toHaveBeenLastCalledWith(0,10);
});
it('renders both offers and requires a second explicit confirmation',()=>{
 const t=open();t.receive({ITID:502,count:3});t.receive({ITID:0,count:20});t.conclude(false);t.conclude(true);const body=document.body.appendChild(document.createElement('div'));createTradePanel(body,t);expect(body.querySelector('[data-peer]').textContent).toContain('20 Z');body.querySelector('[data-execute]').click();expect(s.execute).not.toHaveBeenCalled();body.querySelector('dialog [data-confirm]').click();expect(s.execute).toHaveBeenCalledOnce();
});

it('allows damaged inventory items to be offered, leaving tradeability to the server',()=>{s.items[0].IsDamaged=1;const t=open();t.add(2,t.snapshot().items[0].identity,1);expect(s.add).toHaveBeenCalledExactlyOnceWith(2,1);});

it('does not replace the quantity input when an asynchronous item icon arrives',()=>{const t=open(),snapshot=t.snapshot;let icon='';t.snapshot=()=>{const state=snapshot();state.items=state.items.map(item=>({...item,icon}));return state;};const body=document.body.appendChild(document.createElement('div')),panel=createTradePanel(body,t);body.querySelector('.inventory-list button').click();const input=body.querySelector('[aria-label="交易数量"]');input.value='2';icon='data:image/png;base64,AA';panel.update();expect(body.querySelector('[aria-label="交易数量"]')).toBe(input);expect(input.value).toBe('2');});

it('lets players inspect the other offer without relying on right click or sending a packet',()=>{
 const t=open();t.receive({ITID:502,count:1});const body=document.body.appendChild(document.createElement('div'));createTradePanel(body,t);body.querySelector('[data-picker]').scrollIntoView=vi.fn();body.querySelector('[data-peer] button').click();expect(body.querySelector('[data-picker] h3').textContent).toBe('物品502');expect(body.querySelector('[data-picker] p').textContent).toBe('说明');expect(body.querySelector('[aria-label="交易数量"]')).toBeNull();expect(s.add).not.toHaveBeenCalled();
});

it('excludes hatched eggs encoded as damaged armor while allowing unhatched eggs and damaged equipment',()=>{
 s.items=[{index:2,ITID:9001,type:4,IsDamaged:2,WearState:0},{index:3,ITID:9001,type:4,IsDamaged:0,WearState:0},{index:4,ITID:2301,type:4,IsDamaged:2,WearState:0}];
 const t=open();expect(t.snapshot().items.map(item=>item.index)).toEqual([3,4]);
 const egg=s.items[0], identity=JSON.stringify([egg.ITID,egg.RefiningLevel,egg.enchantgrade,egg.slot,egg.Options]);
 t.add(2,identity,1);expect(s.add).not.toHaveBeenCalled();expect(t.snapshot().pending).toBe(false);
 t.add(3,t.snapshot().items[0].identity,1);expect(s.add).toHaveBeenCalledExactlyOnceWith(3,1);
});
it('unlocks an item request on server rejection so another item can be offered',()=>{
 const t=open(),identity=t.snapshot().items[0].identity;t.add(2,identity,1);
 t.acknowledge(2,false);expect(t.snapshot().pending).toBe(false);expect(s.remove).not.toHaveBeenCalled();
 t.add(2,identity,1);expect(s.add).toHaveBeenCalledTimes(2);
});
