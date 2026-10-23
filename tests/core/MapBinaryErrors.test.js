import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('Core/FileSystem.js', () => ({ default: {} }));
import FileManager from 'Core/FileManager.js';
import MapLoader from 'Loaders/MapLoader.js';
afterEach(() => vi.restoreAllMocks());
describe('real map parser errors', () => {
	it.each(['rsw', 'gat', 'gnd'])('reports corrupt %s binary headers', extension => {
		vi.spyOn(FileManager, 'get').mockImplementation((filename, callback) => callback(Uint8Array.from('INVALID binary data', c => c.charCodeAt(0)).buffer));
		const callback = vi.fn(); FileManager.load(`data\\bad.${extension}`, callback);
		expect(callback).toHaveBeenCalledExactlyOnceWith(null, expect.stringContaining('Invalid header'));
	});
	it('propagates a real RSW parser failure through MapLoader without successful completion', () => {
		vi.spyOn(FileManager, 'get').mockImplementation((filename, callback) => callback(Uint8Array.from('INVALID binary data', c => c.charCodeAt(0)).buffer));
		const map = new MapLoader(); map.onload = vi.fn(); map.ondata = vi.fn(); map.load('bad.rsw');
		expect(map.onload).toHaveBeenCalledExactlyOnceWith(false, expect.objectContaining({ code: 'invalid_resource', resource: 'data\\bad.rsw' }));
		expect(map.ondata).not.toHaveBeenCalled();
	});
});
