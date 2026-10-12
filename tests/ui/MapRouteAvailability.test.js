vi.mock('../../src/UI/Components/GameTools/ArrivalPreviewService.js', () => ({requestArrivalPreview:vi.fn(async()=>({x:10,y:10}))}));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ listener: null, point: { x: 30, y: 30 } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMapInfo: () => ({displayName:'普隆德拉'}) } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { NavigationTeleportAllowed: true } }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: { loading: false } }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
 searchAdventureMaps: async () => ({data:[{map:'prontera'}],total:1}), loadAdventureMapNpcs: async () => []
}));
vi.mock('../../src/UI/Components/GameTools/AdventureActionService.js', () => ({
 getCurrentAdventureMap: () => 'prontera', normalizeAdventureMap: map => map,
 getCurrentAdventurePosition: () => ({x:10,y:10}), getAdventureActionState: () => ({canTeleport:true}),
 subscribeAdventureActions: () => () => {}, teleportToCoordinate: vi.fn(), teleportToNpc: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/AdventureRouteService.js', () => ({
 subscribeAdventureRoute: listener => {state.listener=listener; return () => {};},
 previewAdventureRoute: vi.fn(target => {state.listener({target,unavailable:true,pending:false,active:false,path:[]});return true;}),
 startAdventureRoute: vi.fn(), stopAdventureRoute: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/NpcAvailabilityService.js', () => ({npcAvailabilityBatches:()=>[],requestNpcAvailability:vi.fn()}));
vi.mock('../../src/UI/Components/GameTools/WorldAssetService.js', () => ({
 loadNpcAssets:async()=>({mapImages:[]}), loadCatalogMapImage:async()=>null,
 loadCatalogMap:async()=>({gat:{width:100,height:100}}), canvasToMapCoordinate:()=>state.point,
 findNearestWalkableCoordinate:(_gat,point)=>point
}));
vi.mock('../../src/UI/Components/GameTools/WorldMapPreview.js', () => ({drawWorldMapPreview:vi.fn()}));
vi.mock('UI/Components/Navigation/NavigationAutoWalk.js', () => ({remainingPathFromPosition:()=>[]}));
import mapCatalog from '../../src/UI/Components/GameTools/MapCatalogTab.js';
import {teleportToCoordinate} from '../../src/UI/Components/GameTools/AdventureActionService.js';
let cleanup, container;
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();state.point={x:30,y:30};container=document.createElement('div');document.body.append(container);});
afterEach(()=>{cleanup?.();container.remove();vi.useRealTimers();});
it.each([false,true])('disables only walking for an unreachable selection (mobile=%s)',async mobile=>{
 cleanup=mapCatalog.mount(container,{mobile});await vi.advanceTimersByTimeAsync(0);
 container.querySelector('.catalog-map-picker').click();await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.catalog-route').disabled).toBe(true);
 expect(container.querySelector('.catalog-teleport').disabled).toBe(false);
 container.querySelector('.catalog-teleport').click();
 expect(teleportToCoordinate).toHaveBeenCalledWith(expect.objectContaining({mapName:'prontera',x:30,y:30}));
 state.listener({target:{mapName:'prontera',x:30,y:30},unavailable:false,pending:false,path:[{x:10,y:10},{x:30,y:30}]});
 expect(container.querySelector('.catalog-route').disabled).toBe(false);
 // Failure for another target must not disable this selection.
 state.listener({target:{mapName:'prontera',x:60,y:60},unavailable:true,pending:false,path:[]});
 expect(container.querySelector('.catalog-route').disabled).toBe(false);
});

it.each([false,true])('requires an explicit walking target when opening the map (mobile=%s)',async mobile=>{
 cleanup=mapCatalog.mount(container,{mobile});await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.catalog-route').disabled).toBe(true);
 expect(container.querySelector('.catalog-route').title).toBe('请先选择目标位置');
 expect(container.querySelector('.catalog-teleport').disabled).toBe(false);
});
