import { afterEach, expect, it } from 'vitest';
import { contrastRatio, readableColor, ensureReadableText } from '../../src/Utils/ReadableText.js';
import { applyColorCodes, formatNPCMarkup } from '../../src/Utils/RagnarokText.js';
afterEach(() => document.body.replaceChildren());
it('corrects arbitrary dark and light colors against both panel themes', () => {
 for (const bg of [[25,31,38], [239,244,240]]) {
  for (const color of [[0,0,205], [128,0,0], [0,80,0], [255,255,0], [220,220,220], [20,20,20]]) {
   const result=readableColor(color,bg);
   expect(contrastRatio(result,bg)).toBeGreaterThanOrEqual(4.5);
   if(contrastRatio(color,bg)>=4.5) expect(result).toEqual(color);
  }
 }
 const blue=readableColor([0,0,205],[25,31,38]);
 expect(blue[0]).toBe(blue[1]);expect(blue[2]).toBeGreaterThan(blue[0]);
});
it('resets script colors to the theme and closes consecutive spans', () => {
 const host=document.body.appendChild(document.createElement('div'));
 host.style.cssText='background:#191f26;color:#eeeeee';
 host.innerHTML=applyColorCodes('^0000cd蓝^ff0000红^000000正文');
 ensureReadableText(host);
 expect(host.querySelectorAll('span')).toHaveLength(2);
 expect(host.querySelector('span span')).toBeNull();
 expect(host.lastChild.nodeType).toBe(Node.TEXT_NODE);
 expect(host.lastChild.textContent).toBe('正文');
 expect(host.innerHTML).not.toContain('color:#000000');
});
it('composites transparent ancestor backgrounds across a shadow root', () => {
 const host=document.body.appendChild(document.createElement('div'));
 host.style.backgroundColor='#191f26';
 const root=host.attachShadow({mode:'open'});
 const content=document.createElement('div');root.append(content);
 content.style.backgroundColor='rgba(255,255,255,0.1)';
 content.innerHTML=formatNPCMarkup('^0000cd蓝^000000正文 <font color="darkred">红</font>');
 ensureReadableText(content);
 const bg=[25,31,38].map(c=>255*0.1+c*0.9);
 for(const node of content.querySelectorAll('span,font')) {
  const color=node.style.color.match(/\d+/g).map(Number);
  expect(contrastRatio(color,bg)).toBeGreaterThanOrEqual(4.5);
 }
 const first=content.innerHTML;ensureReadableText(content);expect(content.innerHTML).toBe(first);
});

it('uses a deployment target of 7 on dark and light panels while preserving readable colors', async () => {
 const { vi } = await import('vitest');
 vi.resetModules();
 const { default: Configs } = await import('../../src/Core/Configs.js');
 Configs.set('clientDefaults', { scriptText: { minContrast: 7 } });
 const adjusted = await import('../../src/Utils/ReadableText.js');
 for (const bg of [[25,31,38], [239,244,240]]) {
  for (const color of [[0,0,205], [128,0,0], [0,80,0], [255,255,0]]) {
   expect(adjusted.contrastRatio(adjusted.readableColor(color,bg),bg)).toBeGreaterThanOrEqual(7);
  }
 }
 expect(adjusted.readableColor([255,255,255],[25,31,38])).toEqual([255,255,255]);
 // Original 4.5 policy and its cache must not leak into the new policy.
 const color=[0,0,205],bg=[25,31,38];
 expect(adjusted.readableColor(color,bg)).not.toEqual(readableColor(color,bg));
 const host=document.body.appendChild(document.createElement('div'));
 host.style.backgroundColor='#191f26';host.innerHTML='<span style="color:#0000cd">正文</span>';
 adjusted.ensureReadableText(host);
 expect(adjusted.contrastRatio(host.firstChild.style.color.match(/\d+/g).map(Number),bg)).toBeGreaterThanOrEqual(7);
 const first=host.innerHTML;adjusted.ensureReadableText(host);expect(host.innerHTML).toBe(first);
 vi.resetModules();
});

it('chooses the maximum attainable contrast when neither endpoint reaches the configured target', async () => {
 const { vi } = await import('vitest');vi.resetModules();
 const { default: Configs } = await import('../../src/Core/Configs.js');
 Configs.set('clientDefaults', { scriptText: { minContrast: 7 } });
 const adjusted = await import('../../src/Utils/ReadableText.js');
 for(const bg of [[117,117,117],[118,118,118]]) {
  const white=contrastRatio([255,255,255],bg),black=contrastRatio([0,0,0],bg);
  expect(Math.max(white,black)).toBeLessThan(7);
  const expected=white>=black?[255,255,255]:[0,0,0];
  expect(adjusted.readableColor(bg,bg)).toEqual(expected);
 }
 vi.resetModules();
});
