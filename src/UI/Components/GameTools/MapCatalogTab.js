import { bindMapDetailScroll } from './MapDetailScroll.js';
import { createMapMonsterTable } from './MapMonsterTable.js';
import { requestArrivalPreview } from './ArrivalPreviewService.js';
import DB from 'DB/DBManager.js';
import { getMapChannel } from 'DB/Map/MapChannels.js';
import MiniMapTable from 'DB/Map/MiniMapTable.js';
import Session from 'Engine/SessionStorage.js';
import { mountRemoteCatalogBrowser } from './RemoteCatalogBrowser.js';
import { escapeCatalogHtml } from './CatalogData.js';
import { loadAdventureMapNpcs, searchAdventureMaps } from './AdventureControlService.js';
import {
	getAdventureActionState,
	getCurrentAdventureMap,
	getCurrentAdventurePosition,
	normalizeAdventureMap,
	subscribeAdventureActions,
	teleportToCoordinate,
	teleportToNpc
} from './AdventureActionService.js';
import { npcAvailabilityBatches, requestNpcAvailability } from './NpcAvailabilityService.js';
import {
	previewAdventureRoute,
	startAdventureRoute,
	stopAdventureRoute,
	subscribeAdventureRoute
} from './AdventureRouteService.js';
import { remainingPathFromPosition } from 'UI/Components/Navigation/NavigationAutoWalk.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import {
	canvasToMapCoordinate,
	findNearestWalkableCoordinate,
	loadCatalogMap,
	loadCatalogMapImage,
	loadNpcAssets
} from './WorldAssetService.js';
import { drawWorldMapPreview } from './WorldMapPreview.js';
import { npcCatalogKey, npcTeleportEnabled, toCatalogNpcs } from './WorldCatalogService.js';

function npcAvailabilityLabel(available) {
	if (available === true) return '可传送';
	if (available === false) return '不可用';
	if (available === 'checking') return '校验中...';
	return '待校验';
}

function mount(container, context = {}) {
	container.classList.add('world-catalog-tab', 'map-catalog-tab');
	const monsterTable = createMapMonsterTable(context);
	let actionState = {};
	let routeState = {};
	let selectedCoordinate = null;
	let initialTarget = context.initialMap;
	let selectedReview = null;
	let selectedTargetName = '';
	let routeSelected = false;
	let arrivalPreview = null;
	let arrivalAbort = null;
	let loadedMap = null;
	let mapLoadError = false;
	let loadingMapName = '';
	let loadToken = 0;
	let thumbnailToken = 0;
	let thumbnailObserver = null;
	let redrawPreview = () => {};
	let previewResizeObserver = null;
	let mapNpcs = [];
	let mapNpcsStatus = 'loading';
	let mapNpcsToken = 0;
	let npcAvailability = {};
	let npcAvailabilityToken = 0;
	let selectedNpcKey = '';
	let pendingSelectionClear = '';
	let mapImageNames = new Set();
	let browserApi = null;
	let catalogMap = getCurrentAdventureMap();
	let catalogChannelsEnabled = Session.NavigationMapChannelsEnabled;
	const refreshDetail = () => browserApi?.refreshDetail();
	/** Ask the map server which of this map's NPCs can actually be teleported to. */
	const checkNpcAvailability = (npcs, api) => {
		if (!npcs.length) return;
		const token = ++npcAvailabilityToken;
		npcAvailability = Object.fromEntries(npcs.map(npc => [npcCatalogKey(npc), 'checking']));
		Promise.all(npcAvailabilityBatches(npcs).map(batch => requestNpcAvailability(batch)))
			.then(results => {
				if (token !== npcAvailabilityToken) return;
				const flattened = results.flat();
				npcAvailability = Object.fromEntries(npcs.map((npc, index) => [npcCatalogKey(npc), flattened[index]]));
				api.refreshDetail();
			})
			.catch(() => {
				if (token !== npcAvailabilityToken) return;
				npcAvailability = Object.fromEntries(npcs.map(npc => [npcCatalogKey(npc), false]));
				api.refreshDetail();
			});
	};
	async function loadMapNpcs(mapName, api) {
		const token = ++mapNpcsToken;
		mapNpcs = [];
		mapNpcsStatus = 'loading';
		try {
			const rows = await loadAdventureMapNpcs(mapName);
			if (token !== mapNpcsToken) return;
			mapNpcs = toCatalogNpcs(rows);
			mapNpcsStatus = 'ready';
			checkNpcAvailability(mapNpcs, api);
		} catch {
			if (token !== mapNpcsToken) return;
			mapNpcsStatus = 'error';
		}
		if (token === mapNpcsToken) api.refreshDetail();
	}

	/** Adapt one adventure-tools map row, resolving the channel the character is on. */
	const toCatalogMap = row => {
		const currentMap = normalizeAdventureMap(getCurrentAdventureMap());
		const currentChannel = getMapChannel(currentMap);
		const mapName = normalizeAdventureMap(row.map);
		const mapChannel = getMapChannel(mapName);
		const isCurrentMap =
			mapName === currentMap ||
			(!Session.NavigationMapChannelsEnabled &&
				currentChannel &&
				mapChannel?.canonicalMapName === currentChannel.canonicalMapName);
		const resolvedMapName = isCurrentMap ? currentMap : mapName;
		return {
			id: row.map,
			mapName: resolvedMapName,
			name: row.name_zh_cn || row.map,
			isCurrentMap,
			hasImage: mapImageNames.has(MiniMapTable[resolvedMapName] || resolvedMapName)
		};
	};
	const openTarget = target => {
		if (!target?.mapName || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
		initialTarget = target;
		loadingMapName = '';
		browserApi?.select({
			id: target.id || target.mapName,
			mapName: target.mapName,
			name: DB.getMapInfo?.(`${target.mapName}.rsw`)?.displayName || DB.getMapName?.(target.mapName, target.mapName) || target.mapName
		});
	};
	const onOpenMap = event => openTarget(event.detail);
	container.addEventListener('game-tools-open-map', onOpenMap);
	const destroyBrowser = mountRemoteCatalogBrowser(container, {
		placeholder: '搜索地图名称或地图代码',
		searchLabel: '搜索地图',
		initialQuery: context.initialMap?.id,
		emptyDetail: '选择一个地图查看详情',
		pageSize: 35,
		key: map => map.id,
		async load(query) {
			// Resolved from a cached promise, so this only blocks the first page.
			if (!mapImageNames.size) mapImageNames = new Set((await loadNpcAssets()).mapImages || []);
			const result = await searchAdventureMaps({
				query: query.query,
				// Server ignores this once a search term is set, matching the old
				// client-side search-relevance-first ordering.
				currentMap: getCurrentAdventureMap(),
				page: query.page,
				perPage: query.perPage
			});
			return {
				items: result.data.map(toCatalogMap),
				total: result.total
			};
		},
		renderRow(map, selected) {
			return `<button class="catalog-row map-row${selected?.id === map.id ? ' selected' : ''}" type="button" data-catalog-key="${escapeCatalogHtml(map.id)}">
				<span class="map-thumb" data-map-thumb="${escapeCatalogHtml(map.id)}"><span>加载中</span></span><span class="catalog-row-text"><strong>${escapeCatalogHtml(map.name)}</strong><small>${escapeCatalogHtml(map.id)}</small></span>
			</button>`;
		},
		onListRendered(list, maps) {
			const token = ++thumbnailToken;
			thumbnailObserver?.disconnect();
			const mapsById = new Map(maps.map(map => [map.id, map]));
			const renderThumbnail = async thumbnail => {
				const map = mapsById.get(thumbnail.dataset.mapThumb);
				if (!map) return;
				const image = await loadCatalogMapImage(map.mapName).catch(() => null);
				if (token !== thumbnailToken || !thumbnail.isConnected) return;
				if (image) {
					const preview = document.createElement('img');
					preview.src = image;
					preview.alt = '';
					thumbnail.replaceChildren(preview);
					return;
				}
				const resource = await loadCatalogMap(map.mapName).catch(() => null);
				if (token !== thumbnailToken || !thumbnail.isConnected) return;
				if (!resource?.gat?.cells) {
					thumbnail.textContent = '无图';
					return;
				}
				const preview = document.createElement('canvas');
				preview.width = 112;
				preview.height = 84;
				preview.setAttribute('aria-hidden', 'true');
				drawWorldMapPreview(preview, null, null, resource.gat);
				thumbnail.replaceChildren(preview);
			};
			thumbnailObserver =
				typeof IntersectionObserver === 'function'
					? new IntersectionObserver(
							entries => {
								for (const entry of entries) {
									if (!entry.isIntersecting) continue;
									thumbnailObserver?.unobserve(entry.target);
									renderThumbnail(entry.target);
								}
							},
							{ root: list, rootMargin: '80px' }
						)
					: null;
			for (const thumbnail of list.querySelectorAll('[data-map-thumb]')) {
				if (thumbnailObserver) thumbnailObserver.observe(thumbnail);
				else renderThumbnail(thumbnail);
			}
		},
		renderDetail(detail, map, api) {
			if (loadingMapName !== map.mapName) {
				loadingMapName = map.mapName;
				const initial = initialTarget && (initialTarget.id === map.id || initialTarget.mapName === map.mapName) && Number.isFinite(initialTarget.x) && Number.isFinite(initialTarget.y)
					? initialTarget : null;
				initialTarget = null;
				selectedCoordinate = initial ? { x: initial.x, y: initial.y } : { x: 0, y: 0, automatic: true };
				selectedReview = initial?.dialogueTarget || null;
				selectedTargetName = initial?.name || '';
				routeSelected = Boolean(initial);
				arrivalAbort?.abort();
				arrivalAbort = new AbortController();
				const signal = arrivalAbort.signal;
				arrivalPreview = null;
				// Reviewed NPC targets already carry their landing; no runtime preflight.
				if (!selectedReview) requestArrivalPreview(map.mapName, signal)
					.then(point => {
						if (signal.aborted) return;
						arrivalPreview = point;
						api.refreshDetail();
					})
					.catch(() => {
						if (signal.aborted) return;
						arrivalPreview = null;
						api.refreshDetail();
					});
				loadedMap = null;
				mapLoadError = false;
				selectedNpcKey = '';
				npcAvailability = {};
				const token = ++loadToken;
				loadCatalogMap(map.mapName).then(resource => {
					if (token !== loadToken) return;
					loadedMap = resource;
					mapLoadError = !resource?.gat?.width || !resource?.gat?.height;
					api.refreshDetail();
				}).catch(() => {
					if (token !== loadToken) return;
					mapLoadError = true;
					api.refreshDetail();
				});
				void loadMapNpcs(map.mapName, api);
			}
			const selectedNpc = mapNpcs.find(entry => npcCatalogKey(entry) === selectedNpcKey);
			if (selectedNpc) {
				selectedCoordinate = { x: selectedNpc.x, y: selectedNpc.y };
			}
			const target = selectedCoordinate ? { ...map, ...selectedCoordinate } : null;
			const grid = loadedMap?.gat;
			const inBounds = point => point && grid?.width > 0 && grid?.height > 0 &&
				Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0 && point.x < grid.width && point.y < grid.height;
			const targetInBounds = inBounds(target);
			const routeTarget = routeSelected && targetInBounds && !target.automatic ? target : null;
			const currentMap = getCurrentAdventureMap();
			const sameMap = normalizeAdventureMap(map.mapName) === currentMap;
			const currentPosition = getCurrentAdventurePosition();
			const routeMatches = Boolean(
				routeTarget &&
				routeState.target &&
				normalizeAdventureMap(routeState.target.mapName) === normalizeAdventureMap(routeTarget.mapName) &&
				routeState.target.x === routeTarget.x &&
				routeState.target.y === routeTarget.y
			);
			const routeActive = routeMatches && routeState.active;
			const routePending = routeMatches && routeState.pending && !routeState.walking;
			const routeUnavailable = routeMatches && routeState.unavailable;
			const reviewedTeleport = !selectedReview || (selectedReview.allowed && selectedReview.teleportAllowed &&
				Number.isFinite(selectedReview.arrivalX) && Number.isFinite(selectedReview.arrivalY));
			const teleportTarget = target && reviewedTeleport
				? { ...target, ...(selectedReview ? { x: selectedReview.arrivalX, y: selectedReview.arrivalY } : {}) } : null;
			const targetActionState = getAdventureActionState(teleportTarget);
			const canTeleport =
				teleportTarget &&
				targetInBounds &&
				inBounds(teleportTarget) &&
				targetActionState.canTeleport;
			const currentMapName =
				DB.getMapInfo(`${currentMap}.rsw`)?.displayName || DB.getMapName(currentMap, currentMap);

			const npcListScrollTop = detail.querySelector('.map-npc-scroll')?.scrollTop || 0;
			const npcActionState = selectedNpc
				? { ...actionState, ...getAdventureActionState(selectedNpc) }
				: actionState;
			const canTeleportNpc = selectedNpc
				? npcTeleportEnabled(selectedNpc, npcAvailability[npcCatalogKey(selectedNpc)], npcActionState)
				: false;
			const canTeleportHere = selectedNpc ? canTeleportNpc : canTeleport;
			const mapStatus = mapLoadError ? '地图加载失败，请重新打开地图。'
				: !loadedMap ? '地图正在加载…'
				: target && !targetInBounds ? '目标坐标不在地图范围内'
				: !reviewedTeleport ? (selectedReview.teleportReason === 'map_forbidden' ? '目标地图禁止直接传入' : '该目标没有可用的传送落点')
				: !Session.NavigationTeleportAllowed ? '当前账号没有传送权限' : '';
			const selectionLabel = selectedNpc
				? `${selectedNpc.name} · ${selectedNpc.x}, ${selectedNpc.y}`
				: selectedCoordinate?.automatic
					? ''
					: selectedCoordinate
						? `${selectedTargetName ? `${selectedTargetName} · ` : ''}${selectedCoordinate.x}, ${selectedCoordinate.y}`
						: '点击地图选择位置';
			detail.innerHTML = `<div class="map-heading"><div><h3>${escapeCatalogHtml(map.name)}</h3><div class="map-heading-meta"><p>${escapeCatalogHtml(map.id)}</p><small class="map-current-position">角色位置：${escapeCatalogHtml(currentMapName)} (${currentPosition.x}, ${currentPosition.y})</small></div></div>${selectionLabel ? `<strong>${escapeCatalogHtml(selectionLabel)}</strong>` : ''}</div>
					<div class="map-detail-body">
					<button class="catalog-map-picker" type="button" aria-label="在${escapeCatalogHtml(map.name)}选择坐标"><canvas class="catalog-map" width="480" height="360"></canvas></button>
					<section class="map-npc-list" aria-label="${escapeCatalogHtml(map.name)}的 NPC">
						<h4><span>NPC</span><button type="button" class="map-monsters-jump" disabled>地图魔物 ↓</button></h4>
						${
							mapNpcsStatus === 'loading'
								? '<p class="menu-hint" role="status">NPC 加载中…</p>'
								: mapNpcsStatus === 'error'
									? '<p class="menu-hint error" role="status">NPC 加载失败</p><button type="button" class="map-npcs-retry">重试</button>'
									: mapNpcs.length
								? `<div class="map-npc-scroll"><ul>${mapNpcs
										.map(npc => {
											const npcKey = npcCatalogKey(npc);
											const available = npcAvailability[npcKey];
											return `<li class="map-npc-row${selectedNpcKey === npcKey ? ' selected' : ''}" data-npc-key="${escapeCatalogHtml(npcKey)}">
												<span class="map-npc-text"><strong>${escapeCatalogHtml(npc.name)}</strong>${context.mobile ? '' : `<small>${escapeCatalogHtml(npcAvailabilityLabel(available))}</small>`}</span>
											</li>`;
										})
										.join('')}</ul></div>`
								: '<p class="map-npc-empty">该地图没有可显示的 NPC</p>'
						}
					</section>
					<section class="map-monsters" aria-label="地图魔物"></section>
					</div>
					<div class="catalog-action-panel">
						<button class="catalog-route${routeActive ? ' is-active' : ''}" aria-busy="${Boolean(routePending)}" title="${!sameMap ? '寻路仅支持角色当前所在地图' : !routeTarget ? '请先选择目标位置' : routeUnavailable ? '无法寻路到所选位置' : ''}" type="button" ${routeTarget && sameMap && !routePending && !routeUnavailable ? '' : 'disabled'}>${routePending ? '计算中…' : routeActive ? '停止寻路' : '开始寻路'}</button>
					<button class="catalog-teleport" type="button" ${canTeleportHere ? '' : 'disabled'}>${actionState.npcPending && selectedNpc ? '正在传送...' : '传送到这里'}</button>
					<span class="catalog-status error">${escapeCatalogHtml(mapStatus)}</span>
				</div>`;
			detail.querySelector('.map-npcs-retry')?.addEventListener('click', () => {
				void loadMapNpcs(map.mapName, api);
				api.refreshDetail();
			});
			const monsterJump = detail.querySelector('.map-monsters-jump');
			monsterTable.render(detail.querySelector('.map-monsters'), map.mapName, available => { monsterJump.disabled = !available; });
			bindMapDetailScroll(detail.querySelector('.map-detail-body'));
			const canvas = detail.querySelector('.catalog-map');
			const picker = detail.querySelector('.catalog-map-picker');
			let lastPositionKey = '';
			redrawPreview = force => {
				if (!canvas.isConnected) return;
				if (getCurrentAdventureMap() !== currentMap) {
					api.refreshDetail();
					return;
				}
				const position = getCurrentAdventurePosition();
				const direction = Session.Entity?.direction ?? 0;
				const positionKey = `${position.x}:${position.y}:${direction}`;
				if (!force && positionKey === lastPositionKey) return;
				lastPositionKey = positionKey;
				const label = detail.querySelector('.map-current-position');
				if (label) label.textContent = `角色位置：${currentMapName} (${position.x}, ${position.y})`;
				drawWorldMapPreview(
					canvas,
					loadedMap?.image,
					selectedNpc ? null : selectedCoordinate?.automatic ? arrivalPreview : selectedCoordinate,
					loadedMap?.gat,
					{
						path: sameMap && routeMatches ? remainingPathFromPosition(routeState.path, position) : [],
						player: sameMap ? { ...position, direction } : null,
						selectedNpc
					}
				);
			};
			previewResizeObserver?.disconnect();
			previewResizeObserver =
				typeof ResizeObserver === 'function' ? new ResizeObserver(() => redrawPreview(true)) : null;
			if (previewResizeObserver) previewResizeObserver.observe(picker);
			redrawPreview(true);
			const npcList = detail.querySelector('.map-npc-scroll');
			if (npcList) npcList.scrollTop = npcListScrollTop;
			picker.addEventListener('click', event => {
				if (!grid?.width || !grid?.height) return;
				const raw = canvasToMapCoordinate(canvas, event, loadedMap?.gat);
				selectedNpcKey = '';
				selectedReview = null;
				selectedTargetName = '';
				selectedCoordinate = findNearestWalkableCoordinate(loadedMap?.gat, raw);
				routeSelected = Boolean(selectedCoordinate);
				if (!selectedCoordinate) {
					api.refreshDetail();
					return;
				}
				const nextTarget = { ...map, ...selectedCoordinate };
				if (!sameMap || !previewAdventureRoute(nextTarget)) api.refreshDetail();
			});
			detail.querySelector('.catalog-route').addEventListener('click', () => {
				if (!sameMap || !routeTarget || routePending || routeUnavailable) return;
				if (routeActive) stopAdventureRoute();
				else if (routeTarget) startAdventureRoute(routeTarget);
			});
			detail.querySelector('.catalog-teleport').addEventListener('click', () => {
				if (!canTeleportHere) return;
				const started = selectedNpc
					? teleportToNpc(selectedNpc)
					: teleportTarget
						? teleportToCoordinate(teleportTarget)
						: false;
				pendingSelectionClear = started ? 'teleport' : '';
			});
			for (const row of detail.querySelectorAll('.map-npc-row')) {
				row.addEventListener('click', () => {
					if (selectedNpcKey === row.dataset.npcKey) return;
					selectedReview = null;
					selectedTargetName = '';
					selectedNpcKey = row.dataset.npcKey;
					routeSelected = true;
					const npc = mapNpcs.find(entry => npcCatalogKey(entry) === selectedNpcKey);
					selectedCoordinate = { x: npc.x, y: npc.y };
					if (!sameMap || !previewAdventureRoute({ ...map, ...selectedCoordinate })) api.refreshDetail();
				});
			}
		},
		onReady(api) {
			browserApi = api;
			if (initialTarget) openTarget(initialTarget);
		}
	});

	const clearMapMarker = () => {
		selectedReview = null;
		selectedTargetName = '';
		routeSelected = false;
		selectedNpcKey = '';
		selectedCoordinate = { x: 0, y: 0, automatic: true };
		pendingSelectionClear = '';
	};
	const unsubscribeActions = subscribeAdventureActions(state => {
		const waiting = pendingSelectionClear === 'teleport';
		const wasPending = actionState.npcPending || actionState.mapPending;
		actionState = state;
		if (waiting && wasPending && !state.npcPending && !state.mapPending && !state.error) clearMapMarker();
		else if (waiting && !state.npcPending && !state.mapPending && state.error) pendingSelectionClear = '';
		refreshDetail();
	});
	const unsubscribeRoute = subscribeAdventureRoute(state => {
		routeState = state;
		if (state.message === '已到达目的地') clearMapMarker();
		refreshDetail();
	});
	const positionTimer = setInterval(() => {
		const currentMap = getCurrentAdventureMap();
		const channelsEnabled = Session.NavigationMapChannelsEnabled;
		if (
			!MapRenderer.loading &&
			currentMap &&
			(currentMap !== catalogMap || channelsEnabled !== catalogChannelsEnabled)
		) {
			const mapChanged = currentMap !== catalogMap;
			catalogMap = currentMap;
			catalogChannelsEnabled = channelsEnabled;
			if (mapChanged) browserApi?.reset();
			else browserApi?.reload();
		}
		redrawPreview();
	}, 500);

	return () => {
		container.removeEventListener('game-tools-open-map', onOpenMap);
		monsterTable.destroy();
		arrivalAbort?.abort();
		loadToken += 1;
		mapNpcsToken += 1;
		npcAvailabilityToken += 1;
		thumbnailToken += 1;
		thumbnailObserver?.disconnect();
		previewResizeObserver?.disconnect();
		clearInterval(positionTimer);
		redrawPreview = () => {};
		unsubscribeActions();
		unsubscribeRoute();
		destroyBrowser();
	};
}

export default { id: 'maps', label: '地图图鉴', mount };
