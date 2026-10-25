import { COMBAT_EXECUTION_IDS, executionDrainMs } from './CombatSkillCapabilities.js';
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
	const retired = new Map();
	const settling = new Map();
	let clock = 0;
	const retire = () => {
		if (pending)
			retired.set(pending.id, {
				target: pending.target,
				until: Math.max(clock, pending.deadline) + timing.backoff
			});
		pending = null;
	};
	let pending = null,
		normalUntil = 0;
	const key = (targetId, skillId) => `${targetId}:${skillId}`;
	function suppress(skillId, targetId, now) {
		failures.set(key(targetId, skillId), now + timing.backoff);
		pending = null;
	}
	return {
		reset() {
			retire();
			normalUntil = 0;
			failures.clear();
		},
		clearPending() {
			retire();
		},
		begin(
			id,
			target,
			now,
			{ kind = 'attack', effect, wireTarget = target, position, area = false, level = 1 } = {}
		) {
			clock = now;
			pending = {
				id,
				target,
				kind,
				effect,
				wireTarget,
				position,
				area,
				level,
				executed: false,
				deadline: now + timing.confirmation
			};
		},
		waiting: () => pending !== null,
		maintaining: () => pending?.kind === 'buff',
		useNormalAttack: now => now < normalUntil,
		available: (id, target, now) =>
			Math.max(
				failures.get(key(target, id)) || 0,
				failures.get(key('*', id)) || 0,
				settling.get(id) || 0,
				retired.get(id)?.target === target ? retired.get(id).until : 0
			) <= now,
		suppress,
		feedback({ id, phase, delay = 0, target, position, unscoped = false }, now) {
			clock = now;
			for (const [skillId, value] of retired) if (value.until <= now) retired.delete(skillId);
			// DISPEL has no request or skill identity: it must never cancel a newer request.
			if (
				!pending ||
				(phase === 'cancelled' && retired.size > 0) ||
				(phase !== 'cancelled' &&
					pending.id !== id &&
					!(phase === 'executed' && COMBAT_EXECUTION_IDS[pending.id]?.includes(id)))
			)
				return null;
			if (target && target !== pending.wireTarget && !(pending.area && target === pending.target)) return null;
			if (pending.position && position && pending.position.some((value, index) => value !== position[index]))
				return null;
			if (unscoped && retired.has(id)) return null;
			if (phase === 'failed' || phase === 'cancelled') {
				suppress(pending.id, unscoped ? '*' : pending.target, now);
				return 'failed';
			}
			if (phase === 'casting') pending.deadline = now + Math.max(0, delay) + timing.confirmation;
			else if (phase === 'executed') {
				if (pending.kind === 'buff') {
					// Multiple party-animation packets must not extend this deadline forever.
					if (!pending.executed) pending.deadline = now + timing.effectConfirmation;
					pending.executed = true;
				} else {
					// Chain lightning can bounce for (3 + level) * 650 ms after its first hit.
					// Keep the parent out of the pool until its delayed children have drained.
					const drain = executionDrainMs(pending.id, pending.level);
					if (drain) settling.set(pending.id, now + drain);
					pending = null;
				}
			}
			return phase;
		},
		poll(targetId, now, approaching = false, hasStatus = () => false) {
			clock = now;
			for (const [id, until] of settling) if (until <= now) settling.delete(id);
			for (const [id, value] of retired) if (value.until <= now) retired.delete(id);
			for (const [id, until] of failures) if (until <= now) failures.delete(id);
			if (pending && pending.kind !== 'buff' && pending.target !== targetId) retire();
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
