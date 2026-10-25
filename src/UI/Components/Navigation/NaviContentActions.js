import { naviTargetKey } from './NaviActionController.js';

export function createNaviContentActions({ manifest, loadTools, mobile, suspend, beginVisit, failed }) {
	let generation = 0;
	const entryFor = info => manifest.entries[naviTargetKey(info)];
	const available = info => {
		const entry = entryFor(info);
		return Boolean(entry && (entry.kind === 'monster' && Number.isInteger(entry.monsterId) && entry.monsterId > 0 ||
			entry.kind === 'coordinate' && entry.mapName && Number.isInteger(entry.x) && Number.isInteger(entry.y)));
	};
	return {
		available,
		reset() { generation++; },
		async activate(info, label, source) {
			if (!available(info)) return false;
			const request = ++generation, entry = entryFor(info);
			let visit;
			try {
				const tools = await loadTools();
				if (request !== generation || source && !source.isConnected) return false;
				const suspended = suspend(source);
				if (suspended === false) return false;
				visit = beginVisit(suspended);
				if (entry.kind === 'monster') {
					if (mobile()) tools.openMonster(entry.monsterId, visit.close);
					else tools.showMonster(entry.monsterId, visit.close);
				} else {
					const target = { id: entry.mapName, mapName: entry.mapName, x: entry.x, y: entry.y, name: label || entry.mapName };
					if (mobile()) tools.openMap(target, undefined, visit.close);
					else tools.showMap(target, visit.close);
				}
				return true;
			} catch {
				visit?.close();
				if (request === generation) failed();
				return false;
			}
		}
	};
}
