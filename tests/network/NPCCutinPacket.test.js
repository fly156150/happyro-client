import { expect, it } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';

it.each([
 ['SHOW_IMAGE', 16, 'min01.bmp'],
 ['SHOW_IMAGE', 16, '포링'],
 ['SHOW_IMAGE2', 64, '마리오네트카드'],
 ['SHOW_IMAGE2', 64, '루나틱카드.bmp'],
 ['SHOW_IMAGE2', 64, '파브르카드.bmp'],
 ['SHOW_IMAGE2', 64, ''],
])('decodes %s artwork as UTF-8 and preserves the display type', (kind, width, name) => {
 const data = new Uint8Array(width + 1);
 data.set(new TextEncoder().encode(name));
 data[width] = name ? 4 : 255;
 const reader = new BinaryReader(data.buffer);
 const packet = new PACKET.ZC[kind](reader, data.byteLength);
 expect(packet.imageName).toBe(name);
 expect(packet.type).toBe(name ? 4 : 255);
 expect(reader.tell()).toBe(data.byteLength);
});
