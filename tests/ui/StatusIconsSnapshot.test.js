import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ tick: 1000, encode: vi.fn(), load: vi.fn() }));
vi.mock('DB/Status/StatusInfo.js', () => ({ default: { 1: { icon: 'test.bmp', descript: [['加速术'], ['提升移动速度']], haveTimeLimit: 1 } } }));
vi.mock('DB/DBManager.js', () => ({ default: { isTaeKwon: () => false } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('Renderer/Renderer.js', () => ({ default: { get tick() { return state.tick; }, height: 800 } }));
vi.mock('Renderer/ScreenEffectManager.js', () => ({ default: { clean() {}, cleanStatusEffect() {}, parseStatus() {} } }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: (_path, callback) => callback('decoded-resource') } }));
vi.mock('Utils/Texture.js', () => ({ default: { load: (...args) => state.load(...args) } }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: component => component } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
 static MouseMode = { CROSS: 1 };
 constructor() { this.root = document.createElement('div'); this.root.innerHTML = '<div id="StatusIcons"></div>'; }
 getRoot() { return this.root; }
} }));
import StatusIcons from '../../src/UI/Components/StatusIcons/StatusIcons.js';
beforeEach(() => {
 state.tick = 1000;
 state.encode.mockReset().mockReturnValue('data:image/png;base64,c3RhdHVz');
 state.load.mockReset().mockImplementation((_data, callback) => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 24;
  canvas.toDataURL = state.encode; callback.call(canvas, true);
 });
 vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
 StatusIcons.clean();
});
afterEach(() => vi.restoreAllMocks());
it('exposes decoded canvas icons to mobile and encodes once across countdown updates', () => {
 StatusIcons.update(1, 1, 10000);
 expect(StatusIcons.getSnapshot()).toEqual([{id:'1', title:'加速术', description:'提升移动速度', seconds:10, icon:'data:image/png;base64,c3RhdHVz'}]);
 state.tick += 1000;
 expect(StatusIcons.getSnapshot()[0].seconds).toBe(9);
 StatusIcons.update(1, 1, 10000);
 expect(state.encode).toHaveBeenCalledOnce();
 expect(state.load).toHaveBeenCalledOnce();
 StatusIcons.update(1, 0, 0);
 expect(StatusIcons.getSnapshot()).toEqual([]);
});
