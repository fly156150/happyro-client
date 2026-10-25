import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ map: 'alberta' }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: { loading: false } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMapInfo: () => null, getMapName: map => map } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { NavigationTeleportAllowed: true, NavigationMapChannelsEnabled: false } }));
vi.mock('../../src/UI/Components/GameTools/MapDetailScroll.js', () => ({ bindMapDetailScroll: () => {} }));
vi.mock('../../src/UI/Components/GameTools/MapMonsterTable.js', () => ({ createMapMonsterTable: () => ({ render() {}, destroy() {} }) }));
vi.mock('../../src/UI/Components/GameTools/ArrivalPreviewService.js', () => ({ requestArrivalPreview: vi.fn(async () => ({ x: 10, y: 10 })) }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
 searchAdventureMaps: vi.fn(async () => ({ data: [{ map: state.map }], total: 1 })),
 loadAdventureMapNpcs: vi.fn(async () => [])
}));
vi.mock('../../src/UI/Components/GameTools/AdventureActionService.js', () => ({
 getCurrentAdventureMap: () => state.map, normalizeAdventureMap: map => map,
 subscribeAdventureActions: () => () => {}, getAdventureActionState: () => ({ canTeleport: true }),
 getCurrentAdventurePosition: () => ({ x: 23, y: 238 }), teleportToCoordinate: vi.fn(() => true), teleportToNpc: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/AdventureRouteService.js', () => ({
 subscribeAdventureRoute: () => () => {}, previewAdventureRoute: vi.fn(() => false), startAdventureRoute: vi.fn(), stopAdventureRoute: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/NpcAvailabilityService.js', () => ({ npcAvailabilityBatches: () => [], requestNpcAvailability: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/WorldAssetService.js', () => ({
 loadNpcAssets: async () => ({ mapImages: [] }), loadCatalogMapImage: async () => null,
 loadCatalogMap: vi.fn(async () => ({ image: null, gat: { width: 300, height: 300, cells: [] } })),
 canvasToMapCoordinate: () => ({ x: 55, y: 66 }), findNearestWalkableCoordinate: (_, raw) => raw
}));
vi.mock('../../src/UI/Components/GameTools/WorldMapPreview.js', () => ({ drawWorldMapPreview: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/WorldCatalogService.js', () => ({ npcCatalogKey: npc => npc.id, npcTeleportEnabled: () => false, toCatalogNpcs: rows => rows }));
vi.mock('UI/Components/Navigation/NavigationAutoWalk.js', () => ({ remainingPathFromPosition: () => [] }));
import { requestArrivalPreview } from '../../src/UI/Components/GameTools/ArrivalPreviewService.js';
import mapTab from '../../src/UI/Components/GameTools/MapCatalogTab.js';
import { loadCatalogMap } from '../../src/UI/Components/GameTools/WorldAssetService.js';
import { drawWorldMapPreview } from '../../src/UI/Components/GameTools/WorldMapPreview.js';
import { teleportToCoordinate } from '../../src/UI/Components/GameTools/AdventureActionService.js';
import { startAdventureRoute } from '../../src/UI/Components/GameTools/AdventureRouteService.js';
import { searchAdventureMaps } from '../../src/UI/Components/GameTools/AdventureControlService.js';
let root, cleanup;
const target = (review = {}) => ({ id: 'alberta', mapName: 'alberta', x: 98, y: 154, name: '工具店', dialogueTarget: { allowed: true, teleportAllowed: true, arrivalX: 97, arrivalY: 150, ...review } });
const open = async value => { root.dispatchEvent(new CustomEvent('game-tools-open-map', { detail: value })); await vi.advanceTimersByTimeAsync(0); };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); state.map = 'alberta'; root = document.body.appendChild(document.createElement('div')); });
afterEach(() => { cleanup?.(); cleanup = null; root.remove(); vi.useRealTimers(); });
it('opens a NAVI target directly, marks its original location and uses only its reviewed landing for teleport', async () => {
 cleanup = mapTab.mount(root, { initialMap: target() }); await vi.advanceTimersByTimeAsync(0);
 expect(searchAdventureMaps).not.toHaveBeenCalled();
 expect(root.querySelector('.map-heading').textContent).toContain('工具店 · 98, 154');
 expect(drawWorldMapPreview).toHaveBeenCalledWith(expect.anything(), null, { x: 98, y: 154 }, expect.anything(), expect.anything());
 root.querySelector('.catalog-route').click(); expect(startAdventureRoute).toHaveBeenCalledWith(expect.objectContaining({ mapName: 'alberta', x: 98, y: 154 }));
 root.querySelector('.catalog-teleport').click(); expect(teleportToCoordinate).toHaveBeenCalledWith(expect.objectContaining({ mapName: 'alberta', x: 97, y: 150 }));
});
it('retains the marker but disables an unreviewed landing and prevents synthetic clicks from sending it', async () => {
 cleanup = mapTab.mount(root, { initialMap: target({ teleportAllowed: false, teleportReason: 'no_safe_candidate' }) }); await vi.advanceTimersByTimeAsync(0);
 const button = root.querySelector('.catalog-teleport'); expect(button.disabled).toBe(true); button.dispatchEvent(new MouseEvent('click'));
 expect(teleportToCoordinate).not.toHaveBeenCalled(); expect(root.textContent).toContain('该目标没有可用的传送落点');
 expect(root.querySelector('.catalog-route').disabled).toBe(false);
});
it('replaces targets on an already mounted tab and clears review restrictions on manual selection and another map', async () => {
 cleanup = mapTab.mount(root); await vi.advanceTimersByTimeAsync(0);
 await open(target({ teleportAllowed: false })); expect(root.querySelector('.catalog-teleport').disabled).toBe(true);
 root.querySelector('.catalog-map-picker').click(); expect(root.querySelector('.catalog-teleport').disabled).toBe(false);
 root.querySelector('.catalog-teleport').click(); expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({ x: 55, y: 66 }));
 await open({ id: 'prontera', mapName: 'prontera', x: 120, y: 130, name: '另一目标' });
 expect(root.querySelector('.catalog-route').disabled).toBe(true); expect(root.querySelector('.catalog-teleport').disabled).toBe(false);
 root.querySelector('.catalog-teleport').click(); expect(teleportToCoordinate).toHaveBeenLastCalledWith(expect.objectContaining({ mapName: 'prontera', x: 120, y: 130 }));
 expect(root.textContent).not.toContain('工具店');
});
it('ignores a late catalog search when an external target is selected meanwhile', async () => {
 let resolve; searchAdventureMaps.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
 cleanup = mapTab.mount(root); await vi.advanceTimersByTimeAsync(0);
 await open(target()); resolve({ data: [{ map: 'geffen' }], total: 1 }); await vi.advanceTimersByTimeAsync(0);
 expect(root.querySelector('.map-heading').textContent).toContain('alberta'); expect(root.querySelector('.map-heading').textContent).toContain('98, 154');
});

it('keeps both actions unavailable when the target resource fails to load', async () => {
 loadCatalogMap.mockRejectedValueOnce(new Error('unavailable'));
 cleanup = mapTab.mount(root, { initialMap: target() }); await vi.advanceTimersByTimeAsync(0);
 expect(root.querySelector('.catalog-route').disabled).toBe(true); expect(root.querySelector('.catalog-teleport').disabled).toBe(true);
 expect(root.textContent).toContain('地图加载失败');
});
it('rejects out-of-bounds NAVI coordinates without sending navigation or teleport', async () => {
 cleanup = mapTab.mount(root, { initialMap: { ...target(), x: 5000 } }); await vi.advanceTimersByTimeAsync(0);
 expect(root.querySelector('.catalog-route').disabled).toBe(true); expect(root.querySelector('.catalog-teleport').disabled).toBe(true);
 root.querySelector('.catalog-route').dispatchEvent(new MouseEvent('click')); root.querySelector('.catalog-teleport').dispatchEvent(new MouseEvent('click'));
 expect(startAdventureRoute).not.toHaveBeenCalled(); expect(teleportToCoordinate).not.toHaveBeenCalled();
 expect(root.textContent).toContain('目标坐标不在地图范围内');
});

it('does not request an arrival preflight for an audited NPC marker', async () => {
 cleanup = mapTab.mount(root, { initialMap: target() }); await vi.advanceTimersByTimeAsync(0);
 expect(requestArrivalPreview).not.toHaveBeenCalled();
 expect(root.querySelector('.catalog-teleport').disabled).toBe(false);
});
