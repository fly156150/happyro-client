import { contrastRatio } from '../../src/Utils/ReadableText.js';
import { createSkillsPanel } from '../../src/UI/Mobile/game/SkillsPanel.js';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/Navigation/NaviActionService.js', () => ({ prepareNaviLinks:vi.fn(), isNaviAvailable:vi.fn(()=>true),  handleNaviClick: vi.fn() }));
import { createShortcutPanel } from '../../src/UI/Mobile/game/ShortcutPanel.js';
let body, entry, item, slots, actions, panel;
beforeEach(() => {
 body = document.body.appendChild(document.createElement('div'));
 entry = { isSkill: true, ID: 1, tier: '一转', level: 5, name: '测试技能', description: '技能说明\n第二行', amount: 'Lv.5', icon: '' };
 item = { isSkill: false, ID: 501, type: 0, name: '红色药水', amount: 3 };
 slots = [{ index: 3, name: '空位置', empty: true }, { index: 4, name: '测试技能', empty: false, binding: { isSkill: true, ID: 1, count: 3 } }];
 actions = { itemDetail: () => ({...item,index:1,count:3,identified:true,descriptionMarkup:'恢复生命。\n重量：7'}), previewItem: vi.fn(async () => ({image:'data:image/png;base64,AA=='})), skillDetail: () => ({ name: entry.name, kind: '主动', level: 5, max: 10, requirements: ['前置技能 3/3'], reason: '技能点不足', description: entry.description }), snapshot: () => ({ slots, page: 0, pages: 1 }), candidates: () => [entry, item], configure: vi.fn((index, choice, level) => {
  const slot = slots.find(s => s.index === index);slot.empty = !choice;slot.name = choice?.name || '空位置';slot.binding = choice ? { isSkill: choice.isSkill, ID: choice.ID, count: level } : null;return true;
 }) };
 panel = createShortcutPanel(body, actions);
});
it('preserves chosen level and list position while icons load, then saves without closing the editor', () => {
 body.querySelector('.shortcut-choices').scrollTop = 100;
 body.querySelector('.shortcut-choice').click(); const select = body.querySelector('.shortcut-level select'); select.value = '2';
 panel.updateIcons([{ ...entry, icon: 'data:image/png;base64,AA==' }, item]);
 expect(select.value).toBe('2');expect(body.querySelector('img').src).toContain('data:image');
 expect(body.querySelector('.shortcut-choices').scrollTop).toBe(100);
 body.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
 expect(actions.configure).toHaveBeenCalledWith(3, entry, 2);
 expect(body.querySelector('[data-slot-title]').textContent).toContain(entry.name);
 expect(document.querySelector('.ui-toast').textContent).toContain('已保存');
 expect(document.querySelector('.ui-toast').classList.contains('success')).toBe(true);
 expect(body.querySelector('form').hidden).toBe(false);
});
it('disables clearing empty slots, confirms occupied ones and allows cancelling', () => {
 expect(body.querySelector('[data-clear-slot]').disabled).toBe(true);
 body.querySelector('[data-index="4"]').click();body.querySelector('[data-clear-slot]').click();
 expect(actions.configure).not.toHaveBeenCalled();expect(body.querySelector('dialog p').textContent).toContain('位置 5');
 body.querySelector('dialog [data-cancel]').click();expect(body.querySelector('dialog')).toBeNull();
 body.querySelector('[data-clear-slot]').click();body.querySelector('dialog [data-confirm]').click();
 expect(actions.configure).toHaveBeenCalledExactlyOnceWith(4, null);
 expect(body.querySelector('[data-clear-slot]').disabled).toBe(true);
});
it('switching slots cancels the pending edit and clear confirmation', () => {
 body.querySelector('[data-index="4"]').click();body.querySelector('[data-clear-slot]').click();
 body.querySelector('[data-index="3"]').click();expect(body.querySelector('dialog')).toBeNull();
 expect(body.querySelector('[data-save-slot]').disabled).toBe(true);expect(actions.configure).not.toHaveBeenCalled();
});
it('editing an existing skill starts at the bound level and items hide the level selector', () => {
 body.querySelector('[data-index="4"]').click();body.querySelector('.shortcut-choice').click();
 expect(body.querySelector('.shortcut-level select').value).toBe('3');
 body.querySelector('[data-key="false:501"]').click();expect(body.querySelector('.shortcut-level select').disabled).toBe(true);
 expect(body.querySelectorAll('.shortcut-choice[aria-pressed="true"]')).toHaveLength(1);
 body.querySelector('[data-index="4"]').click();expect(body.querySelector('[data-save-slot]').disabled).toBe(true);
});
it('failed saves keep the draft and selected level for correction', () => {
 actions.configure.mockReturnValue(false);body.querySelector('.shortcut-choice').click();body.querySelector('.shortcut-level select').value = '2';
 body.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
 expect(document.querySelector('.ui-toast').textContent).toContain('保存失败');
 expect(body.querySelector('.shortcut-level select').value).toBe('2');expect(body.querySelector('form').hidden).toBe(false);
});

it('shows bound skill levels and switches batches without saving the previous draft', () => {
 expect(body.querySelector('[data-index="4"] > span').textContent).toBe('测试技能 · Lv.3');
 let page=0;
 actions.snapshot=()=>({page,pages:2,slots:page ? [{index:5,name:'其它技能',binding:{isSkill:true,ID:2,count:7}}] : slots});
 actions.turn=vi.fn(delta=>{page=(page+delta+2)%2;});
 panel.updateIcons([]);
 body.querySelector('.shortcut-choice').click();
 body.querySelector('[data-page-step="1"]').click();
 expect(actions.turn).toHaveBeenCalledWith(1);
 expect(body.querySelector('[data-page-label]')).toBeNull();
 expect(body.querySelector('.shortcut-pages').firstElementChild.textContent).toBe('‹');
 expect(body.querySelector('.shortcut-pages').lastElementChild.textContent).toBe('›');
 expect(body.querySelector('[data-index="5"] > span').textContent).toContain('Lv.7');
 expect(body.querySelector('[data-index="3"]')).toBeNull();
 expect(body.querySelector('[data-slot-title]').textContent).toBe('当前位置 6：其它技能 · Lv.7');
 expect(body.querySelector('[data-save-slot]').disabled).toBe(true);
 expect(actions.configure).not.toHaveBeenCalled();
 body.querySelector('[data-page-step="-1"]').click();
 expect(body.querySelector('[data-index="3"]')).not.toBeNull();
});

it('does not notify when changing an unsaved skill level', () => {
 body.querySelector('.shortcut-choice').click();
 const select=body.querySelector('.shortcut-level select');select.value='2';
 select.dispatchEvent(new Event('input',{bubbles:true}));
 expect(document.querySelector('.ui-toast')).toBeNull();
});

it('filters skills and items exclusively and clears a choice hidden by the filter', () => {
 const skill = body.querySelector('[data-skill-filter]');
 const itemFilter = body.querySelector('[data-item-filter]');
 const change = (select, value) => { select.value = value; select.dispatchEvent(new Event('change')); };
 const visible = () => [...body.querySelectorAll('.shortcut-choice')].filter(node => !node.hidden).map(node => node.dataset.key);
 change(skill, '一转'); expect(visible()).toEqual(['true:1']);
 body.querySelector('[data-key="true:1"]').click();
 change(itemFilter, 'consumables');
 expect(skill.value).toBe('all'); expect(visible()).toEqual(['false:501']);
 expect(body.querySelector('[data-save-slot]').disabled).toBe(true);
 change(skill, 'skills'); expect(itemFilter.value).toBe('all'); expect(visible()).toEqual(['true:1']);
 change(itemFilter, 'weapon'); expect(visible()).toEqual([]);
 expect(body.querySelector('[data-filter-empty]').hidden).toBe(false);
 change(itemFilter, 'all'); expect(visible()).toEqual(['true:1', 'false:501']);
 expect(body.querySelector('[data-filter-empty]').hidden).toBe(true);
 expect(actions.configure).not.toHaveBeenCalled();
});

it('distinguishes job tiers and equipment categories while preserving a visible draft', () => {
 const second = { ...entry, ID: 2, tier: '二转' };
 const weapon = { ...item, ID: 1201, type: 5, name: '短剑' };
 body.replaceChildren(); actions.candidates = () => [entry, second, item, weapon];
 const filteredPanel = createShortcutPanel(body, actions);
 const skill = body.querySelector('[data-skill-filter]');
 skill.value = '二转'; skill.dispatchEvent(new Event('change'));
 expect([...body.querySelectorAll('.shortcut-choice')].filter(node => !node.hidden).map(node => node.dataset.key)).toEqual(['true:2']);
 body.querySelector('[data-key="true:2"]').click();
 const level = body.querySelector('.shortcut-level select'); level.value = '2';
 skill.value = 'skills'; skill.dispatchEvent(new Event('change'));
 filteredPanel.updateIcons([{ ...second, icon: 'data:image/png;base64,AA==' }]);
 expect(body.querySelector('form').hidden).toBe(false); expect(level.value).toBe('2');
 const category = body.querySelector('[data-item-filter]');
 category.value = 'weapon'; category.dispatchEvent(new Event('change'));
 expect([...body.querySelectorAll('.shortcut-choice')].filter(node => !node.hidden).map(node => node.dataset.key)).toEqual(['false:1201']);
});

it('keeps every footer action visible and renders the description outside the footer', () => {
 const footer=body.querySelector('.shortcut-footer');
 for(const key of ['save-slot','clear-slot']) {
  const button=footer.querySelector(`[data-${key}]`);
  expect(button.hidden).toBe(false); expect(button.disabled).toBe(true);
 }
 expect(body.querySelector('form').hidden).toBe(false);
 body.querySelector('.shortcut-choice').click();
 expect(body.querySelector('[data-choice-detail] .item-description').textContent).toBe(entry.description);
 expect(body.querySelector('.shortcut-editor button')).toBeNull();
 expect(footer.querySelector('[data-save-slot]').disabled).toBe(false);
 expect(body.querySelector('[data-cancel-choice]')).toBeNull();
 expect(footer.querySelector('[data-save-slot]').textContent).toBe('保存');
 expect(footer.querySelector('[data-clear-slot]').textContent).toBe('清空位置');
 body.querySelector('[data-index="4"]').click();
 expect(footer.querySelector('[data-save-slot]').disabled).toBe(true);
 expect(body.querySelector('[data-choice-detail]').hidden).toBe(true);
 body.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));
 expect(actions.configure).not.toHaveBeenCalled();
});

it('matches the skill menu description while retaining slot information', () => {
 body.querySelector('.shortcut-choice').click();
 const detail=body.querySelector('[data-choice-detail]');
 expect(detail.querySelector('h3').textContent).toBe(entry.name);
 expect([...detail.querySelectorAll('p')].map(p=>p.textContent)).toEqual(['主动 · 等级 5/10','前置技能：前置技能 3/3\n技能点不足',entry.description]);
 expect(body.querySelector('[data-slot-title]').textContent).toBe('当前位置 4：空位置');
 expect(body.querySelector('[data-slot-title]').textContent).toContain('空位置');
 expect(detail.querySelector('img')).toBeNull();
 body.querySelector('[data-key="false:501"]').click();
 expect(detail.querySelector('h3').textContent).toBe('红色药水');
 expect(detail.querySelector('img')).toBeNull();
 expect(detail.querySelector('.inventory-item-metadata').textContent).toContain('数量：3');
 panel.updateIcons([{...item,icon:'data:image/png;base64,AA=='}]);
 expect(detail.querySelector('h3').textContent).toBe('红色药水');
 body.querySelector('.shortcut-choice').click();
 expect(detail.querySelector('h3').textContent).toBe(entry.name);
});

it('renders exactly the same description markup as the skill menu', () => {
 Object.defineProperty(HTMLElement.prototype, 'scrollTo', {value:vi.fn(),configurable:true});
 const skill={...actions.skillDetail(1),id:1,active:true,learnable:false};
 const skillsBody=document.body.appendChild(document.createElement('div'));
 createSkillsPanel(skillsBody,{snapshot:()=>({points:0,skills:[skill]})});
 skillsBody.querySelector('[data-skill]').click();
 body.querySelector('.shortcut-choice').click();
 expect(body.querySelector('[data-choice-detail]').innerHTML).toBe(skillsBody.querySelector('.inventory-item-description').outerHTML);
 expect(body.querySelector('[data-choice-hint]').hidden).toBe(true);
 expect(body.querySelector('.menu-labeled-select > span').textContent).toBe('施放等级');
 delete HTMLElement.prototype.scrollTo;
});

it('shows the inventory illustration, quantity, weight and description without inventory actions', async () => {
 actions.previewItem.mockResolvedValue({art:'data:image/png;base64,AA=='});
 body.querySelector('[data-key="false:501"]').click();
 await Promise.resolve();
 const detail=body.querySelector('[data-choice-detail]');
 expect(actions.previewItem).toHaveBeenCalledWith(1,501);
 expect(detail.querySelector('.inventory-item-picture.is-illustration').alt).toBe('红色药水');
 expect(detail.querySelector('.inventory-item-metadata').textContent).toBe('数量：3重量：7');
 expect(detail.querySelector('.item-description').textContent).toBe('恢复生命。');
 expect(detail.querySelector('button')).toBeNull();
 expect(body.querySelector('[data-slot-title]').textContent).toBe('当前位置 4：空位置');
});
it('does not insert a late item image into a newly selected skill', async () => {
 let resolve; actions.previewItem.mockReturnValue(new Promise(done=>{resolve=done}));
 body.querySelector('[data-key="false:501"]').click();
 body.querySelector('.shortcut-choice').click();
 resolve({image:'data:image/png;base64,AA=='});await Promise.resolve();
 expect(body.querySelector('[data-choice-detail] img')).toBeNull();
 expect(body.querySelector('[data-choice-detail] h3').textContent).toBe(entry.name);
});

it('keeps colored item descriptions readable after mounting in shortcut details', () => {
 body.style.backgroundColor = 'rgb(25, 33, 42)';
 actions.itemDetail = () => ({ ...item, index: 1, count: 3, identified: true, descriptionMarkup: '^777777Item details^000000' });
 body.querySelector('[data-key="false:501"]').click();
 const span = body.querySelector('[data-choice-detail] .item-description span');
 const rgb = getComputedStyle(span).color.match(/\d+/g).map(Number);
 expect(contrastRatio(rgb, [25, 33, 42])).toBeGreaterThanOrEqual(4.5);
 expect(span.textContent).toBe('Item details');
});

it('keeps the skill empty hint and footer stable while the skill list refreshes',()=>{
 const body=document.body.appendChild(document.createElement('div'));
 const panel=createSkillsPanel(body,{snapshot:()=>({points:0,skills:Array.from({length:80},(_,i)=>({id:i+1,name:`技能${i}`,level:1,max:10,requirements:[],description:'说明'}))})});
 const detail=body.querySelector('.inventory-detail');
 const hint=detail.firstChild,footer=body.querySelector('.skills-action-slot').firstChild;
 const list=body.querySelector('.inventory-list');list.scrollTop=1000;
 for(let i=0;i<20;i++)panel.update();
 expect(detail.firstChild).toBe(hint);expect(body.querySelector('.skills-action-slot').firstChild).toBe(footer);expect(list.scrollTop).toBe(1000);
});
