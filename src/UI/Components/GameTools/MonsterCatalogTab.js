import { loadMonsterCatalog, loadMonsterDrops } from './MonsterCatalogAssets.js';
import preferences from 'Preferences/AdventureTools.js';
import { renderCatalogEmptyState } from './CatalogEmptyState.js';
import { resetTabScroll } from './TabViewState.js';
import { showToast } from 'UI/Components/Toast.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import DB from 'DB/DBManager.js';
import { getMapChannelDisplayName } from 'DB/Map/MapChannels.js';
import {
	getAdventureActionState,
	getCurrentAdventureMap,
	subscribeAdventureActions,
	teleportToCoordinate
} from './AdventureActionService.js';
import {
	filterMonsters,
	getMonsterSpawnMapNames,
	listMonsterSpawnMaps,
	paginateMonsters
} from './MonsterCatalogData.js';
import escapeHtml from './escapeHtml.js';
import { renderCatalogScopeFilter } from './CatalogData.js';
import { mountGameSelects, renderGameSelect } from './GameSelect.js';

const pageSize = 40;
const raceNames = {
	Formless: '无形',
	Undead: '不死',
	Brute: '动物',
	Plant: '植物',
	Insect: '昆虫',
	Fish: '鱼贝',
	Demon: '恶魔',
	Demihuman: '人形',
	Angel: '天使',
	Dragon: '龙',
	Player_Human: '人类玩家',
	Player_Doram: '喵族玩家'
};
const elementNames = {
	Neutral: '无',
	Water: '水',
	Earth: '地',
	Fire: '火',
	Wind: '风',
	Poison: '毒',
	Holy: '圣',
	Dark: '暗',
	Ghost: '念',
	Undead: '不死'
};
const sizeNames = { Small: '小型', Medium: '中型', Large: '大型' };
const resultMessages = [
	'召唤成功',
	'当前账号没有召唤权限',
	'召唤冷却中，请稍后再试',
	'魔物资料无效',
	'当前不允许召唤 Mini / MVP',
	'当前地图禁止召唤',
	'角色附近没有可用位置'
];

let activeController;

function atlasStyle(catalog, monster, displaySize) {
	if (monster.atlas === null) return '';
	const { tileSize, columns, rows } = catalog.atlas;
	const scale = displaySize / tileSize;
	const column = monster.tile % columns;
	const row = Math.floor(monster.tile / columns);
	return [
		`background-image:url('./data/monsters/atlas-${monster.atlas}.webp')`,
		`background-size:${columns * tileSize * scale}px ${rows * tileSize * scale}px`,
		`background-position:${-column * displaySize}px ${-row * displaySize}px`
	].join(';');
}

function formatRate(rate) {
	return `${(Number(rate || 0) / 100).toFixed(2).replace(/\.00$/, '')}%`;
}

function mount(container, context = {}) {
	container.classList.add('monster-tab');
	let destroyed = false;
	let requestedMonsterId = context.initialMonsterId;
	let showReturnToItem = Boolean(requestedMonsterId);
	const state = {
		catalog: null,
		drops: null,
		dropsLoading: false,
		dropsError: false,
		monsters: [],
		filtered: [],
		selected: null,
		page: 1,
		pending: false,
		status: '',
		statusError: false,
		requestedMonsterName: '',
		cooldownUntil: 0,
		cooldownTimer: null,
		requestTimer: null,
		selectedSpawn: null,
		locationScrollTop: 0,
		navigationMaps: []
	};
	const controller = {
		onSpawnResult(result) {
			clearTimeout(state.requestTimer);
			state.pending = false;
			state.status = resultMessages[result] || '召唤失败';
			state.statusError = result !== 0;
			if (result === 0) {
				showToast(container, `已召唤 ${state.requestedMonsterName}`);
				state.status = '';
			} else {
				showToast(container, state.status, 'error');
			}
			if (result === 0 && Session.GameToolsMonsterSpawnCooldown > 0) {
				state.cooldownUntil = Date.now() + Session.GameToolsMonsterSpawnCooldown * 1000;
				clearInterval(state.cooldownTimer);
				state.cooldownTimer = setInterval(() => {
					if (Date.now() >= state.cooldownUntil) clearInterval(state.cooldownTimer);
					renderDetail();
				}, 1000);
			}
			renderDetail();
		},
		onConfigUpdate() {
			renderDetail();
		}
	};
	activeController = controller;

	container.innerHTML = `
		<div class="monster-toolbar">
			<input class="monster-search" type="search" placeholder="搜索名称、英文名或 ID" aria-label="搜索魔物">
			${renderGameSelect({
				className: 'monster-filter',
				ariaLabel: '魔物类型',
				value: 'all',
				options: [
					{ value: 'all', label: '全部' },
					{ value: 'normal', label: '普通' },
					{ value: 'mini', label: 'Mini' },
					{ value: 'mvp', label: 'MVP' }
				]
			})}
			${renderCatalogScopeFilter({ name: 'monster-scope', ariaLabel: '当前地图', value: preferences.monsterCurrentMap ? 'current' : 'all' })}
		</div>
		<div class="monster-layout" data-menu-layout="split">
			<section class="monster-browser">
				<div class="monster-summary">正在加载魔物资料...</div>
				<div class="monster-list"></div>
				<div class="monster-pagination">
					<button class="page-prev" type="button" aria-label="上一页"><span aria-hidden="true">‹</span></button>
					<span class="page-label"></span>
					<button class="page-next" type="button" aria-label="下一页"><span aria-hidden="true">›</span></button>
				</div>
			</section>
			<section class="monster-detail"><div class="empty-detail">选择一个魔物查看详情</div>${renderActionPanel()}</section>
		</div>`;

	const search = container.querySelector('.monster-search');
	const filter = container.querySelector('.monster-filter.game-select-value');
	const scopeFilter = container.querySelector('.catalog-scope-filter');
	const list = container.querySelector('.monster-list');
	const summary = container.querySelector('.monster-summary');
	const pageLabel = container.querySelector('.page-label');
	mountGameSelects(container);

	function openRequestedMonster() {
		if (!requestedMonsterId || !state.catalog) return;
		const id = requestedMonsterId;
		requestedMonsterId = null;
		showReturnToItem = true;
		search.value = String(id);
		if (scopeFilter) scopeFilter.checked = false;
		container.querySelector('[data-game-select] [data-value="all"]').click();
		applyFilter();
		selectMonster(state.monsters.find(monster => monster.id === id) || null);
	}
	const openMonster = event => { requestedMonsterId = event.detail; openRequestedMonster(); };
	container.addEventListener('game-tools-open-monster', openMonster);
	function getScope() {
		return scopeFilter?.checked ? 'current' : 'all';
	}

	function applyFilter() {
		resetTabScroll(container, list);
		state.filtered = filterMonsters(state.monsters, search.value, filter.value, {
			scope: getScope(),
			currentMap: getCurrentAdventureMap(),
			channelsEnabled: Session.NavigationMapChannelsEnabled
		});
		state.page = 1;
		if (state.selected && !state.filtered.some(monster => monster.id === state.selected.id)) state.selected = null;
		if (!state.selected) {
			state.selected = state.filtered[0] || null;
			state.selectedSpawn =
				listMonsterSpawnMaps(state.selected?.spawns, {
					channelsEnabled: Session.NavigationMapChannelsEnabled,
					currentMap: getCurrentAdventureMap()
				})[0] || null;
			state.status = '';
		}
		renderList();
		renderDetail();
	}

	function renderList() {
		if (!state.catalog) return;
		const page = paginateMonsters(state.filtered, state.page, pageSize);
		state.page = page.page;
		summary.textContent = '';
		pageLabel.textContent = `${page.page} / ${page.pageCount}`;
		container.querySelector('.page-prev').disabled = page.page <= 1;
		container.querySelector('.page-next').disabled = page.page >= page.pageCount;
		list.innerHTML = page.items
			.map(
				monster => `
			<button class="monster-row${state.selected?.id === monster.id ? ' selected' : ''}" type="button" data-id="${monster.id}">
				<span class="monster-thumb${monster.atlas === null ? ' no-image' : ''}" style="${atlasStyle(state.catalog, monster, context.mobile ? 40 : 48)}"></span>
				<span class="monster-row-text"><strong>${escapeHtml(monster.name)}</strong><small>Lv.${monster.level} · ${monster.id}${monster.kind === 'mvp' ? ' · MVP' : monster.kind === 'mini' ? ' · Mini' : ''}</small></span>
			</button>`
			)
			.join('');
		if (!page.items.length) {
			renderCatalogEmptyState(
				list,
				search.value.trim() || filter.value !== 'all'
					? '没有匹配结果'
					: scopeFilter.checked
						? '当前地图暂无魔物'
						: '暂无魔物资料',
				scopeFilter.checked
					? () => {
							scopeFilter.checked = false;
							changeScope();
						}
					: null
			);
		}
		list.querySelectorAll('.monster-row').forEach(button => {
			button.addEventListener('click', () => {
				selectMonster(state.monsters.find(monster => monster.id === Number(button.dataset.id)));
			});
		});
	}

	function selectMonster(monster) {
		state.selected = monster;
		state.selectedSpawn =
			listMonsterSpawnMaps(monster?.spawns, {
				channelsEnabled: Session.NavigationMapChannelsEnabled,
				currentMap: getCurrentAdventureMap()
			})[0] || null;
		state.status = '';
		state.statusError = false;
		renderList();
		renderDetail();
	}

	function changePage(delta) {
		const page = paginateMonsters(state.filtered, state.page + delta, pageSize);
		state.page = page.page;
		resetTabScroll(container, list);
		selectMonster(page.items[0] || null);
	}

	function renderDrops(drops, title) {
		if (!drops?.length) return '';
		return `<div class="drop-group"><h4>${title}</h4>${drops.map(drop => `<div><span title="${escapeHtml(drop.nameEn || drop.Item)}">${escapeHtml(drop.name || drop.Item)}</span><em>${formatRate(drop.Rate)}</em></div>`).join('')}</div>`;
	}

	function renderActionPanel(summonDisabled = true, teleportEnabled = false, status = '') {
		return `<div class="summon-panel">
			${showReturnToItem ? '<button class="monster-return-item" type="button">返回物品</button>' : ''}
			<button class="summon-button" type="button" ${summonDisabled ? 'disabled' : ''}>${state.pending ? '召唤中...' : '召唤'}</button>
			<button class="monster-map-teleport" type="button" ${teleportEnabled ? '' : 'disabled'}>传送到地图</button>
			<span class="summon-status error" role="status" aria-live="polite">${escapeHtml(status)}</span>
		</div>`;
	}

	let detailMonsterId;
	function renderDetail() {
		const detail = container.querySelector('.monster-detail');
		if (detailMonsterId !== state.selected?.id) {
			detailMonsterId = state.selected?.id;
			resetTabScroll(container, detail);
			state.locationScrollTop = 0;
		}
		const previousLocations = detail.querySelector('.monster-locations');
		if (previousLocations) state.locationScrollTop = previousLocations.scrollTop;
		const monster = state.selected;
		if (!state.catalog || !monster) {
			detail.innerHTML = `<div class="empty-detail">选择一个魔物查看详情</div>${renderActionPanel()}`;
			return;
		}
		if (!state.drops && !state.dropsLoading && !state.dropsError) {
			state.dropsLoading = true;
			loadMonsterDrops()
				.then(payload => {
					if (destroyed) return;
					state.drops = payload.drops;
					state.dropsLoading = false;
					renderDetail();
				})
				.catch(() => {
					if (destroyed) return;
					state.dropsLoading = false;
					state.dropsError = true;
					renderDetail();
				});
		}
		const bossBlocked = monster.kind !== 'normal' && !Session.GameToolsMonsterSpawnAllowBoss;
		const cooldownRemaining = Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000));
		const disabled = !Session.GameToolsMonsterSpawnAllowed || bossBlocked || state.pending || cooldownRemaining > 0;
		const spawnMaps = listMonsterSpawnMaps(monster.spawns, {
			channelsEnabled: Session.NavigationMapChannelsEnabled,
			currentMap: getCurrentAdventureMap()
		});
		const spawnMapNames = getMonsterSpawnMapNames(spawnMaps, state.navigationMaps);
		if (state.selectedSpawn && !spawnMaps.some(spawn => spawn.mapName === state.selectedSpawn.mapName)) {
			state.selectedSpawn = spawnMaps[0] || null;
		}
		const teleportTarget = state.selectedSpawn
			? { mapName: state.selectedSpawn.mapName, x: state.selectedSpawn.x, y: state.selectedSpawn.y }
			: null;
		const teleportState = getAdventureActionState(teleportTarget);
		const summonConstraintText = !Session.GameToolsMonsterSpawnAllowed
			? '当前账号仅可查看图鉴'
			: bossBlocked
				? '后台未开放 Mini / MVP 召唤'
				: '';
		detail.innerHTML = `
			${context.mobile ? '<div class="monster-information">' : ''}
			<div class="monster-overview"><div class="monster-heading">
				<span class="monster-portrait${monster.atlas === null ? ' no-image' : ''}" style="${atlasStyle(state.catalog, monster, 96)}"></span>
				${context.mobile ? '' : `<div><h3>${escapeHtml(monster.name)}</h3><p>${escapeHtml(monster.nameEn)} · ${monster.id}</p><span class="monster-badge">${monster.kind === 'mvp' ? 'MVP' : monster.kind === 'mini' ? 'Mini' : '普通'}</span></div>`}
			</div>
			<div class="monster-stats">
                ${context.mobile ? `<div><span>名称</span><strong>${escapeHtml(monster.name)}</strong></div><div><span>英文名</span><strong>${escapeHtml(monster.nameEn)}</strong></div><div><span>编号</span><strong>${monster.id}</strong></div><div><span>类型</span><strong>${monster.kind === 'mvp' ? 'MVP' : monster.kind === 'mini' ? 'Mini' : '普通'}</strong></div>` : ''}
				<div><span>等级</span><strong>${monster.level}</strong></div><div><span>HP</span><strong>${monster.hp}</strong></div>
				<div><span>攻击</span><strong>${monster.attack.filter(Number.isFinite).join(' - ')}</strong></div><div><span>防御</span><strong>${monster.defense} / ${monster.magicDefense}</strong></div>
				<div><span>种族</span><strong>${raceNames[monster.race] || monster.race}</strong></div><div><span>属性</span><strong>${elementNames[monster.element] || monster.element} ${monster.elementLevel}</strong></div>
				<div><span>体型</span><strong>${sizeNames[monster.size] || monster.size}</strong></div><div><span>经验</span><strong>${monster.baseExp} / ${monster.jobExp}</strong></div>
			</div>
			</div><div class="monster-resources">
				<section class="monster-drops"><h4>掉落物品</h4>${
					state.drops
						? `${renderDrops(state.drops[monster.id]?.mvpDrops, 'MVP 奖励')}${renderDrops(state.drops[monster.id]?.drops, '普通掉落') || '<p>无掉落资料</p>'}`
						: state.dropsError
							? '<p>掉落资料加载失败</p><button type="button" class="monster-drops-retry">重试</button>'
							: '<p>掉落资料加载中...</p>'
				}</section>
				<section class="monster-locations">
					<h4>出现地图</h4>
					<div class="monster-location-list">${
						spawnMaps.length
							? spawnMaps
									.map(spawn => {
										const displayName = getMapChannelDisplayName(
											spawn.mapName,
											spawnMapNames.get(spawn.mapName),
											Session.NavigationMapChannelsEnabled
										);
										return `<button type="button" data-spawn-map="${escapeHtml(spawn.mapName)}" class="monster-location${state.selectedSpawn?.mapName === spawn.mapName ? ' selected' : ''}"><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(spawn.mapName)}</small></button>`;
									})
									.join('')
							: `<p class="monster-locations-empty">${context.mobile ? '<span class="monster-empty-full">暂无常驻刷新地图</span><span class="monster-empty-compact">无</span>' : '暂无常驻刷新地图'}</p>`
					}</div>
				</section>
			</div>
			${context.mobile ? '</div>' : ''}
			${renderActionPanel(disabled, Boolean(teleportTarget && teleportState.canTeleport), summonConstraintText || (!teleportState.allowed ? '当前账号没有传送权限' : ''))}`;
		const summonButton = detail.querySelector('.summon-button');
		const locations = detail.querySelector('.monster-locations');
		locations.scrollTop = state.locationScrollTop;
		locations.addEventListener('scroll', () => {
			state.locationScrollTop = locations.scrollTop;
		});
		detail.querySelectorAll('[data-spawn-map]').forEach(button => {
			button.addEventListener('click', () => {
				state.selectedSpawn = spawnMaps.find(spawn => spawn.mapName === button.dataset.spawnMap) || null;
				renderDetail();
			});
		});
		detail.querySelector('.monster-map-teleport').addEventListener('click', () => {
			if (!teleportTarget) return;
			teleportToCoordinate(teleportTarget);
		});
		summonButton.addEventListener('click', () => {
			state.pending = true;
			state.requestedMonsterName = monster.name;
			state.statusError = false;
			state.status = '';
			clearTimeout(state.requestTimer);
			state.requestTimer = setTimeout(() => {
				state.pending = false;
				state.statusError = true;
				state.status = '服务器响应超时，请稍后重试';
				showToast(container, state.status, 'error');
				renderDetail();
			}, 8000);
			const packet = new PACKET.CZ.HAPPYRO_MONSTER_SPAWN();
			packet.monsterId = monster.id;
			Network.sendPacket(packet);
			renderDetail();
		});
	}

	search.addEventListener('input', applyFilter);
	filter.addEventListener('change', applyFilter);
	scopeFilter?.addEventListener('change', changeScope);

	function changeScope() {
		preferences.monsterCurrentMap = scopeFilter.checked;
		preferences.save();
		applyFilter();
	}
	container.querySelector('.page-prev').addEventListener('click', () => changePage(-1));
	container.querySelector('.page-next').addEventListener('click', () => changePage(1));

	Promise.all([loadMonsterCatalog(), DB.listNavigation('MAP', { channelsEnabled: Session.NavigationMapChannelsEnabled })])
		.then(([catalog, navigationMaps]) => {
			state.catalog = catalog;
			state.navigationMaps = navigationMaps;
			state.monsters = catalog.monsters;
			applyFilter();
			openRequestedMonster();
		})
		.catch(error => {
			console.error(error);
			summary.textContent = '魔物资料加载失败';
		});
	container.addEventListener('click', event => {
		if (event.target.closest('.monster-return-item')) {
			showReturnToItem = false;
			context.returnToItem?.();
			return;
		}
		if (!event.target.closest('.monster-drops-retry')) return;
		state.dropsError = false;
		renderDetail();
	});
	const unsubscribeAdventureActions = subscribeAdventureActions(() => renderDetail());
	let catalogMap = getCurrentAdventureMap();
	const mapTimer = setInterval(() => {
		const currentMap = getCurrentAdventureMap();
		if (!state.catalog || !currentMap || currentMap === catalogMap) return;
		catalogMap = currentMap;
		applyFilter();
	}, 500);
	const clearFeedback = () => {
		state.status = '';
		state.statusError = false;
		if (state.catalog) renderDetail();
	};
	container.addEventListener('game-tools-reset-feedback', clearFeedback);

	return () => {
		destroyed = true;
		container.removeEventListener('game-tools-open-monster', openMonster);
		clearInterval(mapTimer);
		container.removeEventListener('game-tools-reset-feedback', clearFeedback);
		clearTimeout(state.requestTimer);
		clearInterval(state.cooldownTimer);
		unsubscribeAdventureActions();
		if (activeController === controller) activeController = null;
	};
}

export function notifyMonsterSpawnResult(result) {
	activeController?.onSpawnResult(result);
}

export function notifyMonsterSpawnConfig() {
	activeController?.onConfigUpdate();
}

export default { id: 'monsters', label: '魔物图鉴', mount };
