import reviewedTargets from 'DB/Navigation/NaviTargets.json';
import Platform from 'UI/Platform.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { naviTargetKey } from './NaviActionController.js';

export function createNpcNaviMapActions({ manifest, isMobile, loadMobileTools, loadDesktopTools }) {
	let generation = 0;
	function available(info) {
		const entry = manifest.entries[naviTargetKey(info)];
		return Boolean(entry?.kind === 'coordinate' && entry.mapName &&
			Number.isInteger(entry.x) && Number.isInteger(entry.y));
	}
	return {
		available,
		reset() { generation++; },
		async open(info, { label, isCurrent = () => true, onClose = () => {} } = {}) {
			if (!available(info) || !isCurrent()) return false;
			const request = ++generation;
			const current = () => request === generation && isCurrent();
			const entry = manifest.entries[naviTargetKey(info)];
			const target = {
				id: entry.mapName, mapName: entry.mapName, x: entry.x, y: entry.y,
				name: label || entry.mapName
			};
			try {
				const mobile = isMobile();
				const tools = await (mobile ? loadMobileTools() : loadDesktopTools());
				if (!current()) return false;
				const restore = () => { if (current()) onClose(); };
				if (mobile) tools.openMap(target, undefined, restore);
				else tools.showMap(target, restore);
				return true;
			} catch {
				return false;
			}
		}
	};
}

const service = createNpcNaviMapActions({
	manifest: reviewedTargets,
	isMobile: () => Platform.isMobile,
	loadMobileTools: () => import('UI/Mobile/game/AdventureTools.js').then(module => module.default),
	loadDesktopTools: () => import('UI/Components/GameTools/GameTools.js').then(module => module.default)
});
export const isNpcNaviAvailable = info => service.available(info);
export const openNpcNaviMap = (info, options) => service.open(info, options);
onConnectionEnd(() => service.reset());
