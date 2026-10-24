import { expect, it, vi } from 'vitest';
import rawSwitch from '../../src/UI/Components/SwitchEquip/SwitchEquip.js?raw';
import rawInventory from '../../src/UI/Components/Inventory/InventoryCommon.js?raw';
import rawEquipment from '../../src/UI/Components/Equipment/EquipmentCommon.js?raw';
function method(raw, owner, name, deps, indent=0) {
 const source=raw.replace(/\r\n/g,'\n');
 const start=source.indexOf(`${owner}.${name} = function`);
 const end=source.indexOf('\n'+'\t'.repeat(indent)+'};',start);
 return new Function(...Object.keys(deps),`return (${source.slice(source.indexOf('function',start),end+indent+2)});`)(...Object.values(deps));
}
function fixture() {
 const root=document.createElement('div');
 root.innerHTML='<div class="col1 left"></div><div class="col3 right"></div>';
 const callbacks=[];
 const SwitchEquip={_list:{},getRoot:()=>root};
 const deps={SwitchEquip,DB:{INTERFACE_PATH:'',getItemInfo:()=>({identifiedResourceName:'test'}),getItemName:()=> '装备'},Client:{loadFile:(_p,cb)=>callbacks.push(cb)},_escapeHtml:s=>s,getSelectorFromLocation:mask=>[mask&2?'.right':'',mask&32?'.left':''].filter(Boolean).join(', ')};
 for(const name of ['equip','unEquip','clearItems']) SwitchEquip[name]=method(rawSwitch,'SwitchEquip',name,deps);
 return {root,SwitchEquip,callbacks};
}
it('keeps preview state independent of the worn item and clears every occupied cell',()=>{
 const {root,SwitchEquip,callbacks}=fixture();
 const worn={index:1,ITID:1,location:34,equipped:32};
 SwitchEquip.equip(worn,34,false);
 expect(worn.equipped).toBe(32);
 expect(root.querySelectorAll('.item')).toHaveLength(2);
 callbacks.forEach(cb=>cb('current.bmp'));
 for(const button of root.querySelectorAll('button')) expect(button.style.backgroundImage).toContain('current.bmp');
 SwitchEquip.unEquip(1,34);
 expect(root.querySelectorAll('.item')).toHaveLength(0);
 expect(worn.equipped).toBe(32);
});
it('ignores callbacks from an old snapshot even when the source object is reused',()=>{
 const {root,SwitchEquip,callbacks}=fixture();
 const item={index:1,ITID:1,equipped:2};
 SwitchEquip.equip(item,2,false);
 const stale=callbacks.pop();
 SwitchEquip.clearItems();
 SwitchEquip.equip(item,2,true);
 callbacks.pop()('new.bmp');
 stale('old.bmp');
 expect(root.querySelector('button').style.backgroundImage).toContain('new.bmp');
 expect(root.querySelector('button').style.filter).not.toBe('grayscale(100%)');
});
it('uses the actual worn slot when restoring the baseline preview',()=>{
 const Component={}; const SwitchEquip={equip:vi.fn()};
 const item={index:1,location:34,equipped:32};
 Component.equipItemsToSwitch=method(rawEquipment,'Component','equipItemsToSwitch',{_list:{1:item},SwitchEquip},2);
 Component.equipItemsToSwitch();
 expect(SwitchEquip.equip).toHaveBeenCalledWith(item,32,false);
});

it('rebuilds full and empty snapshots with the real preview and worn-equipment methods',()=>{
 const {root,SwitchEquip,callbacks}=fixture();
 const worn={index:1,ITID:1,location:34,equipped:32};
 const EquipmentUI={};
 EquipmentUI.equipItemsToSwitch=method(rawEquipment,'Component','equipItemsToSwitch',{_list:{1:worn},SwitchEquip},2);
 const inventoryRoot=document.createElement('div');
 inventoryRoot.innerHTML='<div class="item" data-index="2"><i class="switch1"></i><i class="switch2"></i></div>';
 const inventory={equipswitchlist:[],getRoot:()=>inventoryRoot,getItemByIndex:index=>index===2?{index:2,ITID:2,location:34}:null};
 const chat=vi.fn();
 const deps={Component:inventory,Equipment:{getUI:()=>EquipmentUI},SwitchEquip,ChatBox:{addText:chat},Client:{loadFile:(_p,cb)=>callbacks.push(cb)},DB:{INTERFACE_PATH:''}};
 for(const name of ['setSwitchItems','addItemtoSwitch']) inventory[name]=method(rawInventory,'Component',name,deps,2);
 inventory.setSwitchItems([{index:2,location:2}]);
 expect(root.querySelector('.right .item').dataset.index).toBe('2');
 expect(root.querySelector('.left .item').dataset.index).toBe('1');
 inventory.setSwitchItems([]);
 callbacks.forEach(cb=>cb('icon.bmp'));
 expect(root.querySelector('.right .item')).toBeNull();
 expect(root.querySelector('.left .item').dataset.index).toBe('1');
 expect(worn.equipped).toBe(32);
 expect(Object.keys(SwitchEquip._list)).toEqual(['1']);
 expect(chat).not.toHaveBeenCalled();
});
it('closing and reopening the preview preserves its current snapshot',()=>{
 const {SwitchEquip}=fixture();
 const Renderer={render:vi.fn(),stop:vi.fn()};
 SwitchEquip._host=document.createElement('div');
 SwitchEquip._host.style.display='none';
 SwitchEquip.focus=vi.fn();
 SwitchEquip.toggle=method(rawSwitch,'SwitchEquip','toggle',{Renderer,swaprender:()=>{}});
 SwitchEquip.equip({index:1,ITID:1},32,true);
 const snapshot=SwitchEquip._list;
 SwitchEquip.toggle(); SwitchEquip.toggle(); SwitchEquip.toggle();
 expect(SwitchEquip._list).toBe(snapshot);
 expect(Object.keys(snapshot)).toEqual(['1']);
 expect(Renderer.render).toHaveBeenCalledTimes(2);
 expect(Renderer.stop).toHaveBeenCalledOnce();
});
