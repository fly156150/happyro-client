import { expect, it } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import versions from '../../src/Network/PacketVersions.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';

const entries = [
	{ index: 2, ITID: 1201, RefiningLevel: 7, grade: 2, slot: { card1: 255, card2: 0, card3: 150000, card4: 0 } },
	{ index: 47, ITID: 500001, RefiningLevel: 12, grade: 4, slot: { card1: 100001, card2: 4002, card3: 0, card4: 70001 } }
];

it.each([false, true])('decodes consecutive current-protocol equipment entries (repair=%s)', repair => {
	const stride = repair ? 24 : 23;
	const bytes = new ArrayBuffer(stride * entries.length);
	const view = new DataView(bytes);
	entries.forEach((item, i) => {
		const start = i * stride;
		view.setInt16(start, item.index, true);
		view.setUint32(start + 2, item.ITID, true);
		if (!repair) view.setUint8(start + 6, item.RefiningLevel);
		Object.values(item.slot).forEach((card, j) => view.setUint32(start + (repair ? 6 : 7) + j * 4, card, true));
		if (repair) {
			view.setUint8(start + 22, item.RefiningLevel);
			view.setUint8(start + 23, item.grade);
		}
	});
	const reader = new BinaryReader(bytes);
	const packet = new (repair ? PACKET.ZC.REPAIRITEMLIST2 : PACKET.ZC.NOTIFY_WEAPONITEMLIST)(reader, bytes.byteLength);
	expect(packet.itemList).toEqual(entries.map(({ grade, ...item }) => repair ? { ...item, grade } : item));
	expect(reader.tell()).toBe(bytes.byteLength);
});

it.each([entries[1], { index: -1, ITID: 0, RefiningLevel: 0, grade: 0, slot: { card1: 0, card2: 0, card3: 0, card4: 0 } }])('encodes a complete current repair selection or cancel', item => {
	const packet = new PACKET.CZ.REQ_ITEMREPAIR();
	const version = versions[20211103].find(row => row[0] === PACKET.CZ.REQ_ITEMREPAIR);
	packet.getPacketVersion = () => [20211103, ...version.slice(1)];
	Object.assign(packet, { index: item.index, itemId: item.ITID, RefiningLevel: item.RefiningLevel, grade: item.grade, slots: item.slot });
	const bytes = packet.build().buffer;
	const view = new DataView(bytes);
	expect(bytes.byteLength).toBe(26);
	expect(view.getUint16(0, true)).toBe(0x0b66);
	expect(view.getInt16(2, true)).toBe(item.index);
	expect(view.getUint32(4, true)).toBe(item.ITID);
	expect([8, 12, 16, 20].map(offset => view.getUint32(offset, true))).toEqual(Object.values(item.slot));
	expect(view.getUint8(24)).toBe(item.RefiningLevel);
	expect(view.getUint8(25)).toBe(item.grade);
});
