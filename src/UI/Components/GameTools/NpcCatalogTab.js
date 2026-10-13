import preferences from 'Preferences/AdventureTools.js';
import { renderCatalogEmptyState } from './CatalogEmptyState.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import Session from 'Engine/SessionStorage.js';
import { mountRemoteCatalogBrowser } from './RemoteCatalogBrowser.js';
import { escapeCatalogHtml, renderCatalogScopeFilter } from './CatalogData.js';
import { searchAdventureNpcs } from './AdventureControlService.js';
import {
	getAdventureActionState,
	getCurrentAdventureMap,
	subscribeAdventureActions,
	teleportToNpc
} from './AdventureActionService.js';
import { requestNpcAvailability } from './NpcAvailabilityService.js';
import { loadNpcAssets, npcAtlasStyle } from './WorldAssetService.js';
import { loadCatalogMap } from './WorldAssetService.js';
import { drawWorldMapPreview } from './WorldMapPreview.js';
import { npcCatalogKey, npcTeleportEnabled, toCatalogNpcs } from './WorldCatalogService.js';

const key = npcCatalogKey;

function mount(container, context = {}) {
	container.classList.add('world-catalog-tab', 'npc-catalog-tab');
	let manifest = null;
	let available = null;
	let checking = false;
	let actionState = {};
	let selectionToken = 0;
	let loadedNpcMap = null;
	let loadingNpcMapName = '';
	let mapLoadToken = 0;
	let previewResizeObserver = null;
	let scopeFilter = null;
	let browserApi = null;
	let catalogMap = getCurrentAdventureMap();
	function changeScope() {
		preferences.npcCurrentMap = scopeFilter.checked;
		preferences.save();
		browserApi.reload();
	}
	const refreshDetail = () => browserApi?.refreshDetail();
	const destroyBrowser = mountRemoteCatalogBrowser(container, {
		placeholder: '搜索 NPC、地图或编号',
		searchLabel: '搜索 NPC',
		filterHtml: renderCatalogScopeFilter({ name: 'npc-scope', ariaLabel: '当前地图', value: preferences.npcCurrentMap ? 'current' : 'all' }),
		emptyDetail: '选择一个 NPC 查看详情',
		pageSize: 32,
		key,
		async load(query) {
			const currentMap = getCurrentAdventureMap();
			const onMap = scopeFilter.checked ? currentMap : '';
			manifest ??= await loadNpcAssets();
			const result = await searchAdventureNpcs({
				query: query.query,
				currentMap,
				onMap,
				page: query.page,
				perPage: query.perPage
			});
			return { items: toCatalogNpcs(result.data), total: result.total };
		},
		renderEmptyList(list, query) {
			renderCatalogEmptyState(
				list,
				query ? '没有匹配结果' : scopeFilter.checked ? '当前地图暂无 NPC' : '暂无 NPC 资料',
				scopeFilter.checked
					? () => {
							scopeFilter.checked = false;
							changeScope();
						}
					: null
			);
		},
		renderRow(npc, selected) {
			const style = npcAtlasStyle(manifest, npc.spriteId, context.mobile ? 40 : 48);
			return `<button class="catalog-row${key(selected || {}) === key(npc) ? ' selected' : ''}" type="button" data-catalog-key="${escapeCatalogHtml(key(npc))}">
				<span class="catalog-thumb${style ? '' : ' no-image'}" style="${style}"></span>
				<span class="catalog-row-text"><strong>${escapeCatalogHtml(npc.name)}</strong><small>${escapeCatalogHtml(npc.mapDisplayName)} · ${npc.x},${npc.y}</small></span>
			</button>`;
		},
		renderDetail(detail, npc, api) {
			previewResizeObserver?.disconnect();
			if (loadingNpcMapName !== npc.mapName) {
				loadingNpcMapName = npc.mapName;
				loadedNpcMap = null;
				const token = ++mapLoadToken;
				loadCatalogMap(npc.mapName).then(resource => {
					if (token !== mapLoadToken) return;
					loadedNpcMap = resource;
					api.refreshDetail();
				});
			}
			const style = npcAtlasStyle(manifest, npc.spriteId, 112);
			const canTeleport = npcTeleportEnabled(npc, available, { ...actionState, ...getAdventureActionState(npc) });
			detail.innerHTML = `<div class="catalog-heading">
				<span class="catalog-portrait${style ? '' : ' no-image'}" style="${style}"></span>
				<div><h3>${escapeCatalogHtml(npc.name)}</h3><p>${escapeCatalogHtml(npc.sourceName)} · ${npc.npcClass}</p></div>
			</div>
			<div class="npc-detail-body">
				<div class="npc-map-picker" aria-label="${escapeCatalogHtml(npc.mapDisplayName)}中的 NPC 位置"><canvas class="catalog-map npc-map-canvas" width="480" height="360"></canvas></div>
				<section class="npc-detail-info">
					<div class="catalog-metadata">${context.mobile ? `<div><span>名称</span><strong>${escapeCatalogHtml(npc.name)}</strong></div>` : ''}<div><span>地图</span><strong>${escapeCatalogHtml(npc.mapDisplayName)}</strong></div><div><span>地图代码</span><strong>${escapeCatalogHtml(npc.mapName)}</strong></div><div><span>坐标</span><strong>${npc.x}, ${npc.y}</strong></div><div><span>在线状态</span><strong>${checking ? '校验中...' : available ? '可用' : available === false ? '不可用' : '待校验'}</strong></div></div>
				</section>
			</div>
			<div class="catalog-action-panel">
				<button class="catalog-teleport" type="button" ${canTeleport ? '' : 'disabled'}>${actionState.npcPending ? '正在传送...' : '传送到 NPC 附近'}</button>
				<span class="catalog-status error">${escapeCatalogHtml(!Session.NavigationTeleportAllowed ? '当前账号没有传送权限' : '')}</span>
			</div>`;
			const canvas = detail.querySelector('.npc-map-canvas');
			const paintNpcMap = () =>
				drawWorldMapPreview(canvas, loadedNpcMap?.image, null, loadedNpcMap?.gat, { selectedNpc: npc });
			paintNpcMap();
			previewResizeObserver = new ResizeObserver(paintNpcMap);
			previewResizeObserver.observe(canvas);
			detail.querySelector('.catalog-teleport').addEventListener('click', () => teleportToNpc(npc));

			const token = selectionToken;
			if (available === null && !checking) {
				checking = true;
				requestNpcAvailability([npc])
					.then(result => {
						if (token !== selectionToken) return;
						available = result[0];
						checking = false;
						api.refreshDetail();
					})
					.catch(() => {
						if (token !== selectionToken) return;
						available = false;
						checking = false;
						api.refreshDetail();
					});
			}
		},
		onSelectionChange() {
			previewResizeObserver?.disconnect();
			selectionToken += 1;
			available = null;
			checking = false;
		},
		onReady(api) {
			browserApi = api;
			scopeFilter = api.container.querySelector('.catalog-scope-filter');
			scopeFilter?.addEventListener('change', changeScope);
		}
	});

	const unsubscribeActions = subscribeAdventureActions(state => {
		actionState = state;
		refreshDetail();
	});

	const mapTimer = setInterval(() => {
		const currentMap = getCurrentAdventureMap();
		if (!currentMap || MapRenderer.loading || currentMap === catalogMap) return;
		catalogMap = currentMap;
		browserApi?.reload();
	}, 500);

	return () => {
		clearInterval(mapTimer);
		previewResizeObserver?.disconnect();
		selectionToken += 1;
		mapLoadToken += 1;
		unsubscribeActions();
		destroyBrowser();
	};
}

export default { id: 'npcs', label: 'NPC 图鉴', mount };
