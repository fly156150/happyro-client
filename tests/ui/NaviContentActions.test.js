import { expect,it,vi } from 'vitest';
import {createNaviContentActions} from '../../src/UI/Components/Navigation/NaviContentActions.js';
function setup(loadTools) {
 const tools={openMap:vi.fn(),openMonster:vi.fn(),showMap:vi.fn(),showMonster:vi.fn()};
 const close=vi.fn();const suspend=vi.fn(()=>({restore:vi.fn()}));const beginVisit=vi.fn(()=>({close}));const failed=vi.fn();
 const service=createNaviContentActions({manifest:{entries:{'map,1,2':{kind:'coordinate',mapName:'map',x:1,y:2},'mob,0,0':{kind:'monster',monsterId:1002},'bad,1,2':{kind:'blocked'}}},loadTools:loadTools||(()=>Promise.resolve(tools)),mobile:()=>true,suspend,beginVisit,failed});
 return {service,tools,suspend,close,failed};
}
it('routes coordinate and monster links to their normal mobile tools',async()=>{
 const {service,tools,close}=setup();await service.activate('map,1,2','位置');expect(tools.openMap).toHaveBeenCalledWith({id:'map',mapName:'map',x:1,y:2,name:'位置'},undefined,close);
 await service.activate('mob,0,0','魔物');expect(tools.openMonster).toHaveBeenCalledWith(1002,close);
 expect(await service.activate('bad,1,2','错误')).toBe(false);expect(service.available('missing')).toBe(false);
});
it('ignores stale loads and disconnected source links without hiding their windows',async()=>{
 let resolve;const {service,suspend}=setup(()=>new Promise(r=>{resolve=r;}));
 const pending=service.activate('map,1,2');service.reset();resolve({});expect(await pending).toBe(false);expect(suspend).not.toHaveBeenCalled();
 const source=document.createElement('a');const detached=service.activate('map,1,2','位置',source);resolve({});expect(await detached).toBe(false);expect(suspend).not.toHaveBeenCalled();
});
it('restores its source if opening tools throws',async()=>{
 const {service,close,failed}=setup(()=>Promise.resolve({openMap:()=>{throw Error('failed');}}));expect(await service.activate('map,1,2')).toBe(false);expect(close).toHaveBeenCalledOnce();expect(failed).toHaveBeenCalledOnce();
});
