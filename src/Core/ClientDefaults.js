import Configs from './Configs.js';
import schema from './ClientDefaults.schema.json';

/** Fresh values for initialization and reset; saved preferences must never mutate the deployment defaults. */
export function getClientDefaults(section) {
	const result = {};
	const configured = Configs.get('clientDefaults', {});
	for (const field of Object.values(schema.fields)) {
		const [group, ...keys] = field.path.split('.');
		if (group !== section) continue;
		let value = configured?.[group];
		for (const key of keys) value = value?.[key];
		value = value === undefined ? field.default : value;
		let target = result;
		for (const key of keys.slice(0, -1)) target = target[key] ??= {};
		target[keys.at(-1)] = structuredClone(value);
	}
	return result;
}
