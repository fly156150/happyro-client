import { expect, it, vi } from 'vitest';
import { createNaviPresentations } from '../../src/UI/Components/Navigation/NaviPresentations.js';
function deferred() { let resolve, reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; }
for (const mobile of [false,true]) {
 it(`does not open a stale monster target after asynchronous loading (${mobile?'mobile':'desktop'})`,async()=>{
  const pending=deferred();const tools={openMonster:vi.fn(),showMonster:vi.fn()};let current=true;
  const present=vi.fn();const actions=createNaviPresentations({isMobile:()=>mobile,loadMobileTools:()=>pending.promise,loadDesktopTools:()=>pending.promise,present});
  const loading=actions.openMonster(1784,()=>current);current=false;pending.resolve(tools);await loading;
  expect(tools.openMonster).not.toHaveBeenCalled();expect(tools.showMonster).not.toHaveBeenCalled();expect(present).not.toHaveBeenCalled();
 });
}
it('ignores obsolete failures and only opens a current map',async()=>{
 const pending=deferred();let current=true;const present=vi.fn();const navigation={show:vi.fn(),setNaviInfo:vi.fn()};
 const actions=createNaviPresentations({isMobile:()=>false,loadNavigation:()=>pending.promise,present});
 const failed=actions.openMap({mapName:'prontera',x:100,y:200},()=>current);current=false;pending.reject(new Error('chunk failed'));await failed;expect(present).not.toHaveBeenCalled();
 const currentActions=createNaviPresentations({isMobile:()=>false,loadNavigation:async()=>navigation,present});
 await currentActions.openMap({mapName:'prontera',x:100,y:200,name:'城门'},()=>true);
 expect(navigation.setNaviInfo).toHaveBeenCalledWith('prontera,100,200','城门');
});
