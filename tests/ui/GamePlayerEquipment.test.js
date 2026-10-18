import { expect, it, vi } from 'vitest';
vi.mock('../../src/UI/Game/GameInventory.js',()=>({
 createGameInventory:()=>({describe:item=>({index:item.index,ID:item.ITID,name:'装备',count:1})})
}));
vi.mock('../../src/UI/Game/ItemPreview.js',()=>({
 createItemPreviewLoader:()=>vi.fn(async item=>({image:String(item.ITID)}))
}));
import { showPlayerEquipment } from '../../src/UI/Game/GamePlayerEquipment.js';
import { interactionSnapshot, showInteraction, clearInteraction } from '../../src/UI/Game/ServerInteraction.js';

it('maps actual worn slots instead of allowed locations and protects a subsequent interaction', async()=>{
 const raw={index:3,ITID:100,location:136,WearState:8};
 showPlayerEquipment({characterName:'对方',ItemInfo:[raw]});
 const state=interactionSnapshot(), service=state.service;
 expect(state.title).toBe('对方 · 装备');
 expect(service.readOnly).toBe(true);
 const snapshot=service.snapshot();
 expect(snapshot.slots.find(s=>s.key==='ACCESSORY1').item?.ID).toBe(100);
 expect(snapshot.slots.find(s=>s.key==='ACCESSORY2').item).toBeNull();
 expect(snapshot.stats).toEqual([]);
 expect(snapshot.attachment.mask).toBe(0);
 expect(await service.preview(3,100)).toEqual({image:'100'});
 expect(await service.preview(3,101)).toBeNull();
 expect(raw).not.toHaveProperty('equipped');
 showInteraction({kind:'trade',token:Symbol()});state.close();
 expect(interactionSnapshot().kind).toBe('trade');
 clearInteraction();
 showPlayerEquipment({characterName:'空装备',ItemInfo:[]});
 interactionSnapshot().close();expect(interactionSnapshot()).toBeNull();
});
