import { expect, it } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import lengths from '../../src/Network/PacketLength.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
it('registers and decodes the dedicated appearance packet at PACKETVER 20211103', async () => {
 await lengths.init(20211103);
 expect(lengths.getPacketLength(0xd08)).toBe(8);
 expect(PACKET.ZC.HAPPYRO_RIDING_APPEARANCE.size).toBe(8);
 const buffer = new ArrayBuffer(6); const view = new DataView(buffer);
 view.setUint32(0, 2000010, true); view.setUint16(4, 5, true);
 const reader = new BinaryReader(buffer);
 expect(new PACKET.ZC.HAPPYRO_RIDING_APPEARANCE(reader)).toMatchObject({ actorId: 2000010, appearance: 5 });
 expect(reader.tell()).toBe(6);
});

it('decodes saved appearance by character ID independently of map actor IDs', async () => {
 await lengths.init(20211103);
 expect(lengths.getPacketLength(0xd09)).toBe(8);
 const buffer = new ArrayBuffer(6), view = new DataView(buffer);
 view.setUint32(0, 150001, true); view.setUint16(4, 2, true);
 expect(new PACKET.HC.HAPPYRO_CHARACTER_APPEARANCE(new BinaryReader(buffer)))
  .toEqual({ charId: 150001, appearance: 2 });
});
