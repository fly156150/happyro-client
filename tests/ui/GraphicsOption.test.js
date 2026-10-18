import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
 graphics: { quality: 100, cursor: true, pixelPerfectSprites: false, defaults: { quality: 100, cursor: true, pixelPerfectSprites: false }, save: vi.fn() },
 resize: vi.fn(), setConfig: vi.fn(), message: vi.fn()
}));
vi.mock('Preferences/Graphics.js', () => ({ default: state.graphics }));
vi.mock('Core/Configs.js', () => ({ default: { set: state.setConfig } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { resize: state.resize } }));
vi.mock('UI/Components/FPS/FPS.js', () => ({ default: { toggle: vi.fn() } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: { addText: state.message, TYPE: { INFO: 1 }, FILTER: { PUBLIC_LOG: 0 } } }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: component => component } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
 static MouseMode = { STOP: 1 };
 getRoot() { return this.root; }
 draggable() {}
} }));
import GraphicsOption from '../../src/UI/Components/GraphicsOption/GraphicsOption.js';

beforeEach(() => {
 vi.clearAllMocks();
 Object.assign(state.graphics, state.graphics.defaults);
 document.body.innerHTML = GraphicsOption.render();
 GraphicsOption.root = document.querySelector('#GraphicsOption');
 GraphicsOption._host = GraphicsOption.root;
 GraphicsOption.init();
});

it('restores actual canvas quality and cursor together with stored defaults', () => {
 state.graphics.quality = 50;
 state.graphics.cursor = false;
 document.body.classList.remove('custom-cursor');
 GraphicsOption.root.querySelector('.reset-button').click();
 expect(state.setConfig).toHaveBeenCalledWith('quality', 100);
 expect(state.resize).toHaveBeenCalledOnce();
 expect(document.body.classList.contains('custom-cursor')).toBe(true);
 expect(state.graphics.save).toHaveBeenCalledOnce();
});

it('saves pixel filtering in both directions and explains the required reload', () => {
 const input = GraphicsOption.root.querySelector('.pixel-perfect');
 for (const enabled of [true, false]) {
  input.checked = enabled;
  input.dispatchEvent(new Event('change'));
  expect(state.graphics.pixelPerfectSprites).toBe(enabled);
  expect(state.message).toHaveBeenLastCalledWith(expect.stringContaining('刷新页面'), 1, 0);
 }
});

it('keeps working FXAA controls while hiding its unimplemented subpixel control', () => {
 expect(GraphicsOption.root.querySelector('.fxaaEnabled')).not.toBeNull();
 expect(GraphicsOption.root.querySelector('.fxaaEdgeThreshold')).not.toBeNull();
 expect(GraphicsOption.root.querySelector('.fxaaSubpix')).toBeNull();
});
