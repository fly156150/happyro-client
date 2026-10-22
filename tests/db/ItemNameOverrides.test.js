import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ItemNameOverrides from '../../src/DB/Items/ItemNameOverrides.generated.js';

describe('ItemNameOverrides', () => {
	it('contains only reviewed differences from itemInfo', () => {
		expect(Object.keys(ItemNameOverrides)).toHaveLength(789);
		expect(Object.values(ItemNameOverrides).every(name => !/[\uac00-\ud7af]/.test(name))).toBe(true);
		expect(ItemNameOverrides[1101]).toBeUndefined();
		expect(ItemNameOverrides[4434]).toBe('矿坑小精灵卡片');
		expect(ItemNameOverrides[909]).toBe('杰勒比结晶');
	});

	it('preserves reviewed Chinese card display names', () => {
		expect(ItemNameOverrides[4006]).toBe('疯兔卡片');
		expect(ItemNameOverrides[4002]).toBe('绿棉虫卡片');
	});

	it('loads equipment affixes from the UTF-8 card prefix table', () => {
		const source = readFileSync('src/DB/DBManager.js', 'utf8');
		expect(source).toContain("'data/cardprefixnametable.txt'");
		expect(source).toContain('.prefixName = val;');
		expect(source).toMatch(/onLoad\(\),\r?\n\s*'utf-8'/);
	});
});
