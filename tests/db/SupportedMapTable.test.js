import { describe, expect, it } from 'vitest';
import MapTable from '../../src/DB/Map/MapTable.js';
import MiniMapTable from '../../src/DB/Map/MiniMapTable.js';
import SupportedMapTable, { isSupportedMapResource } from '../../src/DB/Map/SupportedMapTable.js';

describe('supported map resources', () => {
	it('contains only the verified client and server intersection', () => {
		expect(SupportedMapTable.size).toBe(1088);
		expect(isSupportedMapResource('prontera.gat')).toBe(true);
		for (const map of ['tra_fild01', 'tra_fild02', 'tra_fild03']) {
			expect(isSupportedMapResource(map + '.rsw'), map).toBe(true);
		}
		for (let group = 1; group <= 5; group++) {
			for (let area = 1; area <= 4; area++) {
				expect(isSupportedMapResource(`new_${group}-${area}.gat`)).toBe(true);
				expect(MapTable[`new_${group}-${area}.rsw`].displayName).toMatch(/[\u3400-\u9fff]/);
				expect(MiniMapTable[`new_${group}-${area}`]).toBe(`new_zone0${area}`);
			}
		}
		expect(isSupportedMapResource('jor_tail')).toBe(false);
		expect(isSupportedMapResource('airplane_01.rsw')).toBe(true);
	});
});
