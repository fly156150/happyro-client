import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import { validateSocialText } from '../../src/Utils/SocialText.js';

const source = readFileSync('src/Engine/CharEngine.js', 'utf8');
const start = source.indexOf('function onCharCreationRequest(');
const body = source.slice(start, source.indexOf('/**', start));
function harness() {
 const sent = [], messages = [];
 const create = new Function('PACKET', 'PACKETVER', 'Network', 'UIManager', '_creationSlot', 'validateSocialText', body + '\nreturn onCharCreationRequest;')(
  PACKET, {value:20211103}, {sendPacket:p=>sent.push(p)}, {showMessageBox:m=>messages.push(m)}, 0, validateSocialText);
 return {sent, messages, create:name=>create(name,1,1,1,1,1,1,0,0,0,0)};
}
it('rejects names that would be truncated before sending a creation packet', () => {
 for (const name of ['ab一二三四五六七八', '一二三四五六七八', 'a'.repeat(24), '😀'.repeat(6), 'a\0b']) {
  const h = harness(); h.create(name);
  expect(h.sent).toHaveLength(0); expect(h.messages).toHaveLength(1);
 }
});
it('preserves a full 23-byte mixed name with a terminating NUL', () => {
 const h = harness(), name = 'ab一二三四五六七'; h.create(name);
 expect(h.messages).toHaveLength(0); expect(h.sent).toHaveLength(1);
 const bytes = new Uint8Array(h.sent[0].build().buffer, 2, 24);
 expect(bytes[23]).toBe(0);
 expect(new TextDecoder('utf-8', {fatal:true}).decode(bytes.subarray(0,23))).toBe(name);
});
