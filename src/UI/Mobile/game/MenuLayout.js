/** Classify available layout space, never the device name or the keyboard height. */
export const MENU_BREAKPOINT = { width: 768, height: 560 };
export function menuDensity(width, height) {
	return width >= MENU_BREAKPOINT.width && height >= MENU_BREAKPOINT.height ? 'spacious' : 'compact';
}
export function updateMenuLayout(host, width, height) {
	// Physical screen size keeps narrow tablet windows and keyboards out of phone-only rules.
	const phone = Math.min(screen.width, screen.height) < 600;
	host.toggleAttribute('data-phone-screen', phone);
	host.dataset.menuDensity = phone ? menuDensity(width, height) : 'spacious';
	host.dataset.orientation = width < height ? 'portrait' : 'landscape';
	// Tablets keep the same workspace in both orientations; only phones stack panes.
	host.dataset.menuArrangement = phone && width < height ? 'stacked' : 'wide';
}
