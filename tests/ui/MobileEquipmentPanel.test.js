import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEquipmentController } from '../../src/UI/Game/GameEquipment.js';
import { createEquipmentPanel } from '../../src/UI/Mobile/game/EquipmentPanel.js';
vi.mock('../../src/UI/Game/EquipmentAvailability.js', () => ({requestEquipmentAvailability:vi.fn(async (_, items)=>({available:items.map(()=>true),blocked:false}))}));
const checkCandidates = async (_, items) => ({available:items.map(()=>true),blocked:false});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => { HTMLElement.prototype.scrollTo = vi.fn(); });
afterEach(() => { vi.useRealTimers(); });
it('supports empty slots, candidate details, explicit wear, removal, groups, and server stat refresh', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 let items = [{ index: 3, ID: 100, name: '头饰', count: 1, identified: true, category: 'equipment', location: 256, worn: false, description: '<img src=x>' }];
 let defense = 2; const act = vi.fn(); const service = createEquipmentController({ snapshot: () => items, act }, () => [{ key: 'def', label: '防御', value: defense }]);
 service.preview = vi.fn(async () => null);
 const panel = createEquipmentPanel(body, service); const click = label => [...body.querySelectorAll('button')].find(b => b.textContent === label).click();
 body.querySelector('[data-slot="HEAD_TOP"]').click(); click('选择装备'); await flush(); body.querySelector('.equipment-candidate').click(); expect(body.querySelector('.item-description img')).toBeNull(); click('确认'); expect(act).toHaveBeenCalledExactlyOnceWith(3, 100, 'equip', 256);
 items = [{ ...items[0], worn: true, wearLocation: 256 }]; defense = 8; panel.update(); expect(body.querySelector('[data-slot="HEAD_TOP"]').textContent).toContain('头饰');
 expect(body.querySelector('.equipment-actions button').textContent).toBe('卸下'); click('卸下'); expect(act).toHaveBeenLastCalledWith(3, 100, 'unequip', undefined);
 click('属性'); expect(body.querySelector('[data-stat="def"]').textContent).toBe('8'); expect(body.querySelector('.equipment-layout').hidden).toBe(true);
 click('时装'); expect(body.querySelector('[data-slot="COSTUME_HEAD_TOP"]').hidden).toBe(false); expect(body.querySelector('[data-slot="HEAD_TOP"]').hidden).toBe(true);
 click('影子'); expect(body.querySelector('[data-slot="SHADOW_WEAPON"]').hidden).toBe(false);
 click('装备'); expect([...body.querySelectorAll('button')].find(b => b.textContent === '更换').disabled).toBe(true);
});
it('replaces an occupied slot through explicit candidate selection without losing the current item before confirmation', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 let items = [
  { index: 1, ID: 100, name: '旧头饰', count: 1, identified: true, category: 'equipment', location: 256, wearLocation: 256, worn: true },
  { index: 2, ID: 100, name: '新头饰', count: 1, identified: true, category: 'equipment', location: 256, worn: false }
 ];
 const act = vi.fn(); const service = createEquipmentController({ snapshot: () => items, act }, () => []);
 service.preview = vi.fn(async () => null);
 const panel = createEquipmentPanel(body, service); const click = text => [...body.querySelectorAll('button')].find(b => b.textContent === text).click();
 click('更换'); await flush();
 expect(body.querySelector('[data-index="2"]').getAttribute('aria-pressed')).toBe('true');
 expect(body.querySelector('.equipment-picker-preview h3').textContent).toBe('新头饰');
 expect(body.querySelector('[data-confirm]').disabled).toBe(false);
 expect(act).not.toHaveBeenCalled();
 panel.update();expect(body.querySelector('[data-slot="HEAD_TOP"]').textContent).toContain('旧头饰');
 click('确认');expect(act).toHaveBeenCalledExactlyOnceWith(2, 100, 'equip', 256);
 items = [{ ...items[0], worn: false, wearLocation: 0 }, { ...items[1], worn: true, wearLocation: 256 }];panel.update();
 expect(body.querySelector('[data-slot="HEAD_TOP"]').textContent).toContain('新头饰');expect(body.querySelector('.equipment-detail').textContent).not.toContain('已穿戴');
});

it('reuses equipment details in read-only mode without local stats or mutation actions', async () => {
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

for (const key of ['HEAD_TOP', 'AMMO', 'COSTUME_HEAD_TOP', 'SHADOW_WEAPON']) {
 for (const candidate of [false, true]) {
  for (const identified of [false, true]) {
   for (const damaged of [false, true]) {
    for (const worn of candidate ? [false, true] : [true]) {
     it(`shows separate relevant status lines for ${key}, candidate=${candidate}, identified=${identified}, damaged=${damaged}, worn=${worn}`, async () => {
      const body = document.body.appendChild(document.createElement('div'));
      const item = {index:1,ID:100,name:'测试装备',count:1,identified,damaged,worn};
      const group = key.startsWith('COSTUME') ? 'costume' : key.startsWith('SHADOW') ? 'shadow' : 'normal';
      const service = {snapshot:()=>({attachment:{mask:0,removal:null},stats:[],slots:[{key,label:'测试部位',group,item,candidates:[item]}]}), checkCandidates, preview:async()=>null};
      createEquipmentPanel(body,service);
      if(group!=='normal')body.querySelector(`[data-group="${group}"]`)?.click();
      body.querySelector(`[data-slot="${key}"]`).click();
      if(candidate) {
       [...body.querySelectorAll('button')].find(b=>b.textContent==='更换').click(); await flush();
       body.querySelector('.equipment-candidate').click();
      }
      const area=body.querySelector(candidate?'.equipment-picker-preview':'.equipment-detail');
      const expected=[key==='AMMO'&&'数量：1',candidate&&worn&&'已穿戴',!identified&&'未鉴定',damaged&&'已损坏'].filter(Boolean);
      expect([...area.querySelectorAll('.inventory-item-metadata p')].map(p=>p.textContent)).toEqual(expected);
      if(!expected.length)expect(area.querySelector('.inventory-item-metadata')).toBeNull();
      body.remove();
     });
    }
   }
  }
 }
}

for (const reason of [null, '等级不足']) {
 it(`previews the first candidate without equipping and respects its restriction: ${reason}`, async () => {
  const body = document.body.appendChild(document.createElement('div'));
  const act = vi.fn();
  const item = {index:2,ID:100,name:'第一件装备',identified:true,reason};
  createEquipmentPanel(body,{snapshot:()=>({slots:[{key:'HEAD_TOP',label:'头饰',group:'normal',candidates:[item,{...item,index:3,name:'第二件装备',reason:null}]}],stats:[],attachment:{mask:0,removal:null}}),checkCandidates, preview:async()=>null,act});
  [...body.querySelectorAll('button')].find(button=>button.textContent==='选择装备').click(); await flush();
  expect(body.querySelector('.ui-confirm-body > p').textContent).toBe('选择头饰装备');
  expect(body.querySelector('.equipment-candidate').getAttribute('aria-pressed')).toBe('true');
  expect(body.querySelector('.equipment-picker-preview h3').textContent).toBe('第一件装备');
  expect(body.querySelector('[data-confirm]').disabled).toBe(Boolean(reason));
  expect(act).not.toHaveBeenCalled();
 });
}

it('removes replacements that become unavailable and disables replacement when none remain', async () => {
 vi.useFakeTimers();
 const body = document.body.appendChild(document.createElement('div'));
 let items = [
  {index:1,ID:100,name:'第一件',worn:false,identified:true,category:'equipment',location:256},
  {index:2,ID:101,name:'第二件',worn:false,identified:true,category:'equipment',location:256},
  {index:3,ID:102,name:'未鉴定装备',worn:false,identified:false,category:'equipment',location:256}
 ];
 const act = vi.fn();
 const service = createEquipmentController({snapshot:()=>items,act},()=>[]);
 service.preview = async()=>null;
 const panel = createEquipmentPanel(body,service);
 [...body.querySelectorAll('button')].find(button=>button.textContent==='选择装备').click(); await flush();
 expect([...body.querySelectorAll('.equipment-candidate')].map(node=>node.dataset.index)).toEqual(['1','2']);
 items = items.map(item=>item.index===1?{...item,damaged:true}:item);
 panel.update(); await vi.advanceTimersByTimeAsync(150);
 expect(body.querySelector('.equipment-candidate[aria-pressed="true"]').dataset.index).toBe('2');
 expect(body.querySelector('.equipment-picker-preview h3').textContent).toBe('第二件');
 items = items.map(item=>({...item,damaged:true}));
 panel.update();
 expect(body.querySelectorAll('.equipment-candidate')).toHaveLength(0);
 expect(body.querySelector('.equipment-picker-preview').textContent).toBe('没有符合穿戴条件的装备');
 expect(body.querySelector('[data-confirm]').disabled).toBe(true);
 expect([...body.querySelectorAll('button')].find(button=>button.textContent==='选择装备').disabled).toBe(true);
 expect(act).not.toHaveBeenCalled();
});
