import { expect, it, vi } from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
import { talkieMessageError, showTalkieMessage, requestTalkieMessage } from '../../src/Engine/MapEngine/TalkieBox.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
vi.mock('../../src/UI/Components/Confirmation.js', () => ({ confirmAction: vi.fn((container, message, action, options) => {
	globalThis.talkiePrompt = { action, options };
	return options.cancelled;
}) }));
it('validates the UTF-8 field without splitting Chinese characters', () => {
	expect(talkieMessageError('中文留言')).toBe('');
	expect(talkieMessageError('中'.repeat(6) + 'ab')).toBe('');
	expect(talkieMessageError('中'.repeat(7))).not.toBe('');
	expect(talkieMessageError(' ')).not.toBe('');
	expect(talkieMessageError('hello\0hidden')).not.toBe('');
});
it('round trips a Chinese message through the fixed-size ground-skill packet', () => {
	const outgoing = new PACKET.CZ.USE_SKILL_TOGROUNDMoreInfo();
	outgoing.getPacketVersion = () => [20211103, 0x0190, 90, 2, 4, 6, 8, 10];
	Object.assign(outgoing, { SKID: 125, selectedLevel: 1, xPos: 100, yPos: 101, contents: '中'.repeat(6) + 'ab' });
	const sent = outgoing.build().buffer;
	expect(new DataView(sent).getUint16(4, true)).toBe(125);
	expect(new Uint8Array(sent)[89]).toBe(0);
	const incoming = new ArrayBuffer(25);
	new DataView(incoming).setUint32(0, 42, true);
	new Uint8Array(incoming, 4).set(new Uint8Array(sent, 10, 21));
	const packet = new PACKET.ZC.TALKBOX_CHATCONTENTS(new BinaryReader(incoming), 25);
	expect(packet.contents).toBe(outgoing.contents);
	const set = vi.fn();
	showTalkieMessage(packet, { get: () => ({ dialog: { set } }) });
	expect(set).toHaveBeenCalledWith(outgoing.contents);
	expect(() => showTalkieMessage(packet, { get: () => undefined })).not.toThrow();
});
it('returns confirmed text and cancels unfinished input on disconnect', async () => {
	const accepted = requestTalkieMessage();
	globalThis.talkiePrompt.options.content.querySelector('input').value = '欢迎';
	globalThis.talkiePrompt.action();
	await expect(accepted).resolves.toBe('欢迎');
	const cancelled = requestTalkieMessage();
	endConnection();
	await expect(cancelled).resolves.toBeNull();
	delete globalThis.talkiePrompt;
});
