import { onConnectionEnd } from './ConnectionLifecycle.js';

/** Serialize item requests; ambiguous stacks stay quarantined until their late reply or disconnect. */
export function createItemUseExecution(now = () => performance.now()) {
	let pending = null,
		nextAt = 0;
	const uncertain = new Map();
	const cooldowns = new Map();
	function poll() {
		if (pending && now() - pending.at >= 3000) {
			const request = pending;
			pending = null;
			uncertain.set(request.index, request);
			request.complete('timeout');
		}
	}
	return {
		busy(automatic = false) {
			poll();
			return Boolean(pending) || (automatic && now() < nextAt);
		},
		canUse(index, group) {
			poll();
			return !uncertain.has(index) && now() >= (cooldowns.get(group) || 0);
		},
		request(entity, index, id, send, complete = () => {}, options = {}) {
			poll();
			if (pending || uncertain.has(index) || (options.automatic && (now() < nextAt || now() < (cooldowns.get(options.cooldownGroup) || 0)))) return false;
			pending = { entity, index, id, complete, options, at: now() };
			try {
				send();
			} catch {
				pending = null;
				return false;
			}
			return true;
		},
		receive(entity, packet) {
			const quarantined = uncertain.get(packet.index);
			const request = quarantined || pending;
			if (
				!request ||
				request.entity !== entity ||
				request.index !== packet.index ||
				(packet.id && packet.id !== request.id)
			)
				return;
			if (Number(packet.result) === 1 && request.options.cooldownMs > 0) cooldowns.set(request.options.cooldownGroup, now() + request.options.cooldownMs);
			if (quarantined) {
				uncertain.delete(packet.index);
				return;
			}
			pending = null;
			nextAt = now() + 800;
			request.complete(Number(packet.result) === 1 ? 'success' : 'failed');
		},
		reset() {
			pending = null;
			nextAt = 0;
			uncertain.clear();
			cooldowns.clear();
		}
	};
}
export const itemUseExecution = createItemUseExecution();
onConnectionEnd(() => itemUseExecution.reset());
