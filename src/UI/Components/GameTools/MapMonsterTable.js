import { loadMonsterCatalog } from './MonsterCatalogAssets.js';
import { escapeCatalogHtml } from './CatalogData.js';
import { elementNames } from './MonsterLabels.js';

export function mapMonsterRows(monsters, mapName) {
	return monsters
		.flatMap(monster => {
			const count = monster.spawns
				.filter(spawn => spawn.mapName === mapName)
				.reduce((sum, spawn) => sum + spawn.count, 0);
			return count ? [{ ...monster, count }] : [];
		})
		.sort((a, b) => a.level - b.level || a.id - b.id);
}

export function createMapMonsterTable(context) {
	let active = true;
	let catalog = null;
	const number = value => value == null || !Number.isFinite(Number(value)) ? '-' : Number(value).toLocaleString('zh-CN');
	const experience = monster => {
		const base = number(monster.baseExp), job = number(monster.jobExp);
		return base === '-' && job === '-' ? '-' : `${base} / ${job}`;
	};
	function render(region, mapName) {
		if (!catalog) {
			region.innerHTML = '<h5>地图魔物</h5><p role="status">加载中…</p>';
			loadMonsterCatalog()
				.then(data => {
					if (!active) return;
					catalog = data;
					if (region.isConnected) render(region, mapName);
				})
				.catch(() => {
					if (!active || !region.isConnected) return;
					region.innerHTML =
						'<h5>地图魔物</h5><p role="status">魔物信息加载失败</p><button type="button">重试</button>';
					region.querySelector('button').onclick = () => render(region, mapName);
				});
			return;
		}
		region.classList.add('item-source-list', 'item-source-group');
		const rows = mapMonsterRows(catalog.monsters, mapName);
		region.innerHTML = `<h5>地图魔物（${rows.length}）</h5>${rows.length ? `<div class="item-source-scroll map-monster-scroll" role="region" aria-label="地图魔物表格" tabindex="0"><table class="item-source-table map-monster-table"><thead><tr>${['名称', '等级', 'HP', '属性', '经验'].map(text => `<th scope="col">${text}</th>`).join('')}</tr></thead><tbody>${rows.map(monster => `<tr><td><button type="button" class="item-source-monster" data-monster-id="${monster.id}">${escapeCatalogHtml(monster.name)}</button></td><td>${number(monster.level)}</td><td>${number(monster.hp)}</td><td>${escapeCatalogHtml(elementNames[monster.element] || monster.element)} ${number(monster.elementLevel)}</td><td>${experience(monster)}</td></tr>`).join('')}</tbody></table></div>` : '<p role="status">该地图暂无魔物刷新信息</p>'}`;
		for (const button of region.querySelectorAll('[data-monster-id]')) {
			button.onclick = () => context.openMonster(Number(button.dataset.monsterId));
		}
	}
	return {
		render,
		destroy() {
			active = false;
			catalog = null;
		}
	};
}
