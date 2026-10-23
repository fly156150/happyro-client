import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ texture: vi.fn(), createShaderProgram: vi.fn(() => ({})) }));
vi.mock('Utils/WebGL.js', () => ({ default: mocks }));
vi.mock('Renderer/SpriteRenderer.js', () => ({ default: {} }));
vi.mock('Preferences/Map.js', () => ({ default: {} }));
import Water from 'Renderer/Map/Water.js';
import Models from 'Renderer/Map/Models.js';
function context() { return { createBuffer: vi.fn(() => ({})), bindBuffer: vi.fn(), bufferData: vi.fn(), deleteBuffer: vi.fn(), deleteTexture: vi.fn(), deleteProgram: vi.fn() }; }
beforeEach(() => vi.clearAllMocks());
describe('map GPU texture generations', () => {
	it.each([
		['water', Water, { vertCount: 3, mesh: [], images: Array(32).fill('water.jpg') }],
		['models', Models, { buffer: [], infos: [{ texture: 'model.jpg', vertCount: 3, vertOffset: 0 }] }]
	])('discards a late %s texture after free and a new initialization', (name, renderer, data) => {
		const gl = context(); renderer.init(gl, data); const oldCallback = mocks.texture.mock.calls[0][2];
		renderer.free(gl); renderer.init(gl, data); const currentCallback = mocks.texture.mock.calls.at(-1)[2];
		gl.deleteTexture.mockClear(); const staleTexture = {}; const currentTexture = {};
		expect(() => oldCallback(staleTexture, 0)).not.toThrow();
		expect(gl.deleteTexture).toHaveBeenCalledExactlyOnceWith(staleTexture);
		currentCallback(currentTexture, 0); expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
		renderer.free(gl); expect(gl.deleteTexture).toHaveBeenCalledWith(currentTexture);
	});
});
