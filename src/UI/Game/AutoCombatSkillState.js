/** One in-flight skill request. The request owns its target, not the current monster. */
export const AUTO_COMBAT_SKILL_TIMING = Object.freeze({
	confirmation: 8000,
	effectConfirmation: 1500,
	backoff: 10000,
	normalAttack: 3000,
	retry: 200
});

export function createAutoCombatSkillState() {
	const timing = AUTO_COMBAT_SKILL_TIMING;
	const failures = new Map();
	let pending = null,
		normalUntil = 0;
	const key = (targetId, skillId) => `${targetId}:${skillId}`;
	function suppress(skillId, targetId, now) {
		failures.set(key(targetId, skillId), now + timing.backoff);
		pending = null;
	}
	return {
		reset() {
			pending = null;
			normalUntil = 0;
			failures.clear();
		},
		clearPending() {
			pending = null;
		},
		begin(id, target, now, { kind = 'attack', effect } = {}) {
			pending = { id, target, kind, effect, executed: false, deadline: now + timing.confirmation };
		},
		waiting: () => pending !== null,
		maintaining: () => pending?.kind === 'buff',
		useNormalAttack: now => now < normalUntil,
		available: (id, target, now) => (failures.get(key(target, id)) || 0) <= now,
		suppress,
		feedback({ id, phase, delay = 0 }, now) {
			if (!pending || (phase !== 'cancelled' && pending.id !== id)) return null;
			if (phase === 'failed' || phase === 'cancelled') {
				suppress(pending.id, pending.target, now);
				return 'failed';
			}
			if (phase === 'casting') pending.deadline = now + Math.max(0, delay) + timing.confirmation;
			else if (phase === 'executed') {
				if (pending.kind === 'buff') {
					// Multiple party-animation packets must not extend this deadline forever.
					if (!pending.executed) pending.deadline = now + timing.effectConfirmation;
					pending.executed = true;
				} else pending = null;
			}
			return phase;
		},
		poll(targetId, now, approaching = false, hasStatus = () => false) {
			for (const [id, until] of failures) if (until <= now) failures.delete(id);
			if (pending?.kind === 'attack' && pending.target !== targetId) pending = null;
			if (pending?.kind === 'buff' && pending.executed && hasStatus(pending.effect)) pending = null;
			if (pending?.kind === 'attack' && approaching) pending.deadline = now + timing.confirmation;
			if (!pending || now < pending.deadline) return false;
			const attack = pending.kind === 'attack';
			suppress(pending.id, pending.target, now);
			if (attack) normalUntil = now + timing.normalAttack;
			return true;
		}
	};
}
