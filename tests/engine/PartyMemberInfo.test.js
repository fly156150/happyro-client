import { expect, it, vi } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
import { updatePartyMemberInfo } from '../../src/Engine/MapEngine/PartyMemberInfo.js';

it('decodes a real member update and preserves party identity and state', () => {
	const bytes = new ArrayBuffer(8);
	const view = new DataView(bytes);
	view.setUint32(0, 2000001, true);
	view.setUint16(4, 4017, true);
	view.setUint16(6, 99, true);
	const packet = new PACKET.ZC.NOTIFY_MEMBERINFO_TO_GROUPM(new BinaryReader(bytes), 8);
	expect(PACKET.ZC.NOTIFY_MEMBERINFO_TO_GROUPM.size).toBe(10);
	const member = { AID: 2000001, characterName: 'Member', role: 1, state: 0, class_: 4254, baseLevel: 275, mapName: 'izlude', life: { hp: 10 } };
	const party = { getSocialSnapshot: () => ({ party: [member] }), addPartyMember: vi.fn() };
	updatePartyMemberInfo(party, packet);
	expect(party.addPartyMember).toHaveBeenCalledWith({ ...member, class_: 4017, baseLevel: 99 });
	expect(member.baseLevel).toBe(275);
});

it('does not re-add a member who has already left', () => {
	const party = { getSocialSnapshot: () => ({ party: [] }), addPartyMember: vi.fn() };
	updatePartyMemberInfo(party, { AID: 2000001, job: 4017, level: 99 });
	expect(party.addPartyMember).not.toHaveBeenCalled();
});

it('decodes Chinese party and member names from the current party list packet', () => {
	const bytes = new ArrayBuffer(78);
	const view = new DataView(bytes);
	const text = new TextEncoder();
	new Uint8Array(bytes, 0, 24).set(text.encode('技能验收1017'));
	view.setUint32(24, 2000001, true);
	view.setUint32(28, 150001, true);
	new Uint8Array(bytes, 32, 24).set(text.encode('测试角色'));
	new Uint8Array(bytes, 56, 16).set(text.encode('izlude.gat'));
	view.setUint8(72, 1);
	view.setUint8(73, 0);
	view.setUint16(74, 4017, true);
	view.setInt16(76, 99, true);
	const packet = new PACKET.ZC.GROUP_LIST3(new BinaryReader(bytes), 78);
	expect(packet.groupName).toBe('技能验收1017');
	expect(packet.groupInfo).toEqual([{ AID: 2000001, GID: 150001, characterName: '测试角色', mapName: 'izlude.gat', role: 1, state: 0, class_: 4017, baseLevel: 99 }]);
});
