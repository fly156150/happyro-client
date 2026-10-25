/**
 * UI/Components/Navigation/Navigation.js
 *
 * Navigation window for NAVI links
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { notifyGameInput } from 'Controls/GameInputIntent.js';
import KEYS from 'Controls/KeyEventHandler.js';
import Renderer from 'Renderer/Renderer.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import EntityManager from 'Renderer/EntityManager.js';
import Entity from 'Renderer/Entity/Entity.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import Altitude from 'Renderer/Map/Altitude.js';
import Session from 'Engine/SessionStorage.js';
import Client from 'Core/Client.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import DB from 'DB/DBManager.js';
import { loadCatalogMapImage } from '../GameTools/WorldAssetService.js';
import { drawWalkableMapPreview, drawPlayerArrow, NPC_MARKER_COLOR } from '../GameTools/WorldMapPreview.js';
import htmlText from './Navigation.html?raw';
import cssText from './Navigation.css?raw';
import MapPathFinder from './MapPathFinder.js';
import { isNavigationSearchInteraction } from './NavigationSearchInteraction.js';
import { remainingPathFromPosition, selectAutoWalkWaypoint } from './NavigationAutoWalk.js';
import { toWorldEntities } from '../GameTools/WorldCatalogService.js';
import {
	canvasPointToMap,
	fittedMapRect,
	mapImageSourceRect,
	mapPointToCanvas
} from '../GameTools/MapPreviewLayout.js';
import {
	getAdventureActionState,
	subscribeAdventureActions,
	teleportToCoordinate,
	teleportToNpc
} from '../GameTools/AdventureActionService.js';
import {
	npcAvailabilityBatches,
	requestNpcAvailability as sendNpcAvailabilityRequest
} from '../GameTools/NpcAvailabilityService.js';

/**
 * Create Navigation component
 */
const Navigation = new GUIComponent('Navigation', cssText);

const NAVIGATION_WIDTH = 440;
const NAVIGATION_HEIGHT = 520;
const MAP_WIDTH = 400;
const MAP_HEIGHT = 340;

Navigation.render = () => htmlText;

/**
 * Async image create helper
 */
function createAsyncImage() {
	const img = new Image();
	img.decoding = 'async';
	return img;
}

function closeSearchFilterMenus(root, except = null) {
	for (const filter of root.querySelectorAll('.search-filter')) {
		if (filter === except) continue;
		filter.querySelector('.filter-menu').hidden = true;
		filter.querySelector('.filter-trigger').setAttribute('aria-expanded', 'false');
	}
}

function setupSearchFilter(root, selector, onChange) {
	const filter = root.querySelector(selector);
	const trigger = filter.querySelector('.filter-trigger');
	const menu = filter.querySelector('.filter-menu');
	trigger.addEventListener('click', event => {
		event.stopPropagation();
		const willOpen = menu.hidden;
		closeSearchFilterMenus(root, filter);
		menu.hidden = !willOpen;
		trigger.setAttribute('aria-expanded', String(willOpen));
	});

	for (const option of menu.querySelectorAll('.filter-option')) {
		option.addEventListener('click', event => {
			event.stopPropagation();
			const changed = filter.dataset.value !== option.dataset.value;
			filter.dataset.value = option.dataset.value;
			trigger.querySelector('.filter-label').textContent = option.textContent;
			for (const item of menu.querySelectorAll('.filter-option')) {
				item.setAttribute('aria-selected', String(item === option));
			}
			menu.hidden = true;
			trigger.setAttribute('aria-expanded', 'false');
			trigger.focus();
			if (changed) onChange();
		});
	}
}

function getSearchFilterValue(root, selector) {
	return root.querySelector(selector)?.dataset.value || '';
}

/**
 * @var {Image} arrow image
 */

/**
 * @var {Image} map information images
 */
const _toolDealer = createAsyncImage();
const _weaponDealer = createAsyncImage();
const _armorDealer = createAsyncImage();
const _blacksmith = createAsyncImage();
const _guide = createAsyncImage();
const _inn = createAsyncImage();
const _kafra = createAsyncImage();

/**
 * @var {Image} minimap image
 */
const _map = createAsyncImage();

/**
 * @var {CanvasRenderingContext2D} canvas context
 */
let _ctx = null;

/**
 * @var {Array} town information
 */
let _towninfo = [];

/**
 * @var {Array} markers on the map
 */
const _markers = [];

/**
 * @var {Array} path points
 */
let _path = [];

/**
 * @var {number} Last time the path was recalculated
 */
let _lastPathUpdate = 0;

/**
 * @var {number} Minimum time between path recalculations (in ms)
 */
const _pathUpdateThrottle = 500;

/**
 * @var {boolean} Lock for path update
 */
let _pathUpdateLock = false;

/**
 * @var {Worker} pathfinding worker
 */
let _pathFindingWorker = null;

/**
 * @var {Object} map data
 */
let _mapData = null;
let _mapTerrain = null;

/**
 * @var {number} latest map resource request
 */
let _mapLoadRequestId = 0;

/**
 * @var {number} latest navigation request
 */
let _navigationRequestId = 0;

/**
 * @var {string|null} map represented by the current image
 */
let _mapImageMap = null;

/**
 * @var {Object} target data
 */
let _targetData = null;

/**
 * @var {Object} final target data
 */
let _finalTargetData = null;

/** @var {Object|null} explicit map coordinate selected for an action */
let _selectedTargetData = null;

let _autoWalkTimer = null;
let _autoWalkActive = false;
let _autoWalkRequested = false;
let _resumeAutoWalkAfterMapLoad = false;
let _dialogueWarp = null;
const _routeStateListeners = new Set();
let _npcAvailabilityRequestId = 0;
let _npcAvailabilityPending = null;
let _npcAvailabilityTimer = null;
let _searchRequestId = 0;
let _unsubscribeAdventureActions = null;

/**
 * @var {boolean} was target set by map click
 */
let _isMapClickTarget = false;

/**
 * @var {boolean} whether the current route is known to be unavailable
 */
let _pathUnavailable = false;

/**
 * @var {boolean} blinking state for target coordinates
 */
let _blinking = false;

/**
 * @var {number} fade interval ID for blinking
 */
let _fadeInterval = null;

/**
 * @var {string} original color for blinking restore
 */
let _originalColor = '';

/**
 * Document click handler reference for cleanup
 */
let _documentClickHandler = null;

/**
 * Local utility functions
 */

/**
 * Normalize a map name (remove .gat extension)
 */
function normalizeMapName(mapName) {
	if (!mapName) return '';
	mapName = mapName.replace(/\.gat$/, '').toLowerCase();
	return mapName;
}

/**
 * Format coordinates with consistent styling
 */
function formatCoordinates(x, y, options) {
	options = options || {};
	const shouldFloor = options.floor !== false;

	if (shouldFloor) {
		return `${Math.floor(x)},${Math.floor(y)}`;
	}
	return `${x},${y}`;
}

/**
 * Format target coordinates text with consistent styling
 */
function formatTargetCoordinates(x, y, options) {
	options = options || {};

	let text = Number.isFinite(x) && Number.isFinite(y) ? `${Math.floor(x)},${Math.floor(y)}` : '';

	if (options.noPathFound) {
		text += text ? '（未找到路径）' : '未找到路径';
	} else if (options.targetMap && options.targetMap !== getCurrentMap()) {
		text += ` (${options.targetMap})`;
	}

	return text;
}

/**
 * Format location title with consistent styling
 */
function formatLocationTitle(currentMap, targetMap, displayName) {
	let text;

	if (!displayName && targetMap && currentMap !== targetMap) {
		text = `[${currentMap} → ${targetMap}]`;
	} else {
		text = `[${displayName || currentMap}]`;
	}

	return text;
}

function getMapFit(width, height) {
	if (!_mapData?.width || !_mapData?.height) return fittedMapRect(width, height, width, height);
	return fittedMapRect(width, height, _mapData.width, _mapData.height);
}

/**
 * Convert map coordinates to screen coordinates
 */
function mapToScreen(x, y, width, height) {
	return mapPointToCanvas(getMapFit(width, height), _mapData, { x, y });
}

/**
 * Get the current map name
 */
function getCurrentMap() {
	if (MapRenderer && MapRenderer.currentMap) {
		return normalizeMapName(MapRenderer.currentMap);
	}
}

/**
 * Get the current player position
 */
function getPlayerPosition() {
	if (!Session.Entity || !Session.Entity.position) {
		return { x: 0, y: 0 };
	}
	const currentX = Math.ceil(Session.Entity.position[0]);
	const currentY = Math.ceil(Session.Entity.position[1]);

	return { x: currentX, y: currentY };
}

function notifyRouteState() {
	const state = Navigation.getRouteState();
	for (const listener of _routeStateListeners) listener(state);
}

/**
 * Whether the map server currently allows this session to teleport itself.
 */
function canSelfTeleport() {
	return Session.NavigationTeleportAllowed;
}

/**
 * Terminate the pathfinding worker
 */
function terminatePathFindingWorker() {
	if (_pathFindingWorker) {
		_pathFindingWorker.terminate();
		_pathFindingWorker = null;
	}
}

/**
 * Initialize the pathfinding worker
 */
function initializePathFindingWorker() {
	if (!_pathFindingWorker) {
		_pathFindingWorker = new Worker(new URL('./PathFindingWorker.js', import.meta.url).href);
		_pathFindingWorker.id = new Date().getTime().toString();
		_pathFindingWorker.onmessage = function (e) {
			const data = e.data;
			switch (data.type) {
				case 'pathResult':
					if (data.navigationRequestId !== _navigationRequestId || data.workerId !== _pathFindingWorker?.id) return;
					_pathUpdateLock = false;
					if (_finalTargetData && data.path && data.workerId === _pathFindingWorker.id) {
						const mapName = getCurrentMap();
						_path = data.path;
						if (_path.length > 0) {
							this.updateTargetText();
							this.updateAutoWalkButtons();
							this.setTargetCoordinatesBlinking(false);
							this.setLocationTitle(mapName, _finalTargetData.map, _finalTargetData.displayName);
							if (_autoWalkRequested) {
								_autoWalkRequested = false;
								this.startAutoWalk();
							}
						} else {
							_autoWalkRequested = false;
							_pathUnavailable = true;
							this.stopAutoWalk();
							this.updateAutoWalkButtons();
							this.updateTargetText(true);
							this.setTargetCoordinatesBlinking(false);
							this.setLocationTitle(mapName, null);
						}
					}
					notifyRouteState();
					break;
			}
		}.bind(Navigation);
	}
}

function resetPathFindingWorker() {
	terminatePathFindingWorker();
	initializePathFindingWorker();
}

/**
 * Convert screen coordinates to map coordinates
 */
Navigation.screenToMapCoordinates = function screenToMapCoordinates(screenX, screenY) {
	if (!_mapData?.ready) return null;
	return canvasPointToMap(getMapFit(MAP_WIDTH, MAP_HEIGHT), _mapData, screenX, screenY);
};

/**
 * Initialize component
 */
Navigation.init = function init() {
	const root = Navigation.getRoot();

	_mapData = {
		walkableType: Altitude.TYPE.WALKABLE
	};

	this._host.style.top = `${Math.max(0, Math.min(Renderer.height - NAVIGATION_HEIGHT, 120))}px`;
	this._host.style.left = `${Math.max(0, Math.min(Renderer.width - NAVIGATION_WIDTH, 120))}px`;

	// Get canvas context
	const canvas = document.createElement('canvas');
	canvas.width = MAP_WIDTH;
	canvas.height = MAP_HEIGHT;
	_ctx = canvas.getContext('2d');
	const mapDisplay = root.querySelector('.map-display');
	if (mapDisplay) {
		mapDisplay.appendChild(canvas);
	}

	// Load arrow image

	// Load town info icons
	Client.loadFile(`${DB.INTERFACE_PATH}information/store.bmp`, dataURI => {
		_toolDealer.src = dataURI;
	});
	Client.loadFile(`${DB.INTERFACE_PATH}information/weaponshop.bmp`, dataURI => {
		_weaponDealer.src = dataURI;
	});
	Client.loadFile(`${DB.INTERFACE_PATH}information/armorshops.bmp`, dataURI => {
		_armorDealer.src = dataURI;
	});
	Client.loadFile(`${DB.INTERFACE_PATH}information/smithy.bmp`, dataURI => {
		_blacksmith.src = dataURI;
	});
	Client.loadFile(`${DB.INTERFACE_PATH}information/guide.bmp`, dataURI => {
		_guide.src = dataURI;
	});
	Client.loadFile(`${DB.INTERFACE_PATH}information/inn.bmp`, dataURI => {
		_inn.src = dataURI;
	});
	Client.loadFile(`${DB.INTERFACE_PATH}information/kafra.bmp`, dataURI => {
		_kafra.src = dataURI;
	});

	// Bind events
	const closeButton = root.querySelector('.close');
	closeButton.addEventListener('mousedown', event => event.stopPropagation());
	closeButton.addEventListener('click', event => {
		event.stopPropagation();
		this.hide();
	});
	root.querySelector('.search-button').addEventListener('click', event => {
		event.stopPropagation();
		this.onSearch();
	});
	const refreshSearch = () => {
		if (root.querySelector('.search-input').value.trim().length >= 1) this.onSearch();
	};
	setupSearchFilter(root, '.search-type', refreshSearch);
	setupSearchFilter(root, '.search-scope', refreshSearch);

	const searchInput = root.querySelector('.search-input');
	searchInput.addEventListener('keypress', e => {
		if (e.which === KEYS.ENTER || e.key === 'Enter') {
			this.onSearch();
		}
	});

	// Focus handling for search input
	searchInput.addEventListener('focus', () => {
		const resultsContainer = root.querySelector('.search-results');
		if (resultsContainer && resultsContainer.children.length > 0) {
			resultsContainer.style.display = 'block';
		}
	});

	// Hide search results when clicking outside (on document level)
	_documentClickHandler = e => {
		if (!isNavigationSearchInteraction(e)) {
			closeSearchFilterMenus(root);
			const resultsContainer = root.querySelector('.search-results');
			if (resultsContainer) {
				resultsContainer.style.display = 'none';
			}
		}
	};
	document.addEventListener('click', _documentClickHandler);

	// Map click event for navigation
	root.querySelector('.map-display').addEventListener('click', e => this.onMapClick(e));
	root.querySelector('.teleport-button').addEventListener('click', e => {
		e.stopPropagation();
		this.teleportToSelectedTarget();
	});
	root.querySelector('.npc-teleport-button').addEventListener('click', e => {
		e.stopPropagation();
		this.teleportToSelectedNpc();
	});
	root.querySelector('.walk-button').addEventListener('click', e => {
		e.stopPropagation();
		this.startAutoWalk();
	});
	root.querySelector('.walk-stop-button').addEventListener('click', e => {
		e.stopPropagation();
		this.stopAutoWalk();
	});

	// Mouse move event for displaying coordinates
	root.querySelector('.map-display').addEventListener('mousemove', e => this.onMapMouseMove(e));

	// Mouse leave event to reset coordinates display
	root.querySelector('.map-display').addEventListener('mouseleave', () => this.onMapMouseLeave());

	this.draggable('.titlebar');

	// Hide the UI initially
	this.ui.hide();
};

/**
 * Once append to the DOM
 */
Navigation.onAppend = function onAppend() {
	const resumeAutoWalk = _resumeAutoWalkAfterMapLoad;
	_resumeAutoWalkAfterMapLoad = false;
	// Clear path for clean render
	this.clearPath();

	// Start rendering
	Renderer.render(this.renderCanvas.bind(this));

	// Initialize pathfinding worker
	initializePathFindingWorker();
	_unsubscribeAdventureActions?.();
	_unsubscribeAdventureActions = subscribeAdventureActions(state => {
		if ((state.kind === 'coordinate' || state.kind === 'npc') && state.message) this.setActionStatus(state.message, state.error);
		this.updateTeleportButton();
	});
	this.updateTeleportButton();

	// Load the current map after initializing the worker
	const mapName = getCurrentMap();
	this.loadMap(mapName);

	if (_finalTargetData) {
		const currentPos = getPlayerPosition();
		this.navigateTo({
			startMap: mapName,
			startX: currentPos.x,
			startY: currentPos.y,
			endMap: _finalTargetData.map,
			endX: _finalTargetData.x,
			endY: _finalTargetData.y,
			displayName: _finalTargetData.displayName,
			autoWalk: resumeAutoWalk
		});
	}
};

// Mobile prepares the navigation model without mounting its desktop window.
// Resume from the map-load lifecycle as well, after the player position is restored.
Navigation.resumeMapTransition = function resumeMapTransition() {
	if (!_resumeAutoWalkAfterMapLoad || !_finalTargetData) return;
	_resumeAutoWalkAfterMapLoad = false;
	const position = getPlayerPosition();
	this.navigateTo({
		startMap: getCurrentMap(),
		startX: position.x,
		startY: position.y,
		endMap: _finalTargetData.map,
		endX: _finalTargetData.x,
		endY: _finalTargetData.y,
		displayName: _finalTargetData.displayName,
		autoWalk: true
	});
};

Navigation.prepareMapTransition = function prepareMapTransition() {
	const resume = Boolean(_finalTargetData && (_autoWalkActive || _autoWalkRequested));
	_resumeAutoWalkAfterMapLoad = resume;
	if (_autoWalkTimer) clearInterval(_autoWalkTimer);
	_autoWalkTimer = null;
	_autoWalkActive = false;
	_autoWalkRequested = resume;
	_dialogueWarp = null;
	_navigationRequestId++;
	terminatePathFindingWorker();
	this.clearPath();
};

/**
 * Once removed from DOM
 */
Navigation.onRemove = function onRemove() {
	_searchRequestId++;
	_navigationRequestId++;
	if (!_resumeAutoWalkAfterMapLoad) this.stopAutoWalk();
	this.clearPath();
	terminatePathFindingWorker();
	clearTimeout(_npcAvailabilityTimer);
	_npcAvailabilityPending = null;
	_unsubscribeAdventureActions?.();
	_unsubscribeAdventureActions = null;

	// Clean up document-level event listener
	if (_documentClickHandler) {
		document.removeEventListener('click', _documentClickHandler);
	}
};

/**
 * Handle search button click
 */
Navigation.onSearch = async function onSearch() {
	const root = Navigation.getRoot();
	const query = root.querySelector('.search-input').value.trim();
	const type = getSearchFilterValue(root, '.search-type');
	const resultsContainer = root.querySelector('.search-results');
	closeSearchFilterMenus(root);
	const requestId = ++_searchRequestId;

	if (query.length < 1) {
		if (resultsContainer) {
			resultsContainer.replaceChildren();
			resultsContainer.style.display = 'none';
		}
		return;
	}

	// Search for NPCs and MOBs
	let results;
	try {
		results = toWorldEntities(
			await DB.searchNavigation(query, type, {
				channelsEnabled: Session.NavigationMapChannelsEnabled,
				currentMap: getCurrentMap(),
				scope: getSearchFilterValue(root, '.search-scope')
			})
		);
	} catch (error) {
		if (requestId !== _searchRequestId) return;
		console.error('[Navigation] Failed to load navigation catalog:', error);
		this.displaySearchResults([]);
		return;
	}
	if (requestId !== _searchRequestId) return;

	const npcResults = results.filter(result => result.type === 'NPC');
	if (npcResults.length) {
		this.requestNpcAvailability(results, npcResults);
		return;
	}

	this.displaySearchResults(results);
};

Navigation.requestNpcAvailability = function requestNpcAvailability(results, npcResults) {
	const requestId = ++_npcAvailabilityRequestId;
	_npcAvailabilityPending = { requestId, results, npcResults };
	for (const npc of npcResults) npc.availability = 'pending';
	this.displaySearchResults(results);
	clearTimeout(_npcAvailabilityTimer);
	_npcAvailabilityTimer = setTimeout(() => {
		if (_npcAvailabilityPending?.requestId !== requestId) return;
		_npcAvailabilityPending = null;
		for (const npc of npcResults) npc.availability = 'unknown';
		this.displaySearchResults(results);
	}, 5000);

	Promise.all(npcAvailabilityBatches(npcResults).map(batch => sendNpcAvailabilityRequest(batch)))
		.then(batchResults => {
			if (_npcAvailabilityPending?.requestId !== requestId) return;
			clearTimeout(_npcAvailabilityTimer);
			const available = batchResults.flat();
			npcResults.forEach((result, index) => {
				result.availability = available[index] ? 'available' : 'unavailable';
			});
			_npcAvailabilityPending = null;
			this.displaySearchResults(results);
		})
		.catch(() => {
			if (_npcAvailabilityPending?.requestId !== requestId) return;
			clearTimeout(_npcAvailabilityTimer);
			_npcAvailabilityPending = null;
			for (const npc of npcResults) npc.availability = 'unknown';
			this.displaySearchResults(results);
		});
};

Navigation.onNpcAvailabilityResult = function onNpcAvailabilityResult(packet) {
	const pending = _npcAvailabilityPending;
	if (!pending || packet.requestId !== pending.requestId || packet.available.length !== pending.npcResults.length)
		return;
	clearTimeout(_npcAvailabilityTimer);
	pending.npcResults.forEach((result, index) => {
		result.availability = packet.available[index] ? 'available' : 'unavailable';
	});
	_npcAvailabilityPending = null;
	this.displaySearchResults(pending.results);
};

Navigation.displaySearchMessage = function displaySearchMessage(message) {
	const root = this.getRoot();
	let container = root.querySelector('.search-results');
	if (!container) {
		container = document.createElement('div');
		container.className = 'search-results';
		root.querySelector('.content').appendChild(container);
	}
	container.replaceChildren();
	const label = document.createElement('div');
	label.className = 'no-results';
	label.textContent = message;
	container.appendChild(label);
	container.style.display = 'block';
};

/**
 * Display search results
 */
Navigation.displaySearchResults = function displaySearchResults(results) {
	const root = Navigation.getRoot();

	// Get or create results container
	let resultsContainer = root.querySelector('.search-results');
	if (!resultsContainer) {
		resultsContainer = document.createElement('div');
		resultsContainer.className = 'search-results';
		root.querySelector('.content').appendChild(resultsContainer);
	} else {
		resultsContainer.replaceChildren();
	}

	// If no results, show a message
	if (results.length === 0) {
		const noResults = document.createElement('div');
		noResults.className = 'no-results';
		noResults.textContent = '未找到结果';
		resultsContainer.appendChild(noResults);
		resultsContainer.style.display = 'block';
		return;
	}

	// Create results list
	const resultsList = document.createElement('ul');
	resultsList.className = 'results-list';
	resultsContainer.appendChild(resultsList);

	// Add each result to the list
	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const resultRow = document.createElement('li');
		const resultItem = document.createElement('button');
		resultItem.type = 'button';
		resultItem.className = 'result-item';

		// Add type icon (NPC or MOB)
		const typeIcon =
			result.type === 'NPC'
				? 'npc_icon'
				: result.type === 'MAP'
					? 'map_icon'
					: result.type === 'WARP'
						? 'map_icon'
						: 'mob_icon';
		const typeLabel = document.createElement('span');
		typeLabel.className = `result-type ${typeIcon}`;
		typeLabel.textContent = result.type;
		const nameLabel = document.createElement('span');
		nameLabel.className = 'result-name';
		nameLabel.textContent = result.name;
		const mapLabel = document.createElement('span');
		mapLabel.className = 'result-map';
		const mapName = result.type === 'MAP' ? result.mapName : result.mapDisplayName || result.mapName;
		mapLabel.textContent =
			result.type === 'NPC' && Number.isFinite(result.x) && Number.isFinite(result.y)
				? `${mapName} · ${result.x},${result.y}`
				: mapName;
		if (result.type === 'NPC' && result.availability === 'pending') mapLabel.textContent += ' · 校验中';
		if (result.type === 'NPC' && result.availability === 'unavailable') mapLabel.textContent += ' · 当前不可用';
		resultItem.append(typeLabel, nameLabel, mapLabel);

		// Store result data
		resultItem._resultData = result;

		// Add click handler
		resultItem.addEventListener('click', event => {
			event.stopPropagation();
			this.navigateToSearchResult(result);
		});

		resultRow.appendChild(resultItem);
		resultsList.appendChild(resultRow);
	}

	// Show the results container
	resultsContainer.style.display = 'block';
};

/**
 * Navigate to a search result
 */
Navigation.navigateToSearchResult = function navigateToSearchResult(result) {
	if (!result || !result.mapName) {
		return;
	}

	this.targetResult = result;
	this.setActionStatus('');
	_isMapClickTarget = false;
	if (!Number.isFinite(result.x) || !Number.isFinite(result.y)) {
		this.showMap(result.mapName, result.mapDisplayName || result.mapName, {
			preserveSearch: true
		});
		return;
	}

	const currentMap = getCurrentMap();
	const currentPos = getPlayerPosition();

	this.navigateTo({
		startMap: currentMap,
		startX: currentPos.x,
		startY: currentPos.y,
		endMap: result.mapName,
		endX: result.x,
		endY: result.y,
		displayName: result.name
	});

	// Hide the search results
	const root = Navigation.getRoot();
	const resultsContainer = root.querySelector('.search-results');
	if (resultsContainer) {
		resultsContainer.style.display = 'none';
	}
};

/**
 * Find the closest walkable cell to the given coordinates
 */
Navigation.findClosestWalkableCell = function findClosestWalkableCell(x, y, maxRadius) {
	if (x >= 0 && x < _mapData.width && y >= 0 && y < _mapData.height) {
		const index = x + y * _mapData.width;
		const cellType = _mapData.cellTypes[index];

		if (cellType & _mapData.walkableType) {
			return { x: x, y: y };
		}
	}

	maxRadius = maxRadius || 10;
	let radius = 1;
	let bestDistance = Infinity;
	let bestCell = null;

	while (radius <= maxRadius) {
		for (let offsetY = -radius; offsetY <= radius; offsetY++) {
			for (let offsetX = -radius; offsetX <= radius; offsetX++) {
				if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
					continue;
				}

				const cx = x + offsetX;
				const cy = y + offsetY;

				if (cx >= 0 && cx < _mapData.width && cy >= 0 && cy < _mapData.height) {
					const index = cx + cy * _mapData.width;
					const cellType = _mapData.cellTypes[index];

					if (cellType & _mapData.walkableType) {
						const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
						if (distance < bestDistance) {
							bestDistance = distance;
							bestCell = { x: cx, y: cy };
						}
					}
				}
			}
		}

		if (bestCell) {
			return bestCell;
		}

		radius++;
	}

	return null;
};

/**
 * Handle map click event
 */
Navigation.onMapClick = function onMapClick(event) {
	if (!_mapData?.ready || !_mapData.map) return;
	this.targetResult = null;
	this.setActionStatus('');

	const root = Navigation.getRoot();
	const mapDisplay = root.querySelector('.map-display');
	const rect = mapDisplay.getBoundingClientRect();
	const x = Math.floor(event.clientX - rect.left);
	const y = Math.floor(event.clientY - rect.top);

	const mapCoords = this.screenToMapCoordinates(x, y);
	if (!mapCoords) return;

	const currentMap = getCurrentMap();
	const currentPos = getPlayerPosition();
	const previewMap = normalizeMapName(_mapData.map);
	const previewName = DB.getMapInfo(`${previewMap}.rsw`)?.displayName || DB.getMapName(previewMap, previewMap);
	_selectedTargetData = { x: mapCoords.x, y: mapCoords.y, map: previewMap, displayName: previewName };

	// Keep coordinate clicks local when the navigation window is previewing another map.
	if (previewMap !== currentMap) {
		this.clearPath();
		_finalTargetData = null;
		_targetData = { x: mapCoords.x, y: mapCoords.y, map: previewMap };
		this.updateTeleportButton();
		this.setTargetCoordinatesText(mapCoords.x, mapCoords.y);
		this.setLocationTitle(previewMap, null, previewName);
		return;
	}

	_isMapClickTarget = true;

	this.navigateTo({
		startMap: currentMap,
		startX: currentPos.x,
		startY: currentPos.y,
		endMap: _mapData.map,
		endX: mapCoords.x,
		endY: mapCoords.y,
		displayName: previewName
	});
};

/**
 * Show the self-teleport action only when the server grants the capability.
 */
function getTeleportTarget() {
	return _selectedTargetData || _finalTargetData || _targetData || {
		map: _mapData?.map || getCurrentMap(),
		x: 0,
		y: 0
	};
}

Navigation.updateTeleportButton = function updateTeleportButton() {
	const root = Navigation.getRoot();
	const button = root?.querySelector('.teleport-button');
	const npcButton = root?.querySelector('.npc-teleport-button');
	if (!button || !npcButton) return;

	const target = getTeleportTarget();
	const isCrossMap = target?.map && normalizeMapName(target.map) !== getCurrentMap();
	const canTeleportTarget = canSelfTeleport() && (!isCrossMap || Session.NavigationTeleportCrossMap);
	const coordinateActionState = getAdventureActionState(
		target ? { mapName: target.map, x: target.x, y: target.y } : null
	);
	const npcTarget = this.targetResult?.type === 'NPC' ? this.targetResult : null;
	const npcTeleportable =
		npcTarget && npcTarget.availability !== 'unavailable' && npcTarget.availability !== 'pending';
	const hasCoordinateTarget = Boolean(target && Number.isFinite(target.x) && Number.isFinite(target.y));
	button.style.display = 'inline-block';
	button.disabled = !hasCoordinateTarget || !canTeleportTarget || !coordinateActionState.canTeleport;
	npcButton.style.display = npcTeleportable && canTeleportTarget ? 'inline-block' : 'none';
	const npcActionState = getAdventureActionState(npcTarget);
	npcButton.disabled = !npcActionState.canTeleport;
	npcButton.textContent = npcActionState.npcPending ? '正在传送...' : '传送到 NPC 附近';
};

Navigation.setActionStatus = function setActionStatus(message, isError = false) {
	const status = this.getRoot()?.querySelector('.action-status');
	if (!status) return;
	status.textContent = message;
	status.style.color = isError ? '#a61d24' : '#555';
};

Navigation.setTeleportConfig = function setTeleportConfig(type, value) {
	if (type === 1000) Session.NavigationTeleportAllowed = Boolean(value);
	if (type === 1001) Session.NavigationTeleportCrossMap = Boolean(value);
	if (type === 1002) Session.NavigationTeleportCooldown = Math.max(0, Number(value) || 0);
	if (type === 1003) Session.NavigationMapChannelsEnabled = Boolean(value);
	this.updateTeleportButton();
};

Navigation.updateAutoWalkButtons = function updateAutoWalkButtons() {
	const root = Navigation.getRoot();
	const start = root?.querySelector('.walk-button');
	const stop = root?.querySelector('.walk-stop-button');
	if (!start || !stop) return;
	const canStart = Boolean(_path.length && _targetData && _targetData.map === getCurrentMap() && !_pathUnavailable);
	start.style.display = _autoWalkActive ? 'none' : 'inline-block';
	start.disabled = !canStart;
	stop.style.display = _autoWalkActive ? 'inline-block' : 'none';
};

Navigation.startAutoWalk = function startAutoWalk() {
	notifyGameInput('action');
	if (_autoWalkActive || !_targetData || _targetData.map !== getCurrentMap() || _pathUnavailable) return;
	_autoWalkActive = true;
	this.updateAutoWalkButtons();
	notifyRouteState();
	const sendTarget = () => {
		if (!_autoWalkActive || !_finalTargetData) return;
		if (_dialogueWarp) return;
		const currentMap = getCurrentMap();
		if (!_targetData || _targetData.map !== currentMap) {
			const position = getPlayerPosition();
			this.navigateTo({
				startMap: currentMap,
				startX: position.x,
				startY: position.y,
				endMap: _finalTargetData.map,
				endX: _finalTargetData.x,
				endY: _finalTargetData.y,
				displayName: _finalTargetData.displayName
			});
			return;
		}
		const position = getPlayerPosition();
		const reachedTarget = Math.abs(position.x - _targetData.x) <= 1 && Math.abs(position.y - _targetData.y) <= 1;
		if (reachedTarget && _targetData.warpType >= 202) {
			this.stopAutoWalk();
			this.setActionStatus(`已到达${_targetData.warpName || '传送服务'}，请与 NPC 对话完成传送`);
			return;
		}
		if (reachedTarget && _finalTargetData.map === currentMap) {
			this.clear();
			this.setActionStatus('已到达目的地');
			return;
		}
		const waypoint = selectAutoWalkWaypoint(_path, position) || _targetData;
		const source = waypoint.warpSource || _targetData.warpSource;
		if (source && Math.hypot(position.x - source.srcX, position.y - source.srcY) <= 3) {
			const normalizeNpc = name => String(name || '').replace(/^#/, '').toLowerCase();
			const names = [source.name, source.npcName].filter(Boolean).map(normalizeNpc);
			let npc = null;
			EntityManager.forEach(entity => {
				if (
					(entity.objecttype === Entity.TYPE_NPC || entity.objecttype === Entity.TYPE_NPC2) &&
					entity.job !== 45 &&
					names.includes(normalizeNpc(entity.display.name)) &&
					Math.hypot(entity.position[0] - source.srcX, entity.position[1] - source.srcY) <= 3
				) npc = entity;
			});
			if (npc) {
				_dialogueWarp = source;
				const packet = new PACKET.CZ.CONTACTNPC();
				packet.NAID = npc.GID;
				packet.type = 1;
				Network.sendPacket(packet);
				this.setActionStatus('请完成传送对话；传送后继续寻路，取消对话后可停止或重新开始寻路');
				return;
			}
		}
		const packet = PACKETVER.value >= 20180307 ? new PACKET.CZ.REQUEST_MOVE2() : new PACKET.CZ.REQUEST_MOVE();
		packet.dest[0] = Math.floor(waypoint.x);
		packet.dest[1] = Math.floor(waypoint.y);
		Network.sendPacket(packet);
	};
	sendTarget();
	_autoWalkTimer = setInterval(sendTarget, 1200);
};

Navigation.stopAutoWalk = function stopAutoWalk() {
	_resumeAutoWalkAfterMapLoad = false;
	_dialogueWarp = null;
	const changed = _autoWalkRequested || _autoWalkActive;
	_autoWalkRequested = false;
	_autoWalkActive = false;
	if (_autoWalkTimer) clearInterval(_autoWalkTimer);
	_autoWalkTimer = null;
	this.updateAutoWalkButtons();
	if (changed || _pathUnavailable) notifyRouteState();
};

Navigation.getRouteState = function getRouteState() {
	return {
		active: _autoWalkActive,
		pending: _autoWalkRequested || _pathUpdateLock,
		unavailable: _pathUnavailable,
		path: _path.map(point => ({ ...point })),
		target: _finalTargetData ? { ..._finalTargetData } : null
	};
};

Navigation.subscribeRouteState = function subscribeRouteState(listener) {
	_routeStateListeners.add(listener);
	listener(this.getRouteState());
	return () => _routeStateListeners.delete(listener);
};

/**
 * Request a mapmove for the currently controlled character.
 * The server derives the character from the authenticated game session.
 */
Navigation.teleportToSelectedTarget = function teleportToSelectedTarget() {
	const target = getTeleportTarget();
	if (!teleportToCoordinate({ mapName: target.map, x: target.x, y: target.y })) return;
	this.hide();
	UIManager.components.WorldMap?.hide?.();
	this.setActionStatus('正在等待服务器确认...');
	this.updateTeleportButton();
};

Navigation.teleportToSelectedNpc = function teleportToSelectedNpc() {
	const npc = this.targetResult;
	if (!canSelfTeleport() || !teleportToNpc(npc)) return;
	this.setActionStatus('正在等待服务器确认...');
	this.updateTeleportButton();
};

/**
 * Load a map for display
 */
Navigation.loadMap = function loadMap(mapName, displayName, onReady) {
	const mapBaseName = normalizeMapName(mapName);
	if (!mapBaseName) {
		if (onReady) onReady(false);
		return;
	}

	const requestId = ++_mapLoadRequestId;
	_mapTerrain = null;
	if (_isMapClickTarget && _mapData && _mapData.map && _mapData.map !== mapName) {
		this.clear();
		_isMapClickTarget = false;
	}

	_mapData = {
		map: mapBaseName,
		ready: false,
		walkableType: Altitude.TYPE.WALKABLE
	};
	_mapImageMap = null;

	// Load town info
	_towninfo = DB.getTownInfo(mapBaseName) || [];

	// Use the same image availability data as the map catalog.
	loadCatalogMapImage(mapBaseName).then(dataURI => {
		if (requestId !== _mapLoadRequestId) return;
		if (dataURI) {
			_mapImageMap = mapBaseName;
			_map.onerror = () => {
				if (requestId === _mapLoadRequestId) _mapImageMap = null;
			};
			_map.src = dataURI;
		}
	}).catch(error => {
		console.warn('Navigation map image could not be loaded:', mapBaseName, error);
	});

	// Get the correct map path using DB.mapalias
	let gatPath = mapBaseName + '.gat';
	gatPath = gatPath.replace(/\//g, '\\');
	gatPath = DB.mapalias[gatPath] || gatPath;

	// Load the GAT file for pathfinding
	Client.loadFile('data/' + gatPath, gatData => {
		if (requestId !== _mapLoadRequestId) return;

		if (gatData?.cells && gatData.width && gatData.height) {
			_mapData.width = gatData.width;
			_mapData.height = gatData.height;
			_mapData.cells = gatData.cells;

			const cellCount = gatData.width * gatData.height;
			const cellTypes = new Uint8Array(cellCount);

			for (let i = 0; i < cellCount; i++) {
				const cellIndex = i * 5 + 4;
				cellTypes[i] = gatData.cells[cellIndex];
			}

			_mapData.cellTypes = cellTypes;
			// Cache the terrain background; navigation redraws every frame.
			const terrain = document.createElement('canvas');
			terrain.width = MAP_WIDTH;
			terrain.height = MAP_HEIGHT;
			drawWalkableMapPreview(terrain.getContext('2d'), terrain, _mapData);
			_mapTerrain = terrain;
			_mapData.ready = true;
			if (onReady) onReady(true);
			return;
		}

		if (onReady) onReady(false);
	});

	this.setMapNameText(displayName || mapName);
};

/**
 * Open a map selected from the world map without starting a search.
 */
Navigation.showMap = function showMap(mapName, displayName, options = {}) {
	this.clear();
	this.targetResult = null;
	this.show();

	const root = this.getRoot();
	const searchInput = root.querySelector('.search-input');
	if (searchInput && !options.preserveSearch) searchInput.value = '';

	const resultsContainer = root.querySelector('.search-results');
	if (resultsContainer) resultsContainer.style.display = 'none';

	this.loadMap(mapName, displayName);
	this.setLocationTitle(mapName, null, displayName);
	this.updateTeleportButton();
};

Navigation.showCurrentMap = function showCurrentMap() {
	const mapName = getCurrentMap();
	if (!mapName) return;
	if (_autoWalkActive || _autoWalkRequested) {
		this.show();
		this.loadMap(mapName);
		this.setLocationTitle(mapName, _finalTargetData?.map, _finalTargetData?.displayName);
		return;
	}
	this.showMap(mapName, DB.getMapInfo(`${mapName}.rsw`)?.displayName || DB.getMapName(mapName, mapName));
	this.setActionStatus('点击地图寻路/传送');
};

/**
 * Clear the end marker
 */
Navigation.clear = function clear() {
	this.stopAutoWalk();
	_navigationRequestId++;
	this.clearPath();
	_finalTargetData = null;
	_targetData = null;
	_selectedTargetData = null;
	_isMapClickTarget = false;
	_pathUnavailable = false;

	// Hide the target coordinates display
	const root = Navigation.getRoot();
	const targetInfo = root.querySelector('.target-info');
	if (targetInfo) {
		targetInfo.style.display = 'none';
	}

	// Update location title with current map name
	const currentMap = getCurrentMap();
	if (currentMap) {
		this.setLocationTitle(currentMap, null);
	}
	this.updateTeleportButton();
	this.updateAutoWalkButtons();
};

Navigation.clearPath = function clearPath(notify = true) {
	_path = [];
	_lastPathUpdate = 0;
	_pathUpdateLock = false;
	if (notify) notifyRouteState();
};

/**
 * Add a marker to the map
 */
Navigation.addMarker = function addMarker(x, y, color, label) {
	_markers.push({
		x: x,
		y: y,
		color: color || 'rgb(255,0,0)',
		label: label || ''
	});
};

/**
 * Render the map and markers
 */
Navigation.renderCanvas = function renderCanvas(tick) {
	const hostDisplay = this._host ? getComputedStyle(this._host).display : 'none';
	if (hostDisplay === 'none') {
		return;
	}

	const width = MAP_WIDTH;
	const height = MAP_HEIGHT;
	const ctx = _ctx;

	if (!ctx) {
		return;
	}

	// Check if player position has changed
	const currentMap = getCurrentMap();
	const currentPos = getPlayerPosition();
	if (_finalTargetData && !_dialogueWarp && !_pathUnavailable && tick - _lastPathUpdate > _pathUpdateThrottle && !_pathUpdateLock) {
		this.navigateTo({
			startMap: currentMap,
			startX: currentPos.x,
			startY: currentPos.y,
			endMap: _finalTargetData.map,
			endX: _finalTargetData.x,
			endY: _finalTargetData.y,
			displayName: _finalTargetData.displayName
		});
		_lastPathUpdate = tick;
	}

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Draw map background
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, width, height);

	// Draw the map image if loaded
	if (_mapData?.ready && _mapImageMap === _mapData.map && _map.complete && _map.width) {
		const fit = getMapFit(width, height);
		const source = mapImageSourceRect(_map.naturalWidth || _map.width, _map.naturalHeight || _map.height, _mapData);
		ctx.drawImage(_map, source.x, source.y, source.width, source.height, fit.x, fit.y, fit.width, fit.height);
	} else if (_mapData?.ready && _mapTerrain) {
		ctx.drawImage(_mapTerrain, 0, 0, width, height);
	}

	const mapToScreenBound = (x, y) => {
		return mapToScreen(x, y, width, height);
	};

	if (!_mapData?.ready) return;

	// Draw town info icons
	if (_towninfo && _towninfo.length) {
		for (let i = 0; i < _towninfo.length; i++) {
			const info = _towninfo[i];
			const pos = mapToScreenBound(info.X, info.Y);

			let img;
			switch (info.Type) {
				case 0:
					img = _toolDealer;
					break;
				case 1:
					img = _weaponDealer;
					break;
				case 2:
					img = _armorDealer;
					break;
				case 3:
					img = _blacksmith;
					break;
				case 4:
					img = _guide;
					break;
				case 5:
					img = _inn;
					break;
				case 6:
					img = _kafra;
					break;
				default:
					continue;
			}

			if (img.complete && img.width) {
				ctx.drawImage(img, pos.x - img.width / 2, pos.y - img.height / 2);
			}
		}
	}

	// Draw the path
	const remainingPath = remainingPathFromPosition(_path, currentPos);
	if (remainingPath && remainingPath.length > 0) {
		ctx.lineWidth = 2;

		let currentSegment = [];
		for (let i = 0; i < remainingPath.length; i++) {
			const point = remainingPath[i];
			const pos = mapToScreenBound(point.x, point.y);

			if (currentSegment.length === 0) {
				currentSegment.push(pos);
				// The first remaining point may itself be a warp entrance.
				if (!point.isWarp) continue;
			}

			if (point.isWarp || i === remainingPath.length - 1) {
				currentSegment.push(pos);

				ctx.strokeStyle = 'cyan';
				ctx.beginPath();
				ctx.moveTo(currentSegment[0].x, currentSegment[0].y);
				for (let j = 1; j < currentSegment.length; j++) {
					ctx.lineTo(currentSegment[j].x, currentSegment[j].y);
				}
				ctx.stroke();

				if (point.isWarp) {
					ctx.beginPath();
					ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
					ctx.fillStyle = 'yellow';
					ctx.fill();

					if (i + 1 < remainingPath.length) {
						const exitPos = mapToScreenBound(remainingPath[i + 1].x, remainingPath[i + 1].y);

						ctx.beginPath();
						ctx.arc(exitPos.x, exitPos.y, 3, 0, Math.PI * 2);
						ctx.fillStyle = 'yellow';
						ctx.fill();

						currentSegment = [exitPos];
						i++;
					} else {
						currentSegment = [pos];
					}
				} else {
					currentSegment = [pos];
				}
			} else {
				currentSegment.push(pos);
			}
		}
	}

	// Draw end marker (target position)
	if (_targetData) {
		const lastPoint = mapToScreenBound(_targetData.x, _targetData.y);
		ctx.fillStyle = NPC_MARKER_COLOR;
		ctx.beginPath();
		ctx.arc(lastPoint.x, lastPoint.y, 5, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 2;
		ctx.stroke();
	}

	// Draw start marker (player position)
	const startPos = mapToScreenBound(currentPos.x, currentPos.y);
	if (_mapData.map === currentMap) {
		drawPlayerArrow(ctx, startPos, Session.Entity?.direction ?? 0);
	}

	// Draw custom markers
	for (let i = 0; i < _markers.length; i++) {
		const marker = _markers[i];
		const pos = mapToScreenBound(marker.x, marker.y);

		ctx.fillStyle = marker.color;
		ctx.beginPath();
		ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
		ctx.fill();

		if (marker.label) {
			ctx.fillStyle = '#fff';
			ctx.font = '10px Arial';
			ctx.fillText(marker.label, pos.x + 5, pos.y + 3);
		}
	}
};

/**
 * Update the target coordinates text
 */
Navigation.updateTargetText = function updateTargetText(noPathFound) {
	const root = Navigation.getRoot();
	const targetInfo = root.querySelector('.target-info');
	if (targetInfo) {
		targetInfo.style.display = 'flex';
	}

	if (_finalTargetData) {
		this.setTargetCoordinatesText(_finalTargetData.x, _finalTargetData.y, {
			noPathFound: noPathFound,
			targetMap: _finalTargetData.map
		});
	}
};

/**
 * Set target coordinates text with proper formatting
 */
Navigation.setTargetCoordinatesText = function setTargetCoordinatesText(x, y, options) {
	const root = Navigation.getRoot();
	if (!root) {
		return;
	}

	const text = formatTargetCoordinates(x, y, options);
	const targetCoords = root.querySelector('.target-coordinates');
	if (targetCoords) {
		targetCoords.textContent = text;
		targetCoords.style.display = '';
	}
	const targetInfo = root.querySelector('.target-info');
	if (targetInfo) {
		targetInfo.style.display = 'flex';
	}
};

Navigation.setTargetCoordinatesBlinking = function setTargetCoordinatesBlinking(blinking) {
	const root = Navigation.getRoot();
	if (!root) {
		return;
	}

	const targetCoordinates = root.querySelector('.target-coordinates');
	if (!targetCoordinates) {
		return;
	}

	if (blinking) {
		if (!_blinking) {
			_blinking = true;
			_originalColor = getComputedStyle(targetCoordinates).color || '#ffffff';

			let fadeStep = 0;
			let fadeDirection = -1;
			_fadeInterval = setInterval(() => {
				fadeStep += fadeDirection * 0.1;

				if (fadeStep <= 0.3) {
					fadeDirection = 1;
				} else if (fadeStep >= 1) {
					fadeDirection = -1;
				}

				targetCoordinates.style.opacity = fadeStep;
			}, 50);
		}
	} else {
		if (_blinking) {
			clearInterval(_fadeInterval);
			_fadeInterval = null;
			targetCoordinates.style.opacity = '1';
			targetCoordinates.style.color = _originalColor;
			_blinking = false;
		}
	}
};

/**
 * Set location title with proper formatting
 */
Navigation.setLocationTitle = function setLocationTitle(currentMap, targetMap, displayName) {
	const root = Navigation.getRoot();
	if (!root) {
		return;
	}

	const title = formatLocationTitle(currentMap, targetMap, displayName);
	const locationTitle = root.querySelector('.location-title');
	if (locationTitle) {
		locationTitle.textContent = title;
	}
};

/**
 * Set coordinates text with proper formatting
 */
Navigation.setCoordinatesText = function setCoordinatesText(x, y, options) {
	const root = Navigation.getRoot();
	if (!root) {
		return;
	}

	const text = formatCoordinates(x, y, options);
	const coords = root.querySelector('.coordinates');
	if (coords) {
		coords.textContent = text;
	}
};

/**
 * Set map name text with proper formatting
 */
Navigation.setMapNameText = function setMapNameText(mapName) {
	const root = Navigation.getRoot();
	if (!root) {
		return;
	}

	const mapNameEl = root.querySelector('.map-name');
	if (mapNameEl) {
		mapNameEl.textContent = normalizeMapName(mapName);
	}
};

/**
 * Set mouse coordinates text with proper formatting
 */
Navigation.setMouseCoordinatesText = function setMouseCoordinatesText(x, y, options) {
	const root = Navigation.getRoot();
	if (!root) {
		return;
	}

	const text = formatCoordinates(x, y, options);
	const mouseCoords = root.querySelector('.mouse-coordinates');
	if (mouseCoords) {
		mouseCoords.textContent = text;
	}
};

/**
 * Find a path between two points using a web worker
 */
Navigation.findPath = async function findPath(startX, startY, endX, endY) {
	const navigationRequestId = _navigationRequestId;
	initializePathFindingWorker();
	if (_pathFindingWorker && !_pathUpdateLock) {
		_pathUpdateLock = true;

		let naviLinkTable;
		try {
			naviLinkTable = (await DB.getNavigationGraph()).links;
		} catch (error) {
			if (navigationRequestId !== _navigationRequestId) return;
			console.error('[Navigation] Failed to load navigation graph:', error);
			_pathUpdateLock = false;
			_pathUnavailable = true;
			notifyRouteState();
			return;
		}
		if (navigationRequestId !== _navigationRequestId) return;
		const currentMap = getCurrentMap();
		const warps = [];

		if (naviLinkTable && naviLinkTable.length) {
			for (let i = 0; i < naviLinkTable.length; i++) {
				const warp = naviLinkTable[i];
				if (!warp || warp.length < 11) {
					continue;
				}

				const srcMap = warp[0].replace(/\.gat$/, '').toLowerCase();
				const destMap = warp[8].replace(/\.gat$/, '').toLowerCase();

				if (srcMap === currentMap && destMap === currentMap) {
					warps.push({
						id: warp[1],
						type: warp[2],
						name: warp[4],
						npcName: warp[5],
						srcX: warp[6],
						srcY: warp[7],
						destX: warp[9],
						destY: warp[10]
					});
				}
			}
		}

		_pathFindingWorker.postMessage({
			type: 'findPath',
			startX: startX,
			startY: startY,
			endX: endX,
			endY: endY,
			mapData: {
				width: _mapData.width,
				height: _mapData.height,
				cellTypes: _mapData.cellTypes,
				walkableType: _mapData.walkableType,
				warps
			},
			workerId: _pathFindingWorker.id,
			navigationRequestId,
			existingPath: _path
		});
	}
};

/**
 * Toggle the navigation window (show/hide)
 */
Navigation.toggle = function toggle() {
	const hostDisplay = this._host ? getComputedStyle(this._host).display : 'none';
	if (hostDisplay !== 'none') {
		const currentZ = parseInt(this._host.style.zIndex, 10) || 0;
		let maxZ = currentZ;
		const components = this.manager?.components || {};
		for (const name in components) {
			const other = components[name];
			if (other === this || !other.__active || !other.needFocus) continue;
			maxZ = Math.max(maxZ, parseInt(other._host?.style.zIndex, 10) || 0);
		}
		if (currentZ >= maxZ) this.hide();
		else this.showCurrentMap();
		return;
	}
	this.showCurrentMap();
};

/**
 * Show the navigation window
 */
Navigation.show = function show() {
	const root = Navigation.getRoot();
	DB.prepareNavigationCatalog().catch(error => {
		console.error('[Navigation] Failed to preload navigation catalog:', error);
	});

	initializePathFindingWorker();

	// Hide coordinate displays initially
	const mouseInfo = root.querySelector('.mouse-info');
	if (mouseInfo) {
		mouseInfo.style.display = 'none';
	}
	const targetInfo = root.querySelector('.target-info');
	if (targetInfo) {
		targetInfo.style.display = 'none';
	}

	const mapName = getCurrentMap();

	this.setMapNameText(mapName);

	const locationTitle = root.querySelector('.location-title');
	if (locationTitle && !locationTitle.textContent) {
		this.setLocationTitle(mapName, null);
	}

	this.ui.show();
	this.focus();
	this.updateTeleportButton();
	this.updateAutoWalkButtons();
};

/**
 * Hide the navigation window
 */
Navigation.hide = function hide() {
	this.ui.hide();
};

Navigation.onKeyDown = function onKeyDown(event) {
	const hostDisplay = this._host ? getComputedStyle(this._host).display : 'none';
	if ((event.which === KEYS.ESCAPE || event.key === 'Escape') && hostDisplay !== 'none') {
		this.hide();
	}
};

/**
 * Handle mouse movement over the map to display coordinates
 */
Navigation.onMapMouseMove = function onMapMouseMove(event) {
	if (!_mapData?.ready) {
		this.onMapMouseLeave();
		return;
	}

	const root = Navigation.getRoot();
	const mapDisplay = root.querySelector('.map-display');
	const rect = mapDisplay.getBoundingClientRect();
	const x = Math.floor(event.clientX - rect.left);
	const y = Math.floor(event.clientY - rect.top);

	const mapCoords = this.screenToMapCoordinates(x, y);
	const mapX = Math.floor(mapCoords.x);
	const mapY = Math.floor(mapCoords.y);

	const mouseInfo = root.querySelector('.mouse-info');
	if (mouseInfo) {
		mouseInfo.style.display = 'flex';
	}
	this.setMouseCoordinatesText(mapX, mapY);
};

/**
 * Handle mouse leaving the map area
 */
Navigation.onMapMouseLeave = function onMapMouseLeave() {
	const root = Navigation.getRoot();
	const mouseInfo = root.querySelector('.mouse-info');
	if (mouseInfo) {
		mouseInfo.style.display = 'none';
	}
};

/**
 * Set the content of the navigation window based on NAVI info
 */
Navigation.setNaviInfo = function setNaviInfo(naviInfo, displayName) {
	const parts = naviInfo.split(',');
	if (parts.length < 3) {
		return;
	}

	const mapName = parts[0];
	const x = parseInt(parts[1], 10);
	const y = parseInt(parts[2], 10);

	// Clear the search input
	const root = Navigation.getRoot();
	const searchInput = root.querySelector('.search-input');
	if (searchInput) {
		searchInput.value = '';
	}
	_isMapClickTarget = false;

	const currentMap = getCurrentMap();
	const currentPos = getPlayerPosition();

	this.navigateTo({
		startMap: currentMap,
		startX: currentPos.x,
		startY: currentPos.y,
		endMap: mapName,
		endX: x,
		endY: y,
		displayName: displayName
	});
};

/**
 * Wait for map data to be loaded
 */
Navigation.withMapData = function withMapData(mapName, callback) {
	const normalizedMap = normalizeMapName(mapName);
	if (_mapData?.ready && _mapData.map === normalizedMap) {
		callback.call(this, true);
		return;
	}

	this.loadMap(normalizedMap, DB.getMapName(normalizedMap, normalizedMap), ready => {
		callback.call(this, ready);
	});
};

/**
 * Unified navigation function that handles both same-map and cross-map navigation
 */
Navigation.navigateTo = async function navigateTo(options) {
	const navigationRequestId = ++_navigationRequestId;
	this.setActionStatus('');
	const root = Navigation.getRoot();
	const startMap = normalizeMapName(options.startMap);
	const endMap = normalizeMapName(options.endMap);
	const displayName = options.displayName;
	const hasCoordinates = Number.isFinite(options.endX) && Number.isFinite(options.endY);
	if (!startMap || !endMap || !hasCoordinates) return;
	_autoWalkRequested = Boolean(options.autoWalk);

	if (
		_finalTargetData &&
		(_finalTargetData.map !== endMap || _finalTargetData.x !== options.endX || _finalTargetData.y !== options.endY)
	) {
		this.clearPath(false);
		resetPathFindingWorker();
		this.setTargetCoordinatesText(options.endX, options.endY, {
			targetMap: endMap
		});
		this.setTargetCoordinatesBlinking(true);
	}
	_pathUnavailable = false;

	_finalTargetData = {
		map: endMap,
		x: options.endX,
		y: options.endY,
		displayName: displayName
	};
	notifyRouteState();
	this.updateTeleportButton();
	this.updateAutoWalkButtons();

	const warpTypes = [200, 201];

	_pathUpdateLock = true;
	notifyRouteState();
	let path;
	try {
		path = await MapPathFinder.findPathBetweenMaps(
			startMap,
			options.startX,
			options.startY,
			endMap,
			options.endX,
			options.endY,
			warpTypes
		);
	} catch (error) {
		console.error('[Navigation] Failed to calculate route:', error);
		path = null;
	}
	if (navigationRequestId !== _navigationRequestId) return;
	_pathUpdateLock = false;

	if (!path || path.length === 0) {
		_autoWalkRequested = false;
		_pathUnavailable = true;
		this.stopAutoWalk();
		this.clearPath();
		this.updateTargetText(true);
		this.setTargetCoordinatesBlinking(false);
		this.setLocationTitle(startMap, endMap, displayName);
		return;
	}

	const target = path[0];
	_pathUpdateLock = true;
	this.withMapData(startMap, function (ready) {
		if (navigationRequestId !== _navigationRequestId) return;
		_pathUpdateLock = false;
		if (!ready || !_finalTargetData) {
			_pathUnavailable = true;
			this.stopAutoWalk();
			this.updateTargetText(true);
			this.setTargetCoordinatesBlinking(false);
			return;
		}

		const walkableCell = this.findClosestWalkableCell(target.x, target.y);

		if (walkableCell) {
			_targetData = {
				x: walkableCell.x,
				y: walkableCell.y,
				map: target.map,
				displayName: displayName,
				warpType: target.warpType,
				warpName: target.warpName,
				warpSource: target.warpSource
			};
			this.findPath(options.startX, options.startY, _targetData.x, _targetData.y);
		} else {
			_pathUnavailable = true;
			this.stopAutoWalk();
			this.clearPath();
			this.updateTargetText(true);
			this.setTargetCoordinatesBlinking(false);
		}
	});
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(Navigation);
