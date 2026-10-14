import { loadAdventureItem } from './AdventureControlService.js';
import { escapeCatalogHtml } from './CatalogData.js';

import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import { loadMonsterCatalog } from './MonsterCatalogAssets.js';
import { listMonsterSpawnMaps, getMonsterSpawnMapNames } from './MonsterCatalogData.js';

function formatRate(rate) {
	return `${(rate / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

async function loadSources(itemId) {
	const item = await loadAdventureItem(itemId);
	if (!item.dropSources.length) return [];
	const [catalog, navigationMaps] = await Promise.all([
		loadMonsterCatalog(),
		DB.listNavigation('MAP', { channelsEnabled: Session.NavigationMapChannelsEnabled })
	]);
	const monsters = new Map(catalog.monsters.map(monster => [monster.id, monster]));
	return item.dropSources.map(source => {
		const spawns = listMonsterSpawnMaps(monsters.get(source.id)?.spawns, {
			channelsEnabled: Session.NavigationMapChannelsEnabled
		});
		const names = getMonsterSpawnMapNames(spawns, navigationMaps);
		return { ...source, maps: [...new Set(spawns.map(spawn => names.get(spawn.mapName)))] };
	});
}

function renderGroup(sources, method, expanded) {
	const rows = sources
		.filter(source => source.drops.some(drop => drop.method === method))
		.map(source => {
			const rates = source.drops.filter(drop => drop.method === method).sort((a, b) => b.rate - a.rate);
			return { ...source, rates, rate: rates[0].rate };
		})
		.sort(
			(a, b) =>
				b.rate - a.rate ||
				Number(Boolean(b.maps.length)) - Number(Boolean(a.maps.length)) ||
				a.level - b.level ||
				a.id - b.id
		);
	if (!rows.length) return '';
	const shown = expanded ? rows : rows.slice(0, 8);
	return `<section class="item-source-group" data-method="${method}"><h5>${method === 'normal' ? '普通掉落' : 'MVP 奖励'}</h5><div class="item-source-scroll" role="region" aria-label="${method === 'normal' ? '普通掉落' : 'MVP 奖励'}表格" tabindex="0"><table class="item-source-table"><colgroup><col class="source-name"><col class="source-id"><col class="source-level"><col class="source-rate"><col class="source-map"></colgroup><thead><tr><th scope="col">名称</th><th scope="col">ID</th><th scope="col">等级</th><th scope="col">掉率</th><th scope="col">地图</th></tr></thead><tbody>${shown.map(source => `<tr><td><button type="button" class="item-source-monster" data-monster-id="${source.id}">${escapeCatalogHtml(source.name)}</button></td><td>${source.id}</td><td>${source.level}</td><td>${source.rates.map(drop => `<span class="item-source-rate">${formatRate(drop.rate)}${drop.count > 1 ? ` × ${drop.count}` : ''}</span>`).join('')}</td><td title="${escapeCatalogHtml(source.maps.join('、'))}">${source.maps.length ? `${escapeCatalogHtml(source.maps[0])}${source.maps.length > 1 ? ` +${source.maps.length - 1}` : ''}` : '未收录'}</td></tr>`).join('')}</tbody>${rows.length > 8 ? `<tfoot><tr><td colspan="5" class="item-sources-footer"><button type="button" class="item-sources-more" data-method="${method}" aria-expanded="${Boolean(expanded)}">${expanded ? '收起' : `展开更多（${rows.length}）`}</button></td></tr></tfoot>` : ''}</table></div></section>`;
}

/** A tab-local cache avoids reloading a selected item's sources during action feedback. */
export function createItemDropSources(context) {
	const cache = new Map();
	let active = true;
	function render(region, itemId) {
		const entry = cache.get(itemId);
		if (!entry) {
			region.innerHTML = '<p role="status">加载中…</p>';
			const request = loadSources(itemId).then(
				sources => ({ sources }),
				() => ({ error: true })
			);
			cache.set(itemId, { request });
			void request.then(result => {
				if (!active) return;
				cache.set(itemId, result);
				if (region.isConnected) render(region, itemId);
			});
			return;
		}
		if (entry.request) {
			region.innerHTML = '<p role="status">加载中…</p>';
			void entry.request.then(() => {
				if (active && region.isConnected) render(region, itemId);
			});
			return;
		}
		if (entry.error) {
			region.innerHTML =
				'<p role="status">加载失败</p><button type="button" class="item-sources-retry">重试</button>';
			region.querySelector('button').onclick = () => {
				cache.delete(itemId);
				render(region, itemId);
			};
			return;
		}
		const { sources } = entry;
		if (!sources.length) {
			region.innerHTML =
				'<p class="item-sources-empty" role="status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 9l8-4 8 4v10H4zM4 9l8 4 8-4M12 13v6"/></svg><span>无掉落信息</span></p>';
			return;
		}
		const paint = () => {
			entry.expanded ??= {};
			region.innerHTML =
				['normal', 'mvp_reward'].map(method => renderGroup(sources, method, entry.expanded[method])).join('');
			region.querySelectorAll('[data-monster-id]').forEach(button => {
				button.onclick = () => context.openMonster?.(Number(button.dataset.monsterId));
			});
			region.querySelectorAll('.item-sources-more').forEach(button => {
				button.onclick = () => {
					const method = button.dataset.method;
					entry.expanded[method] = !entry.expanded[method];
					paint();
					region.querySelector(`.item-sources-more[data-method="${method}"]`)?.focus({ preventScroll: true });
				};
			});
		};
		paint();
	}
	return {
		render,
		destroy() {
			active = false;
			cache.clear();
		}
	};
}
