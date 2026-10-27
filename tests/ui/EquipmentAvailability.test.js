import lengths from '../../src/Network/PacketLength.js';
import { afterEach, expect, it, vi } from 'vitest';
import Network from '../../src/Network/NetworkManager.js';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
import { requestEquipmentAvailability, handleEquipmentAvailability } from '../../src/UI/Game/EquipmentAvailability.js';

afterEach(() => { endConnection(); vi.restoreAllMocks(); vi.useRealTimers(); });
const items = n => Array.from({length:n},(_,i)=>({index:i+2,ID:2301+i}));
it('encodes identities and requested slot without trusting client eligibility', () => {
 const packet = new PACKET.CZ.HAPPYRO_EQUIPMENT_AVAILABILITY();
 Object.assign(packet,{requestId:123,position:16,items:items(2)});
 const reader = new BinaryReader(packet.build().buffer);
 expect(reader.readUShort()).toBe(0xd11);
 expect(reader.readUShort()).toBe(26);
 expect(reader.readULong()).toBe(123);
 expect(reader.readULong()).toBe(16);
 expect(reader.readUShort()).toBe(2);
 expect(reader.readUShort()).toBe(2); expect(reader.readULong()).toBe(2301);
 expect(reader.readUShort()).toBe(3); expect(reader.readULong()).toBe(2302);
});
it('strictly decodes eligibility results and rejects malformed data', () => {
 const bytes = new Uint8Array(9);
 const view = new DataView(bytes.buffer); view.setUint32(0,123,true);view.setUint16(4,2,true);
 bytes[6]=1;bytes[7]=0;bytes[8]=1;
 expect(new PACKET.ZC.HAPPYRO_EQUIPMENT_AVAILABILITY(new BinaryReader(bytes.buffer),9)).toMatchObject({requestId:123,blocked:true,available:[false,true]});
 expect(()=>new PACKET.ZC.HAPPYRO_EQUIPMENT_AVAILABILITY(new BinaryReader(bytes.buffer),8)).toThrow();
 bytes[8]=2;
 expect(()=>new PACKET.ZC.HAPPYRO_EQUIPMENT_AVAILABILITY(new BinaryReader(bytes.buffer),9)).toThrow();
});
it('batches large lists and returns a single complete ordered result', async () => {
 const send = vi.spyOn(Network,'sendPacket').mockImplementation(packet=> {
  handleEquipmentAvailability({requestId:packet.requestId,blocked:false,available:packet.items.map(item=>item.index%2===0)});
 });
 const candidates = items(205);
 expect(await requestEquipmentAvailability(16,candidates)).toEqual({available:candidates.map(item=>item.index%2===0),blocked:false});
 expect(send.mock.calls.map(([packet])=>packet.items.length)).toEqual([100,100,5]);
});
it('does not query an empty list', async () => {
 const send=vi.spyOn(Network,'sendPacket');
 expect(await requestEquipmentAvailability(16,[])).toEqual({available:[],blocked:false});
 expect(send).not.toHaveBeenCalled();
});
it('cancels pending queries and ignores late results', async () => {
 const send=vi.spyOn(Network,'sendPacket').mockReturnValue(true);
 const abort=new AbortController();
 const promise=requestEquipmentAvailability(16,items(1),abort.signal);
 const rejected=expect(promise).rejects.toThrow('取消');
 const id=send.mock.lastCall[0].requestId;
 abort.abort();await rejected;
 expect(handleEquipmentAvailability({requestId:id,available:[true],blocked:false})).toBe(false);
});
it.each(['timeout','disconnect','send','count'])('reports %s as failure, not an empty result', async mode=> {
 vi.useFakeTimers();
 const send=vi.spyOn(Network,'sendPacket').mockReturnValue(mode!=='send');
 const promise=requestEquipmentAvailability(16,items(1));
 const rejected=expect(promise).rejects.toThrow();
 if(mode==='timeout')await vi.advanceTimersByTimeAsync(5000);
 if(mode==='disconnect')endConnection();
 if(mode==='count')handleEquipmentAvailability({requestId:send.mock.lastCall[0].requestId,available:[],blocked:false});
 await rejected;
});

it('registers the response boundary for the deployed protocol', () => {
 lengths.init(20211103);
 expect(lengths.getPacketLength(0xd12)).toBe(-1);
});
