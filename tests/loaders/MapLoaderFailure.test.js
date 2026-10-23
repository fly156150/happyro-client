import { beforeEach, describe, expect, it, vi } from 'vitest';
const files = vi.hoisted(() => ({ filesAlias: {}, load: vi.fn() }));
vi.mock('Core/FileManager.js', () => ({ default: files }));
import MapLoader from 'Loaders/MapLoader.js';

function scene() {
	return {
		'data\\test.rsw': { files: { gat: 'test.gat', gnd: 'test.gnd' }, water: { level: 0, waveHeight: 0 }, models: [], compile: () => ({ light: {}, water: {} }) },
		'data\\test.gat': { compile: () => ({ width: 2, height: 2 }) },
		'data\\test.gnd': { version: 1, textures: [], compile: () => ({ waterVertCount: 0, textures: [] }) }
	};
}
function loader() {
	const result = new MapLoader(); result.onload = vi.fn(); result.ondata = vi.fn(); result.onprogress = vi.fn(); return result;
}
beforeEach(() => { vi.clearAllMocks(); files.filesAlias = {}; });
describe('required map resources and cancellation', () => {
	it.each(['rsw', 'gat', 'gnd'])('reports missing %s exactly once without completing the map', extension => {
		const resources = scene(); delete resources[`data\\test.${extension}`];
		files.load.mockImplementation((name, callback) => callback(resources[name] || null, resources[name] ? null : "Can't get file"));
		const map = loader(); map.load('test.rsw');
		expect(map.onload).toHaveBeenCalledExactlyOnceWith(false, expect.objectContaining({ code: 'missing_resource', resource: `data\\test.${extension}` }));
		expect(map.active).toBe(false);
	});
	it.each(['rsw', 'gat', 'gnd'])('preserves %s parser errors from FileManager', extension => {
		const resources = scene();
		files.load.mockImplementation((name, callback) => name.endsWith('.' + extension) ? callback(null, 'Invalid binary header') : callback(resources[name]));
		const map = loader(); map.load('test.rsw');
		expect(map.onload).toHaveBeenCalledExactlyOnceWith(false, expect.objectContaining({ code: 'invalid_resource', resource: `data\\test.${extension}`, message: expect.stringContaining('Invalid binary header') }));
	});
	it.each(['rsw', 'gat', 'gnd'])('contains exceptions while compiling %s', extension => {
		const resources = scene(); resources[`data\\test.${extension}`].compile = () => { throw new Error('Truncated grid'); };
		files.load.mockImplementation((name, callback) => callback(resources[name]));
		const map = loader(); expect(() => map.load('test.rsw')).not.toThrow();
		expect(map.onload).toHaveBeenCalledExactlyOnceWith(false, expect.objectContaining({ code: 'invalid_resource', resource: `data\\test.${extension}` }));
	});
	it('allows missing optional ground textures and models', () => {
		const resources = scene(); resources['data\\test.rsw'].models = [{ filename: 'optional.rsm' }]; resources['data\\test.gnd'].textures = ['missing.bmp'];
		resources['data\\test.gnd'].compile = () => ({ waterVertCount: 0, textures: ['missing.bmp'] });
		files.load.mockImplementation((name, callback) => callback(resources[name] || null));
		const map = loader(); map.load('test.rsw'); expect(map.onload).toHaveBeenCalledExactlyOnceWith(true);
	});
	it('discards outstanding resource callbacks after a newer load starts', () => {
		const pending = new Map(); files.load.mockImplementation((name, callback) => pending.set(name, callback));
		const map = loader(); map.load('old.rsw'); map.load('test.rsw');
		pending.get('data\\old.rsw')(null, "Can't get file");
		expect(map.onload).not.toHaveBeenCalled();
		pending.get('data\\test.rsw')(scene()['data\\test.rsw']);
		expect(pending.has('data\\test.gat')).toBe(true);
		map.cancel(); pending.get('data\\test.gat')(scene()['data\\test.gat']);
		expect(map.ondata).not.toHaveBeenCalled(); expect(map.onload).not.toHaveBeenCalled();
	});
});
