vi.mock('../../src/UI/Components/GameTools/ArrivalPreviewService.js', () => ({requestArrivalPreview:vi.fn(async()=>({x:168,y:373}))}));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ options: null }));
vi.mock('Core/Client.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: { TYPE: { WALKABLE: 1 } } }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: { currentMap: 'prontera' } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMapInfo: () => null, getMapName: name => name } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { NavigationTeleportAllowed: true } }));
vi.mock('../../src/UI/Components/GameTools/RemoteCatalogBrowser.js', () => ({
 mountRemoteCatalogBrowser: (_, options) => { state.options = options; return () => {}; }
}));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
 loadAdventureMapNpcs: async () => [], searchAdventureMaps: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/AdventureActionService.js', () => ({
 getCurrentAdventureMap: () => 'prontera', getCurrentAdventurePosition: () => ({ x: 1, y: 1 }),
 normalizeAdventureMap: name => name, getAdventureActionState: () => ({ canTeleport: true }),
 subscribeAdventureActions: () => () => {}, teleportToCoordinate: vi.fn(() => true), teleportToNpc: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/AdventureRouteService.js', () => ({
 subscribeAdventureRoute: () => () => {}, previewAdventureRoute: vi.fn(), startAdventureRoute: vi.fn(), stopAdventureRoute: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/NpcAvailabilityService.js', () => ({ npcAvailabilityBatches: vi.fn(), requestNpcAvailability: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/WorldMapPreview.js', () => ({ drawWorldMapPreview: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/WorldCatalogService.js', () => ({ toCatalogNpcs: () => [], npcCatalogKey: vi.fn(), npcTeleportEnabled: vi.fn() }));
vi.mock('UI/Components/Navigation/NavigationAutoWalk.js', () => ({ remainingPathFromPosition: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/WorldAssetService.js', async original => ({
 ...await original(), loadCatalogMap: async () => ({}), loadCatalogMapImage: async () => null,
 loadNpcAssets: async () => ({ mapImages: [] }), canvasToMapCoordinate: () => ({ x: 9, y: 11 })
}));
import catalog from '../../src/UI/Components/GameTools/MapCatalogTab.js';
import { teleportToCoordinate } from '../../src/UI/Components/GameTools/AdventureActionService.js';
let container, cleanup;
beforeEach(() => { vi.useFakeTimers();vi.clearAllMocks();container=document.body.appendChild(document.createElement('div')); });
afterEach(() => { cleanup?.();document.body.replaceChildren();vi.useRealTimers(); });
async function mount(mapName, context={}) {
 cleanup=catalog.mount(container,context);
 const map={id:mapName,mapName,name:mapName};
 const api={ refreshDetail: () => state.options.renderDetail(container,map,api) };
 state.options.onReady(api);api.refreshDetail();await vi.advanceTimersByTimeAsync(0);
}
it.each([false,true])('uses server arrival selection, then preserves a manual coordinate (mobile=%s)',async mobile=>{
 await mount('comodo',{mobile});
 expect(container.textContent).toContain('自动选择安全落点');
 const teleport=container.querySelector('.catalog-teleport');expect(teleport.disabled).toBe(false);teleport.click();
 expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({mapName:'comodo',x:0,y:0,automatic:true}));
 container.querySelector('.catalog-map-picker').click();container.querySelector('.catalog-teleport').click();
 expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({mapName:'comodo',x:9,y:11}));
 expect(teleportToCoordinate.mock.lastCall[0].automatic).toBeUndefined();
});
it('asks the server to recheck city defaults too',async()=>{
 await mount('geffen');container.querySelector('.catalog-teleport').click();
 expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({mapName:'geffen',x:0,y:0,automatic:true}));
});
it('does not replace an explicitly supplied initial coordinate',async()=>{
 await mount('comodo',{initialMap:{id:'comodo',x:50,y:60}});container.querySelector('.catalog-teleport').click();
 expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({mapName:'comodo',x:50,y:60}));
});

it('draws the preview while retaining automatic teleport semantics',async()=>{
 await mount('prt_fild08');
 const {drawWorldMapPreview}=await import('../../src/UI/Components/GameTools/WorldMapPreview.js');
 expect(drawWorldMapPreview.mock.lastCall[2]).toEqual({x:168,y:373});
 expect(container.querySelector('.catalog-route').disabled).toBe(true);
 container.querySelector('.catalog-teleport').click();
 expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({x:0,y:0,automatic:true}));
});

it('does not replace a manual marker with a late preview',async()=>{
 const {requestArrivalPreview}=await import('../../src/UI/Components/GameTools/ArrivalPreviewService.js');
 const {drawWorldMapPreview}=await import('../../src/UI/Components/GameTools/WorldMapPreview.js');
 let resolve;requestArrivalPreview.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 await mount('prt_fild08');container.querySelector('.catalog-map-picker').click();
 resolve({x:168,y:373});await vi.advanceTimersByTimeAsync(0);
 expect(drawWorldMapPreview.mock.lastCall[2]).toEqual({x:9,y:11});
 container.querySelector('.catalog-teleport').click();
 expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({x:9,y:11}));
});
it('does not request again on detail redraw and cancels on unmount',async()=>{
 const {requestArrivalPreview}=await import('../../src/UI/Components/GameTools/ArrivalPreviewService.js');
 await mount('prt_fild08');container.querySelector('.catalog-map-picker').click();
 expect(requestArrivalPreview).toHaveBeenCalledTimes(1);
 const signal=requestArrivalPreview.mock.lastCall[1];cleanup();cleanup=null;
 expect(signal.aborted).toBe(true);
});
