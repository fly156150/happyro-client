import { expect, it, vi } from 'vitest';
import { createSkillsPanel } from '../../src/UI/Mobile/game/SkillsPanel.js';
import { createShopPanel } from '../../src/UI/Mobile/game/ShopPanel.js';
import { createContainerPanel } from '../../src/UI/Mobile/game/ContainerPanel.js';
import { createNPCPanel } from '../../src/UI/Mobile/game/NPCPanel.js';
const click = (body, label) => [...body.querySelectorAll('button')].find(node => node.textContent === label).click();
it('keeps a chosen casting level through async icons and requires confirmation before learning', () => {
 const body = document.body.appendChild(document.createElement('div'));
 const skill = { id: 1, name: '技能', kind: '主动', level: 3, max: 10, active: true, learnable: true, requirements: [], description: '说明' };
 const actions = { snapshot: () => ({ points: 2, skills: [skill] }), learn: vi.fn(), bind: vi.fn(() => true), shortcuts: () => ({ pages: 8, page: 0, total: 36, slots: [{ index: 0 }] }), slotName: () => '空' };
 const panel = createSkillsPanel(body, actions); expect(body.querySelector('.skills-toolbar [data-skill-points]')).toBeNull(); expect(body.querySelector('.skills-footer [data-skill-points]')).not.toBeNull(); body.querySelector('[data-skill]').click();
 const description = body.querySelector('.item-description'); click(body,'设置快捷键'); expect(body.querySelector('.item-description')).toBe(description);
 const level = body.querySelector('[aria-label="等级"]'); level.value = '1'; skill.icon = 'icon.bmp'; panel.update(); expect(body.querySelector('[aria-label="等级"]')).toBe(level); expect(level.value).toBe('1');
 click(body,'确认'); expect(actions.bind).toHaveBeenCalledExactlyOnceWith(1,1,0);
 click(body,'升级一级'); expect(actions.learn).not.toHaveBeenCalled(); body.querySelector('dialog [data-confirm]').click(); expect(actions.learn).toHaveBeenCalledExactlyOnceWith(1,4);
});
it('separates selecting quantities from submitting a shop order and preserves form input on polling', () => {
 const body = document.body.appendChild(document.createElement('div')); const item = { index: 0, ID: 501, name: '药水', price: 50, quantity: 0, limit: 10 };
 const state = { mode:'buy', money:1000, total:0, allowed:true, items:[item] };
 const actions = { snapshot:()=>state, set:vi.fn((index,id,n)=>{item.quantity=n;state.total=n*50;return '';}),submit:vi.fn(()=>{state.allowed=false;return '等待';}) };
 const panel = createShopPanel(body,actions); body.querySelector('.inventory-item').click(); click(body,'→'); const input=body.querySelector('input'); input.value='3'; panel.update(); expect(input.value).toBe('3');
 click(body,'确认'); expect(actions.set).toHaveBeenCalledExactlyOnceWith(0,501,3); expect(actions.submit).not.toHaveBeenCalled();
 click(body,'购买'); click(body,'购买'); expect(actions.submit).toHaveBeenCalledOnce();
});
it('offers categories and explicit container destinations, preserving quantities across server refreshes', () => {
 const body=document.body.appendChild(document.createElement('div'));let items=[{index:2,ID:501,name:'药水',count:5,category:'usable'}];
 const actions={snapshot:()=>({containers:['inventory','storage','cart'],items,allowed:true,capacity:{current:1,limit:600}}),setCapacity: vi.fn(), preview: vi.fn(async () => null), transfer:vi.fn(()=> '等待')};
 const panel=createContainerPanel(body,actions,'storage');body.querySelector('.inventory-item').click();const input=body.querySelector('[aria-label="取出数量"]');input.value='2';panel.update();expect(input.value).toBe('2');
 const destination=body.querySelector('[aria-label="背包或手推车"]');destination.value='cart';destination.dispatchEvent(new Event('change'));body.querySelector('.inventory-item').click();body.querySelector('[aria-label="取出数量"]').value='2';click(body,'确认取出');expect(actions.transfer).toHaveBeenCalledExactlyOnceWith('storage','cart',2,501,2,undefined);
 items=[];panel.update();expect(body.querySelector('.container-amount')).toBeNull();expect(body.textContent).toContain('点击物品');
});
it('submits NPC form values only on explicit confirmation and renders server text as text', () => {
 const body=document.body.appendChild(document.createElement('div')), respond=vi.fn(()=> '请输入有效的整数');
 createNPCPanel(body,{kind:'npc',mode:'number',lines:['<img src=x onerror=alert(1)>'],respond});expect(body.querySelector('img')).toBeNull();
 body.querySelector('input').value='1.5';body.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));expect(respond).toHaveBeenCalledExactlyOnceWith('1.5');expect(body.querySelector('.npc-error').textContent).toContain('请输入有效的整数');
});

it('filters skills by job tier and keeps points beneath the list', () => {
 const body = document.body.appendChild(document.createElement('div'));
 const skills = [{id:1,tier:'一转',kind:'主动',active:true,level:2}, {id:2,tier:'二转',kind:'被动',active:false,level:1}];
 createSkillsPanel(body, {snapshot:()=>({points:5,skills,canReset:false})});
 const tier = body.querySelector('[aria-label="转职分类"]');
 expect([...tier.options].map(option=>option.textContent)).toEqual(['全部转职','一转','二转']);
 tier.value='二转'; tier.dispatchEvent(new Event('change'));
 expect([...body.querySelectorAll('[data-skill]')].map(node=>node.dataset.skill)).toEqual(['2']);
 const category=body.querySelector('[aria-label="技能分类"]');category.value='active';category.dispatchEvent(new Event('change'));
 expect(body.querySelectorAll('[data-skill]')).toHaveLength(0);
 expect(body.querySelector('.skills-layout').nextElementSibling).toBe(body.querySelector('.skills-footer'));
 expect(body.querySelector('.skills-footer .skills-reset button').textContent).toBe('重置技能点');
});
