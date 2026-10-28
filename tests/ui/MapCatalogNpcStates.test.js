vi.mock('../../src/UI/Components/GameTools/ArrivalPreviewService.js', () => ({requestArrivalPreview:vi.fn(async()=>({x:10,y:10}))}));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ map: 'payon', loading: false }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: { get loading() { return state.loading; } } }));
vi.mock('DB/DBManager.js', () => ({ default: {getMapInfo:()=>({displayName:"地图"}),getMapName:()=>"地图"} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { NavigationMapChannelsEnabled: false } }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
	searchAdventureMaps: vi.fn(async ({ currentMap, onMap }) => ({
		data: [{ map: onMap || currentMap, name_zh_cn: onMap || currentMap }],
		total: onMap ? 1 : 70
	})),
	loadAdventureMapNpcs: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/AdventureActionService.js', () => ({
	getCurrentAdventureMap: () => state.map,
	normalizeAdventureMap: map => map,
	subscribeAdventureActions: () => () => {},
	getAdventureActionState: vi.fn(()=>({})),
	getCurrentAdventurePosition: vi.fn(()=>({x:10,y:10})),
	teleportToCoordinate: vi.fn(),
	teleportToNpc: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/AdventureRouteService.js', () => ({
	subscribeAdventureRoute: () => () => {},
	previewAdventureRoute: vi.fn(),
	startAdventureRoute: vi.fn(),
	stopAdventureRoute: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/NpcAvailabilityService.js', () => ({
	npcAvailabilityBatches: vi.fn(()=>[]), requestNpcAvailability: vi.fn(async()=>[])
}));
vi.mock('../../src/UI/Components/GameTools/WorldAssetService.js', () => ({
	loadNpcAssets: async () => ({ mapImages: ['payon'] }),
	loadCatalogMapImage: vi.fn(async () => null),
	loadCatalogMap: async () => null,
	canvasToMapCoordinate: vi.fn(),
	findNearestWalkableCoordinate: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/WorldMapPreview.js', () => ({ drawWorldMapPreview: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/WorldCatalogService.js', () => ({
	npcCatalogKey: vi.fn(), npcTeleportEnabled: vi.fn(), toCatalogNpcs: vi.fn(rows=>rows)
}));
vi.mock('UI/Components/Navigation/NavigationAutoWalk.js', () => ({ remainingPathFromPosition: vi.fn() }));

vi.mock('../../src/UI/Components/GameTools/MonsterCatalogAssets.js',()=>({loadMonsterCatalog:async()=>({monsters:[]})}));
import tab from '../../src/UI/Components/GameTools/MapCatalogTab.js';
import {loadAdventureMapNpcs} from '../../src/UI/Components/GameTools/AdventureControlService.js';
let container,dispose;
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();container=document.body.appendChild(document.createElement('div'));});
afterEach(()=>{dispose?.();container.remove();vi.useRealTimers();});
it('distinguishes pending, failure, retry and a successful empty NPC list',async()=>{
 let reject;
 loadAdventureMapNpcs.mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;})).mockResolvedValueOnce([]);
 dispose=tab.mount(container,{mobile:true});await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.map-npc-list').textContent).toContain('NPC 加载中');
 expect(container.querySelector('.map-npc-list').textContent).not.toContain('没有可显示');
 reject(Error('offline'));await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.map-npc-list .error').textContent).toBe('NPC 加载失败');
 container.querySelector('.map-npcs-retry').click();
 expect(container.querySelector('.map-npc-list').textContent).toContain('NPC 加载中');
 await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.map-npc-empty').textContent).toBe('该地图没有可显示的 NPC');
 expect(loadAdventureMapNpcs).toHaveBeenCalledTimes(2);
 expect(loadAdventureMapNpcs).toHaveBeenLastCalledWith('payon');
});
it('ignores an NPC result after the tab is closed',async()=>{
 let resolve;loadAdventureMapNpcs.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 dispose=tab.mount(container,{mobile:true});await vi.advanceTimersByTimeAsync(0);
 dispose();const html=container.innerHTML;resolve([]);await vi.advanceTimersByTimeAsync(0);
 expect(container.innerHTML).toBe(html);
});
