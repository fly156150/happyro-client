vi.mock('DB/DBManager.js', () => ({ default: { getItemName: item => '材料' + item.ITID } }));
import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ items: [], session: { Playing: true, zeny: 100, Entity: { action: 0, ACTION: { DIE: 99 } } }, lock: false }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: { getUI: () => ({ list: s.items, getItemByIndex: index => s.items.find(item => item.index === index), npcsalelock: s.lock }) } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('UI/Game/GameInventory.js', () => ({ createGameInventory: () => ({ describe: item => ({ index: item.index, ID: item.ITID, count: item.count || 1, name: '物品' }) }) }));
import { openGameShop, finishGameShop, closePlayerShop } from '../../src/UI/Game/GameShop.js';
import { clearInteraction, interactionSnapshot } from '../../src/UI/Game/ServerInteraction.js';
beforeEach(() => { clearInteraction(); s.session.Playing = true; s.session.zeny = 100; s.session.Entity.action = 0; s.lock = false; s.items = [{ index: 3, ITID: 501, count: 5, PlaceETCTab: 0 }]; });
it('checks quantity, order total and blocks duplicates without changing money or items', () => {
 const send = vi.fn(); const shop = openGameShop('buy', [{ ITID: 501, price: 60, discountprice: 50 }], send, vi.fn());
 for (const count of [-1, 1.5, 65536, NaN]) expect(shop.set(0, 501, count)).not.toBe('');
 shop.set(0, 501, 3); expect(shop.submit()).toContain('金额'); expect(send).not.toHaveBeenCalled();
 shop.set(0, 501, 2); shop.submit(); shop.submit();
 expect(send).toHaveBeenCalledExactlyOnceWith([{ index: 0, ITID: 501, count: 2 }]);
 expect(s.session.zeny).toBe(100); expect(s.items[0].count).toBe(5);
 expect(shop.snapshot().pending).toBe(true); finishGameShop('成功', true); expect(interactionSnapshot()).toMatchObject({title:'购买成功',resultItems:[{name:'物品',count:2}]});
});
it('revalidates sold identities, counts and sale locks at final confirmation', () => {
 const send = vi.fn(); const shop = openGameShop('sell', [{ index: 3, price: 10, overchargeprice: 12 }], send, vi.fn());
 shop.set(3, 501, 5); s.items[0].count = 4; expect(shop.submit()).toContain('变化');
 s.items[0].count = 5; s.items[0].ITID = 502; expect(shop.submit()).toContain('变化');
 s.items[0].ITID = 501; s.lock = true; s.items[0].PlaceETCTab = 1; expect(shop.submit()).toContain('变化');
 expect(send).not.toHaveBeenCalled();
});
it('rejects stale shops, closed sessions and death and sends quit once', () => {
 const send = vi.fn(), quit = vi.fn(); const old = openGameShop('buy', [{ ITID: 501, price: 0 }], send, quit);
 old.set(0, 501, 1); const shop = openGameShop('buy', [{ ITID: 501, price: 0 }], send, quit);
 old.submit(); old.close(); expect(send).not.toHaveBeenCalled(); expect(quit).not.toHaveBeenCalled();
 shop.set(0, 501, 1); s.session.Entity.action = 99; shop.submit(); expect(send).not.toHaveBeenCalled();
 shop.close(); shop.close(); expect(quit).toHaveBeenCalledOnce(); expect(interactionSnapshot()).toBeNull();
});
it('honors finite market stock including zero and cash balances independently of Zeny', () => {
 const send=vi.fn(),quit=vi.fn();
 let shop=openGameShop('buy',[{ITID:501,price:20,qty:0}],send,quit,{type:'market'});
 expect(shop.set(0,501,1)).toContain('变化');
 shop=openGameShop('buy',[{ITID:501,price:20}],send,quit,{type:'cash',currency:'商店点数',balance:30,closeAfterResult:true});
 shop.set(0,501,2);expect(shop.submit()).toContain('金额');shop.set(0,501,1);shop.submit();
 expect(send).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ITID:501,count:1,price:20})]);
 finishGameShop('完成', true);expect(quit).toHaveBeenCalledOnce();
});
it('aggregates exchange materials across order lines and preserves shop indices in requests', () => {
 const send=vi.fn();const shop=openGameShop('buy',[{index:7,ITID:502,amount:0xffffffff,currencyITID:501,currencyamount:2},{index:9,ITID:503,amount:3,price:0,currencyList:[{ITID:501,amount:2,refine_level:0}]}],send,vi.fn(),{type:'barter'});
 shop.set(7,502,2);shop.set(9,503,1);expect(shop.submit()).toContain('材料不足');expect(send).not.toHaveBeenCalled();
 shop.set(9,503,0);shop.submit();expect(send).toHaveBeenCalledExactlyOnceWith([{index:7,ITID:502,count:2,shopIndex:7,matcurrency:501}]);
});
it('can explicitly clear a stale order before rebuilding it',()=>{
 const send=vi.fn();const shop=openGameShop('sell',[{index:3,price:10}],send,vi.fn());shop.set(3,501,1);s.items=[];expect(shop.submit()).toContain('变化');expect(shop.clear()).toBe(true);expect(shop.submit()).toContain('先选择');expect(send).not.toHaveBeenCalled();
});

it('caps sales to a buying store across inventory stacks and acknowledges every sold stack',()=>{
 s.items.push({index:4,ITID:501,count:5,PlaceETCTab:0});const send=vi.fn();const t=openGameShop('sell',[{index:3,ITID:501,price:10,qty:3},{index:4,ITID:501,price:10,qty:3}],send,vi.fn(),{type:'player-buying',limitToOffer:true,maxTotal:25});
 t.set(3,501,2);t.set(4,501,2);expect(t.submit()).toContain('数量');t.set(4,501,1);expect(t.submit()).toContain('金额');t.set(3,501,1);t.submit();expect(send).toHaveBeenCalledExactlyOnceWith([{index:3,ITID:501,count:1},{index:4,ITID:501,count:1}]);expect(t.acknowledgeSale(3,1)).toBe(false);expect(t.acknowledgeSale(4,1)).toBe(true);
});
it('does not wait for a nonexistent success acknowledgement when buying from a player vendor',()=>{
 const send=vi.fn(),t=openGameShop('buy',[{ITID:501,price:10,qty:2}],send,vi.fn(),{type:'player-vending',requestOnly:true});t.set(0,501,1);t.submit();expect(send).toHaveBeenCalledOnce();expect(interactionSnapshot()).toBeNull();t.submit();expect(send).toHaveBeenCalledOnce();
});

it('keeps the NPC sale lock from excluding items requested by a player buying store',()=>{s.lock=true;s.items[0].PlaceETCTab=1;const send=vi.fn(),t=openGameShop('sell',[{index:3,ITID:501,price:1,qty:2}],send,vi.fn(),{type:'player-buying',limitToOffer:true,maxTotal:100});expect(t.set(3,501,1)).toBe('');t.submit();expect(send).toHaveBeenCalledOnce();});

it('keeps failure results visible',()=>{openGameShop('buy',[],vi.fn(),vi.fn());finishGameShop('余额不足',false);expect(interactionSnapshot()).toMatchObject({kind:'notice',lines:['余额不足']});});

it('retains sold item details after the server removes inventory entries',()=>{
 const shop=openGameShop('sell',[{index:3,ITID:501,price:10}],vi.fn(),vi.fn());
 shop.set(3,501,5);shop.submit();s.items=[];finishGameShop('成功',true);
 expect(interactionSnapshot()).toMatchObject({title:'出售成功',resultItems:[{name:'物品',count:5}]});
});

it('invalidates only the matching player storefront and blocks stale order submission', () => {
 const send = vi.fn();
 const shop = openGameShop('buy', [{ITID: 501, price: 10, qty: 2}], send, vi.fn(), {type: 'player-vending', owner: 2000002});
 shop.set(0, 501, 1);
 closePlayerShop(2000003);
 expect(interactionSnapshot()?.kind).toBe('shop');
 closePlayerShop(2000002);
 expect(interactionSnapshot()).toMatchObject({kind: 'notice', lines: ['摊位已关闭，请重新选择摊位']});
 shop.submit();
 expect(send).not.toHaveBeenCalled();
 openGameShop('buy', [{ITID: 501, price: 10}], send, vi.fn());
 closePlayerShop(2000002);
 expect(interactionSnapshot()?.kind).toBe('shop');
});
