import { createPlayerStatuses } from './PlayerStatuses.js';

/** Target-local authoritative effects: missing packets are unknown, not absent. */
export function createTargetStatuses(now) {
	const effects = createPlayerStatuses(now);
	const known = new Set();
	return {
		update(packet) {
			known.add(packet.index);
			effects.update(packet);
		},
		known: index => known.has(index),
		has: index => effects.has(index),
		values: index => effects.values(index)
	};
}
