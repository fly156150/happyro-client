/** Keep viewport-level notifications below the actual portrait HUD, including safe-area padding. */
export function bindHUDNotificationInset(root) {
	const host = root.host;
	const panels = [...root.querySelectorAll('.top-left, .map')];
	const property = '--mobile-notification-top';
	const itemProperty = '--mobile-item-notification-top';
	const update = () => {
		if (host.dataset.orientation !== 'portrait' || !host.isConnected) {
			document.body.style.removeProperty(property);
			document.body.style.removeProperty(itemProperty);
			return;
		}
		const bottom = Math.max(0, ...panels.map(panel => panel.getBoundingClientRect().bottom));
		const top = Math.ceil(bottom) + 12;
		document.body.style.setProperty(property, `${top}px`);
		document.body.style.setProperty(itemProperty, `${Math.max(top, Math.round((top + 32) * 0.9))}px`);
	};
	const size = new ResizeObserver(update);
	for (const panel of panels) size.observe(panel);
	const orientation = new MutationObserver(update);
	orientation.observe(host, { attributes: true, attributeFilter: ['data-orientation', 'style'] });
	update();
	return () => {
		size.disconnect();
		orientation.disconnect();
		document.body.style.removeProperty(property);
		document.body.style.removeProperty(itemProperty);
	};
}
