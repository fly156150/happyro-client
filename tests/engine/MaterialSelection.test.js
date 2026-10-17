import { expect, it } from 'vitest';
import { createMaterialSelectionPacket } from '../../src/Engine/MapEngine/MaterialSelection.js';

it.each([0, 1, 2])('encodes conversion mode %i and every selected stack', Type => {
	const packet = createMaterialSelectionPacket({ Type, Action: 1, MaterialList: [{ index: 89, count: 1 }, { index: 88, count: 10 }] });
	packet.getPacketVersion = () => [20211103, 0x07e4, -1, 2, 4, 8, 12];
	const bytes = packet.build().buffer;
	const view = new DataView(bytes);
	expect(bytes.byteLength).toBe(20);
	expect(view.getUint16(0, true)).toBe(0x07e4);
	expect(view.getUint16(2, true)).toBe(20);
	expect(view.getUint32(4, true)).toBe(Type);
	expect(view.getUint32(8, true)).toBe(1);
	expect([12, 14, 16, 18].map(offset => view.getUint16(offset, true))).toEqual([89, 1, 88, 10]);
});

it('encodes cancellation without any material entries', () => {
	const packet = createMaterialSelectionPacket({ Type: 1, Action: 0, MaterialList: [] });
	packet.getPacketVersion = () => [20211103, 0x07e4, -1, 2, 4, 8, 12];
	const bytes = packet.build().buffer;
	expect(bytes.byteLength).toBe(12);
	expect(new DataView(bytes).getUint32(8, true)).toBe(0);
});
