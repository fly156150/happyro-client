/** Prefer an accessible actor, then an illustrated actor, over hidden triggers. */
export function buildNpcInstanceNames(entries) {
	const selected = new Map();
	const rank = entry => (entry.game_visible ? 2 : entry.display_sprite_id != null ? 1 : 0);
	for (const entry of entries) {
		if (!/[\u3400-\u9fff]/.test(entry.display_name)) continue;
		const key = `${entry.map}:${entry.x}:${entry.y}`;
		const previous = selected.get(key);
		if (!previous || rank(entry) > rank(previous)) selected.set(key, entry);
	}
	return Object.fromEntries([...selected].map(([key, entry]) => [key, {
		name: entry.display_name,
		sourceName: entry.source_name
	}]));
}
