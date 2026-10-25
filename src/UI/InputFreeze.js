import Session from 'Engine/SessionStorage.js';

// Each modal/recovery flow releases only its own claim, in any closing order.
const owners = new Set();
const publish = () => { Session.FreezeUI = owners.size > 0; };
export function acquireInputFreeze(owner) {
	owners.add(owner);
	publish();
}
export function releaseInputFreeze(owner) {
	owners.delete(owner);
	publish();
}
export function isInputFrozenExcept(owner) {
	return [...owners].some(candidate => candidate !== owner);
}
