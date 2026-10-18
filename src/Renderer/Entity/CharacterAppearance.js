import MountTable from '../../DB/Jobs/MountTable.js';
import { characterAppearanceJobs, characterAppearanceOptions } from '../../DB/Jobs/CharacterAppearanceTable.generated.js';

export function isCharacterAppearance(value) {
 return Number.isInteger(value) && (value === 0 || Object.hasOwn(characterAppearanceOptions, value));
}

/** Validate identity separately from visual state; the server remains authoritative. */
export function characterAppearanceOption(job, choice, sex) {
 const real = characterAppearanceJobs[job];
 const option = characterAppearanceOptions[choice];
 if (!real || !option || real.branch !== option.branch || real.stage <= option.stage
  || (real.sex !== -1 && real.sex !== sex) || (option.sex !== -1 && option.sex !== sex)) return null;
 return option;
}

export function characterAppearanceJob(entity) {
 const option = characterAppearanceOption(entity._job, entity._characterAppearance, entity._sex);
 if (!option || entity._characterAppearanceFailed || entity._allRidingState || entity._active_monster_transform
  || entity._monster_transform || entity._job_transform
  || (entity.costume && entity.costume !== MountTable[entity._job])) return 0;
 // Existing second outfits and transformations keep their display priority.
 if (entity._body > 0 && entity._body !== entity._job && entity._body !== entity.costume) return 0;
 // Missing historical forms yield to the complete real-job form, without erasing the saved choice.
 const riding = Boolean(entity.costume && entity.costume === MountTable[entity._job]);
 return riding ? option.mountedJob : option.job;
}

export function characterAppearanceBaseJob(entity) {
 return characterAppearanceJob(entity) ? characterAppearanceOptions[entity._characterAppearance].job : entity._job;
}
