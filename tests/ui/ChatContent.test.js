import { expect, it, vi } from 'vitest';
import { createChatContent } from '../../src/UI/Game/ChatContent.js';

const attack = '<span class="nickname-link"></span><img src=x onerror="window.injected=1">';
it('renders player HTML literally even when it resembles a nickname link', () => {
 const content = createChatContent(attack, vi.fn());
 expect(content.textContent).toBe(attack);
 expect(content.childElementCount).toBe(0);
});
it('keeps whisper names and bodies inert while preserving the nickname link', () => {
 const name = '"><img src=x onerror=alert(1)>';
 const content = createChatContent(['[ 来自 ', { kind: 'nickname', text: name }, ' ] : ', attack], vi.fn());
 expect(content.querySelectorAll('.nickname-link')).toHaveLength(1);
 expect(content.querySelector('.nickname-link').dataset.nickname).toBe(name);
 expect(content.textContent).toBe(`[ 来自 ${name} ] : ${attack}`);
 expect(content.querySelector('img')).toBeNull();
});
it('preserves item link data and labels without trusting the surrounding text or attributes', () => {
 const raw = '<ITEM>" onmouseover="alert(1)<INFO>501</INFO></ITEM>';
 const parse = vi.fn(() => ({ name: '<img src=x>红药水' }));
 const content = createChatContent(`${attack}${raw}${attack}`, parse);
 const link = content.querySelector('.item-link');
 expect(link.dataset.item).toBe(raw);
 expect(link.textContent).toBe('<<img src=x>红药水>');
 expect(link.hasAttribute('onmouseover')).toBe(false);
 expect(content.querySelectorAll('img,script,svg')).toHaveLength(0);
 expect(content.textContent).toBe(`${attack}<<img src=x>红药水>${attack}`);
});
it('leaves malformed item links readable without aborting message processing', () => {
 const raw = '<ITEML>bad</ITEML>';
 expect(createChatContent(raw, () => { throw new Error('bad item'); }).textContent).toBe(raw);
});
it('preserves generated download links and treats file names as attribute values', () => {
 const filename = 'ChatHistory " onclick="alert(1).html';
 const content = createChatContent(['记录 ', { kind: 'download', text: '点击此处', url: 'blob:https://game.test/id', filename }], vi.fn());
 const link = content.querySelector('a');
 expect(link.getAttribute('href')).toBe('blob:https://game.test/id');
 expect(link.download).toBe(filename);
 expect(link.hasAttribute('onclick')).toBe(false);
 expect(content.textContent).toBe('记录 点击此处');
});
it('keeps rich message text intact when consumed by the mobile chat feed', () => {
 const content = createChatContent(['[ To ', { kind: 'nickname', text: '甲<&乙' }, ' ] : ', attack], vi.fn());
 const mobile = new DOMParser().parseFromString(content.innerHTML, 'text/html');
 expect(mobile.body.textContent).toBe(content.textContent);
 expect(mobile.querySelector('img')).toBeNull();
});
