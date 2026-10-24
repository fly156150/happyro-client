// These scripts ask players to distinguish individual monster names, including decoys.
const maps = new Set(['in_moc_16', 'job_hunte', 'job3_rang02']);
export function isIdentificationExam(map) {
	return maps.has(String(map || '').replace(/\.gat$/i, '').toLowerCase());
}

// Keep object identity: a new monster can reuse an old GID after despawning.
export function createExamTargets({ enabled, get, focus, select, stop, attack }) {
	let candidates = [];
	const live = entity => Boolean(entity && get(entity.GID) === entity &&
		entity.objecttype === entity.constructor.TYPE_MOB && entity.remove_tick === 0 &&
		entity.action !== entity.ACTION.DIE);
	function clear() { candidates = []; }
	function choose(id) {
		const entity = candidates.find(entry => entry.GID === id);
		if (!enabled() || !live(entity)) return false;
		stop();
		select(entity);
		return true;
	}
	return {
		clear,
		choose,
		pick(entities) {
			clear();
			if (!enabled()) return false;
			candidates = entities.filter(live);
			if (!candidates.length) return false;
			choose(candidates[0].GID);
			return true;
		},
		attack() {
			const entity = focus();
			if (!enabled() || !live(entity) || !candidates.includes(entity) || !entity.serverMonsterName) return false;
			attack();
			return true;
		},
		snapshot() {
			if (!enabled()) clear();
			candidates = candidates.filter(live);
			const selected = candidates.includes(focus()) ? focus() : null;
			return {
				name: selected ? selected.serverMonsterName || '正在获取名称…' : '',
				canAttack: Boolean(selected?.serverMonsterName),
				candidates: candidates.map(entity => ({
					id: entity.GID, name: entity.serverMonsterName || '正在获取名称…',
					selected: entity === selected
				}))
			};
		}
	};
}
