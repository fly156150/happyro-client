import { expect, it, vi } from 'vitest';
import { createEquipmentController } from '../../src/UI/Game/GameEquipment.js';
import Location from '../../src/DB/Items/EquipmentLocation.js';

it('maps actual worn masks, multi-slot equipment and separate left/right accessories without duplicating candidates', () => {
 const items = [
  { index: 1, ID: 100, worn: true, wearLocation: Location.HEAD_TOP | Location.HEAD_MID },
  { index: 2, ID: 200, worn: true, wearLocation: Location.ACCESSORY2, location: Location.ACCESSORY1 | Location.ACCESSORY2 },
  { index: 3, ID: 200, worn: false, identified: true, category: 'equipment', location: Location.ACCESSORY1 | Location.ACCESSORY2 },
  { index: 4, ID: 300, worn: false, category: 'other', location: Location.HEAD_TOP }
 ];
 const act = vi.fn(); const service = createEquipmentController({ snapshot: () => items, act }, () => []);
 const state = service.snapshot(); const slot = key => state.slots.find(s => s.key === key);
 expect(slot('HEAD_TOP').item.index).toBe(1); expect(slot('HEAD_MID').item.index).toBe(1);
 expect(slot('ACCESSORY1').item).toBeUndefined(); expect(slot('ACCESSORY2').item.index).toBe(2);
 expect(slot('ACCESSORY2').candidates.map(i => i.index)).toEqual([3]); expect(slot('HEAD_TOP').candidates).toEqual([]);
 service.act('ACCESSORY2', 3, 200, 'equip'); expect(act).toHaveBeenCalledExactlyOnceWith(3, 200, 'equip', Location.ACCESSORY2);
 service.act('HEAD_MID', 1, 100, 'unequip'); expect(act).toHaveBeenLastCalledWith(1, 100, 'unequip', undefined);
});
it('rejects stale indices, changed IDs, wrong slots and unsupported actions using a fresh snapshot', () => {
 let items = [{ index: 4, ID: 300, worn: false, identified: true, category: 'equipment', location: Location.ARMOR }];
 const act = vi.fn(); const service = createEquipmentController({ snapshot: () => items, act }, () => []);
 service.act('HEAD_TOP', 4, 300, 'equip'); service.act('ARMOR', 4, 301, 'equip'); service.act('ARMOR', 4, 300, 'use');
 items = []; service.act('ARMOR', 4, 300, 'equip'); expect(act).not.toHaveBeenCalled();
});

it('refreshes left-hand choices after gaining and losing dual-wield eligibility', () => {
 let items = [{ index: 9, ID: 1201, worn: false, identified: true, category: 'equipment', location: Location.WEAPON }];
 const act = vi.fn();
 const controller = createEquipmentController({ snapshot: () => items, act }, () => []);
 const left = () => controller.snapshot().slots.find(slot => slot.key === 'SHIELD');
 expect(left().candidates).toEqual([]);
 items = [{ ...items[0], location: Location.WEAPON | Location.SHIELD }];
 expect(left().candidates.map(item => item.index)).toEqual([9]);
 controller.act('SHIELD', 9, 1201, 'equip');
 expect(act).toHaveBeenLastCalledWith(9, 1201, 'equip', Location.SHIELD);
 items = [{ ...items[0], location: Location.WEAPON }];
 expect(left().candidates).toEqual([]);
 act.mockClear();
 controller.act('SHIELD', 9, 1201, 'equip');
 expect(act).not.toHaveBeenCalled();
});

it('filters unavailable replacements and rechecks eligibility before equipping', () => {
 const usable = { index: 1, ID: 2301, worn: false, identified: true, damaged: false, reason: '', category: 'equipment', location: Location.ARMOR };
 let items = [usable, {...usable,index:2,identified:false}, {...usable,index:3,damaged:true}, {...usable,index:4,reason:'当前无法操作物品'}, {...usable,index:5,location:Location.SHOES}];
 const act = vi.fn();
 const controller = createEquipmentController({snapshot:()=>items,act},()=>[]);
 const armor = () => controller.snapshot().slots.find(slot=>slot.key==='ARMOR');
 expect(armor().candidates.map(item=>item.index)).toEqual([1]);
 items = items.map(item=>({...item,damaged:true}));
 expect(armor().candidates).toEqual([]);
 controller.act('ARMOR',1,2301,'equip');
 expect(act).not.toHaveBeenCalled();
});
