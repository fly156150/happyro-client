import { storageTitle } from '../../src/UI/Components/Storage/StorageLabels.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('storage localization and controls', () => {
	it.each(['StorageV0', 'StorageV3'])('uses a Chinese title and text tabs in %s', version => {
		const html = read(`src/UI/Components/Storage/${version}/Storage.html`);

		expect(html).toContain('<span class="text">仓库</span>');
		for (const label of ['消耗', '现金', '防具', '武器', '弹药', '卡片', '其他']) {
			expect(html).toContain(`>${label}</button>`);
		}
		expect(html).not.toContain('tab_itm_ex_');
	});

	it('keeps the normal storage title localized after server metadata arrives', () => {
		const source = read('src/Engine/MapEngine/Storage.js');

		expect(source).toContain('storageTitle(InvTypeName)');
		expect(storageTitle('Storage')).toBe('仓库');
		expect(storageTitle('Guild Storage')).toBe('公会仓库');
		expect(storageTitle('活动仓库')).toBe('活动仓库');
	});

	it('uses the shared game select for expanded-storage ordering', () => {
		const html = read('src/UI/Components/Storage/StorageV3/Storage.html');
		const source = read('src/UI/Components/Storage/StorageCommon.js');
		const versionSource = read('src/UI/Components/Storage/StorageV3/Storage.js');

		expect(html).toContain('class="game-select storage-order-select"');
		expect(html).not.toContain('<select');
		for (const label of ['默认', '升序', '降序']) expect(html).toContain(`<strong>${label}</strong>`);
		expect(html).toContain('data-value="NAME_ASC"');
		expect(html).toContain('data-value="NAME_DESC"');
		expect(source).toContain('mountGameSelects(root)');
		expect(source).toContain("querySelectorAll('.filter-buttons > button')");
		expect(versionSource).toContain('GameSelect.css?raw');
	});

	it('matches the expanded-storage close button to the search control size', () => {
		const css = read('src/UI/Components/Storage/StorageV3/Storage.css');
		const closeRule = css.match(/#Storage \.footer \.close \{[\s\S]*?\n\}/)?.[0];
		const searchRule = css.match(/#Storage \.footer \.search-button \{[\s\S]*?\n\}/)?.[0];

		expect(closeRule).toContain('width: 38px');
		expect(closeRule).toContain('min-width: 38px');
		expect(closeRule).toContain('height: 18px');
		expect(searchRule).toContain('width: 38px');
		expect(searchRule).toContain('min-width: 38px');
		expect(searchRule).toContain('height: 18px');
		expect(searchRule).toContain('margin-left: 0');
		expect(css).toContain('gap: 4px');
		expect(css).toMatch(/#Storage \.footer \.search-input \{[\s\S]*flex: 1;[\s\S]*min-width: 0/);
	});

	it('centers storage and opens inventory immediately to its left', () => {
		const source = read('src/UI/Components/Storage/StorageCommon.js');

		expect(source).toContain('(Renderer.width - rect.width) / 2');
		expect(source).toContain('(Renderer.height - rect.height) / 2');
		expect(source).toContain('if (!inventory.__active) inventory.append()');
		expect(source).toContain('left - inventoryRect.width - 8');
	});

	it('does not announce an empty attendance event during automatic mounting', () => {
		const source = read('src/UI/Components/CheckAttendance/CheckAttendance.js');

		expect(source).not.toContain("ChatBox.addText('当前没有进行中的签到活动。'");
	});
});
