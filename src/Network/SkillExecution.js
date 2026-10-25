const listeners = new Set();

/** Feedback for the local player's skill requests; never other actors' casts. */
export function reportSkillExecution(id, phase, delay = 0) {
	for (const listener of listeners) listener({ id, phase, delay });
}

export function subscribeSkillExecution(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
