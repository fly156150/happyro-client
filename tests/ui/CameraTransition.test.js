import { expect, it, vi } from 'vitest';

const viewport = vi.hoisted(() => ({ portrait: false }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: {} }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.mock('Core/Events.js', () => ({ default: {} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('Core/Configs.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: { isIndoor: () => false } }));
vi.mock('Preferences/Camera.js', () => ({
	default: { zoom: 110, smooth: false },
	DEFAULT_CAMERA_ZOOM: 110,
	viewportCameraZoom: zoom => zoom + (viewport.portrait ? 45 : 0)
}));
import Camera from '../../src/Renderer/Camera.js';

it.each([16, 100, 250])('restores landscape distance without overshoot with %i ms frames', frame => {
	Camera.target = { position: [0, 0, 0] };
	Camera.zoom = Camera.zoomFinal = 110;
	Camera.lastTick = 0;
	let tick = 0;
	for (const portrait of [true, false, true, false]) {
		viewport.portrait = portrait;
		const target = portrait ? 155 : 110;
		for (let i = 0; i < 100; i++) {
			const before = Camera.zoom;
			Camera.update(tick += frame);
			expect(Camera.zoom).toBeGreaterThanOrEqual(Math.min(before, target));
			expect(Camera.zoom).toBeLessThanOrEqual(Math.max(before, target));
		}
		expect(Camera.zoom).toBeCloseTo(target, 5);
		expect(Camera.zoomFinal).toBe(110);
	}
});
