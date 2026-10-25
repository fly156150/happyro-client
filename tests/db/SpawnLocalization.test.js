// Names verified against docs/localization/map-name-scans/merged/data in the root repository.
import { describe, expect, it } from 'vitest';
import MapTable from '../../src/DB/Map/MapTable.js';
import { mergeLocalizedMapInfo } from '../../src/DB/Map/MapInfoLocalization.js';
import MiniMapTable from '../../src/DB/Map/MiniMapTable.js';
import JobDisplayNameTable, { getJobDisplayName } from '../../src/DB/Jobs/JobDisplayNameTable.js';

describe('spawn localization', () => {
	it('localizes the isolated island map', () => {
		for (const map of ['int_land.rsw', 'int_land01.rsw', 'int_land02.rsw', 'int_land03.rsw', 'int_land04.rsw']) {
			expect(MapTable[map].signName.mainTitle).toBe('偏僻岛');
			expect(MapTable[map].displayName).toBe('偏僻岛');
		}
	});

	it('localizes stranded passenger ship maps', () => {
		for (const map of ['iz_int.rsw', 'iz_int01.rsw', 'iz_int02.rsw', 'iz_int03.rsw', 'iz_int04.rsw']) {
			expect(MapTable[map].signName.mainTitle).toBe('新手地图');
			expect(MapTable[map].displayName).toBe('新手地图');
		}
	});

	it('localizes summoner job names', () => {
		expect(JobDisplayNameTable[4218]).toBe('召唤师');
		expect(JobDisplayNameTable[4220]).toBe('召唤师宝宝');
		expect(getJobDisplayName(4218)).toBe('召唤师');
	});

	it('keeps localized map text when official map metadata loads', () => {
		const merged = mergeLocalizedMapInfo(
			{
				backgroundBmp: 'official_background',
				displayName: 'Remote Island',
				signName: { mainTitle: 'Remote Island', subTitle: 'Official subtitle' }
			},
			MapTable['int_land.rsw']
		);

		expect(merged.backgroundBmp).toBe('official_background');
		expect(merged.displayName).toBe('偏僻岛');
		expect(merged.signName.mainTitle).toBe('偏僻岛');
		expect(merged.signName.subTitle).toBe('Official subtitle');
	});

	it('uses the Alberta island minimap for every remote island instance', () => {
		for (const map of ['int_land', 'int_land01', 'int_land02', 'int_land03', 'int_land04']) {
			expect(MiniMapTable[map]).toBe('alb2trea');
		}
	});
});
