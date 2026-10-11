import { beforeEach, expect, it, vi } from 'vitest';
import { createShortcutPanel } from '../../src/UI/Mobile/game/ShortcutPanel.js';
let body, entry, item, slots, actions, panel;
beforeEach(() => {
 body = document.body.appendChild(document.createElement('div'));
 entry = { isSkill: true, ID: 1, tier: '一转', level: 5, name: '测试技能', amount: 'Lv.5', icon: '' };
 item = { isSkill: false, ID: 501, type: 0, name: '红色药水', amount: 3 };
 slots = [{ index: 3, name: '空位置', empty: true }, { index: 4, name: '测试技能', empty: false, binding: { isSkill: true, ID: 1, count: 3 } }];
 actions = { snapshot: () => ({ slots, page: 0, pages: 1 }), candidates: () => [entry, item], configure: vi.fn((index, choice, level) => {
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
 expect(body.querySelector('[data-current]').textContent).toContain(entry.name);
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
 expect(body.querySelector('form').hidden).toBe(true);expect(actions.configure).not.toHaveBeenCalled();
});
it('editing an existing skill starts at the bound level and items hide the level selector', () => {
 body.querySelector('[data-index="4"]').click();body.querySelector('.shortcut-choice').click();
 expect(body.querySelector('.shortcut-level select').value).toBe('3');
 body.querySelector('[data-key="false:501"]').click();expect(body.querySelector('.shortcut-level').hidden).toBe(true);
 expect(body.querySelectorAll('.shortcut-choice[aria-pressed="true"]')).toHaveLength(1);
 body.querySelector('[data-cancel-choice]').click();expect(body.querySelector('form').hidden).toBe(true);
});
it('failed saves keep the draft and selected level for correction', () => {
 actions.configure.mockReturnValue(false);body.querySelector('.shortcut-choice').click();body.querySelector('.shortcut-level select').value = '2';
 body.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
 expect(document.querySelector('.ui-toast').textContent).toContain('保存失败');
 expect(body.querySelector('.shortcut-level select').value).toBe('2');expect(body.querySelector('form').hidden).toBe(false);
});

it('shows bound skill levels and switches batches without saving the previous draft', () => {
 expect(body.querySelector('[data-index="4"] span').textContent).toBe('测试技能 · Lv.3');
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
 expect(body.querySelector('[data-index="5"] span').textContent).toContain('Lv.7');
 expect(body.querySelector('[data-index="3"]')).toBeNull();
 expect(body.querySelector('[data-slot-title]').textContent).toBe('位置 6');
 expect(body.querySelector('form').hidden).toBe(true);
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
 expect(body.querySelector('form').hidden).toBe(true);
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
