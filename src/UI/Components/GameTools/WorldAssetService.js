import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';
import MiniMapTable from 'DB/Map/MiniMapTable.js';
import Altitude from 'Renderer/Map/Altitude.js';
import { canvasPointToMap, fittedMapRect } from './MapPreviewLayout.js';

let npcAssetsPromise;
const mapImagePromises = new Map();
const mapResourcePromises = new Map();

export function loadNpcAssets() {
	if (!npcAssetsPromise) {
		npcAssetsPromise = fetch(new URL('./data/world/npc-assets.json', window.location.href)).then(response => {
			if (!response.ok) throw new Error(`NPC assets request failed: ${response.status}`);
			return response.json();
		});
	}
	return npcAssetsPromise;
}

export function npcAtlasStyle(manifest, npcClass, displaySize) {
	const sprite = manifest?.sprites?.[npcClass];
	if (!sprite) return '';
	const { tileSize, columns, rows } = manifest.atlas;
	const scale = displaySize / tileSize;
	const column = sprite.tile % columns;
	const row = Math.floor(sprite.tile / columns);
	return [
		`background-image:url('./data/world/npc-atlas-${sprite.atlas}.webp')`,
		`background-size:${columns * tileSize * scale}px ${rows * tileSize * scale}px`,
		`background-position:${-column * displaySize}px ${-row * displaySize}px`
	].join(';');
}

function loadClientFile(path) {
	return new Promise(resolve =>
		Client.loadFile(
			path,
			data => resolve(data || null),
			() => resolve(null)
		)
	);
}

function getMapPaths(mapName) {
	const normalized = String(mapName || '')
		.replace(/\.gat$/i, '')
		.toLocaleLowerCase();
	const miniMapBaseName = MiniMapTable[normalized] || normalized;
	let bmpPath = `${DB.INTERFACE_PATH.replace('data/texture/', '')}map/${miniMapBaseName}.bmp`.replace(/\//g, '\\');
	bmpPath = DB.mapalias[bmpPath] || bmpPath;
	let gatPath = `${normalized}.gat`.replace(/\//g, '\\');
	gatPath = DB.mapalias[gatPath] || gatPath;
	return { normalized, miniMapBaseName, bmpPath, gatPath };
}

export function loadCatalogMapImage(mapName) {
	const paths = getMapPaths(mapName);
	if (!mapImagePromises.has(paths.normalized)) {
		mapImagePromises.set(
			paths.normalized,
			loadNpcAssets().then(assets =>
				assets.mapImages?.includes(paths.miniMapBaseName)
					? loadClientFile(`data/texture/${paths.bmpPath}`)
					: null
			)
		);
	}
	return mapImagePromises.get(paths.normalized);
}

function loadImageDimensions(source) {
	if (!source) return Promise.resolve(null);
	return new Promise(resolve => {
		const image = new Image();
		image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = () => resolve(null);
		image.src = source;
	});
}

export async function loadCatalogMap(mapName) {
	const paths = getMapPaths(mapName);
	if (!mapResourcePromises.has(paths.normalized)) {
		mapResourcePromises.set(
			paths.normalized,
			Promise.all([loadCatalogMapImage(paths.normalized), loadClientFile(`data/${paths.gatPath}`)]).then(
				async ([image, gat]) => {
					const dimensions = gat?.width && gat?.height ? null : await loadImageDimensions(image);
					const coordinateGrid = gat?.width && gat?.height ? gat : dimensions;
					return { image, gat: coordinateGrid, mapName: paths.normalized };
				}
			)
		);
	}
	return mapResourcePromises.get(paths.normalized);
}

export function canvasToMapCoordinate(canvas, event, gat) {
	const grid = gat?.width && gat?.height ? gat : { width: canvas.width, height: canvas.height };
	const rect = canvas.getBoundingClientRect();
	const scaleX = (canvas.width || rect.width) / (rect.width || 1);
	const scaleY = (canvas.height || rect.height) / (rect.height || 1);
	const canvasX = (event.clientX - rect.left) * scaleX;
	const canvasY = (event.clientY - rect.top) * scaleY;
	const fit = canvas._mapFitRect || fittedMapRect(canvas.width, canvas.height, grid.width, grid.height);
	return canvasPointToMap(fit, grid, canvasX, canvasY);
}

export function findNearestWalkableCoordinate(gat, target, maxRadius = 12) {
	if (!target) return null;
	if (!gat?.cells) return target;
	const isWalkable = (x, y) => {
		if (x < 0 || y < 0 || x >= gat.width || y >= gat.height) return false;
		return (gat.cells[(y * gat.width + x) * 5 + 4] & Altitude.TYPE.WALKABLE) !== 0;
	};
	if (isWalkable(target.x, target.y)) return target;
	for (let radius = 1; radius <= maxRadius; radius += 1) {
		for (let offset = -radius; offset <= radius; offset += 1) {
			for (const [x, y] of [
				[target.x + offset, target.y - radius],
				[target.x + offset, target.y + radius],
				[target.x - radius, target.y + offset],
				[target.x + radius, target.y + offset]
			]) {
				if (isWalkable(x, y)) return { x, y };
			}
		}
	}
	return target;
}
