import { afterEach, expect, it, vi } from 'vitest';
import { createMobileViewport } from '../../src/UI/Mobile/game/MobileViewport.js';
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });
it('preserves layout height during keyboard input, follows its offset and restores on dismissal', () => {
 const host=document.createElement('div'); const root=host.attachShadow({mode:'open'});
 root.innerHTML='<input>'; document.body.append(host);
 vi.stubGlobal('innerWidth',844); vi.stubGlobal('innerHeight',390);
 const visual={width:844,height:390,offsetTop:0};vi.stubGlobal('visualViewport',visual);
 const update=createMobileViewport(host);update();root.querySelector('input').focus();
 visual.height=170;visual.offsetTop=20;update();
 expect(host.style.height).toBe('170px');expect(host.style.top).toBe('20px');
 expect(host.style.getPropertyValue('--mobile-layout-height')).toBe('390px');expect(host.classList.contains('keyboard-open')).toBe(true);
 visual.height=390;visual.offsetTop=0;update();expect(host.classList.contains('keyboard-open')).toBe(false);
});
it('accepts an actual orientation width change instead of retaining the old height', () => {
 const host=document.createElement('div');const root=host.attachShadow({mode:'open'});root.innerHTML='<input>';document.body.append(host);
 vi.stubGlobal('innerWidth',844);vi.stubGlobal('innerHeight',390);const update=createMobileViewport(host);update();root.querySelector('input').focus();
 vi.stubGlobal('innerWidth',390);vi.stubGlobal('innerHeight',844);update();
 expect(host.style.width).toBe('390px');expect(host.style.getPropertyValue('--mobile-layout-height')).toBe('844px');
});

it('scrolls only the overlay to reveal a focused input after the keyboard opens', () => {
 const host = document.createElement('div');
 const root = host.attachShadow({mode:'open'});root.innerHTML='<input>';
 document.body.append(host);host.style.overflowY='auto';
 const input=root.querySelector('input');
 vi.stubGlobal('innerWidth',844);vi.stubGlobal('innerHeight',390);
 const visual={height:390,offsetTop:0};vi.stubGlobal('visualViewport',visual);
 let frame;vi.stubGlobal('requestAnimationFrame',fn=>{frame=fn;return 1;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
 Object.defineProperties(host,{scrollHeight:{value:390},clientHeight:{get:()=>visual.height}});
 host.getBoundingClientRect=()=>({top:visual.offsetTop,bottom:visual.offsetTop+visual.height});
 input.getBoundingClientRect=()=>({top:300-host.scrollTop,bottom:328-host.scrollTop,height:28});
 const update=createMobileViewport(host);update();input.focus();
 visual.height=170;visual.offsetTop=20;update();frame();
 expect(host.scrollTop).toBe(146);
 expect(input.getBoundingClientRect().bottom).toBe(182);
 expect(document.documentElement.scrollTop).toBe(0);
 input.blur();update();expect(host.classList.contains('keyboard-open')).toBe(true);
 visual.height=390;visual.offsetTop=0;update();expect(host.classList.contains('keyboard-open')).toBe(false);
 update.destroy();
});

it('keeps the tablet density during keyboard resizing and recomputes for split view', () => {
 const host=document.createElement('div');const root=host.attachShadow({mode:'open'});root.innerHTML='<input>';document.body.append(host);
 vi.stubGlobal('innerWidth',1024);vi.stubGlobal('innerHeight',768);const visual={height:768,offsetTop:0};vi.stubGlobal('visualViewport',visual);
 const update=createMobileViewport(host);update();expect(host.dataset.menuDensity).toBe('spacious');
 root.querySelector('input').focus();visual.height=320;update();expect(host.dataset.menuDensity).toBe('spacious');
 vi.stubGlobal('innerWidth',600);vi.stubGlobal('innerHeight',768);visual.height=768;update();expect(host.dataset.menuDensity).toBe('compact');update.destroy();
});

it('recomputes density for small split-view changes even while a field is focused', () => {
 const host=document.createElement('div'),root=host.attachShadow({mode:'open'});root.innerHTML='<input>';document.body.append(host);
 vi.stubGlobal('innerWidth',800);vi.stubGlobal('innerHeight',768);const visual={height:768,offsetTop:0};vi.stubGlobal('visualViewport',visual);
 const update=createMobileViewport(host);update();root.querySelector('input').focus();visual.height=320;update();
 vi.stubGlobal('innerWidth',760);update();expect(host.dataset.menuDensity).toBe('compact');update.destroy();
});

it('shares portrait direction with every menu host without reacting to the software keyboard', () => {
 const host=document.createElement('div'),root=host.attachShadow({mode:'open'});root.innerHTML='<input>';document.body.append(host);
 vi.stubGlobal('innerWidth',390);vi.stubGlobal('innerHeight',844);
 const visual={height:844,offsetTop:0};vi.stubGlobal('visualViewport',visual);
 const update=createMobileViewport(host);update();expect(host.dataset.orientation).toBe('portrait');
 root.querySelector('input').focus();visual.height=300;update();expect(host.dataset.orientation).toBe('portrait');
 vi.stubGlobal('innerWidth',844);vi.stubGlobal('innerHeight',390);visual.height=390;update();expect(host.dataset.orientation).toBe('landscape');
 update.destroy();
});

it('uses the physical screen to keep narrow tablet windows out of phone layouts', () => {
 const host = document.createElement('div');
 vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844);
 vi.stubGlobal('screen', { width: 820, height: 1180 });
 const update = createMobileViewport(host);
 update(); expect(host.hasAttribute('data-phone-screen')).toBe(false);
 vi.stubGlobal('screen', { width: 390, height: 844 });
 update(); expect(host.hasAttribute('data-phone-screen')).toBe(true);
 vi.stubGlobal('innerWidth', 844); vi.stubGlobal('innerHeight', 390);
 update(); expect(host.hasAttribute('data-phone-screen')).toBe(true);
 expect(host.dataset.orientation).toBe('landscape');
 update.destroy();
});
