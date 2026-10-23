import { getClientDefaults } from 'Core/ClientDefaults.js';
import Session from 'Engine/SessionStorage.js';
import ItemType from 'DB/Items/ItemType.js';

export const pickupCategories = [
	['equipment', '装备'],
	['consumable', '消耗品'],
	['card', '卡片'],
	['other', '其它']
];
export const pickupDefaults = () => ({
	...getClientDefaults('pickup'),
	excluded: []
});
export function pickupCategory(type) {
	if ([ItemType.ARMOR, ItemType.WEAPON, ItemType.PETARMOR, ItemType.SHADOWGEAR].includes(type)) return 'equipment';
	if ([ItemType.HEALING, ItemType.USABLE, ItemType.DELAYCONSUME, ItemType.CASH].includes(type)) return 'consumable';
	if (type === ItemType.CARD) return 'card';
	return 'other';
}
export function validPickupSettings(value) {
	return Boolean(
		value &&
		typeof value.enabled === 'boolean' &&
		Number.isInteger(value.batchSeconds) &&
		value.batchSeconds >= 1 &&
		value.batchSeconds <= 30 &&
		Number.isInteger(value.range) &&
		value.range >= 1 &&
		value.range <= 15 &&
		Array.isArray(value.categories) &&
		value.categories.every(id => pickupCategories.some(([key]) => key === id)) &&
		Array.isArray(value.excluded) &&
		value.excluded.every(item => Number.isInteger(item.id) && item.id > 0 && typeof item.name === 'string')
	);
}
const key = () => `HappyRO.Pickup:${JSON.stringify([Session.ServerName, Session.AID, Session.GID])}`;
let cachedKey, cachedValue;
export function loadPickupSettings() {
	if (cachedKey === key() && cachedValue) return structuredClone(cachedValue);
	let value;
	try {
		value = JSON.parse(localStorage.getItem(key()));
	} catch {
		/* Unavailable browser storage uses defaults. */
	}
	if (value) value = { ...pickupDefaults(), ...value };
	cachedKey = key();
	cachedValue = validPickupSettings(value) ? value : pickupDefaults();
	return structuredClone(cachedValue);
}
export function savePickupSettings(value) {
	if (!validPickupSettings(value)) return false;
	try {
		localStorage.setItem(key(), JSON.stringify(value));
	} catch {
		return false;
	}
	cachedKey = key();
	cachedValue = structuredClone(value);
	window.dispatchEvent(new Event('happyro-pickup-settings'));
	return true;
}
