import { expect, it } from 'vitest';
import { createStatusPanel } from '../../src/UI/Mobile/game/StatusPanel.js';

it('orders expiring effects first and updates detail time without losing the selected effect', () => {
 const body = document.createElement('div');
 const panel = createStatusPanel(body);
 const effects = [{id:1,title:'永久效果',seconds:null,description:'常驻'}, {id:2,title:'天使之赐福',seconds:125,description:'提升属性'}, {id:3,title:'加速术',seconds:20,description:'提升速度'}];
 panel.update(effects);
 const order = () => [...body.querySelectorAll('[data-status]')].map(n => n.dataset.status);
 expect(order()).toEqual(['3','2','1']);
 expect(body.querySelector('.menu-detail-heading').textContent).toBe('加速术');
 body.querySelector('[data-status="2"]').click();
 expect(body.querySelector('.status-detail-duration').textContent).toBe('剩余时间：2分5秒');
 const selected = body.querySelector('[data-status="2"]');
 panel.update(effects.map(s => ({...s,seconds:s.id===3?200:s.id===2?124:null})));
 expect(order()).toEqual(['2','3','1']);
 expect(body.querySelector('[data-status="2"]')).toBe(selected);
 expect(selected.getAttribute('aria-pressed')).toBe('true');
 expect(body.querySelector('.status-detail-duration').textContent).toBe('剩余时间：2分4秒');
 panel.update([effects[0]]);
 expect(body.querySelector('.status-detail-duration').textContent).toBe('持续时间：永久');
 panel.update([]);
 expect(body.querySelector('.status-detail-duration').hidden).toBe(true);
 expect(body.querySelector('.menu-detail-heading').hidden).toBe(true);
 expect(body.querySelector('.item-description').textContent).toBe('当前没有状态效果');
 expect(effects.map(s=>s.id)).toEqual([1,2,3]);
});
