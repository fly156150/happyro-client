import { expect, it, vi } from 'vitest';
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';

it.each([0, 1, 17, 18, 19, 20, 21, 23, 36, 40, 180])('decodes all %i cash-shop entries using the server layout', count => {
 // Payload after the variable packet header: two balances, then 13 bytes per item.
 const size = 8 + count * 13;
 const buffer = new ArrayBuffer(size + 4);
 const view = new DataView(buffer);
 view.setUint32(0, 100000, true); view.setUint32(4, 5000, true);
 const expected = Array.from({ length: count }, (_, i) => {
  const offset = 8 + i * 13;
  view.setInt32(offset, 100 + i, true); view.setInt32(offset + 4, 90 + i, true);
  view.setUint8(offset + 8, i % 12); view.setUint32(offset + 9, 100000 + i, true);
  return { price: 100 + i, discountprice: 90 + i, type: i % 12, ITID: 100000 + i };
 });
 view.setUint32(size, 0x12345678, true);
 const reader = new BinaryReader(buffer);
 const packet = new PACKET.ZC.PC_CASH_POINT_ITEMLIST(reader, size);
 expect(packet.itemList).toEqual(expected);
 expect(packet.KafraPoint).toBe(100000); expect(packet.CashPoint).toBe(5000);
 expect(reader.tell()).toBe(size);
 expect(reader.readULong()).toBe(0x12345678);
});
