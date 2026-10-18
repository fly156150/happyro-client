import Job from '../../DB/Jobs/JobConst.js';
import MountTable from '../../DB/Jobs/MountTable.js';

const appearances = {
 1: Job.KNIGHT, 2: Job.KNIGHT_H, 3: Job.RUNE_KNIGHT,
 4: Job.CRUSADER, 5: Job.CRUSADER_H, 6: Job.ROYAL_GUARD
};
const stages = new Map([
 [Job.KNIGHT, 1], [Job.KNIGHT_H, 2], [Job.RUNE_KNIGHT, 3], [Job.RUNE_KNIGHT_H, 3], [Job.DRAGON_KNIGHT, 4],
 [Job.CRUSADER, 11], [Job.CRUSADER_H, 12], [Job.ROYAL_GUARD, 13], [Job.ROYAL_GUARD_H, 13], [Job.IMPERIAL_GUARD, 14]
]);
export function characterAppearanceJob(entity) {
 const choice = entity._characterAppearance || 0;
 const stage = stages.get(entity._job) || 0;
 if (!choice || entity._characterAppearanceFailed || entity._allRidingState || entity._active_monster_transform || entity._monster_transform || entity._job_transform
  || (entity.costume && entity.costume !== MountTable[entity._job])) return 0;
 // Preserve second outfits. The protocol also sends the base job as a default body style.
 if (entity._body > 0 && entity._body !== entity._job && entity._body !== entity.costume) return 0;
 if ((choice >= 1 && choice <= 3 && stage > choice && stage <= 4)
  || (choice >= 4 && choice <= 6 && stage > choice + 7 && stage <= 14)) {
  const base = appearances[choice];
  return entity.costume === MountTable[entity._job] ? MountTable[base] : base;
 }
 return 0;
}
export function characterAppearanceBaseJob(entity) {
 return characterAppearanceJob(entity) ? appearances[entity._characterAppearance] : entity._job;
}
