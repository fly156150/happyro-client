import { expect, it, vi } from 'vitest';
const load = vi.hoisted(() => vi.fn());
vi.mock('UI/Components/GameTools/MonsterCatalogAssets.js', () => ({ loadMonsterCatalog: load }));
import { loadAutoCombatMapSpecies } from '../../src/UI/Game/AutoCombatMapSpecies.js';

it('lists every species configured on the exact map without consulting nearby entities', async () => {
 load.mockResolvedValue({ monsters: [
  { id: 1002, name: '波利', spawns: [{ mapName: 'prt_fild08' }, { mapName: 'prt_fild08' }] },
  { id: 1007, name: '绿棉虫', spawns: [{ mapName: 'prt_fild08' }] },
  { id: 1003, name: '土波利', spawns: [{ mapName: 'prt_fild08a' }] }
 ] });
 expect(await loadAutoCombatMapSpecies('PRT_FILD08.gat')).toEqual([{ id: 1002, name: '波利' }, { id: 1007, name: '绿棉虫' }]);
 expect(await loadAutoCombatMapSpecies('prt_fild08a')).toEqual([{ id: 1003, name: '土波利' }]);
 expect(await loadAutoCombatMapSpecies('prontera')).toEqual([]);
});
it('propagates catalog failures so the UI can offer a retry', async () => {
 load.mockRejectedValueOnce(new Error('offline'));
 await expect(loadAutoCombatMapSpecies('prt_fild08')).rejects.toThrow('offline');
});
