import { afterEach, expect, it } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import PACKETVER from '../../src/Network/PacketVerManager.js';
const originalVersion = PACKETVER.value;
afterEach(() => { PACKETVER.value = originalVersion; });
it.each([1000289, 1000290, 12718])('preserves the entire current-protocol crafting item ID %i', id => {
	PACKETVER.value = 20211103;
	const packet = new PACKET.CZ.REQ_MAKINGITEM();
	packet.mkType = 31;
	packet.id = id;
	const bytes = packet.build().buffer;
	const view = new DataView(bytes);
	expect(bytes.byteLength).toBe(8);
	expect(view.getUint16(0, true)).toBe(0x025b);
	expect(view.getUint16(2, true)).toBe(31);
	expect(view.getUint32(4, true)).toBe(id);
});
