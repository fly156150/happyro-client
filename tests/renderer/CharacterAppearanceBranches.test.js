import { describe, expect, it } from 'vitest';
import MountTable from '../../src/DB/Jobs/MountTable.js';
import { characterAppearanceJob, characterAppearanceBaseJob, isCharacterAppearance } from '../../src/Renderer/Entity/CharacterAppearance.js';

// Independent expectations from the audited job IDs, not the generated lookup table.
const branches = [
 ['knight', -1, [7, 4008, 4054, 4060, 4252], [1, 2, 3], [13, 4014, 4080]],
 ['crusader', -1, [14, 4015, 4066, 4073, 4258], [4, 5, 6], [21, 4022, 4082]],
 ['hunter', -1, [11, 4012, 4056, 4062, 4257], [7, 8, 9], [0, 0, 4084]],
 ['wizard', -1, [9, 4010, 4055, 4061, 4255], [10, 11, 12], [0, 0, 0]],
 ['priest', -1, [8, 4009, 4057, 4063, 4256], [13, 14, 15], [0, 0, 0]],
 ['assassin', -1, [12, 4013, 4059, 4065, 4254], [16, 17, 18], [0, 0, 0]],
 ['blacksmith', -1, [10, 4011, 4058, 4064, 4253], [19, 20, 21], [0, 0, 4086]],
 ['sage', -1, [16, 4017, 4067, 4074, 4261], [22, 23, 24], [0, 0, 0]],
 ['alchemist', -1, [18, 4019, 4071, 4078, 4259], [25, 26, 27], [0, 0, 0]],
 ['monk', -1, [15, 4016, 4070, 4077, 4262], [28, 29, 30], [0, 0, 0]],
 ['rogue', -1, [17, 4018, 4072, 4079, 4260], [31, 32, 33], [0, 0, 0]],
 ['bard', 1, [19, 4020, 4068, 4075, 4263], [34, 35, 36], [0, 0, 0]],
 ['dancer', 0, [20, 4021, 4069, 4076, 4264], [37, 38, 39], [0, 0, 0]],
];
const actor = (job, choice, sex) => ({ _job: job, _body: job, _sex: sex, _characterAppearance: choice, costume: 0 });

describe.each(branches)('%s branch', (name, sex, jobs, choices, mounts) => {
 it('allows only earlier same-branch stages for each applicable sex', () => {
  for (const gender of [0, 1]) for (const [index, job] of jobs.entries()) {
   const stage = [1, 2, 3, 3, 4][index];
   for (let choice = 1; choice <= 39; choice++) {
    const option = choices.indexOf(choice);
    const allowed = option >= 0 && option + 1 < stage && (sex === -1 || sex === gender);
    const entity = actor(job, choice, gender);
    expect(characterAppearanceJob(entity), `${name}/${job}/${gender}/${choice}`).toBe(allowed ? jobs[option] : 0);
    expect(characterAppearanceBaseJob(entity)).toBe(allowed ? jobs[option] : job);
    expect(entity).toEqual(actor(job, choice, gender));
   }
  }
 });
 it('keeps a single bound choice across mount, dismount and reset', () => {
  const job = jobs[4];
  const gender = sex === -1 ? 0 : sex;
  for (const [index, choice] of choices.entries()) {
   const entity = actor(job, choice, gender);
   expect(characterAppearanceJob(entity)).toBe(jobs[index]);
   if (MountTable[job]) {
    entity.costume = MountTable[job];
    expect(characterAppearanceJob(entity)).toBe(mounts[index]);
    expect(characterAppearanceBaseJob(entity)).toBe(mounts[index] ? jobs[index] : job);
    expect(entity._characterAppearance).toBe(choice);
    entity.costume = 0;
    expect(characterAppearanceJob(entity)).toBe(jobs[index]);
   }
   entity._characterAppearance = 0;
   expect(characterAppearanceJob(entity)).toBe(0);
   expect(characterAppearanceBaseJob(entity)).toBe(job);
  }
 });
 it('yields to transformations, outfits and local resource failure without erasing choice', () => {
  const entity = actor(jobs[4], choices[0], sex === -1 ? 0 : sex);
  for (const state of [{ _body: 1 }, { _monster_transform: 1002 }, { _active_monster_transform: 1002 },
   { _job_transform: 7 }, { _allRidingState: true }, { costume: 22 }, { _characterAppearanceFailed: true }]) {
   const modified = { ...entity, ...state };
   expect(characterAppearanceJob(modified)).toBe(0);
   expect(characterAppearanceBaseJob(modified)).toBe(jobs[4]);
   expect(modified._characterAppearance).toBe(choices[0]);
  }
 });
});

it('accepts every configured packet value, rejecting malformed and unknown values', () => {
 for (let choice = 0; choice <= 39; choice++) expect(isCharacterAppearance(choice)).toBe(true);
 for (const choice of [-1, 40, 65535, 65536, 1.5, NaN, Infinity, '1', null, undefined]) {
  expect(isCharacterAppearance(choice)).toBe(false);
 }
 for (const job of [0, 1, 4001, 4023, 4096, 4211, 4302, 99999]) {
  for (let choice = 1; choice <= 39; choice++) expect(characterAppearanceJob(actor(job, choice, 0))).toBe(0);
 }
});
