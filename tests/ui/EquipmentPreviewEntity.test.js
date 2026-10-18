import { describe, expect, it } from 'vitest';
import { createEquipmentPreviewEntity } from '../../src/UI/Components/Equipment/EquipmentPreviewEntity.js';
import { upsertCharacterBySlot } from '../../src/UI/Components/CharSelect/CharSelectState.js';

class FakeEntity {
	static TYPE_PC = 0;

	constructor() {
		this.ACTION = { IDLE: 0 };
		this.effectColor = new Float32Array(4);
	}

	set(data) {
		this.data = data;
	}
}

const basePreview = {
	GID: 'preview',
	job: 4253,
	sex: 1,
	head: 1,
	headpalette: 0,
	bodypalette: 0,
	accessory: 11,
	accessory2: 12,
	accessory3: 13,
	robe: 14,
	direction: 0
};

describe('equipment preview entity lifecycle', () => {
	it('resolves the entity class after circular module initialization completes', () => {
		let EntityClass;
		const resolvePreview = createEquipmentPreviewEntity(() => EntityClass);
		EntityClass = FakeEntity;
		expect(resolvePreview(basePreview, {})).toBeInstanceOf(FakeEntity);
	});

	it('reuses the entity until an appearance attachment changes', () => {
		const resolvePreview = createEquipmentPreviewEntity(() => FakeEntity);
		const animation = {};
		const first = resolvePreview(basePreview, animation);
		const repeated = resolvePreview({ ...basePreview }, animation);
		const changed = resolvePreview({ ...basePreview, accessory2: 99 }, animation);

		expect(repeated).toBe(first);
		expect(changed).not.toBe(first);
		expect(changed.data).toMatchObject({
			accessory: 11,
			accessory2: 99,
			accessory3: 13,
			Robe: 14
		});
	});
});

describe('character selection slot state', () => {
	it('updates repeated character-list chunks without duplicating a slot', () => {
		const characters = [{ CharNum: 0, head: 1 }];
		upsertCharacterBySlot(characters, { CharNum: 0, head: 2 });
		upsertCharacterBySlot(characters, { CharNum: 1, head: 3 });

		expect(characters).toEqual([
			{ CharNum: 0, head: 2 },
			{ CharNum: 1, head: 3 }
		]);
	});
});

it('refreshes preview for appearance and outfit changes while preserving real job', () => {
 const resolve = createEquipmentPreviewEntity(() => FakeEntity);
 const original = resolve(basePreview, {});
 const selected = resolve({ ...basePreview, characterAppearance: 2, body: 4253 }, {});
 expect(selected).not.toBe(original);
 expect(selected.characterAppearance).toBe(2);
 expect(selected.data.job).toBe(basePreview.job);
 expect(selected.body).toBe(4253);
 expect(resolve({ ...basePreview, characterAppearance: 2, body: 4253 }, {})).toBe(selected);
 const reset = resolve({ ...basePreview, characterAppearance: 0 }, {});
 expect(reset).not.toBe(selected);
 expect(reset.characterAppearance).toBe(0);
});

it('invalidates cached preview when mounted or cash-mount state changes', () => {
 const resolve = createEquipmentPreviewEntity(() => FakeEntity);
 const walking = resolve({ ...basePreview, characterAppearance: 9 }, {});
 const riding = resolve({ ...basePreview, characterAppearance: 9, effectState: 0x200000 }, {});
 expect(riding).not.toBe(walking);
 expect(riding.characterAppearance).toBe(9);
 expect(riding.effectState).toBe(0x200000);
 const cash = resolve({ ...basePreview, characterAppearance: 9, allRidingState: 1 }, {});
 expect(cash).not.toBe(riding);
 expect(cash.allRidingState).toBe(1);
 expect(cash.effectState).toBe(0);
});

it('forwards all 39 catalog choices, eligible sexes and real jobs without numeric truncation', async () => {
 const { characterAppearanceJobs: jobs, characterAppearanceOptions: options } = await import('../../src/DB/Jobs/CharacterAppearanceTable.generated.js');
 expect(Object.keys(options)).toHaveLength(39);
 const resolve = createEquipmentPreviewEntity(() => FakeEntity);
 for (const [id, option] of Object.entries(options)) {
  const [job] = Object.entries(jobs).find(([, entry]) => entry.branch === option.branch && entry.stage === 4 && !entry.mountedOf);
  for (const sex of option.sex === -1 ? [0, 1] : [option.sex]) {
   const preview = resolve({ ...basePreview, job: Number(job), sex, characterAppearance: Number(id) }, {});
   expect(preview.characterAppearance).toBe(Number(id));
   expect(preview.data.job).toBe(Number(job));
   expect(preview.data.sex).toBe(sex);
  }
 }
});
