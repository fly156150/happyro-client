import { describe, expect, it } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import lengths from '../../src/Network/PacketLength.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';

describe('server-authoritative map recovery protocol', () => {
 it('registers recovery boundaries for the actual stream parser', () => {
  lengths.init(20211103);
  expect(lengths.getPacketLength(0x0d0d)).toBe(8);
  expect(lengths.getPacketLength(0x0d0e)).toBe(8);
 });
 it('sends only the loading generation and selected recovery action', () => {
  const packet = new PACKET.CZ.HAPPYRO_MAP_RECOVERY();
  packet.generation = 0xfedcba98; packet.action = 1;
  const reader = new BinaryReader(packet.build().buffer);
  expect(reader.readUShort()).toBe(0x0d0c);
  expect(reader.readULong()).toBe(0xfedcba98);
  expect(reader.readUChar()).toBe(1);
  expect(reader.tell()).toBe(7);
 });
 it('reads pending load and recovery-attempt metadata', () => {
  const data = new Uint8Array([42,0,0,0,2,1]);
  expect(new PACKET.ZC.HAPPYRO_MAP_LOAD_CONTEXT(new BinaryReader(data.buffer))).toEqual({generation:42,attempt:2,pending:1});
  expect(PACKET.ZC.HAPPYRO_MAP_LOAD_CONTEXT.size).toBe(8);
 });
 it('reads the request generation and terminal safe-map failure', () => {
  const data = new Uint8Array([42,0,0,0,2,1]);
  expect(new PACKET.ZC.HAPPYRO_MAP_RECOVERY_RESULT(new BinaryReader(data.buffer))).toEqual({generation:42,status:2,destination:1});
  expect(PACKET.ZC.HAPPYRO_MAP_RECOVERY_RESULT.size).toBe(8);
 });
});
