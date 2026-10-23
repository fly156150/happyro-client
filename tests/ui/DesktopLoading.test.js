import { beforeAll, afterEach, expect, it, vi } from 'vitest';
vi.mock('UI/Platform.js', () => ({ default: { isMobile: false } }));
vi.mock('DB/DBManager.js', () => ({ default: { INTERFACE_PATH: 'data/texture/interface/' } }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('Core/Configs.js', () => ({ default: { get: () => 1 } }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
let Background;
beforeAll(async () => {
 vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({clearRect:vi.fn(),fillRect:vi.fn(),fillText:vi.fn(),measureText:()=>({width:0})});
 Background = (await import('../../src/UI/Background.js')).default;
});
afterEach(() => vi.restoreAllMocks());
it('requests only the eight loading pictures present in the current official resources', () => {
 Background.init();
 const display = vi.spyOn(Background, 'setImage').mockImplementation(() => {});
 const random = vi.spyOn(Math, 'random');
 for (let i = 0; i < 100; i++) {
  random.mockReturnValue(i / 100);
  Background.setLoading();
 }
 const names = [...new Set(display.mock.calls.map(([name]) => name))].sort();
 expect(names).toEqual(['loading00.jpg','loading01.jpg','loading02.jpg','loading03.jpg','loading04.jpg','loading05.jpg','loading06.jpg','loading07.jpg']);
});
it('uses the explicitly supplied picture list', () => {
 Background.init(['custom.jpg']);
 const display = vi.spyOn(Background, 'setImage').mockImplementation(() => {});
 Background.setLoading();
 expect(display).toHaveBeenCalledWith('custom.jpg', expect.any(Function));
});
