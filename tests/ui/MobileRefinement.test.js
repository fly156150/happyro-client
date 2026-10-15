import {beforeEach, expect, it, vi} from 'vitest';
const state=vi.hoisted(()=>({items:[],session:{Playing:true,zeny:1000,Entity:{action:0,ACTION:{DIE:99}}},send:vi.fn()}));
vi.mock('Engine/SessionStorage.js',()=>({default:state.session}));
vi.mock('UI/Components/Inventory/Inventory.js',()=>({default:{getUI:()=>({list:state.items,getItemByIndex:index=>state.items.find(item=>item.index===index)})}}));
vi.mock('UI/Game/GameInventory.js',()=>({createGameInventory:()=>({snapshot:()=>state.items.map(item=>({index:item.index,ID:item.ITID,category:item.equipment?'equipment':'other',worn:!!item.worn,identified:true,damaged:false}))})}));
vi.mock('Network/NetworkManager.js',()=>({default:{sendPacket:state.send}}));
vi.mock('Network/PacketStructure.js',()=>({default:{CZ:Object.fromEntries(['REFINING_SELECT_ITEM','GRADE_ENCHANT_SELECT_EQUIPMENT','REQ_REFINING','GRADE_ENCHANT_REQ','CLOSE_REFINING_UI','GRADE_ENCHANT_CLOSE_UI'].map(type=>[type,class {constructor(){this.type=type;}}]))}}));
vi.mock('DB/DBManager.js',()=>({default:{getItemInfo:()=>({identifiedDisplayName:'材料'})}}));
import {openGameRefinement,updateRefinementMaterials,finishRefinement} from '../../src/UI/Game/GameRefinement.js';
import {interactionSnapshot,clearInteraction} from '../../src/UI/Game/ServerInteraction.js';
beforeEach(()=>{vi.clearAllMocks();clearInteraction();state.session.zeny=1000;state.session.Playing=true;state.items=[{index:2,ITID:1201,equipment:true,RefiningLevel:7,enchantgrade:0},{index:3,ITID:6635,count:3}];});
function ready(kind='refine'){
 const service=openGameRefinement(kind);service.setOperationGuard(()=>true);expect(service.select(2,1201)).toBe('');
 updateRefinementMaterials(kind,kind==='refine'?{itemIndex:2,blacksmithBlessing:3,MaterialInfo:[{itemId:6635,chance:50,zeny:100}]}:{index:2,success_chance:50,blessing_info:{id:6635,amount:2,max_blessing:2,bonus:1},materialList:[{itemId:6635,amount:2,price:100}]});return service;
}
it('rejects equipment changes and combined material/blacksmith blessing shortage, sends once without local mutation',()=>{
 const service=ready();expect(service.confirm(0,3)).toContain('不足');state.items[1].count=4;state.items[0].worn=true;expect(service.confirm(0,3)).toContain('变化');state.items[0].worn=false;
 expect(service.confirm(0,3)).toBe('');expect(service.confirm(0,3)).toContain('变化');expect(state.send).toHaveBeenLastCalledWith(expect.objectContaining({type:'REQ_REFINING',index:2,itemId:6635,blacksmithBlessing:3}));expect(state.send).toHaveBeenCalledTimes(2);expect(state.items[1].count).toBe(4);
 expect(finishRefinement('refine',{itemIndex:3,result:0})).toBe(false);expect(finishRefinement('refine',{itemIndex:2,result:0})).toBe(true);expect(service.snapshot().message).toBe('强化成功');
});
it('aggregates grade materials with blessings and rechecks currency and grade before requesting',()=>{
 const service=ready('grade');expect(service.confirm(0,1)).toContain('不足');state.items[1].count=4;state.session.zeny=99;expect(service.confirm(0,1)).toContain('不足');state.session.zeny=100;state.items[0].enchantgrade=1;expect(service.confirm(0,1)).toContain('变化');state.items[0].enchantgrade=0;
 expect(service.confirm(0,1)).toBe('');expect(state.send).toHaveBeenLastCalledWith(expect.objectContaining({type:'GRADE_ENCHANT_REQ',index:2,material_index:0,blessing_flag:1,blessing_amount:1,protect_flag:0}));
});
it('ignores wrong-kind materials and stale modal closures and refuses requests after disconnect',()=>{
 const service=ready(),old=interactionSnapshot();expect(updateRefinementMaterials('grade',{index:2})).toBe(false);
 openGameRefinement('grade');const newer=interactionSnapshot();old.close();expect(interactionSnapshot()).toBe(newer);newer.close();newer.close();expect(state.send).toHaveBeenLastCalledWith(expect.objectContaining({type:'GRADE_ENCHANT_CLOSE_UI'}));expect(state.send).toHaveBeenCalledTimes(2);
 state.session.Playing=false;expect(service.confirm(0)).toContain('变化');
});

import {createRefinementPanel} from '../../src/UI/Mobile/game/RefinementPanel.js';
it('releases rejected grade selection and permits choosing another equipment',()=>{
 const service=openGameRefinement('grade');service.setOperationGuard(()=>true);service.select(2,1201);
 expect(updateRefinementMaterials('grade',{index:-1,success_chance:0,materialList:[]})).toBe(true);
 expect(service.snapshot()).toMatchObject({pending:false,allowed:true,selected:null,offer:null,messageKind:'error'});
 expect(service.select(2,1201)).toBe('');
});
it('renders grade percentages directly, including blessing bonuses and the 100 percent cap',()=>{
 const service=ready('grade');
 updateRefinementMaterials('grade',{index:2,success_chance:70,blessing_info:{id:6635,amount:1,max_blessing:4,bonus:10},materialList:[{itemId:6635,amount:1,price:100}]});
 const body=document.createElement('div');document.body.append(body);createRefinementPanel(body,service);
 expect(body.textContent).toContain('成功率：70%');
 const blessing=body.querySelector('input[type="number"]');
 blessing.value='1';blessing.onchange();expect(body.textContent).toContain('成功率：80%');
 blessing.value='4';blessing.onchange();expect(body.textContent).toContain('成功率：100%');
 body.remove();
});
it('does not send zero-base-chance grade requests which the server rejects silently',()=>{
 const service=ready('grade');
 updateRefinementMaterials('grade',{index:2,success_chance:0,blessing_info:{id:6635,amount:1,max_blessing:1,bonus:10},materialList:[{itemId:6635,amount:1,price:100}]});
 expect(service.confirm(0,1)).toBe('此装备当前无法评级');
 expect(state.send).toHaveBeenCalledTimes(1);expect(service.snapshot().pending).toBe(false);
});
