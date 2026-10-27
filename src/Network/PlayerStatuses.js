import { onConnectionEnd } from './ConnectionLifecycle.js';

/** Authoritative local-player effects, independent of icon availability and rendering. */
export function createPlayerStatuses(now = () => performance.now()) {
	const effects = new Map();
	let revision = 0;
	return {
		update({ index, state, RemainMS, val }) {
			revision++;
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
				revision++;
				return false;
			}
			return true;
		},
		values(index) {
			return this.has(index) ? effects.get(index).values : undefined;
		},
		get revision() {
			for (const index of effects.keys()) this.has(index);
			return revision;
		},
		clear() {
			revision++;
			effects.clear();
		}
	};
}

export const playerStatuses = createPlayerStatuses();
onConnectionEnd(() => playerStatuses.clear());
