import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';

const worldMapSource = readFileSync(
	resolve(process.cwd(), 'src/UI/Components/WorldMap/WorldMap.js'),
	'utf8'
);
const navigationSource = readFileSync(
	resolve(process.cwd(), 'src/UI/Components/Navigation/Navigation.js'),
	'utf8'
);
const navigationHtml = readFileSync(
	resolve(process.cwd(), 'src/UI/Components/Navigation/Navigation.html'),
	'utf8'
);
const adventureActionSource = readFileSync(
	resolve(process.cwd(), 'src/UI/Components/GameTools/AdventureActionService.js'),
	'utf8'
);
const miniMapSource = readFileSync(
	resolve(process.cwd(), 'src/UI/Components/MiniMap/MiniMapCommon.js'),
	'utf8'
);

describe('world map navigation', () => {
	it('opens the selected map by id instead of searching its display name', () => {
		const clickHandler = worldMapSource.match(
			/function onWorldMapSectionClick\(e\) \{[\s\S]*?\n\}/
		)?.[0];

		expect(clickHandler).toContain('Navigation.showMap(mapId, displayName)');
		expect(clickHandler).not.toContain('Navigation.onSearch()');
	});

	it('loads the selected map and rejects stale resource callbacks', () => {
		expect(navigationSource).toMatch(
			/Navigation\.showMap = function showMap\(mapName, displayName, options = \{\}\) \{[\s\S]*this\.loadMap\(mapName, displayName\);/
		);
		expect(navigationSource).toContain('const requestId = ++_mapLoadRequestId;');
		expect(navigationSource.match(/if \(requestId !== _mapLoadRequestId\) return;/g)).toHaveLength(2);
	});

	it('preserves the query when a map is opened from a monster result', () => {
		const resultHandler = navigationSource.match(
			/Navigation\.navigateToSearchResult = function navigateToSearchResult\(result\) \{[\s\S]*?\n\};/
		)?.[0];

		expect(resultHandler).toContain('preserveSearch: true');
		expect(navigationSource).toContain('if (searchInput && !options.preserveSearch)');
	});

	it('keeps coordinate clicks on a preview map local to that preview', () => {
		expect(navigationSource).toContain('if (previewMap !== currentMap)');
		expect(navigationSource).toContain('_targetData = { x: mapCoords.x, y: mapCoords.y, map: previewMap }');
		expect(navigationSource).toContain('displayName: previewName');
	});

	it('uses server-issued capabilities for self teleport', () => {
		expect(navigationSource).toContain('Session.NavigationTeleportAllowed');
		expect(navigationSource).toContain('Session.NavigationTeleportCrossMap');
		expect(navigationSource).toContain('Session.NavigationTeleportCooldown');
		expect(navigationSource).not.toContain('Session.UserLevel >= 10');
		expect(navigationSource.match(/canSelfTeleport\(\)/g)).toHaveLength(3);
		expect(navigationSource).toContain('teleportToCoordinate({ mapName: target.map');
		expect(navigationSource).toContain('Navigation.teleportToSelectedTarget');
	});

	it('brings the navigation window above the top-left menu when shown', () => {
		const showHandler = navigationSource.match(/Navigation\.show = function show\(\) \{[\s\S]*?\n\};/)?.[0];
		expect(showHandler).toContain('this.focus()');
		expect(showHandler).toContain('this.ui.show()');
	});

	it('opens adventure maps when the minimap canvas is clicked', () => {
		expect(miniMapSource).toContain("import('UI/Components/GameTools/GameTools.js')");
		expect(miniMapSource).toContain('root.addEventListener(');
		expect(miniMapSource).toContain('mapCanvas.getBoundingClientRect()');
		expect(miniMapSource).toContain('GameTools.showMap()');
		expect(navigationSource).toContain("this.setActionStatus('点击地图寻路/传送')");
		expect(navigationSource).toContain('if (_autoWalkActive || _autoWalkRequested)');
	});

	it('cycles minimap opacity from the button next to zoom out without hiding the controls', () => {
		expect(miniMapSource).toContain("root.querySelector('.mini')");
		expect(miniMapSource).toContain('MiniMap.toggleOpacity()');
		expect(miniMapSource).toContain("_ctx.canvas.style.visibility = 'hidden'");
		expect(miniMapSource).not.toContain('this.ui.hide()');
	});

	it('temporarily hides transfer-service routing', () => {
		expect(navigationHtml).not.toContain('class="services-toggle"');
	});

	it('keeps coordinate actions visible and disabled until a map target is selected', () => {
		expect(navigationSource).toContain("button.style.display = 'inline-block'");
		expect(navigationSource).toContain(
			'button.disabled = !hasCoordinateTarget || !canTeleportTarget || !coordinateActionState.canTeleport'
		);
		expect(navigationSource).toContain("start.style.display = _autoWalkActive ? 'none' : 'inline-block'");
		expect(navigationSource).toContain('start.disabled = !canStart');
		expect(navigationSource).toContain('mapImageSourceRect(');
		expect(navigationSource).toContain('ctx.fillStyle = NPC_MARKER_COLOR');
		expect(navigationSource).toContain('remainingPathFromPosition(_path, currentPos)');
		expect(navigationSource).toContain('point.isWarp || i === remainingPath.length - 1');
	});

	it('hides the window without stopping an active route', () => {
		const hideHandler = navigationSource.match(/Navigation\.hide = function hide\(\) \{[\s\S]*?\n\};/)?.[0];

		expect(hideHandler).toContain('this.ui.hide()');
		expect(hideHandler).not.toContain('stopAutoWalk');
		expect(hideHandler).not.toContain('terminatePathFindingWorker');
		expect(navigationSource).toContain("closeButton.addEventListener('mousedown', event => event.stopPropagation())");
	});

	it('only closes navigation and world map once a coordinate teleport actually starts, without a success message', () => {
		const requestHandler = navigationSource.match(
			/Navigation\.teleportToSelectedTarget = function teleportToSelectedTarget\(\) \{[\s\S]*?\n\};/
		)?.[0];
		const resultHandler = navigationSource.match(
			/Navigation\.onMapTeleportResult = function onMapTeleportResult\(packet\) \{[\s\S]*?\n\};/
		)?.[0];

		for (const started of [false, true]) {
			const Navigation = { hide: vi.fn(), setActionStatus: vi.fn(), updateTeleportButton: vi.fn() };
			const worldMapHide = vi.fn();
			const teleportToCoordinate = vi.fn(() => started);
			runInNewContext(requestHandler, {
				Navigation,
				UIManager: { components: { WorldMap: { hide: worldMapHide } } },
				getTeleportTarget: () => ({ map: 'payon', x: 100, y: 120 }),
				teleportToCoordinate
			});

			Navigation.teleportToSelectedTarget();

			expect(teleportToCoordinate).toHaveBeenCalledWith({ mapName: 'payon', x: 100, y: 120 });
			expect(Navigation.hide).toHaveBeenCalledTimes(started ? 1 : 0);
			expect(worldMapHide).toHaveBeenCalledTimes(started ? 1 : 0);
			expect(Navigation.setActionStatus).toHaveBeenCalledTimes(started ? 1 : 0);
			expect(Navigation.updateTeleportButton).toHaveBeenCalledTimes(started ? 1 : 0);
		}
		expect(resultHandler).not.toContain("this.setActionStatus('瞬间转移')");
		expect(adventureActionSource).toContain("setStatus('', false, null)");
	});

	it('supports map search and auto-walk controls', () => {
		expect(navigationSource).toContain('startAutoWalk');
		expect(navigationSource).toContain('REQUEST_MOVE2');
		expect(navigationSource).toContain('warpType >= 202');
	});

	it('labels live NPC availability without removing static search results', () => {
		expect(navigationSource).toContain('npcAvailabilityBatches');
		expect(navigationSource).toContain('sendNpcAvailabilityRequest');
		expect(navigationSource).toContain("result.availability = available[index] ? 'available' : 'unavailable'");
		expect(navigationSource).toContain('`${mapName} · ${result.x},${result.y}`');
	});

	it('renders navigation results as native buttons for cursor and keyboard handling', () => {
		expect(navigationSource).toContain("document.createElement('button')");
		expect(navigationSource).toContain("resultItem.type = 'button'");
	});

	it('uses in-page filter menus so the game cursor stays above their options', () => {
		expect(navigationHtml).not.toContain('<select');
		expect(navigationHtml).toContain('class="filter-trigger"');
		expect(navigationHtml).toContain('role="listbox"');
		expect(navigationSource).toContain('setupSearchFilter');
	});
});
