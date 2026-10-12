import { expect, it } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
import { localizeEntityName } from '../../src/Engine/MapEngine/EntityName.js';

it.each(['碳酸水自动售货机#prt', '乐园团空间传送员', '长名称😀测试#npc', '微笑助手'])('preserves the complete NPC name %s', name => {
	const bytes = new TextEncoder().encode(name + '\0');
	const buffer = new ArrayBuffer(4 + bytes.length);
	new DataView(buffer).setUint32(0, 123456, true);
	new Uint8Array(buffer, 4).set(bytes);
	const reader = new BinaryReader(buffer);
	const packet = new PACKET.ZC.HAPPYRO_NPC_NAME(reader, buffer.byteLength);
	expect(packet.AID).toBe(123456);
	expect(packet.CName).toBe(name);
	expect(reader.tell()).toBe(buffer.byteLength);
	const entity = { constructor: { TYPE_NPC: 6, TYPE_NPC2: 7 }, objecttype: 6,
		display: { name: '短名称', STYLE: { NPC: 2 }, update() {} } };
	localizeEntityName(entity, packet.CName);
	expect(entity.display.name).toBe(name);
});

it('rejects a truncated name header', () => {
	const buffer = new ArrayBuffer(3);
	expect(() => new PACKET.ZC.HAPPYRO_NPC_NAME(new BinaryReader(buffer), 3)).toThrow('Truncated NPC name');
});
