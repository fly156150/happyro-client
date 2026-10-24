import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ tick: 1000, encode: vi.fn(), load: vi.fn() }));
vi.mock('DB/Status/StatusInfo.js', () => ({ default: { 1: { icon: 'test.bmp', descript: [['加速术', '#00ff00'], ['%s', '#ffff00'], ['提升移动速度']], haveTimeLimit: 1 } } }));
vi.mock('DB/DBManager.js', () => ({ default: { isTaeKwon: () => false, getMessage: (_id, fallback) => fallback } }));
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
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('exposes decoded canvas icons to mobile and encodes once across countdown updates', () => {
 StatusIcons.update(1, 1, 10000);
 expect(StatusIcons.getSnapshot()).toEqual([{id:'1', title:'加速术', description:'提升移动速度', seconds:10, countdown:{fraction:1-10000/60000,color:'rgba(255,150,50,0.65)'}, descriptionLines:[{text:'加速术',color:'#00ff00'},{text:'10 second',color:'#ffff00'},{text:'提升移动速度',color:''}], icon:'data:image/png;base64,c3RhdHVz'}]);
 state.tick += 1000;
 expect(StatusIcons.getSnapshot()[0].seconds).toBe(9);
 expect(StatusIcons.getSnapshot()[0].descriptionLines[1]).toEqual({text:'9 second', color:'#ffff00'});
 StatusIcons.update(1, 1, 10000);
 expect(state.encode).toHaveBeenCalledOnce();
 expect(state.load).toHaveBeenCalledOnce();
 StatusIcons.update(1, 0, 0);
 expect(StatusIcons.getSnapshot()).toEqual([]);
});

it('does not attach a decoded icon from an expired instance of the same status', () => {
 const callbacks = []; state.load.mockImplementation((_data, callback) => callbacks.push(callback));
 StatusIcons.update(1, 1, 10000); StatusIcons.update(1, 0, 0); StatusIcons.update(1, 1, 20000);
 const canvas = document.createElement('canvas'); canvas.width = canvas.height = 24;
 canvas.toDataURL = () => 'data:old'; callbacks[0].call(canvas);
 expect(StatusIcons.getSnapshot()[0].icon).toBeUndefined();
 canvas.toDataURL = () => 'data:new'; callbacks[1].call(canvas);
 expect(StatusIcons.getSnapshot()[0].icon).toBe('data:new');
});
it('ignores a resized image completing after status cleanup', () => {
 let image;
 vi.stubGlobal('Image', class { constructor() { image = this; } });
 vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({save(){},translate(){},scale(){},drawImage(){},restore(){}});
 vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:resized');
 state.load.mockImplementation((_data, callback) => callback.call({width:64,height:64}));
 StatusIcons.update(1, 1, 10000); StatusIcons.clean();
 expect(() => image.onload()).not.toThrow();
 expect(StatusIcons.getSnapshot()).toEqual([]);
});
