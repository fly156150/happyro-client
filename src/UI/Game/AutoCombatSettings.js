import { defaultRecoverySettings, validRecoverySettings } from './RecoverySettings.js';
import { AUTO_COMBAT_RANGE_LIMITS, validAutoCombatTeleport } from './AutoCombatController.js';

/** Only preferences are persisted, never an active battle or a temporary target. */
export function loadAutoCombatSettings(key) {
	try {
		const saved = JSON.parse(localStorage.getItem(key));
		const limits = AUTO_COMBAT_RANGE_LIMITS;
		if (!saved || !Array.isArray(saved.species) || !Array.isArray(saved.skills) || !saved.ranges) return;
		if (
			!saved.species.every(
				entry => entry && Number.isInteger(entry.id) && entry.id > 0 && typeof entry.name === 'string'
			)
		)
			return;
		if (!saved.skills.every(id => Number.isInteger(id) && id > 0)) return;
		const { search, activity } = saved.ranges;
		if (
			!Number.isInteger(search) ||
			!Number.isInteger(activity) ||
			search < limits.min ||
			search > limits.searchMax ||
			activity < search ||
			activity > limits.activityMax
		)
			return;
		if (saved.teleport !== undefined && !validAutoCombatTeleport(saved.teleport)) return;
		if (saved.recovery !== undefined && !validRecoverySettings(saved.recovery)) return;
		return {
			recovery: saved.recovery || defaultRecoverySettings(),
			species: saved.species,
			skills: saved.skills,
			ranges: { search, activity },
			...(saved.teleport ? { teleport: saved.teleport } : {})
		};
	} catch {
		// A missing or unreadable preference must not block entering the map.
		return;
	}
}

export function saveAutoCombatSettings(key, settings) {
	try {
		localStorage.setItem(key, JSON.stringify(settings));
		return true;
	} catch {
		return false;
	}
}
