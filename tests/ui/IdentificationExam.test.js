import { beforeEach, expect, it, vi } from 'vitest';
import { createExamTargets, isIdentificationExam } from '../../src/UI/Game/IdentificationExam.js';
let targets, entities, selected, enabled, select, attack, stop;
function mob(id, name) {
 return { GID: id, constructor: { TYPE_MOB: 5 }, objecttype: 5, serverMonsterName: name,
  job: 1002, position: [10, 10], remove_tick: 0, action: 0, ACTION: { DIE: 9 } };
}
beforeEach(() => {
 entities = new Map([ [1, mob(1, '转职目标')], [2, mob(2, '转职目标们')], [3, mob(3, '转职目标')] ]);
 enabled = true; selected = null; attack = vi.fn(); stop = vi.fn(); select = vi.fn(entity => { selected = entity; });
 targets = createExamTargets({ enabled: () => enabled, get: id => entities.get(id), focus: () => selected, select, stop, attack });
});
it.each(['in_moc_16', 'job_hunte.gat', 'JOB3_RANG02.GAT'])('recognizes identification exam %s', map => {
 expect(isIdentificationExam(map)).toBe(true);
});
it.each(['prontera', 'job3_rang01', '', undefined])('does not change ordinary map %s', map => {
 expect(isIdentificationExam(map)).toBe(false);
});
it('selects without attacking and preserves all overlapping instances, even identical names and positions', () => {
 targets.pick([...entities.values()]);
 expect(attack).not.toHaveBeenCalled(); expect(stop).toHaveBeenCalledOnce();
 expect(targets.snapshot().candidates.map(entry => entry.name)).toEqual(['转职目标', '转职目标们', '转职目标']);
 targets.choose(2); expect(selected).toBe(entities.get(2)); expect(attack).not.toHaveBeenCalled();
 expect(targets.attack()).toBe(true); expect(attack).toHaveBeenCalledOnce();
});
it.each(['dead', 'removed', 'reused', 'gone'])('rejects a %s target without choosing another monster', reason => {
 targets.pick([...entities.values()]);
 if (reason === 'dead') selected.action = 9;
 if (reason === 'removed') selected.remove_tick = 1;
 if (reason === 'reused') entities.set(1, mob(1, '另一只'));
 if (reason === 'gone') entities.delete(1);
 expect(targets.attack()).toBe(false); expect(targets.choose(1)).toBe(false);
 expect(targets.snapshot().canAttack).toBe(false); expect(attack).not.toHaveBeenCalled();
});
it('waits for the server name instead of allowing an attack based on a species fallback', () => {
 const target = entities.get(1); target.serverMonsterName = ''; targets.pick([target]);
 expect(targets.snapshot().name).toBe('正在获取名称…'); expect(targets.attack()).toBe(false);
 target.serverMonsterName = '波利'; expect(targets.snapshot().name).toBe('波利'); expect(targets.attack()).toBe(true);
});
it('clears candidates on death or map leave and requires a fresh selection on return', () => {
 targets.pick([...entities.values()]); enabled = false;
 expect(targets.attack()).toBe(false); expect(targets.snapshot().candidates).toEqual([]);
 enabled = true; expect(targets.attack()).toBe(false);
});
it('does not attack an unrelated focus or a previously cleared selection', () => {
 targets.pick([entities.get(1)]); selected = entities.get(2); expect(targets.attack()).toBe(false);
 targets.pick([entities.get(1)]); targets.clear(); expect(targets.attack()).toBe(false);
});
