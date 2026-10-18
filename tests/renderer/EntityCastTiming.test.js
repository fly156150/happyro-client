import { afterEach, expect, it, vi } from 'vitest';
import initCast from '../../src/Renderer/Entity/EntityCast.js';

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

it.each([5000, 7000])('waits the full %i ms before acknowledging NPC progress', delay => {
	let now = 100000;
	vi.spyOn(Date, 'now').mockImplementation(() => now);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn() });
	const entity = {};
	initCast.call(entity);
	const complete = vi.fn();
	entity.cast.onComplete = complete;
	entity.cast.set(delay);
	for (const elapsed of [delay - 25, delay - 20, delay - 1]) {
		now = 100000 + elapsed;
		entity.cast.render(identity);
		expect(complete).not.toHaveBeenCalled();
		expect(entity.cast.display).toBe(true);
	}
	now = 100000 + delay;
	entity.cast.render(identity);
	expect(complete).toHaveBeenCalledTimes(1);
	expect(entity.cast.display).toBe(false);
	entity.cast.render(identity);
	expect(complete).toHaveBeenCalledTimes(1);
});
