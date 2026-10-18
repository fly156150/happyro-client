import { expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ casEnabled: true, casContrast: 0, casSharpening: 0, vibranceEnabled: true, vibrance: 0 }));
vi.mock('Preferences/Graphics.js', () => ({ default: settings }));
vi.mock('Utils/WebGL.js', () => ({ default: { createShaderProgram: () => ({
 uniform: { uContrast: 'contrast', uSharpening: 'sharpening', uVibrance: 'vibrance' },
 attribute: { aPosition: 0 }
}) } }));
vi.mock('Renderer/Effects/PostProcess.js', () => ({ default: { beforeRenderPass: vi.fn(), afterRenderPass: vi.fn() } }));
import CAS from '../../src/Renderer/Effects/Shaders/CAS.js';
import Vibrance from '../../src/Renderer/Effects/Shaders/Vibrance.js';

it.each([[CAS, 'sharpening', 'casSharpening'], [Vibrance, 'vibrance', 'vibrance']])(
 'passes zero and nonzero preferences to the real shader adapter (%s)', (effect, uniform, key) => {
  const gl = { canvas: { width: 640, height: 480 } };
  for (const name of ['createBuffer', 'bindBuffer', 'bufferData', 'useProgram', 'uniform1f', 'uniform2f', 'uniform3f', 'enableVertexAttribArray', 'vertexAttribPointer', 'activeTexture', 'bindTexture', 'uniform1i', 'drawArrays', 'deleteBuffer']) gl[name] = vi.fn(() => ({}));
  effect.init(gl);
  for (const value of [0, 0.5]) {
   settings[key] = value;
   effect.render(gl, {}, null);
   expect(gl.uniform1f).toHaveBeenCalledWith(uniform, value);
  }
  effect.clean(gl);
 }
);
