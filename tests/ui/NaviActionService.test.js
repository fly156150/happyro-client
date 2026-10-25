import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ end: null, showMap: vi.fn(), showMonster: vi.fn() }));
vi.mock('UI/Platform.js',()=>({default:{isMobile:false}}));
vi.mock('Network/ConnectionLifecycle.js',()=>({onConnectionEnd:fn=>{state.end=fn;}}));
vi.mock('UI/Components/GameTools/GameTools.js',()=>({default:state}));
import manifest from '../../src/DB/Navigation/NaviTargets.json';
import { activateNavi, handleNaviClick, prepareNaviLinks } from '../../src/UI/Components/Navigation/NaviActionService.js';
import { abandonNavigationVisit } from '../../src/UI/Game/NavigationVisit.js';
const approved=Object.entries(manifest.entries).find(([,entry])=>entry.kind==='coordinate');
beforeEach(()=>{vi.clearAllMocks();state.end();vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{state.end();document.body.replaceChildren();vi.unstubAllGlobals();});
function source(key=approved[0]) {
 const host=document.body.appendChild(document.createElement('div'));host.id='ItemInfo';
 const root=host.attachShadow({mode:'open'});root.innerHTML='<div class="description"><span data-navi-info><span>目标</span></span></div>';
 root.querySelector('[data-navi-info]').dataset.naviInfo=key;
 prepareNaviLinks(root);root.addEventListener('click',handleNaviClick);root.addEventListener('keydown',handleNaviClick);
 return {host,root,link:root.querySelector('[data-navi-info]')};
}
it('opens the ordinary marked map, hides its source, and restores the same DOM on close',async()=>{
 const {host,root,link}=source();const detail=root.querySelector('.description');detail.scrollTop=87;
 link.firstChild.click();await vi.waitFor(()=>expect(state.showMap).toHaveBeenCalledOnce());
 expect(state.showMap.mock.calls[0][0]).toEqual({id:approved[1].mapName,mapName:approved[1].mapName,x:approved[1].x,y:approved[1].y,name:'目标'});
 expect(host.style.display).toBe('none');expect(fetch).not.toHaveBeenCalled();
 state.showMap.mock.calls[0][1]();expect(host.style.display).toBe('');expect(root.querySelector('.description')).toBe(detail);expect(detail.scrollTop).toBe(87);
});
it('does not restore the source after travel begins',async()=>{
 const {host,link}=source();await activateNavi(approved[0],'目标',link);abandonNavigationVisit();state.showMap.mock.calls[0][1]();expect(host.style.display).toBe('none');
});
it('opens monster catalog from a keyboard link and restores on close',async()=>{
 const [key,entry]=Object.entries(manifest.entries).find(([,entry])=>entry.kind==='monster');const {host,link}=source(key);
 link.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await vi.waitFor(()=>expect(state.showMonster).toHaveBeenCalledWith(entry.monsterId,expect.any(Function)));
 state.showMonster.mock.calls[0][1]();expect(host.style.display).toBe('');
});
it('keeps invalid links readable but noninteractive',async()=>{
 const {host,link}=source('unknown,1,1');expect(link.classList.contains('navi-link')).toBe(false);expect(link.hasAttribute('tabindex')).toBe(false);
 link.click();await Promise.resolve();expect(state.showMap).not.toHaveBeenCalled();expect(host.style.display).toBe('');
});
