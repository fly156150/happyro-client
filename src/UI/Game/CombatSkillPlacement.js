import { levelValue } from './CombatSkillCapabilities.js';
export const cellDistance = (a, b) => Math.max(Math.abs((a[0] | 0) - (b[0] | 0)), Math.abs((a[1] | 0) - (b[1] | 0)));
/** Avoid the whole server NoFootSet exclusion area, not just the occupied cell. */
export function trapPosition(entry, level, target, player, occupied, walkable) {
	const clearance = levelValue(entry.unitRange, level, 'Size') + levelValue(entry.unitLayout, level, 'Size');
	const distance = Math.max(1, clearance + 1),
		candidates = [];
	for (let x = -distance; x <= distance; x++)
		for (let y = -distance; y <= distance; y++) {
			if (Math.max(Math.abs(x), Math.abs(y)) !== distance) continue;
			const position = [(target[0] | 0) + x, (target[1] | 0) + y];
			if (walkable(position) && !occupied.some(cell => cellDistance(cell, position) <= clearance))
				candidates.push(position);
		}
	return candidates.sort((a, b) => cellDistance(a, player) - cellDistance(b, player))[0] || null;
}
