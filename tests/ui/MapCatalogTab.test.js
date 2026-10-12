vi.mock('../../src/UI/Components/GameTools/ArrivalPreviewService.js', () => ({requestArrivalPreview:vi.fn(async()=>({x:10,y:10}))}));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ map: 'payon', loading: false }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: { get loading() { return state.loading; } } }));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
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
	getAdventureActionState: vi.fn(),
	getCurrentAdventurePosition: vi.fn(),
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
	npcAvailabilityBatches: vi.fn(), requestNpcAvailability: vi.fn()
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
	npcCatalogKey: vi.fn(), npcTeleportEnabled: vi.fn(), toCatalogNpcs: vi.fn()
}));
vi.mock('UI/Components/Navigation/NavigationAutoWalk.js', () => ({ remainingPathFromPosition: vi.fn() }));
// Exercise the real catalog pagination, filters and list, without the unrelated map canvas detail.
vi.mock('../../src/UI/Components/GameTools/RemoteCatalogBrowser.js', async importOriginal => {
	const original = await importOriginal();
	return {
		mountRemoteCatalogBrowser: (container, options) => original.mountRemoteCatalogBrowser(container, {
			...options, renderDetail: (detail, map) => { detail.textContent = map.mapName; }
		})
	};
});

import mapCatalog from '../../src/UI/Components/GameTools/MapCatalogTab.js';
import { searchAdventureMaps } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import Session from 'Engine/SessionStorage.js';

let container;
let cleanup;
beforeEach(async () => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	state.map = 'payon';
	state.loading = false;
	Session.NavigationMapChannelsEnabled = false;
	container = document.createElement('div');
	document.body.append(container);
	cleanup = mapCatalog.mount(container);
	await vi.advanceTimersByTimeAsync(0);
});
afterEach(() => {
	cleanup();
	container.remove();
	vi.useRealTimers();
});

describe('map catalog current map updates', () => {
	it('reloads page one after a map transition and does not repeatedly fetch while stationary', async () => {
		container.querySelector('.catalog-next').click();
		await vi.advanceTimersByTimeAsync(0);
		expect(searchAdventureMaps).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
		container.querySelector('.catalog-list').scrollTop = 400;
		state.map = '';
		await vi.advanceTimersByTimeAsync(500);
		expect(searchAdventureMaps).toHaveBeenCalledTimes(2);
		state.map = 'geffen';
		await vi.advanceTimersByTimeAsync(500);
		expect(searchAdventureMaps).toHaveBeenLastCalledWith(expect.objectContaining({ currentMap: 'geffen', page: 1 }));
		expect(container.querySelector('.map-row small').textContent).toBe('geffen');
		expect(container.querySelector('.catalog-list').scrollTop).toBe(0);
		await vi.advanceTimersByTimeAsync(1500);
		expect(searchAdventureMaps).toHaveBeenCalledTimes(3);
	});

	it('opens on the current map with no scope switch', () => {
		expect(container.querySelector('[name="map-scope"]')).toBeNull();
		expect(container.querySelector('.map-row.selected small').textContent).toBe('payon');
		expect(container.querySelector('.map-row.selected').textContent).not.toContain('当前所在');
		expect(container.querySelector('.catalog-detail').textContent).toBe('payon');
	});

	it('clears search and selects the new map only after loading completes', async () => {
		const search = container.querySelector('.catalog-search');
		search.value = '城';
		search.dispatchEvent(new Event('input'));
		await vi.advanceTimersByTimeAsync(250);
		state.loading = true;
		state.map = 'geffen';
		await vi.advanceTimersByTimeAsync(500);
		expect(search.value).toBe('城');
		state.loading = false;
		await vi.advanceTimersByTimeAsync(500);
		expect(search.value).toBe('');
		expect(searchAdventureMaps).toHaveBeenLastCalledWith({ query: '', currentMap: 'geffen', page: 1, perPage: 35 });
		expect(container.querySelector('.map-row.selected small').textContent).toBe('geffen');
		expect(container.querySelector('.catalog-detail').textContent).toBe('geffen');
	});

	it('preserves manual browsing during same-map movement or teleport', async () => {
		searchAdventureMaps.mockResolvedValueOnce({ data: [{ map: 'geffen' }], total: 1 });
		const search = container.querySelector('.catalog-search');
		search.value = 'geffen';
		search.dispatchEvent(new Event('input'));
		await vi.advanceTimersByTimeAsync(250);
		container.querySelector('.map-row').click();
		container.querySelector('.catalog-list').scrollTop = 100;
		await vi.advanceTimersByTimeAsync(1500);
		expect(search.value).toBe('geffen');
		expect(container.querySelector('.catalog-detail').textContent).toBe('geffen');
		expect(container.querySelector('.catalog-list').scrollTop).toBe(100);
		expect(searchAdventureMaps).toHaveBeenCalledTimes(2);
	});

	it('refreshes when channel visibility changes and stops observing after unmount', async () => {
		Session.NavigationMapChannelsEnabled = true;
		await vi.advanceTimersByTimeAsync(500);
		expect(searchAdventureMaps).toHaveBeenCalledTimes(2);
		cleanup();
		cleanup = () => {};
		state.map = 'geffen';
		await vi.advanceTimersByTimeAsync(1000);
		expect(searchAdventureMaps).toHaveBeenCalledTimes(2);
	});
});

import { loadCatalogMapImage } from '../../src/UI/Components/GameTools/WorldAssetService.js';
it('shows loading until the thumbnail resolves, and only then shows missing images', async () => {
 let resolve;
 const pending = new Promise(done => { resolve=done; });
 loadCatalogMapImage.mockImplementation(() => pending);
 container.querySelector('.catalog-next').click();await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.map-thumb').textContent).toBe('加载中');
 resolve('data:image/png;base64,AA==');await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.map-thumb img')).not.toBeNull();
 loadCatalogMapImage.mockResolvedValue(null);
 container.querySelector('.catalog-prev').click();await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.map-thumb').textContent).toBe('无图');
});

it('opens a map supplied by the quest entry using the catalog search', async () => {
 cleanup();
 cleanup = mapCatalog.mount(container, { mobile: true, initialMap: { id: 'geffen', x: 50, y: 60 } });
 await vi.advanceTimersByTimeAsync(0);
 expect(container.querySelector('.catalog-search').value).toBe('geffen');
 expect(searchAdventureMaps).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'geffen', page: 1 }));
});
