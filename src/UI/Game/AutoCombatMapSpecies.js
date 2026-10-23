import { loadMonsterCatalog } from 'UI/Components/GameTools/MonsterCatalogAssets.js';

/** Map spawn definitions are independent of entities currently visible to the player. */
export async function loadAutoCombatMapSpecies(mapName) {
	const map = String(mapName || '')
		.replace(/\.(?:gat|rsw)$/i, '')
		.toLowerCase();
	const catalog = await loadMonsterCatalog();
	return catalog.monsters
		.filter(monster => monster.spawns.some(spawn => spawn.mapName === map))
		.map(monster => ({ id: monster.id, name: monster.name }));
}
