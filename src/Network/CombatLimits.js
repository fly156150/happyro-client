import { onConnectionEnd } from './ConnectionLifecycle.js';

let searchLimit = null;
const listeners = new Set();
export function getCombatSearchLimit() { return searchLimit; }
export function onCombatLimitsChange(listener) {
 listeners.add(listener);
 return () => listeners.delete(listener);
}
export function updateCombatLimits({ searchRadius }) {
 const next = Number.isInteger(searchRadius) && searchRadius >= 1 ? Math.min(50, searchRadius) : null;
 if (next === searchLimit) return;
 searchLimit = next;
 for (const listener of listeners) listener(searchLimit);
}
onConnectionEnd(() => updateCombatLimits({ searchRadius: null }));
