import PACKETVER from "../../src/Network/PacketVerManager.js";
import {expect,it} from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
it('reads the 20211103 buying store update with a 32-bit item ID and all receipt fields',()=>{
 const buffer=new ArrayBuffer(22),view=new DataView(buffer);
 view.setUint32(0,100000,true);view.setUint16(4,25,true);view.setUint32(6,500,true);view.setUint32(10,1500,true);view.setUint32(14,12345,true);view.setUint32(18,1700000000,true);
 const reader=new BinaryReader(buffer),packet=new PACKET.ZC.UPDATE_ITEM_FROM_BUYING_STORE2(reader);
 expect(packet).toMatchObject({ITID:100000,count:25,zeny:500,limitZeny:1500,GID:12345,date:1700000000});expect(reader.tell()).toBe(22);expect(PACKET.ZC.UPDATE_ITEM_FROM_BUYING_STORE2.size).toBe(24);
});

it('encodes multiple 20211103 purchase rows with 32-bit item IDs and server-sized strides', () => {
 const previous = PACKETVER.value;
 PACKETVER.value = 20211103;
 try {
  const packet = new PACKET.CZ.REQ_TRADE_BUYING_STORE();
  packet.getPacketVersion = () => [20211103, 0x0819, -1];
  Object.assign(packet, {AID: 2000002, UniqueID: 17, itemList: [
   {index: 6, ITID: 537, count: 2}, {index: 9, ITID: 100000, count: 3}
  ]});
  const encoded = packet.build(), bytes = new DataView(encoded.buffer);
  expect(encoded.buffer.byteLength).toBe(28);
  expect(bytes.getUint16(2, true)).toBe(28);
  expect(bytes.getUint32(4, true)).toBe(2000002);
  expect(bytes.getUint32(8, true)).toBe(17);
  expect(bytes.getUint16(12, true)).toBe(6);
  expect(bytes.getUint32(14, true)).toBe(537);
  expect(bytes.getUint16(18, true)).toBe(2);
  expect(bytes.getUint16(20, true)).toBe(9);
  expect(bytes.getUint32(22, true)).toBe(100000);
  expect(bytes.getUint16(26, true)).toBe(3);
 } finally { PACKETVER.value = previous; }
});
