import { expect, it, vi } from 'vitest';
vi.mock('Audio/SoundManager.js', () => ({ default: {} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
import initState from '../../src/Renderer/Entity/EntityState.js';
import { characterAppearanceJob } from '../../src/Renderer/Entity/CharacterAppearance.js';
import { characterAppearanceOptions } from '../../src/DB/Jobs/CharacterAppearanceTable.generated.js';
import MountTable from '../../src/DB/Jobs/MountTable.js';
import Status from '../../src/DB/Status/StatusState.js';
import Job from '../../src/DB/Jobs/JobConst.js';
import { createEquipmentPreviewEntity } from '../../src/UI/Components/Equipment/EquipmentPreviewEntity.js';

// Use the production state setters and appearance resolver; no WebGL/assets required.
class PreviewEntity {
 static TYPE_PC = 0;
 constructor() { this.ACTION = { IDLE: 0 }; this.costume = 0; initState.call(this); }
 set(data) { this._job = data.job; this._sex = data.sex; }
 set characterAppearance(value) { this._characterAppearance = value; }
 get characterAppearance() { return this._characterAppearance; }
 get renderJob() { return characterAppearanceJob(this) || this.costume || this._job; }
}
it.each([
 ['hunter', Job.WINDHAWK, Status.EffectState.WUGRIDER],
 ['blacksmith', Job.MEISTER, Status.EffectState.MADOGEAR],
 ['knight', Job.DRAGON_KNIGHT, Status.EffectState.DRAGON1],
 ['crusader', Job.IMPERIAL_GUARD, Status.EffectState.RIDING]
])('preserves selected %s appearance while preview enters and leaves its actual mount', (branch, job, state) => {
 const [id, choice] = Object.entries(characterAppearanceOptions).find(([, option]) => option.branch === branch && option.stage === 1);
 const resolve = createEquipmentPreviewEntity(() => PreviewEntity);
 const base = { GID: 'preview', job, sex: 1, characterAppearance: Number(id), body: 0 };
 const walking = resolve(base, {});
 expect(walking.renderJob).toBe(choice.job);
 const mounted = resolve({ ...base, effectState: state }, {});
 expect(mounted.renderJob).toBe(choice.mountedJob || MountTable[job]);
 expect(mounted.characterAppearance).toBe(Number(id));
 expect(mounted._job).toBe(job);
 expect(resolve(base, {}).renderJob).toBe(choice.job);
});
it('preserves special costume priority in the equipment preview', () => {
 const resolve = createEquipmentPreviewEntity(() => PreviewEntity);
 const preview = resolve({ job: Job.DRAGON_KNIGHT, sex: 1, characterAppearance: 1, effectState: Status.EffectState.WEDDING }, {});
 expect(preview.renderJob).toBe(22);
 expect(preview.characterAppearance).toBe(1);
});
