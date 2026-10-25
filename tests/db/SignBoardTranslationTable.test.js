// Names verified against docs/localization/map-name-scans/merged/data in the root repository.
import { describe, expect, it } from 'vitest';
import DB from '../../src/DB/DBManager.js';
import SignBoardTranslationTable from '../../src/DB/SignBoardTranslationTable.js';

describe('signboard translation table', () => {
	it('covers every Korean description in the 2021-11-05 signboard resource', () => {
		const entries = Object.entries(SignBoardTranslationTable);

		expect(entries).toHaveLength(50);
		for (const [source, translated] of entries) {
			expect(source).toMatch(/[\uac00-\ud7af]/);
			expect(translated).toMatch(/[\u3400-\u9fff]/);
		}
	});

	it('normalizes spacing before translating', () => {
		expect(DB.getTranslatedSignBoard('  라자냐   행 ')).toBe('前往罗札纳');
		expect(DB.getTranslatedSignBoard('낙원단 공간이동사')).toBe('乐园团空间传送员');
	});
});
