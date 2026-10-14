/** Classify available layout space, never the device name or the keyboard height. */
export const MENU_BREAKPOINT = { width: 768, height: 560 };
export function menuDensity(width, height) {
	return width >= MENU_BREAKPOINT.width && height >= MENU_BREAKPOINT.height ? 'spacious' : 'compact';
}
export function updateMenuLayout(host, width, height) {
	// Physical screen size keeps narrow tablet windows and keyboards out of phone-only rules.
	host.toggleAttribute('data-phone-screen', Math.min(screen.width, screen.height) < 600);
	host.dataset.menuDensity = menuDensity(width, height);
	host.dataset.orientation = width < height ? 'portrait' : 'landscape';
}
