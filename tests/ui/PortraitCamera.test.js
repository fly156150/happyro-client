import { afterEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ isMobile: true, orientation: 'portrait' }));
vi.mock('UI/Platform.js', () => ({ default: platform }));
vi.mock('Core/Preferences.js', () => ({ default: { get: (_key, defaults) => defaults } }));
afterEach(() => { vi.unstubAllGlobals(); platform.isMobile = true; platform.orientation = 'portrait'; });
async function camera(width, height) {
 vi.resetModules(); vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height);
 return import('../../src/Preferences/Camera.js');
}
it('adds three phone portrait steps without accumulating across rotations or altering saved preferences', async () => {
 const { default: preferences, viewportCameraZoom } = await camera(390, 844);
 expect(viewportCameraZoom(preferences.zoom, 15, 325)).toBe(155);
 expect(preferences.zoom).toBe(110);
 platform.orientation = 'landscape'; expect(viewportCameraZoom(preferences.zoom, 15, 325)).toBe(110);
 platform.orientation = 'portrait'; expect(viewportCameraZoom(preferences.zoom, 15, 325)).toBe(155);
 expect(viewportCameraZoom(125, 15, 325)).toBe(170);
 expect(viewportCameraZoom(150, 15, 162.5)).toBe(162.5);
});
it('preserves tablet and desktop camera framing', async () => {
 let cameraModule = await camera(768, 1024);
 expect(cameraModule.viewportCameraZoom(140, 15, 325)).toBe(140);
 platform.isMobile = false; cameraModule = await camera(390, 844);
 expect(cameraModule.viewportCameraZoom(125, 15, 325)).toBe(125);
});
