import { beforeEach, expect, it, vi } from 'vitest';
import { createEquipmentController } from '../../src/UI/Game/GameEquipment.js';
import { createEquipmentPanel } from '../../src/UI/Mobile/game/EquipmentPanel.js';
beforeEach(() => { HTMLElement.prototype.scrollTo = vi.fn(); });
it('supports empty slots, candidate details, explicit wear, removal, groups, and server stat refresh', () => {
 const body = document.body.appendChild(document.createElement('div'));
 let items = [{ index: 3, ID: 100, name: '头饰', count: 1, identified: true, category: 'equipment', location: 256, worn: false, description: '<img src=x>' }];
 let defense = 2; const act = vi.fn(); const service = createEquipmentController({ snapshot: () => items, act }, () => [{ key: 'def', label: '防御', value: defense }]);
 service.preview = vi.fn(async () => null);
 const panel = createEquipmentPanel(body, service); const click = label => [...body.querySelectorAll('button')].find(b => b.textContent === label).click();
 body.querySelector('[data-slot="HEAD_TOP"]').click(); click('选择装备'); body.querySelector('.equipment-candidate').click(); expect(body.querySelector('.item-description img')).toBeNull(); click('确认'); expect(act).toHaveBeenCalledExactlyOnceWith(3, 100, 'equip', 256);
 items = [{ ...items[0], worn: true, wearLocation: 256 }]; defense = 8; panel.update(); expect(body.querySelector('[data-slot="HEAD_TOP"]').textContent).toContain('头饰');
 expect(body.querySelector('.equipment-actions button').textContent).toBe('卸下'); click('卸下'); expect(act).toHaveBeenLastCalledWith(3, 100, 'unequip', undefined);
 click('属性'); expect(body.querySelector('[data-stat="def"]').textContent).toBe('8'); expect(body.querySelector('.equipment-layout').hidden).toBe(true);
 click('时装'); expect(body.querySelector('[data-slot="COSTUME_HEAD_TOP"]').hidden).toBe(false); expect(body.querySelector('[data-slot="HEAD_TOP"]').hidden).toBe(true);
 click('影子'); expect(body.querySelector('[data-slot="SHADOW_WEAPON"]').hidden).toBe(false);
 click('装备'); expect([...body.querySelectorAll('button')].find(b => b.textContent === '更换').disabled).toBe(true);
});
it('replaces an occupied slot through explicit candidate selection without losing the current item before confirmation', () => {
 const body = document.body.appendChild(document.createElement('div'));
 let items = [
  { index: 1, ID: 100, name: '旧头饰', count: 1, identified: true, category: 'equipment', location: 256, wearLocation: 256, worn: true },
  { index: 2, ID: 100, name: '新头饰', count: 1, identified: true, category: 'equipment', location: 256, worn: false }
 ];
 const act = vi.fn(); const service = createEquipmentController({ snapshot: () => items, act }, () => []);
 service.preview = vi.fn(async () => null);
 const panel = createEquipmentPanel(body, service); const click = text => [...body.querySelectorAll('button')].find(b => b.textContent === text).click();
 click('更换');body.querySelector('[data-index="2"]').click();panel.update();expect(body.querySelector('[data-slot="HEAD_TOP"]').textContent).toContain('旧头饰');
 click('确认');expect(act).toHaveBeenCalledExactlyOnceWith(2, 100, 'equip', 256);
 items = [{ ...items[0], worn: false, wearLocation: 0 }, { ...items[1], worn: true, wearLocation: 256 }];panel.update();
 expect(body.querySelector('[data-slot="HEAD_TOP"]').textContent).toContain('新头饰');expect(body.querySelector('.equipment-detail').textContent).toContain('已穿戴');
});

it('reuses equipment details in read-only mode without local stats or mutation actions', () => {
 const body = document.body.appendChild(document.createElement('div'));
 const service = createEquipmentController({snapshot:()=>[
  {index:8,ID:100,name:'对方头饰',count:1,identified:true,worn:true,wearLocation:256,description:'装备说明'}
 ]},()=>[]);
 service.readOnly = true;
 service.preview = vi.fn(async()=>null);
 createEquipmentPanel(body,service);
 expect([...body.querySelectorAll('.equipment-tabs button')].map(b=>b.textContent)).toEqual(['装备','时装','影子']);
 expect(body.querySelector('.equipment-detail').textContent).toContain('对方头饰');
 expect(body.querySelector('.equipment-actions').hidden).toBe(true);
 expect(body.querySelectorAll('.equipment-actions button')).toHaveLength(0);
 body.querySelector('[data-slot="ARMOR"]').click();
 expect(body.querySelector('.equipment-detail').textContent).toContain('未穿戴装备');
 expect(body.querySelector('[data-slot="ARMOR"]').textContent).not.toContain('选择装备');
});
