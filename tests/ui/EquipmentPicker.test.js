import { afterEach, expect, it, vi } from 'vitest';
import { createEquipmentPicker } from '../../src/UI/Mobile/game/EquipmentPicker.js';
afterEach(()=>{ document.body.replaceChildren();vi.useRealTimers(); });
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture(query) {
 const body=document.body.appendChild(document.createElement('div'));
 let state={eligibilityKey:1,slots:[{key:'ARMOR',label:'铠甲',candidates:[{index:2,ID:2301,name:'甲'},{index:3,ID:2302,name:'乙'}]}]};
 const actions={snapshot:()=>state,checkCandidates:vi.fn(query)};
 const equip=vi.fn();
 const picker=createEquipmentPicker(body,state.slots[0],actions,item=>[document.createTextNode(item.name)],equip,state);
 return {body,actions,equip,picker,get state(){return state;},set state(next){state=next;}};
}
it('shows loading then only accepted candidates and equips only after confirmation', async()=>{
 let resolve;
 const f=fixture(()=>new Promise(done=>resolve=done));
 expect(f.body.querySelector('.equipment-picker-list .equipment-picker-message').textContent).toContain('正在检查');
 expect(f.body.querySelector('.equipment-picker-preview').childElementCount).toBe(0);
 expect(f.body.querySelector('[data-confirm]').disabled).toBe(true);
 resolve({available:[false,true],blocked:false});await flush();
 expect(f.body.querySelectorAll('.equipment-candidate')).toHaveLength(1);
 expect(f.body.querySelector('.equipment-picker-preview').textContent).toBe('乙');
 expect(f.equip).not.toHaveBeenCalled();
 f.body.querySelector('[data-confirm]').click();expect(f.equip).toHaveBeenCalledWith(expect.objectContaining({ID:2302}));
});
it('keeps failure distinct from empty and supports retry', async()=>{
 const f=fixture(()=>Promise.reject(new Error('timeout')));await flush();
 expect(f.body.querySelector('.equipment-picker-preview .equipment-picker-message').textContent).toBe('查询失败，请重试');
 expect(f.body.querySelector('.equipment-picker-message').dataset.kind).toBe('error');
 expect(f.body.querySelector('.equipment-picker-list').childElementCount).toBe(0);
 expect(f.body.querySelector('.ui-confirm-actions .equipment-picker-retry').hidden).toBe(false);
 f.actions.checkCandidates.mockResolvedValue({available:[false,false],blocked:false});
 f.body.querySelector('.equipment-picker-retry').click();await flush();
 expect(f.body.querySelector('.equipment-picker-message').textContent).toBe('没有符合穿戴条件的装备');
 expect(f.body.querySelector('[data-confirm]').disabled).toBe(true);
});
it('shows temporary operation blocking without misreporting empty equipment', async()=>{
 const f=fixture(async()=>({available:[true,false],blocked:true}));await flush();
 expect(f.body.querySelector('.equipment-picker-message').textContent).toContain('暂时无法');
 expect(f.body.querySelector('.equipment-candidate')).not.toBeNull();
 expect(f.body.querySelector('[data-confirm]').disabled).toBe(true);
});
it('coalesces relevant changes, cancels obsolete requests and ignores late results', async()=>{
 vi.useFakeTimers();const resolvers=[];
 const f=fixture(()=>new Promise(done=>resolvers.push(done)));
 const oldSignal=f.actions.checkCandidates.mock.lastCall[2];
 f.state={...f.state,eligibilityKey:2};f.picker.refresh(f.state);
 f.state={...f.state,eligibilityKey:3};f.picker.refresh(f.state);
 expect(oldSignal.aborted).toBe(true);
 resolvers[0]({available:[true,true],blocked:false});await flush();
 expect(f.body.querySelectorAll('.equipment-candidate')).toHaveLength(0);
 await vi.advanceTimersByTimeAsync(150);
 expect(f.actions.checkCandidates).toHaveBeenCalledTimes(2);
 resolvers[1]({available:[true,false],blocked:false});await flush();
 f.picker.refresh(f.state);expect(f.actions.checkCandidates).toHaveBeenCalledTimes(2);
 expect(f.body.querySelectorAll('.equipment-candidate')).toHaveLength(1);
});
it('does not let a closed dialog query affect a newly opened one', async()=>{
 let resolve;
 const f=fixture(()=>new Promise(done=>resolve=done));
 const signal=f.actions.checkCandidates.mock.lastCall[2];f.picker.close();
 expect(signal.aborted).toBe(true);
 resolve({available:[true,true],blocked:false});await flush();
 expect(f.body.querySelector('dialog')).toBeNull();expect(f.equip).not.toHaveBeenCalled();
});
