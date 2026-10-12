import {expect,it} from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
it('uses a fixed read-only request and carries no teleport coordinates',()=>{
 const packet=new PACKET.CZ.HAPPYRO_ARRIVAL_PREVIEW();packet.requestId=123;packet.mapName='prt_fild08';
 const writer=packet.build();const reader=new BinaryReader(writer.buffer);
 expect(reader.readUShort()).toBe(0xd06);expect(reader.readULong()).toBe(123);expect(reader.readBinaryString(16).replace(/\0.*$/,'')).toBe('prt_fild08');
 expect(reader.tell()).toBe(22);
});
it('decodes the server result and coordinates with the agreed length',()=>{
 const buffer=new ArrayBuffer(26);const v=new DataView(buffer);v.setUint32(0,123,true);v.setUint16(4,0,true);new Uint8Array(buffer,6).set(new TextEncoder().encode('prt_fild08'));v.setUint16(22,168,true);v.setUint16(24,373,true);
 const packet=new PACKET.ZC.HAPPYRO_ARRIVAL_PREVIEW(new BinaryReader(buffer));
 expect(packet).toMatchObject({requestId:123,result:0,mapName:'prt_fild08',x:168,y:373});expect(PACKET.ZC.HAPPYRO_ARRIVAL_PREVIEW.size).toBe(28);
});
