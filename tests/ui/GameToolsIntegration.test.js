import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import MapInfo from '../../src/DB/Map/MapTable.js';

const projectRoot = resolve(import.meta.dirname, '../..');
const read = path => readFileSync(resolve(projectRoot, path), 'utf8');

describe('game tools integration', () => {
	it('ships the verified monster catalog and every referenced atlas', () => {
		const catalog = JSON.parse(read('applications/pwa/data/monsters/catalog.json'));
		const ids = new Set(catalog.monsters.map(monster => monster.id));
		const poring = catalog.monsters.find(monster => monster.id === 1002);

		expect(catalog.schema).toBe('happyro-monster-catalog/v4');
		expect(catalog.source.sha256).toMatch(/^[a-f0-9]{64}$/);
		expect(catalog.source.itemsSha256).toMatch(/^[a-f0-9]{64}$/);
		expect(catalog.source.spawnsSha256).toMatch(/^[a-f0-9]{64}$/);
		expect(catalog.monsters).toHaveLength(2675);
		expect(ids.size).toBe(catalog.monsters.length);
		expect(poring).toMatchObject({ name: '波利', nameEn: 'Poring', atlas: 0 });
		expect(poring.spawns).toContainEqual(expect.objectContaining({ mapName: 'prt_fild08', count: 87 }));
		expect(catalog.monsters.every(monster => !('drops' in monster) && !('mvpDrops' in monster))).toBe(true);

		for (const atlas of new Set(catalog.monsters.map(monster => monster.atlas).filter(Number.isInteger))) {
			expect(existsSync(resolve(projectRoot, `applications/pwa/data/monsters/atlas-${atlas}.webp`))).toBe(true);
		}
	});

	it('ships monster drops as a separate on-demand file', () => {
		const dropsFile = JSON.parse(read('applications/pwa/data/monsters/drops.json'));
		const catalog = JSON.parse(read('applications/pwa/data/monsters/catalog.json'));

		expect(dropsFile.schema).toBe('happyro-monster-drops/v1');
		expect(dropsFile.source.sha256).toBe(catalog.source.sha256);
		expect(Object.keys(dropsFile.drops)).toHaveLength(catalog.monsters.length);
		expect(dropsFile.drops[1002].drops[0]).toMatchObject({
			Item: 'Jellopy',
			itemId: 909,
			name: '杰勒比结晶',
			nameEn: 'Jellopy'
		});

		const drops = Object.values(dropsFile.drops).flatMap(entry => [...entry.drops, ...entry.mvpDrops]);
		expect(drops).toHaveLength(13339);
		expect(drops.every(drop => drop.itemId > 0 && drop.name && drop.nameEn)).toBe(true);
	});

	it('ships the verified NPC image atlases', () => {
		const catalog = JSON.parse(read('applications/pwa/data/world/npc-assets.json'));
		expect(catalog.schema).toBe('happyro-world-assets/v3');
		expect(catalog.source.sha256).toMatch(/^[a-f0-9]{64}$/);
		expect(catalog.source.npcDefinitionsSha256).toMatch(/^[a-f0-9]{64}$/);
		expect(catalog.source.npcCatalogVersion).toMatch(/^kro-20211105-[a-f0-9]{12}$/);
		expect(catalog.source.mapImagesSha256).toMatch(/^[a-f0-9]{64}$/);
		const imageRoot = resolve(projectRoot, '../happyro-api/resources/game-data/world/npcs');
		const images = readdirSync(imageRoot).filter(name => /^\d+\.png$/.test(name))
			.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
		expect(catalog.source.imageCount).toBe(images.length);
		expect(Object.keys(catalog.sprites).map(Number).sort((a, b) => a - b))
			.toEqual(images.map(name => Number.parseInt(name, 10)));
		const hash = createHash('sha256');
		for (const name of images) hash.update(readFileSync(resolve(imageRoot, name)));
		expect(catalog.source.sha256).toBe(hash.digest('hex'));
		const mapImageRoot = resolve(projectRoot, '../happyro-api/resources/game-data/world/maps');
		const mapImages = readdirSync(mapImageRoot).filter(name => name.endsWith('.png'))
			.map(name => name.slice(0, -4)).sort();
		expect([...catalog.mapImages].sort()).toEqual(mapImages);
		expect(catalog.mapImages).toContain('tra_fild02');
		expect(catalog.mapImages).toContain('prontera');
		expect(catalog).not.toHaveProperty('npcInstances');
		for (const atlas of new Set(Object.values(catalog.sprites).map(sprite => sprite.atlas))) {
			expect(existsSync(resolve(projectRoot, `applications/pwa/data/world/npc-atlas-${atlas}.webp`))).toBe(true);
		}
	});

	it('includes every restored classic instructor with its current server navigation identity', () => {
		const catalog = JSON.parse(read('../happyro-api/resources/game-data/world/npc-catalog.json'));
		const classic = catalog.entries.filter(npc => npc.source.path === 'npc/re/jobs/novice/novice.txt');
		expect(classic).toHaveLength(115);
		for (const npc of classic) {
			expect(npc.game_visible, npc.id).toBe(true);
			expect(npc.navigation.class, npc.id).toBe(npc.sprite_id);
		}
		const ninja = catalog.entries.find(npc => npc.id.includes('Suspicious Man#nq'));
		expect(ninja.navigation.class).toBe(881);
		expect(ninja.navigation.class).toBe(ninja.sprite_id);
	});

	it('ships the localized NPC instance table as a fetched navigation resource', () => {
		const names = JSON.parse(read('src/DB/NpcNameTranslations.zh-CN.json'));
		const catalog = JSON.parse(read('../happyro-api/resources/game-data/world/npc-catalog.json'));
		const assets = JSON.parse(read('applications/pwa/data/world/npc-assets.json'));
		const instances = JSON.parse(read('applications/pwa/data/navigation/npc-instances.json'));
		expect(Object.keys(names).length).toBeGreaterThan(4000);
		expect(Object.values(names).every(name => /[\u3400-\u9fff]/.test(name))).toBe(true);
		expect(instances.schemaVersion).toBe(1);
		expect(Object.keys(instances.instances).length).toBeGreaterThan(10000);
		expect(catalog.schema).toBe('happyro-npc-catalog/v1');
		expect(catalog.entries.length).toBeGreaterThan(13000);
		const teleportable = catalog.entries.filter(npc => Number.isFinite(npc.navigation?.class));
		const visible = teleportable.filter(npc => Number.isFinite(npc.display_sprite_id));
		expect(teleportable.length).toBeGreaterThan(4000);
		expect(visible).toEqual(catalog.entries.filter(npc => npc.game_visible));
		const translatedEntries = catalog.entries
			.filter(npc => /[\u3400-\u9fff]/.test(npc.display_name));
		const byPosition = new Map();
		for (const npc of translatedEntries) {
			const key = `${npc.map}:${npc.x}:${npc.y}`;
			if (!byPosition.has(key)) byPosition.set(key, []);
			byPosition.get(key).push(npc);
		}
		const expectedPositions = new Set(byPosition.keys());
		expect(new Set(Object.keys(instances.instances))).toEqual(expectedPositions);
		for (const position of expectedPositions) {
			const candidates = byPosition.get(position);
			const npc =
				candidates.find(entry => entry.game_visible) ||
				candidates.find(entry => entry.display_sprite_id != null) ||
				candidates[0];
			expect(instances.instances[position]).toEqual({ name: npc.display_name, sourceName: npc.source_name });
		}
		expect(instances.instances['1@cor:172:223']).toEqual({ name: '埃琳娜', sourceName: '埃琳娜' });
		expect(catalog.entries.every((npc, index) => npc.catalog_order === index)).toBe(true);
		expect(visible.every(npc => assets.sprites[npc.display_sprite_id])).toBe(true);
		expect(Object.values(instances.instances).every(npc => /[\u3400-\u9fff]/.test(npc.name))).toBe(true);
		expect(
			visible.filter(npc => npc.map === 'iz_int' && npc.display_name === '受伤的剑士').map(npc => npc.navigation.class)
		).toEqual([687]);
		expect(
			visible.filter(npc => npc.map === 'int_land').map(npc => npc.display_name)
		).toEqual(expect.arrayContaining(['卡洛克船长', '卢敏', '水手']));
		expect(instances.instances['aldeba_in:155:240']).toMatchObject({
			name: '卡普拉',
			sourceName: '卡普拉'
		});
		expect(read('src/DB/Navigation/NavigationData.js')).toContain(
			'getNpcInstanceName(instanceNames, npc[0], npc[6], npc[7])'
		);
		expect(read('src/DB/DBManager.js')).toContain('loadNpcInstanceNames()');
	});

	it('keeps the big world catalogs out of the bundle', () => {
		for (const bundled of [
			'src/DB/Navigation/NpcCatalog.json',
			'src/DB/Navigation/NpcInstanceNameTable.js',
			'src/DB/Navigation/MapCatalog.json'
		]) {
			expect(existsSync(resolve(projectRoot, bundled))).toBe(false);
		}
		for (const fetched of [
			'applications/pwa/data/navigation/npc-instances.json',
			'applications/pwa/data/navigation/map-catalog.json',
			'applications/pwa/data/monsters/drops.json'
		]) {
			expect(existsSync(resolve(projectRoot, fetched))).toBe(true);
		}
		expect(read('src/UI/Components/GameTools/NpcCatalogTab.js')).toContain('searchAdventureNpcs(');
		expect(read('src/UI/Components/GameTools/MapCatalogTab.js')).toContain('searchAdventureMaps(');
	});

	it('uses the common feature registry while retaining the desktop initial tab', () => {
		const source = read('src/UI/Components/GameTools/GameTools.js');
		expect(source).toContain("from './GameToolsTabs.js'");
		expect(source).toContain("Preferences.get('GameTools', { tab: 'maps' }, 2.0)");
	});

	it('centers the adventure tools window from the current viewport dimensions', () => {
		const source = read('src/UI/Components/GameTools/GameTools.js');
		const css = read('src/UI/Components/GameTools/GameTools.css');
		expect(source).toContain('this.renderTabs()');
		expect(source).toContain('(viewportWidth - width) / 2');
		expect(source).toContain('(viewportHeight - height) / 2');
		expect(source).not.toContain('{ x: 250, y: 90');
		expect(css).not.toMatch(/:host\s*\{[^}]*(?:top|left):\s*\d+px/s);
	});

	it('uses lazy map thumbnails and the shared marked map preview', () => {
		const mapSource = read('src/UI/Components/GameTools/MapCatalogTab.js');
		const npcSource = read('src/UI/Components/GameTools/NpcCatalogTab.js');
		expect(mapSource).toContain('loadCatalogMapImage');
		expect(mapSource).toContain('data-map-thumb');
		expect(mapSource).toContain('drawWorldMapPreview');
		expect(npcSource).toContain('npc-map-canvas');
		expect(npcSource).toContain('drawWorldMapPreview');
		expect(npcSource).toContain('class="catalog-heading"');
		expect(npcSource).toContain('class="npc-detail-body"');
		expect(npcSource).toContain('renderCatalogScopeFilter');
		expect(npcSource).toContain('const onMap = scopeFilter.checked ? currentMap : \'\'');
		expect(npcSource).not.toContain("value: 'all'");
	});

	it('lists NPCs for the selected map and teleports through the existing NPC action', () => {
		const mapSource = read('src/UI/Components/GameTools/MapCatalogTab.js');
		expect(mapSource).toContain('loadAdventureMapNpcs(map.mapName)');
		expect(mapSource).toContain('teleportToNpc(selectedNpc)');
		expect(mapSource).toContain('npcTeleportEnabled');
		expect(mapSource).toContain('class="map-detail-body"');
		expect(mapSource).toContain('class="map-npc-list"');
		expect(mapSource).not.toContain('map-npc-teleport');
		expect(mapSource).toContain('npcList.scrollTop = npcListScrollTop');
		expect(mapSource).toContain('mapNpcs = toCatalogNpcs(rows)');
		expect(read('src/UI/Components/GameTools/AdventureControlService.js')).toContain(
			"return request(`/maps/${encodeURIComponent(map)}/npcs`)"
		);
	});

	it('provides current-map route previews, terrain thumbnails and route lifecycle state', () => {
		// Map marker lifecycle is exercised in MapDefaultArrival and MapCatalogTab tests.
		const previewSource = read('src/UI/Components/GameTools/WorldMapPreview.js');
		const routeSource = read('src/UI/Components/GameTools/AdventureRouteService.js');
		const navigationSource = read('src/UI/Components/Navigation/Navigation.js');
		expect(previewSource).toContain('drawWalkableMapPreview(context, canvas, coordinateGrid, canvas._mapFitRect)');
		expect(previewSource).toContain('drawPath(context, canvas, overlays.path, coordinateGrid)');
		expect(previewSource).toContain('drawPlayer(context, canvas, overlays.player, coordinateGrid)');
		expect(previewSource).toContain('mapImageSourceRect(image.naturalWidth, image.naturalHeight, coordinateGrid)');
		expect(previewSource).toContain('export function drawPlayerArrow(context, point, direction = 0, scale = 1)');
		expect(previewSource).toContain('context.rotate((direction * 45 * Math.PI) / 180)');
		expect(previewSource).toContain("export const NPC_MARKER_COLOR = '#a855f7'");
		expect(previewSource).toContain('drawMarker(context, canvas, marker, coordinateGrid, NPC_MARKER_COLOR)');
		expect(routeSource).toContain('Navigation.navigateTo({');
		expect(routeSource).toContain('normalizeAdventureMap(nextTarget.mapName) !== getCurrentAdventureMap()');
		expect(routeSource).not.toContain('new PACKET.CZ.REQUEST_MOVE');
		expect(navigationSource).toContain('_autoWalkRequested = Boolean(options.autoWalk);');
		expect(navigationSource).toContain('Navigation.subscribeRouteState = function subscribeRouteState(listener)');
		expect(navigationSource).toMatch(
			/Navigation\.findPath = async function findPath\([^)]*\) \{\s*const navigationRequestId = _navigationRequestId;\s*initializePathFindingWorker\(\);/
		);
		expect(navigationSource).toContain('if (navigationRequestId !== _navigationRequestId) return;');
	});

	it('keeps monster location scrolling and waits for coordinate teleport results', () => {
		const monsterSource = read('src/UI/Components/GameTools/MonsterCatalogTab.js');
		const actionSource = read('src/UI/Components/GameTools/AdventureActionService.js');
		expect(monsterSource).toContain('locations.scrollTop = state.locationScrollTop;');
		expect(actionSource).toContain('new PACKET.CZ.HAPPYRO_MAP_TELEPORT()');
		expect(actionSource).toContain('handleMapTeleportResult');
	});

	it('keeps NPC availability requests valid across detail rerenders', () => {
		const source = read('src/UI/Components/GameTools/NpcCatalogTab.js');

		expect(source).toContain('const token = selectionToken;');
		expect(source).not.toContain('const token = ++selectionToken;');
		expect(source).not.toContain('catalog-route');
		expect(source).not.toContain('AdventureRouteService');
		expect(source).toContain('class="catalog-teleport"');
		expect(source).toContain('npcAtlasStyle(manifest, npc.spriteId');
	});

	it('uses the audited name and retains the illusion map subtitle', () => {
		expect(MapInfo['gef_d01_i.rsw']).toMatchObject({
			displayName: '第250页',
			signName: { mainTitle: '第250页', subTitle: '幻境' }
		});
	});

	it('wires both active toolbar versions and the private packet pair', () => {
		expect(read('src/UI/Components/BasicInfo/BasicInfoV4/BasicInfoV4.html')).toContain('id="game-tools"');
		expect(read('src/UI/Components/BasicInfo/BasicInfoV5/BasicInfoV5.html')).toContain('id="game-tools"');
		expect(read('src/Network/PacketStructure.js')).toContain('pkt_buf.writeShort(0xcfe)');
		expect(read('src/Network/PacketRegister.js')).toContain('0xcff: PACKET.ZC.HAPPYRO_MONSTER_SPAWN_RESULT');
		expect(read('src/Network/PacketStructure.js')).toContain('pkt_buf.writeShort(0xcfc)');
		expect(read('src/Network/PacketRegister.js')).toContain('0xcfd: PACKET.ZC.HAPPYRO_NPC_TELEPORT_RESULT');
		expect(read('src/Network/PacketStructure.js')).toContain('pkt_buf.writeShort(0xcfa)');
		expect(read('src/Network/PacketStructure.js')).toContain(
			'const packetLength = 10 + count * 24'
		);
		expect(read('src/UI/Components/GameTools/MapCatalogTab.js')).toContain(
			'npcAvailabilityBatches(npcs).map(batch => requestNpcAvailability(batch))'
		);
		expect(read('src/Network/PacketRegister.js')).toContain(
			'0xcfb: PACKET.ZC.HAPPYRO_NPC_AVAILABILITY_RESULT'
		);
		expect(read('src/Network/PacketStructure.js')).toContain('pkt_buf.writeShort(0xd00)');
		expect(read('src/Network/PacketRegister.js')).toContain('0xd01: PACKET.ZC.HAPPYRO_MAP_TELEPORT_RESULT');
		expect(read('src/Network/PacketLength.js')).toContain('packets_len[0x0d01] = 32');
		expect(read('src/Network/PacketLength.js')).toContain('packets_len[0x0cfb] = -1');
	});

	it('copies catalog assets into the deployed PWA output', () => {
		expect(read('applications/tools/builder-web.mjs')).toContain(
			"copyFolder('./applications/pwa/data', dist + platform + '/data')"
		);
		expect(JSON.parse(read('package.json')).scripts['build:online']).toContain('--PWA');
	});

	it('keeps monster details behind a fixed bottom action area', () => {
		const css = read('src/UI/Components/GameTools/GameTools.css');

		expect(css).toMatch(/\.monster-detail\s*\{[^}]*overflow:\s*hidden/s);
		expect(css).toMatch(/\.monster-drops,\s*\.monster-locations\s*\{[^}]*overflow-y:\s*auto/s);
		expect(css).toMatch(/\.monster-resources\s*\{[^}]*grid-template-columns:/s);
		expect(css).toMatch(/\.summon-panel\s*\{[^}]*margin:\s*0 -12px -12px/s);
		expect(css).not.toMatch(/\.summon-panel\s*\{[^}]*position:\s*sticky/s);
	});

	it('renders localized drop names while retaining source names as metadata', () => {
		const source = read('src/UI/Components/GameTools/MonsterCatalogTab.js');

		expect(source).toContain('escapeHtml(drop.name || drop.Item)');
		expect(source).toContain('title="${escapeHtml(drop.nameEn || drop.Item)}"');
		expect(source).toContain('teleportToCoordinate(teleportTarget);');
		expect(source).toContain('>传送到地图</button>');
		expect(source).toContain('renderCatalogScopeFilter');
		expect(source).not.toContain('if (scopeFilter && !currentMonsters.length) scopeFilter.checked = false');
		expect(source).toContain('if (!state.selected) {');
		expect(source).toContain('state.selected = state.filtered[0] || null');
		expect(source).not.toContain('${spawn.count} 只');
	});

	it('shows separate mobile prices, weight and equipment slot counts', () => {
		const source = read('src/UI/Components/GameTools/ItemCatalogTab.js');
		expect(source).toContain("['买价', item.Buy ?? '-']");
		expect(source).toContain("['卖价', item.Sell ?? '-']");
		expect(source).toContain("['重量', weight]");
		expect(source).toContain('${item.Buy ?? \'-\'} / ${item.Sell ?? \'-\'}');
		expect(source).toContain("['洞数', item.Slots ?? 0]");
		expect(source).toContain("ariaLabel: '子类'");
		expect(read('src/UI/Components/GameTools/RemoteCatalogBrowser.js')).toContain(
			'state.selected = state.items[0] || null'
		);
		expect(source).not.toContain('放大镜鉴定后发放');
	});
});
