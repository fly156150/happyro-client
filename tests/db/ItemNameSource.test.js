import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Item name sources', () => {
	it('loads equipment affixes from the UTF-8 card prefix table', () => {
		const source = readFileSync('src/DB/DBManager.js', 'utf8');
		expect(source).toContain("'data/cardprefixnametable.txt'");
		expect(source).toContain('.prefixName = val;');
		expect(source).toMatch(/onLoad\(\),\r?\n\s*'utf-8'/);
	});
});
