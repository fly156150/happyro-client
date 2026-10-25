/** Lazy UI loading must not reopen an obsolete target after a newer click or logout. */
export function createNaviPresentations({
	isMobile,
	loadMobileTools,
	loadDesktopTools,
	loadNavigation,
	present,
	dismiss = () => {}
}) {
	async function open(kind, target, isCurrent) {
		if (!isCurrent()) return;
		try {
			if (isMobile()) {
				const tools = await loadMobileTools();
				if (!isCurrent()) return;
				dismiss();
				if (kind === 'monster') tools.openMonster(target);
				else tools.openMap(target);
			} else if (kind === 'monster') {
				const tools = await loadDesktopTools();
				if (isCurrent()) {
					dismiss();
					tools.showMonster(target);
				}
			} else {
				const navigation = await loadNavigation();
				if (!isCurrent()) return;
				dismiss();
				navigation.show();
				navigation.setNaviInfo(`${target.mapName},${target.x},${target.y}`, target.name);
			}
		} catch {
			if (isCurrent()) present({ title: '导航目标', message: '无法打开目标资料，请稍后再试。' });
		}
	}
	return {
		openMonster: (id, isCurrent) => open('monster', id, isCurrent),
		openMap: (target, isCurrent) => open('map', target, isCurrent)
	};
}
