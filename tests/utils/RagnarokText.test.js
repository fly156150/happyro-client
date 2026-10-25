import { describe, expect, it } from 'vitest';
import tipBox from '../../src/DB/Help/TipBox.json';
import { formatRagnarokMarkup, toPlainRagnarokText } from '../../src/Utils/RagnarokText.js';

describe('Ragnarok text', () => {
	it('removes inline color controls from plain UI text', () => {
		expect(toPlainRagnarokText('力量参数\\n ^cc0000近距离物理攻击力^ffffff,所持重量')).toBe(
			'力量参数\n 近距离物理攻击力,所持重量'
		);
		expect(toPlainRagnarokText('普通说明')).toBe('普通说明');
	});

	it('keeps NAVI display names and hides navigation markup', () => {
		const source =
			'^ffffff<NAVI>^4D4DFF[海达姆伙伴]^000000<INFO>mal_in01,20,124,0,100,0,0</INFO></NAVI>^000000';
		expect(toPlainRagnarokText(source)).toBe('[海达姆伙伴]');
		expect(formatRagnarokMarkup(source)).toContain('class="navi-link"');
		expect(formatRagnarokMarkup(source)).toContain('data-navi-info="mal_in01,20,124,0,100,0,0"');
		expect(formatRagnarokMarkup(source)).toContain('data-navi-name="[海达姆伙伴]"');
		expect(formatRagnarokMarkup(source)).not.toContain('&lt;NAVI&gt;');
		expect(formatRagnarokMarkup(source)).not.toContain('<INFO>');
	});
});

describe('TIPBOX help links', () => {
	const fragment = source => {
		const root = document.createElement('div');
		root.innerHTML = formatRagnarokMarkup(source);
		return root;
	};
	it('renders a known help entry as an accessible link without showing its metadata', () => {
		const source = '<TIPBOX>^4D4DFF[Episode13.2]^000000<INFO>6016</INFO></TIPBOX>';
		const root = fragment(source), link = root.querySelector('.tipbox-link');
		expect(link.dataset.tipboxId).toBe('6016');
		expect(link.getAttribute('role')).toBe('button');
		expect(link.tabIndex).toBe(0);
		expect(root.textContent).toBe('[Episode13.2]');
		expect(toPlainRagnarokText(source)).toBe('[Episode13.2]');
		expect(link.querySelector('span').style.color).toBe('rgb(77, 77, 255)');
	});
	it('normalizes numeric IDs and keeps missing help as readable, noninteractive text', () => {
		const root = fragment('<tipbox>有效<info> 0006016 </info></tipbox> / <TIPBOX>缺失<INFO>99999999</INFO></TIPBOX>');
		expect(root.querySelector('.tipbox-link').dataset.tipboxId).toBe('6016');
		const missing = root.querySelector('[data-tipbox-id="99999999"]');
		expect(missing.textContent).toBe('缺失');
		expect(missing.hasAttribute('role')).toBe(false);
		expect(missing.hasAttribute('tabindex')).toBe(false);
		expect(missing.classList.contains('tipbox-link')).toBe(false);
		expect(root.textContent).toBe('有效 / 缺失');
	});
	it.each(['', '0', '-1', 'NaN', '1e3', '6016,1', '9007199254740993', '6016" onclick="alert(1)'])('hides invalid INFO %s without making a link', info => {
		const source = `<TIPBOX>保留文字<INFO>${info}</INFO></TIPBOX>`;
		const root = fragment(source);
		expect(root.textContent).toBe('保留文字');
		expect(root.querySelector('[data-tipbox-id], .tipbox-link')).toBeNull();
		expect(toPlainRagnarokText(source)).toBe('保留文字');
	});
	it.each([
		['前<TIPBOX>说明</TIPBOX>后', '前说明后'],
		['前<TIPBOX>说明<INFO>6016</TIPBOX>后', '前说明后'],
		['前<TIPBOX>说明<INFO>6016</INFO>\n下一段', '前说明\n下一段'],
		['前<TIPBOX>说明<INFO>6016\n下一段', '前说明\n下一段'],
		['<TIPBOX>坏链接<INFO>6016\n<TIPBOX>好链接<INFO>6057</INFO></TIPBOX>末尾', '坏链接\n好链接末尾']
	])('cleans malformed help metadata while preserving neighboring text: %s', (source, label) => {
		expect(fragment(source).textContent).toBe(label);
		expect(toPlainRagnarokText(source)).toBe(label);
	});
	it('escapes help labels and leaves ordinary item and navigation behavior intact', () => {
		const source = '<TIPBOX><img src=x onerror=alert(1)>帮助<INFO>6016</INFO></TIPBOX> <ITEMLINK>红色药水<INFO>501</INFO></ITEMLINK> <NAVI>城门<INFO>prontera,100,200</INFO></NAVI>';
		const root = fragment(source);
		expect(root.querySelector('img')).toBeNull();
		expect(root.querySelector('.tipbox-link').textContent).toBe('<img src=x onerror=alert(1)>帮助');
		expect(root.querySelector('.item-link').dataset.itemId).toBe('501');
		expect(root.querySelector('.navi-link').dataset.naviInfo).toBe('prontera,100,200');
		expect(toPlainRagnarokText(source)).toBe('<img src=x onerror=alert(1)>帮助 红色药水 城门');
	});
});


it('renders every published help page without exposing TIPBOX or INFO source tags', () => {
	let pages = 0;
	for (const [id, entry] of Object.entries(tipBox.entries)) {
		for (const page of entry.pages) {
			const html = formatRagnarokMarkup(page);
			expect(html, `help ${id}`).not.toMatch(/(?:&lt;|<)\/?(?:TIPBOX|INFO)(?:&gt;|>)/i);
			expect(toPlainRagnarokText(page), `help ${id}`).not.toMatch(/<\/?(?:TIPBOX|INFO)>/i);
			pages++;
		}
	}
	expect(pages).toBeGreaterThan(1000);
});
