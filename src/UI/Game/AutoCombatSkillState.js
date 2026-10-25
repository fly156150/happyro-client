/** Recovery policy uses the controller's monotonic clock; it has no I/O or timers. */
export const AUTO_COMBAT_SKILL_TIMING = Object.freeze({
	confirmation: 8000,
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
		begin(skillId, targetId, now) {
			pending = { id: skillId, target: targetId, deadline: now + timing.confirmation };
		},
		waiting: () => pending !== null,
		useNormalAttack: now => now < normalUntil,
		available: (skillId, targetId, now) => (failures.get(key(targetId, skillId)) || 0) <= now,
		suppress,
		feedback({ id, phase, delay = 0 }, targetId, now) {
			if (!pending || pending.target !== targetId || (phase !== 'cancelled' && pending.id !== id)) return null;
			if (phase === 'failed' || phase === 'cancelled') {
				suppress(pending.id, targetId, now);
				return 'failed';
			}
			if (phase === 'casting') pending.deadline = now + Math.max(0, delay) + timing.confirmation;
			else if (phase === 'executed') pending = null;
			return phase;
		},
		// True denotes one timeout transition; the controller performs stop/GUI effects.
		poll(targetId, now, approaching = false) {
			for (const [id, until] of failures) if (until <= now) failures.delete(id);
			if (pending?.target !== targetId) pending = null;
			if (pending && approaching) pending.deadline = now + timing.confirmation;
			if (!pending || now < pending.deadline) return false;
			suppress(pending.id, targetId, now);
			normalUntil = now + timing.normalAttack;
			return true;
		}
	};
}
