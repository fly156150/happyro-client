import Preferences from '../../src/Core/Preferences.js';
import preferences from '../../src/Preferences/AdventureTools.js';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const world = vi.hoisted(() => ({ map: 'prontera' }));
vi.mock('Network/NetworkManager.js', () => ({ default: {} }));
vi.mock('Network/PacketStructure.js', () => ({ default: {} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: { listNavigation: async () => [] } }));
vi.mock('../../src/UI/Components/GameTools/AdventureActionService.js', () => ({
	getCurrentAdventureMap: () => world.map,
	getAdventureActionState: () => ({}),
	subscribeAdventureActions: () => () => {},
	teleportToMap: vi.fn()
}));
import tab from '../../src/UI/Components/GameTools/MonsterCatalogTab.js';
let root, cleanup;
afterEach(() => {
	cleanup?.();
	root?.remove();
	vi.unstubAllGlobals();
 vi.useRealTimers();
});
it('uses Mini and MVP labels and preserves current-map scope until the user views all', async () => {
 vi.useFakeTimers();
 const catalog = JSON.parse(readFileSync('applications/pwa/data/monsters/catalog.json'));
 const drops = JSON.parse(readFileSync('applications/pwa/data/monsters/drops.json'));
 vi.stubGlobal('fetch', vi.fn(async url => ({ok:true, json:async()=>String(url).endsWith('/drops.json') ? drops : catalog})));
 root=document.createElement('div');document.body.append(root);cleanup=tab.mount(root);
 await vi.advanceTimersByTimeAsync(0);
 const scope=root.querySelector('.catalog-scope-filter');
 expect(scope.checked).toBe(true);
 expect(root.querySelector('.monster-summary').textContent).toBe('');
 expect(root.querySelector('[data-value=mini]').textContent).toContain('Mini');
 expect(root.querySelector('[data-value=mvp]').textContent).toContain('MVP');
 root.querySelector('.catalog-empty-state button').click();
 expect(scope.checked).toBe(false);
 expect(JSON.parse(localStorage.getItem('AdventureTools')).monsterCurrentMap).toBe(false);
 expect(root.querySelector('.monster-summary').textContent).toBe('');
 const search=root.querySelector('.monster-search');
 search.value='1096';search.dispatchEvent(new Event('input'));
 expect(root.querySelector('.monster-badge').textContent).toBe('Mini');
 search.value='1039';search.dispatchEvent(new Event('input'));
 expect(root.querySelector('.monster-badge').textContent).toBe('MVP');
 search.value='';search.dispatchEvent(new Event('input'));
 scope.checked=true;scope.dispatchEvent(new Event('change'));
 expect(scope.checked).toBe(true);
 expect(root.querySelectorAll('.monster-row')).toHaveLength(0);
 world.map='geffen';await vi.advanceTimersByTimeAsync(500);
 expect(scope.checked).toBe(true);
 scope.checked=true;scope.dispatchEvent(new Event('change'));
 search.value='missing';search.dispatchEvent(new Event('input'));
 world.map='payon';await vi.advanceTimersByTimeAsync(500);
 expect(scope.checked).toBe(true);
 expect(search.value).toBe('missing');
});

it.each([false, true])('keeps disabled action buttons during loading and empty MVP searches (mobile: %s)', async mobile => {
 vi.useFakeTimers();world.map='prontera';
 const catalog=JSON.parse(readFileSync('applications/pwa/data/monsters/catalog.json'));
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>catalog})));
 root=document.createElement('div');document.body.append(root);cleanup=tab.mount(root,{mobile});
 const expectDisabled=()=>{
  expect(root.querySelectorAll('.summon-panel')).toHaveLength(1);
  expect(root.querySelector('.summon-button').disabled).toBe(true);
  expect(root.querySelector('.monster-map-teleport').disabled).toBe(true);
 };
 expectDisabled();await vi.advanceTimersByTimeAsync(0);
 const filter=root.querySelector('.monster-filter');filter.value='mvp';filter.dispatchEvent(new Event('change'));
 expect(root.querySelector('.catalog-scope-filter').checked).toBe(true);
 expect(root.querySelectorAll('.monster-row')).toHaveLength(0);expectDisabled();
 const search=root.querySelector('.monster-search');search.value='missing';search.dispatchEvent(new Event('input'));expectDisabled();
 search.value='';search.dispatchEvent(new Event('input'));
 const scope=root.querySelector('.catalog-scope-filter');scope.checked=false;scope.dispatchEvent(new Event('change'));
 expect(root.querySelector('.monster-overview')).not.toBeNull();
 expect(root.querySelectorAll('.summon-panel')).toHaveLength(1);
 scope.checked=true;scope.dispatchEvent(new Event('change'));expectDisabled();
});

beforeEach(() => { preferences.monsterCurrentMap = true; preferences.npcCurrentMap = true; });

it('remembers explicit scope after remount without changing the other catalog', async () => {
 vi.useFakeTimers();
 const catalog=JSON.parse(readFileSync('applications/pwa/data/monsters/catalog.json'));
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>catalog})));
 root=document.createElement('div');document.body.append(root);cleanup=tab.mount(root);
 await vi.advanceTimersByTimeAsync(0);
 const scope=root.querySelector('.catalog-scope-filter');
 scope.checked=false;scope.dispatchEvent(new Event('change'));
 await vi.advanceTimersByTimeAsync(0);
 const saved=JSON.parse(localStorage.getItem('AdventureTools'));
 expect(saved.monsterCurrentMap).toBe(false);
 expect(Preferences.get('AdventureTools', { monsterCurrentMap: true, npcCurrentMap: true }, 1.0).monsterCurrentMap).toBe(false);
 expect(saved.npcCurrentMap).toBe(true);
 cleanup();cleanup=tab.mount(root);
 await vi.advanceTimersByTimeAsync(0);
 expect(root.querySelector('.catalog-scope-filter').checked).toBe(false);
 world.map='empty_map';await vi.advanceTimersByTimeAsync(500);
 expect(root.querySelector('.catalog-scope-filter').checked).toBe(false);
});

it.each([true, false])('opens a drop monster without saving scope and shows return only on mobile=%s', async mobile => {
 vi.useFakeTimers();preferences.monsterCurrentMap=true;world.map='prontera';
 const catalog=JSON.parse(readFileSync('applications/pwa/data/monsters/catalog.json'));
 const drops=JSON.parse(readFileSync('applications/pwa/data/monsters/drops.json'));
 vi.stubGlobal('fetch',vi.fn(async url=>({ok:true,json:async()=>String(url).endsWith('/drops.json')?drops:catalog})));
 const returnToItem=vi.fn();
 root=document.createElement('div');document.body.append(root);
 cleanup=tab.mount(root,{mobile,initialMonsterId:1002,returnToItem});await vi.advanceTimersByTimeAsync(0);
 expect(root.querySelector('.monster-row.selected').dataset.id).toBe('1002');
 expect(root.querySelector('.catalog-scope-filter').checked).toBe(false);
 expect(preferences.monsterCurrentMap).toBe(true);
 root.dispatchEvent(new CustomEvent('game-tools-open-monster',{detail:1039}));
 expect(root.querySelector('.monster-row.selected').dataset.id).toBe('1039');
 if(mobile){root.querySelector('.monster-return-item').click();expect(returnToItem).toHaveBeenCalledOnce();}
 else expect(root.querySelector('.monster-return-item')).toBeNull();
});
