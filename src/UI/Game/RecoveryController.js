/** Recovery policy is independent of target selection, movement and skill acknowledgements. */
export function createRecoveryController(data) {
	const recovering = { hp: false, sp: false };
	const failures = new Map();
	let pending = null,
		nextAt = 0,
		status = '',
		generation = 0;
	function reset() {
		generation++;
		recovering.hp = recovering.sp = false;
		pending = null;
		failures.clear();
		nextAt = 0;
		status = '';
	}
	function tick(settings, active) {
		if (!active) {
			reset();
			return;
		}
		const now = data.now(),
			life = data.life();
		const busy = data.busy(); // Poll item timeouts even when recovery has a pending request.
		for (const key of ['hp', 'sp']) {
			const value = life?.[key],
				max = life?.[`${key}_max`];
			if (!settings[key].enabled || !(max > 0) || !(value >= 0)) recovering[key] = false;
			else if ((value / max) * 100 >= settings[key].target) recovering[key] = false;
			else if ((value / max) * 100 < settings[key].trigger) recovering[key] = true;
		}
		if (!recovering.hp && !recovering.sp) { status = ''; return; }
		if (pending && now - pending.at >= 3000) {
			status = '使用道具结果未确认，自动恢复已暂停';
			return;
		}
		if (pending || now < nextAt || !data.allowed()) return;
		if (busy) {
			status = '等待物品使用结果';
			return;
		}
		status = '';
		const inventory = data.items();
		for (const key of ['hp', 'sp']) {
			if (!recovering[key]) continue;
			const row = settings[key];
			const candidates = row.items.flatMap(id =>
				inventory.filter(item => item.id === id && item.count > 0 && item[key])
			);
			const item = candidates.find(
				candidate => candidate.available !== false && (failures.get(candidate.id)?.until || 0) <= now
			);
			if (!item) {
				status ||= candidates.length ? '道具暂时无法使用' : `${key.toUpperCase()} 道具不足`;
				continue;
			}
			const request = { at: now, generation, item };
			pending = request;
			const accepted = data.use(item, result => {
				if (pending !== request || generation !== request.generation) return;
				pending = null;
				nextAt = data.now() + 800;
				if (result === 'timeout') {
					status = '使用道具结果未确认，已暂停使用该组道具';
				} else if (result === 'success') {
					failures.delete(item.id);
					status = '';
				} else {
					const count = (failures.get(item.id)?.count || 0) + 1;
					failures.set(item.id, {
						count,
						until: data.now() + Math.min(60000, 2000 * 2 ** Math.min(count, 5))
					});
					status = '道具暂时无法使用';
				}
			});
			if (!accepted && pending === request) {
				pending = null;
				failures.set(item.id, { count: 1, until: now + 3000 });
				nextAt = now + 800;
				status = '当前无法使用道具';
			}
			return;
		}
	}
	return { tick, reset, snapshot: () => ({ status, pending: Boolean(pending), recovering: { ...recovering } }) };
}
