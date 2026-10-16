import { expect, it, vi } from 'vitest';
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('Utils/Texture.js', () => ({ default: { load: vi.fn((buffer, callback) => callback.call({})) } }));
vi.mock('Utils/WebGL.js', () => ({ default: { createShaderProgram: () => ({ uniform: {}, attribute: {} }) } }));
vi.mock('Renderer/Camera.js', () => ({ default: { zoom: 1 } }));
vi.mock('Renderer/SpriteRenderer.js', () => ({ default: { runWithDepth: (a, b, c, run) => run() } }));
vi.mock('Core/Configs.js', () => ({ default: { get: () => false } }));
import Client from '../../src/Core/Client.js';
import WarlockSphere from '../../src/Renderer/Effects/WarlockSphere.js';

function context() {
	const gl = Object.fromEntries(['bindBuffer', 'bufferData', 'bindTexture', 'texImage2D', 'texParameteri',
		'deleteTexture', 'deleteProgram', 'deleteBuffer', 'blendFunc', 'uniform1f', 'uniform3fv', 'uniform4fv',
		'uniformMatrix4fv', 'drawArrays'].map(name => [name, vi.fn()]));
	gl.createBuffer = vi.fn(() => ({}));
	gl.createTexture = vi.fn(() => ({}));
	return gl;
}

it('uses the four server sphere elements and frees all their textures', () => {
	const gl = context();
	Client.loadFile.mockClear();
	WarlockSphere.init(gl);
	expect(Client.loadFile.mock.calls.map(([path]) => path)).toEqual([
		'data/texture/effect/fireorb.bmp', 'data/texture/effect/lightningorb.bmp',
		'data/texture/effect/waterorb.bmp', 'data/texture/effect/stoneorb.bmp'
	]);
	for (const [, loaded] of Client.loadFile.mock.calls) loaded(new ArrayBuffer(1));
	expect(WarlockSphere.ready).toBe(true);
	gl.bindTexture.mockClear();
	const sphere = new WarlockSphere({ position: [1, 2, 3] }, [68, 69, 70, 71]);
	sphere.render(gl, 0);
	expect(gl.drawArrays).toHaveBeenCalledTimes(4);
	expect(gl.bindTexture.mock.calls.map(([, texture]) => texture))
		.toEqual(gl.createTexture.mock.results.map(result => result.value).reverse());
	WarlockSphere.free(gl);
	expect(gl.deleteTexture).toHaveBeenCalledTimes(4);
	expect(WarlockSphere.ready).toBe(false);
});

it('ignores resource callbacks from a freed renderer', () => {
	const gl = context();
	Client.loadFile.mockClear();
	WarlockSphere.init(gl);
	WarlockSphere.free(gl);
	for (const [, loaded] of Client.loadFile.mock.calls) loaded(new ArrayBuffer(1));
	expect(gl.createTexture).not.toHaveBeenCalled();
	expect(WarlockSphere.ready).toBe(false);
});
