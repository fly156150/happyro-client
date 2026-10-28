import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createShopPanel } from '../../src/UI/Mobile/game/ShopPanel.js';
let body,state,service,panel;
const click=text=>[...body.querySelectorAll('button')].find(n=>n.textContent===text).click();
beforeEach(()=>{
 body=document.body.appendChild(document.createElement('div'));
 state={mode:'buy',money:1000,currency:'Zeny',total:20,allowed:true,pending:false,items:[{index:0,ID:501,name:'红色药水',price:10,limit:10,quantity:2,description:'恢复 HP\n重量：7',materials:[]}]};
 service={snapshot:()=>state,set:vi.fn((index,id,count)=>{state.items[0].quantity=count;state.total=count*10;return ''; }),clear:vi.fn(()=>{state.items[0].quantity=0;state.total=0;return true;}),submit:vi.fn(()=>{state.pending=true;state.allowed=false;return '已提交，等待服务器回复';})};
 panel=createShopPanel(body,service);
});
afterEach(()=>document.body.replaceChildren());
const select=()=>body.querySelector('.shop-catalog-list .inventory-item').click();
it('moves entered quantities in both directions and preserves the framed description',()=>{
 select();expect(body.querySelector('.shop-layout > .menu-scroll-frame > .inventory-detail').textContent).toContain('恢复 HP');
 click('→');const input=body.querySelector('input');expect(input.max).toBe('8');input.value='3';click('确认');
 expect(service.set).toHaveBeenLastCalledWith(0,501,5);expect(body.querySelector('.shop-order-list').textContent).toContain('× 5');
 click('←');body.querySelector('input').value='2';click('确认');expect(service.set).toHaveBeenLastCalledWith(0,501,3);
});
it('submits directly once and locks the window while waiting',()=>{
 click('购买');expect(service.submit).toHaveBeenCalledOnce();expect(body.querySelector('dialog')).toBeNull();
 click('购买');expect(service.submit).toHaveBeenCalledOnce();expect(body.querySelector('.shop-status')).toBeNull();expect(body.querySelector('.shop-footer .shop-summary').textContent).toBe('余额：1,000 Z · 合计：20 Z');expect(document.querySelector('.ui-toast')).toBeNull();
 expect(body.querySelector('.shop-catalog-list button').disabled).toBe(true);
});
it('retains an entered quantity when limits change and prevents invalid transfers',()=>{
 select();click('→');const input=body.querySelector('input');input.value='8';state.items[0].limit=4;panel.update();
 expect(input.value).toBe('8');expect(input.max).toBe('2');click('确认');expect(service.set).not.toHaveBeenCalled();expect(body.querySelector('dialog')).not.toBeNull();
 click('取消');expect(state.items[0].quantity).toBe(2);
});
it('cancels quantity input if the selected item disappears',()=>{
 select();click('→');state.items=[];panel.update();expect(body.querySelector('dialog')).toBeNull();expect(service.set).not.toHaveBeenCalled();
 expect(body.querySelector('.shop-catalog-list').textContent).toContain('暂无');
});
it('shows sales proceeds, material requirements, and clears the order without submitting',()=>{
 state.mode='sell';state.items[0].materials=[{name:'材料',refine_level:5,amount:3}];panel.update();select();
 expect(body.querySelector('.shop-summary').textContent).toContain('合计：20 Z');expect(body.querySelector('.shop-price').textContent).toContain('精炼 +5');
 click('清空');expect(body.querySelector('.shop-order-list button')).toBeNull();expect(service.submit).not.toHaveBeenCalled();
 expect([...body.querySelectorAll('button')].find(n=>n.textContent==='出售').disabled).toBe(true);
});
it('does not overwrite a replacement result view after synchronous submission',()=>{
 service.submit.mockImplementation(()=>{body.innerHTML='<p>购买请求已发送</p>';return '已提交，等待服务器回复';});
 click('购买');expect(body.textContent).toBe('购买请求已发送');expect(()=>panel.update()).not.toThrow();
});

it('adjusts quantity with bounded step buttons and omits the quantity label and stock metadata',()=>{
 state.items[0].limit=65535;panel.update();select();
 expect(body.querySelector('.shop-catalog-list').textContent).not.toContain('可选');
 click('→');expect(body.querySelector('dialog').textContent).not.toContain('加入数量');
 const input=body.querySelector('input');click('+1');expect(input.value).toBe('2');click('+10');expect(input.value).toBe('12');click('-1');expect(input.value).toBe('11');click('-10');expect(input.value).toBe('1');
 expect([...body.querySelectorAll('button')].find(n=>n.textContent==='-1').disabled).toBe(true);
 state.items[0].limit=5;panel.update();click('+10');expect(input.value).toBe('3');click('确认');expect(service.set).toHaveBeenLastCalledWith(0,501,5);
});

it('keeps weight in the description and places step controls beside the input',()=>{
 select();expect(body.querySelector('.shop-price').textContent).toBe('单价：10 Z');expect(body.querySelector('.item-description').textContent).toContain('重量：7');expect(body.textContent).not.toContain('数量上限');click('→');
 const input=body.querySelector('input');expect(input.previousElementSibling.textContent).toBe('-10-1');expect(input.nextElementSibling.textContent).toBe('+1+10');
});
