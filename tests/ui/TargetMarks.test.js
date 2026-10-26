import { describe, expect, it } from 'vitest';
import { createTargetStatuses } from '../../src/Network/TargetStatuses.js';
import { targetMarkReason } from '../../src/UI/Game/CombatSkillRules.js';
import Status from '../../src/DB/Status/StatusConst.js';
const second = ['IQ_SECOND_FAITH', 'IQ_SECOND_JUDGEMENT', 'IQ_SECOND_FLAME'];
const third = ['IQ_THIRD_PUNISH', 'IQ_THIRD_CONSECRATION', 'IQ_THIRD_FLAME_BOMB'];
function target() { return { statuses: createTargetStatuses() }; }
function update(entity, index, state, val) { entity.statuses.update({ index, state, val }); }
describe('authoritative target prerequisites', () => {
 it.each(['DK_SERVANT_W_PHANTOM', ...second, ...third])('%s treats missing packets as unknown', name => {
  for (const targets of [[], [{}], [target()]]) expect(targetMarkReason(name, 2000001, targets)).toBe('');
 });
 it('distinguishes own, foreign, absent and unknown-owner servant signs', () => {
  const entity = target();
  update(entity, Status.SERVANT_SIGN, 0);
  expect(targetMarkReason('DK_SERVANT_W_PHANTOM', 2000001, [entity])).toBe('需要本人标记的目标');
  update(entity, Status.SERVANT_SIGN, 1, [2000002]);
  expect(targetMarkReason('DK_SERVANT_W_PHANTOM', 2000001, [entity])).not.toBe('');
  update(entity, Status.SERVANT_SIGN, 1, [2000001]);
  expect(targetMarkReason('DK_SERVANT_W_PHANTOM', 2000001, [entity])).toBe('');
  update(entity, Status.SERVANT_SIGN, 1);
  expect(targetMarkReason('DK_SERVANT_W_PHANTOM', 2000001, [entity])).toBe('');
 });
 it.each(second)('%s accepts either brand, rejects only when both absent', name => {
  const entity = target();
  update(entity, Status.FIRST_BRAND, 0);
  expect(targetMarkReason(name, 1, [entity])).toBe('');
  update(entity, Status.SECOND_BRAND, 0);
  expect(targetMarkReason(name, 1, [entity])).toBe('需要带有烙印的目标');
  for (const mark of [Status.FIRST_BRAND, Status.SECOND_BRAND]) {
   update(entity, mark, 1); expect(targetMarkReason(name, 1, [entity])).toBe(''); update(entity, mark, 0);
  }
 });
 it.each(third)('%s requires second brand', name => {
  const entity = target();
  update(entity, Status.FIRST_BRAND, 1); update(entity, Status.SECOND_BRAND, 0);
  expect(targetMarkReason(name, 1, [entity])).toBe('需要第二击烙印目标');
  update(entity, Status.SECOND_BRAND, 1); expect(targetMarkReason(name, 1, [entity])).toBe('');
 });
 it('does not globally block legal or unknown targets because another lacks the mark', () => {
  const blocked = target(), valid = target();
  update(blocked, Status.SECOND_BRAND, 0); update(valid, Status.SECOND_BRAND, 1);
  expect(targetMarkReason(third[0], 1, [blocked, valid])).toBe('');
  expect(targetMarkReason(third[0], 1, [blocked, {}])).toBe('');
  expect(targetMarkReason(third[0], 1, [blocked])).not.toBe('');
 });
 it('expires received durations and isolates entity lifetimes', () => {
  let now = 0;
  const entity = { statuses: createTargetStatuses(() => now) };
  entity.statuses.update({ index: Status.SECOND_BRAND, state: 1, RemainMS: 500 });
  now = 499; expect(targetMarkReason(third[0], 1, [entity])).toBe('');
  now = 500; expect(targetMarkReason(third[0], 1, [entity])).not.toBe('');
  expect(targetMarkReason(third[0], 1, [target()])).toBe('');
 });
});
