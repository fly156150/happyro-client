import { naviTargetKey } from './NaviActionController.js';
import manifest from 'DB/Navigation/NaviTargets.json';
import Platform from 'UI/Platform.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { showToast } from 'UI/Components/Toast.js';
import { beginNavigationVisit, abandonNavigationVisit, suspendNavigationSource } from 'UI/Game/NavigationVisit.js';
import { createNaviContentActions } from './NaviContentActions.js';

const service = createNaviContentActions({
	manifest, mobile: () => Platform.isMobile,
	loadTools: () => Platform.isMobile
		? import('UI/Mobile/game/AdventureTools.js').then(module => module.default)
		: import('UI/Components/GameTools/GameTools.js').then(module => module.default),
	suspend: suspendNavigationSource, beginVisit: beginNavigationVisit,
	failed: () => showToast(document.body, '无法打开目标资料，请稍后重试。', 'error')
});
export const isNaviAvailable = info => service.available(info);
export const getNaviTarget = info => service.available(info) ? manifest.entries[naviTargetKey(info)] : null;
export const activateNavi = (info, label, source) => service.activate(info, label, source);
export function prepareNaviLinks(root) {
	for (const link of root.querySelectorAll('[data-navi-info]')) {
		const available = isNaviAvailable(link.dataset.naviInfo);
		link.classList.toggle('navi-link', available);
		if (available) { link.setAttribute('role', 'button'); link.tabIndex = 0; }
		else { link.removeAttribute('role'); link.removeAttribute('tabindex'); }
	}
}
export function handleNaviClick(event, activate = activateNavi) {
	const link = event.target?.closest?.('[data-navi-info]');
	if (!link || event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return false;
	event.preventDefault(); event.stopPropagation();
	if (isNaviAvailable(link.dataset.naviInfo)) void activate(link.dataset.naviInfo, link.dataset.naviName || link.textContent, link);
	return true;
}
onConnectionEnd(() => { service.reset(); abandonNavigationVisit(); });
