const listeners = new Set();
let current = '';
export function publishRecoveryStatus(status) {
	current = status;
	for (const listener of listeners) listener(current);
}
export function subscribeRecoveryStatus(listener) {
	listeners.add(listener);
	listener(current);
	return () => listeners.delete(listener);
}
