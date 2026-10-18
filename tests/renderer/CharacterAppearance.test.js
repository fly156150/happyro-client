import { describe, expect, it } from 'vitest';
import Job from '../../src/DB/Jobs/JobConst.js';
import MountTable from '../../src/DB/Jobs/MountTable.js';
import { characterAppearanceJob, characterAppearanceBaseJob } from '../../src/Renderer/Entity/CharacterAppearance.js';
function actor(job, choice, extra = {}) { return { _job: job, costume: MountTable[job], _characterAppearance: choice, ...extra }; }
describe('same-branch mount appearance', () => {
 it('keeps the real fourth job while resolving old mount and attack resources', () => {
  const knight = actor(Job.DRAGON_KNIGHT, 2);
  expect(characterAppearanceJob(knight)).toBe(Job.KNIGHT2_H);
  expect(characterAppearanceBaseJob(knight)).toBe(Job.KNIGHT_H);
  expect(knight._job).toBe(Job.DRAGON_KNIGHT);
  expect(characterAppearanceJob(actor(Job.IMPERIAL_GUARD, 6))).toBe(Job.ROYAL_GUARD2);
 });
 it('rejects other branches, higher stages, babies and unrelated jobs', () => {
  for (const [job, choice] of [[Job.DRAGON_KNIGHT, 4], [Job.IMPERIAL_GUARD, 1], [Job.KNIGHT, 2], [Job.KNIGHT_H, 3], [Job.RUNE_KNIGHT_B, 1], [Job.MEISTER, 1]])
   expect(characterAppearanceJob(actor(job, choice))).toBe(0);
  expect(characterAppearanceJob(actor(Job.KNIGHT_H, 1))).toBe(Job.KNIGHT2);
  expect(characterAppearanceJob(actor(Job.CRUSADER_H, 4))).toBe(Job.CRUSADER2);
 });
 it('suspends the selected appearance while transformed', () => {
  for (const extra of [{ costume: 22 }, { _allRidingState: true }, { _monster_transform: 1002 }, { _job_transform: 7 }, { _body: 1 }])
   expect(characterAppearanceJob(actor(Job.DRAGON_KNIGHT, 1, extra))).toBe(0);
  const knight = actor(Job.DRAGON_KNIGHT, 1, { costume: 0 });
  expect(characterAppearanceJob(knight)).toBe(Job.KNIGHT);
  expect(characterAppearanceBaseJob(knight)).toBe(Job.KNIGHT);
  knight.costume = MountTable[knight._job];
  expect(characterAppearanceJob(knight)).toBe(Job.KNIGHT2);
  expect(characterAppearanceJob(actor(Job.DRAGON_KNIGHT, 0))).toBe(0);
 });
});

it('keeps all six selected jobs on foot and restores the default explicitly', () => {
 for (const [real, choices] of [[Job.DRAGON_KNIGHT, [Job.KNIGHT, Job.KNIGHT_H, Job.RUNE_KNIGHT]], [Job.IMPERIAL_GUARD, [Job.CRUSADER, Job.CRUSADER_H, Job.ROYAL_GUARD]]]) {
  choices.forEach((job, index) => {
   const e = actor(real, index + (real === Job.DRAGON_KNIGHT ? 1 : 4), { costume: 0 });
   expect(characterAppearanceJob(e)).toBe(job);
   expect(characterAppearanceBaseJob(e)).toBe(job);
   e._characterAppearance = 0;
   expect(characterAppearanceJob(e)).toBe(0);
   expect(characterAppearanceBaseJob(e)).toBe(real);
  });
 }
});
