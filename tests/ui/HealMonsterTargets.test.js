import { beforeEach, expect, it, vi } from 'vitest';
const load = vi.hoisted(() => vi.fn());
vi.mock('UI/Components/GameTools/MonsterCatalogAssets.js', () => ({ loadMonsterCatalog: load }));
import { createHealMonsterTargets } from '../../src/UI/Game/HealMonsterTargets.js';
const target = job => ({ job, action: 0, ACTION: { DIE: 99 }, remove_tick: 0 });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => load.mockReset());
it('uses element rather than race, rejects unknown and dead targets', async () => {
 load.mockResolvedValue({ monsters: [{ id: 1, element: 'Undead', race: 'Demon' }, { id: 2, element: 'Neutral', race: 'Undead' }] });
 const check = createHealMonsterTargets(); await flush();
 expect(check(target(1))).toBe(true);
 expect(check(target(2))).toContain('不死属性');
 expect(check(target(3))).toContain('无法确认');
 expect(check({ ...target(1), action: 99 })).toContain('已失效');
});
it('reports loading and allows a later explicit tap after a failed load', async () => {
 load.mockRejectedValueOnce(new Error('offline'));
 const check = createHealMonsterTargets();
 expect(check(target(1))).toContain('正在读取'); await flush();
 load.mockResolvedValue({ monsters: [{ id: 1, element: 'Undead' }] });
 expect(check(target(1))).toContain('读取失败'); await flush();
 expect(check(target(1))).toBe(true);
 expect(load).toHaveBeenCalledTimes(2);
});
