import { getClientDefaults } from '../../Core/ClientDefaults.js';

export function defaultRecoverySettings() {
	const defaults = getClientDefaults('autoRecovery');
	return {
		hp: { enabled: false, ...defaults.hp, items: [] },
		sp: { enabled: false, ...defaults.sp, items: [] }
	};
}
export function validRecoverySettings(value) {
	return Boolean(
		value &&
		['hp', 'sp'].every(key => {
			const row = value[key];
			return (
				row &&
				typeof row.enabled === 'boolean' &&
				Number.isInteger(row.trigger) &&
				Number.isInteger(row.target) &&
				row.trigger >= 1 &&
				row.trigger < row.target &&
				row.target <= 100 &&
				Array.isArray(row.items) &&
				row.items.length <= 100 &&
				new Set(row.items).size === row.items.length &&
				row.items.every(id => Number.isInteger(id) && id > 0)
			);
		})
	);
}
