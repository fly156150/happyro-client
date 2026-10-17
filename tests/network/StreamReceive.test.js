import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Network from '../../src/Network/NetworkManager.js';
import PACKET from '../../src/Network/PacketStructure.js';
import PacketLength from '../../src/Network/PacketLength.js';

let socket;
let received;
let disconnected;
function connect() {
	Network.connect('localhost', 5121, () => {}, true);
	socket.onComplete(true);
}
function bytes(count = 37) {
	const buffer = new ArrayBuffer(10 + count);
	const view = new DataView(buffer);
	view.setUint16(0, 0xcfb, true);
	view.setUint16(2, buffer.byteLength, true);
	view.setUint32(4, 12345, true);
	view.setUint16(8, count, true);
	new Uint8Array(buffer).fill(1, 10);
	return buffer;
}
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	PacketLength.init(20211103);
	received = vi.fn(); disconnected = vi.fn();
	Network.onDisconnect = disconnected;
	Network.hookPacket(PACKET.ZC.HAPPYRO_NPC_AVAILABILITY_RESULT, received);
	Network.setSocketFactory(() => (socket = { close: vi.fn(), send: vi.fn() }));
	connect();
});
afterEach(() => { Network.close(); Network.setSocketFactory(null); vi.restoreAllMocks(); vi.useRealTimers(); });

it('accepts every split position and multiple coalesced packets exactly once', () => {
	const packet = bytes();
	for (let split = 1; split < packet.byteLength; split++) {
		received.mockClear();
		socket.onMessage(packet.slice(0, split));
		expect(received).not.toHaveBeenCalled();
		socket.onMessage(packet.slice(split));
		expect(received).toHaveBeenCalledTimes(1);
		expect(received.mock.calls[0][0].available).toEqual(Array(37).fill(true));
	}
	received.mockClear();
	const combined = new Uint8Array(packet.byteLength * 100);
	for (let i = 0; i < 100; i++) combined.set(new Uint8Array(packet), i * packet.byteLength);
	socket.onMessage(combined.buffer);
	expect(received).toHaveBeenCalledTimes(100);
	expect(disconnected).not.toHaveBeenCalled();
});

it('waits for a fragmented raw character-server prefix', () => {
	const prefix = vi.fn(fp => expect(fp.readULong()).toBe(12345));
	Network.read(prefix, 4);
	const combined = new Uint8Array(4 + bytes().byteLength);
	new DataView(combined.buffer).setUint32(0, 12345, true);
	combined.set(new Uint8Array(bytes()), 4);
	socket.onMessage(combined.buffer.slice(0, 1));
	expect(prefix).not.toHaveBeenCalled();
	socket.onMessage(combined.buffer.slice(1));
	expect(prefix).toHaveBeenCalledTimes(1);
	expect(received).toHaveBeenCalledTimes(1);
});

it('discards half-packets and late events from the previous connection', () => {
	const previous = socket;
	previous.onMessage(bytes().slice(0, 7));
	connect();
	previous.onMessage(bytes().slice(7));
	socket.onMessage(bytes());
	expect(received).toHaveBeenCalledTimes(1);
	expect(disconnected).not.toHaveBeenCalled();
});

it('reads only the bytes of a typed-array view', () => {
	const storage = new Uint8Array(bytes().byteLength + 100);
	storage.set(new Uint8Array(bytes()), 13);
	socket.onMessage(storage.subarray(13, 13 + bytes().byteLength));
	expect(received).toHaveBeenCalledTimes(1);
	expect(disconnected).not.toHaveBeenCalled();
});

it('clears a remotely closed connection and refuses subsequent sends', () => {
	socket.onClose();
	expect(Network.send(new ArrayBuffer(2))).toBe(false);
	expect(disconnected).toHaveBeenCalledTimes(1);
});

it('bounds incomplete frame lifetime even when more bytes trickle in', () => {
	vi.useFakeTimers();
	socket.onMessage(bytes().slice(0, 4));
	vi.advanceTimersByTime(59000);
	socket.onMessage(bytes().slice(4, 5));
	vi.advanceTimersByTime(1000);
	expect(disconnected).toHaveBeenCalledTimes(1);
	expect(vi.getTimerCount()).toBe(0);
});

it.each([0, 1, 2, 3])('rejects invalid variable length %i without looping', length => {
	const packet = bytes();
	new DataView(packet).setUint16(2, length, true);
	socket.onMessage(packet);
	expect(disconnected).toHaveBeenCalledTimes(1);
	expect(received).not.toHaveBeenCalled();
});

it('rejects a count that crosses the packet boundary', () => {
	const packet = bytes(1);
	new DataView(packet).setUint16(8, 50, true);
	socket.onMessage(packet);
	expect(disconnected).toHaveBeenCalledTimes(1);
	expect(received).not.toHaveBeenCalled();
});

it('ignores a superseded connection attempt that finishes after the newer socket', () => {
	const completions = vi.fn();
	Network.connect('localhost', 5121, completions, true);
	const slow = socket;
	Network.connect('localhost', 5121, completions, true);
	const latest = socket;
	latest.onComplete(true);
	const id = Network.connectionId;
	slow.onComplete(true);
	expect(Network.connectionId).toBe(id);
	expect(completions).toHaveBeenCalledTimes(1);
	expect(slow.close).toHaveBeenCalledTimes(1);
	Network.send(new ArrayBuffer(2));
	expect(latest.send).toHaveBeenCalled();
});

it('cancels a pending connection when leaving recovery or logging out', () => {
	const completion = vi.fn();
	Network.connect('localhost', 5121, completion, true);
	const pending = socket;
	Network.close();
	pending.onComplete(true);
	expect(completion).not.toHaveBeenCalled();
	expect(Network.connectionId).toBeUndefined();
	expect(pending.close).toHaveBeenCalledTimes(1);
});

it('requests a foreground heartbeat only on the current live session', () => {
	const ping = vi.fn();
	Network.setPing(ping);
	expect(Network.requestPing()).toBe(true);
	expect(ping).toHaveBeenCalledTimes(1);
	Network.close();
	expect(Network.requestPing()).toBe(false);
});

it('receives arrival previews through the real framing table across every split', () => {
 const preview = vi.fn();
 Network.hookPacket(PACKET.ZC.HAPPYRO_ARRIVAL_PREVIEW, preview);
 const buffer = new ArrayBuffer(28);
 const view = new DataView(buffer);
 view.setUint16(0, 0xd07, true);
 view.setUint32(2, 123, true);
 new Uint8Array(buffer, 8, 16).set(new TextEncoder().encode('prt_fild08'));
 view.setUint16(24, 168, true);
 view.setUint16(26, 373, true);
 for (let split = 1; split < buffer.byteLength; split++) {
  preview.mockClear();
  socket.onMessage(buffer.slice(0, split));
  expect(preview).not.toHaveBeenCalled();
  socket.onMessage(buffer.slice(split));
  expect(preview).toHaveBeenCalledTimes(1);
  expect(preview.mock.calls[0][0]).toMatchObject({requestId:123, result:0, mapName:'prt_fild08', x:168, y:373});
 }
 expect(disconnected).not.toHaveBeenCalled();
});

it('reads a 20211103 talkie message without consuming the following packet', () => {
	const talkie = vi.fn();
	Network.hookPacket(PACKET.ZC.TALKBOX_CHATCONTENTS, talkie);
	const frame = new Uint8Array(27);
	const view = new DataView(frame.buffer);
	view.setUint16(0, 0x0191, true);
	view.setUint32(2, 42, true);
	frame.set(new TextEncoder().encode('中文留言'), 6);
	const combined = new Uint8Array(frame.length + bytes().byteLength);
	combined.set(frame);
	combined.set(new Uint8Array(bytes()), frame.length);
	for (let split = 1; split < frame.length; split++) {
		talkie.mockClear(); received.mockClear();
		socket.onMessage(combined.slice(0, split));
		expect(talkie).not.toHaveBeenCalled();
		socket.onMessage(combined.slice(split));
		expect(talkie).toHaveBeenCalledWith(expect.objectContaining({ AID: 42, contents: '中文留言' }));
		expect(received).toHaveBeenCalledTimes(1);
		expect(disconnected).not.toHaveBeenCalled();
	}
});
