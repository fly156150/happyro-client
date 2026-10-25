import { onConnectionEnd } from './ConnectionLifecycle.js';

/** Authoritative local-player effects, independent of icon availability and rendering. */
export function createPlayerStatuses(now = () => performance.now()) {
	const effects = new Map();
	return {
		update({ index, state, RemainMS, val }) {
			if (state === 0) {
				effects.delete(index);
				return;
			}
			const duration = Number(RemainMS);
			effects.set(index, {
				expiresAt: Number.isFinite(duration) && duration > 0 && duration !== 9999 ? now() + duration : Infinity,
				values: val ? [...val] : []
			});
		},
		has(index) {
			const effect = effects.get(index);
			if (!effect) return false;
			if (effect.expiresAt <= now()) {
				effects.delete(index);
				return false;
			}
			return true;
		},
		clear() {
			effects.clear();
		}
	};
}

export const playerStatuses = createPlayerStatuses();
onConnectionEnd(() => playerStatuses.clear());
