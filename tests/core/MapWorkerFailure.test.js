import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ loaders: [] }));
vi.mock('Core/FileManager.js', () => ({ default: {} }));
vi.mock('Core/FileSystem.js', () => ({ default: {} }));
vi.mock('Loaders/MapLoader.js', () => ({ default: class {
	constructor() { this.load = vi.fn(); this.cancel = vi.fn(); mocks.loaders.push(this); }
} }));
beforeEach(async () => {
	vi.resetModules(); mocks.loaders.length = 0;
	vi.stubGlobal('postMessage', vi.fn()); vi.stubGlobal('onmessage', null);
	await import('Core/ThreadEventHandler.js'); postMessage.mockClear();
});
describe('worker map lifecycle', () => {
	it('tags streamed map data and forwards structured failure to the requesting callback', () => {
		onmessage({ data: { type: 'LOAD_MAP', uid: 10, data: { filename: 'bad.rsw', generation: 3 } } });
		const map = mocks.loaders[0];
		map.ondata('MAP_ALTITUDE', { width: 1 }); map.onprogress(3);
		const error = { code: 'invalid_resource', resource: 'bad.gnd', message: 'Invalid header' };
		map.onload(false, error);
		expect(postMessage).toHaveBeenCalledWith({ type: 'MAP_ALTITUDE', data: { generation: 3, data: { width: 1 } } });
		expect(postMessage).toHaveBeenCalledWith({ uid: 10, arguments: [false, error] });
	});
	it('cancels old loads and suppresses their late data when a newer load begins', () => {
		onmessage({ data: { type: 'LOAD_MAP', uid: 10, data: { filename: 'old.rsw', generation: 3 } } });
		const old = mocks.loaders[0];
		onmessage({ data: { type: 'LOAD_MAP', uid: 11, data: { filename: 'new.rsw', generation: 4 } } });
		expect(old.cancel).toHaveBeenCalledOnce();
		expect(postMessage).toHaveBeenCalledWith({ uid: 10, arguments: [false, expect.objectContaining({ code: 'cancelled' })] });
		postMessage.mockClear(); old.ondata('MAP_GROUND', {}); old.onprogress(100); old.onload(true);
		expect(postMessage).not.toHaveBeenCalled();
		onmessage({ data: { type: 'CANCEL_MAP', data: { generation: 3 } } });
		expect(mocks.loaders[1].cancel).not.toHaveBeenCalled();
		onmessage({ data: { type: 'CANCEL_MAP', data: { generation: 4 } } });
		expect(mocks.loaders[1].cancel).toHaveBeenCalledOnce();
	});
});
