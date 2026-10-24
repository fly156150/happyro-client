import { loadMonsterCatalog } from 'UI/Components/GameTools/MonsterCatalogAssets.js';

/** Catalog element is a client targeting hint; the server decides the actual effect. */
export function createHealMonsterTargets() {
 let monsters, pending, error = '';
 function load() {
  if (pending || monsters) return;
  pending = loadMonsterCatalog().then(catalog => {
   monsters = new Map(catalog.monsters.map(monster => [monster.id, monster.element]));
   error = '';
  }).catch(() => { error = '魔物属性读取失败，请再次点击目标重试'; }).finally(() => { pending = null; });
 }
 load();
 return target => {
  if (target.action === target.ACTION.DIE || target.remove_tick > 0) return '目标已失效';
  if (!monsters) { load(); return error || '正在读取魔物属性，请稍后再点目标'; }
  const element = monsters.get(target.job);
  if (!element) return '无法确认该魔物的属性';
  return element === 'Undead' || '治愈术只能攻击不死属性魔物';
 };
}
