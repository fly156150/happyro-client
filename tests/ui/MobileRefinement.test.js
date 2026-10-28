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
 expect(finishRefinement('refine',{itemIndex:3,result:0})).toBe(false);expect(finishRefinement('refine',{itemIndex:2,result:0})).toBe(true);expect(service.snapshot().message).toBe('精炼成功');
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
 expect(service.confirm(0,1)).toContain('不满足升阶条件');
 expect(state.send).toHaveBeenCalledTimes(1);expect(service.snapshot().pending).toBe(false);
});

it.each([
 ['refine',0,'精炼成功'],['refine',1,'精炼失败，装备损毁'],
 ['refine',2,'精炼失败，精炼等级降低'],['refine',3,'精炼失败，装备保留'],
 ['grade',0,'升阶成功'],['grade',1,'升阶失败'],['grade',2,'升阶失败，精炼等级降低'],
 ['grade',3,'升阶失败，装备损毁'],['grade',4,'装备受到保护']
])('maps %s result %i to its own protocol message', (kind,result,message)=>{
 const service=ready(kind);
 expect(finishRefinement(kind,{itemIndex:2,result})).toBe(true);
 expect(service.snapshot()).toMatchObject({message,pending:false,messageKind:result===0?'success':'error'});
});

it('shows the refine condition before submission even when materials are insufficient',()=>{
 const service=ready('grade');
 updateRefinementMaterials('grade',{index:2,success_chance:0,blessing_info:{id:6635,amount:3,max_blessing:10,bonus:1},materialList:[{itemId:1000326,amount:5,price:875000}]});
 expect(service.snapshot().message).toContain('不满足升阶条件');
 expect(service.confirm(0)).toContain('不满足升阶条件');
 const body=document.createElement('div');document.body.append(body);createRefinementPanel(body,service);
 expect(body.querySelector('.interaction-warning').textContent).toContain('先提高精炼等级');
 expect([...body.querySelectorAll('button')].find(b=>b.textContent==='下一步').disabled).toBe(true);
 body.remove();
});

it('distinguishes grade protection options without changing their shared success chance', () => {
 const service=ready('grade');
 updateRefinementMaterials('grade',{index:2,success_chance:70,blessing_info:{id:6635,amount:1,max_blessing:10,bonus:1},materialList:[{itemId:6635,amount:1,price:175000,breakable:1},{itemId:6635,amount:5,price:875000,breakable:0}]});
 const body=document.createElement('div');document.body.append(body);createRefinementPanel(body,service);
 const select=body.querySelector('select');
 expect([...select.options].map(option=>option.textContent)).toEqual(['可能损毁 · 材料 × 1','装备保留 · 材料 × 5']);
 expect(body.textContent).toContain('成功率：70%');
 expect(body.textContent).toContain('失败时：可能损毁装备');
 select.value='1';select.onchange();
 expect(body.textContent).toContain('费用：875000 Z');
 expect(body.textContent).toContain('成功率：70%');
 expect(body.textContent).toContain('失败时：装备保留，精炼等级不变');
 const blessing=body.querySelector('input');blessing.value='3';blessing.oninput();
 expect(body.textContent).toContain('成功率：73%');
 select.value='0';select.onchange();
 expect(body.textContent).toContain('成功率：73%');
 expect(body.textContent).toContain('费用：175000 Z');
 body.remove();
});

it('updates refining chance by material and retains the separate protection checkbox', () => {
 const service=ready();
 updateRefinementMaterials('refine',{itemIndex:2,blacksmithBlessing:3,MaterialInfo:[{itemId:6635,chance:50,zeny:100},{itemId:984,chance:80,zeny:200}]});
 const body=document.createElement('div');document.body.append(body);createRefinementPanel(body,service);
 const select=body.querySelector('.refinement-material-field select');select.value='1';select.onchange();
 expect(body.textContent).toContain('成功率：80%');
 const blessing=body.querySelector('input[type="checkbox"]');blessing.checked=true;blessing.onchange();
 expect(body.textContent).toContain('成功率：80%');
 expect(body.textContent).toContain('效果：避免装备损毁');
 expect(blessing.getAttribute('role')).toBe('switch');
 expect(body.textContent).toContain('消耗：3 个');
 expect(body.textContent).toContain('持有：3 个');
 expect(body.textContent).toContain('材料：材料 × 1');
 body.remove();
});

it('shows an explicit unavailable message instead of empty refining controls', () => {
 const service=ready();
 updateRefinementMaterials('refine',{itemIndex:2,blacksmithBlessing:0,MaterialInfo:[]});
 const body=document.createElement('div');createRefinementPanel(body,service);
 expect(body.querySelector('.inventory-detail').textContent).toContain('此装备无法精炼');
 expect(body.querySelector('.inventory-detail select')).toBeNull();
 expect(body.querySelector('.interaction-footer .refinement-material-field select').disabled).toBe(true);
 expect([...body.querySelectorAll('button')].find(b=>b.textContent==='下一步').disabled).toBe(true);
 expect(service.snapshot().message).toBe('此装备无法精炼');
});
it('disables blessing when stock is insufficient and refreshes when stock changes', () => {
 const service=ready();state.items[1].count=2;
 const body=document.createElement('div');const panel=createRefinementPanel(body,service);
 expect(body.querySelector('[role="switch"]').disabled).toBe(true);
 expect(body.textContent).toContain('铁匠的祝福不足');
 state.items[1].count=4;panel.update();
 expect(body.querySelector('[role="switch"]').disabled).toBe(false);
 expect(body.textContent).toContain('持有：4 个');
});
it('keeps the unsupported protection switch disabled beside the next action', () => {
 const service=ready();updateRefinementMaterials('refine',{itemIndex:2,blacksmithBlessing:0,MaterialInfo:[{itemId:984,chance:100,zeny:200}]});
 const body=document.createElement('div');createRefinementPanel(body,service);
 expect(body.querySelector('.interaction-footer [role="switch"]').disabled).toBe(true);
 expect(body.querySelector('.interaction-status').hidden).toBe(true);
 expect(body.querySelector('.inventory-detail').textContent).toContain('本次精炼不会失败');
 expect(body.querySelector('.inventory-detail .inventory-item-description')).toBeNull();
});
