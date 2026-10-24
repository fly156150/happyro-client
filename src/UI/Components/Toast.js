import Platform from 'UI/Platform.js';
import Interface from 'Preferences/Interface.js';
import css from './Toast.css?raw';
import desktopCSS from './ToastDesktop.css?raw';

let active;

function ownerOf(container) {
	return container?.closest('.game-tools-window, .panel-body') || container;
}

function visible(container) {
	for (let node = container; node; node = node.parentElement || node.getRootNode().host) {
		if (node.hidden || node.style?.display === 'none') return false;
	}
	return container?.isConnected;
}

/** One viewport-level notification shared by every UI, including shadow roots. */
export function showToast(container, message, kind = 'success') {
	// Pending requests keep their control locks without transient notifications.
	if (kind === 'pending' || !message || !visible(container)) return;
	active?.dismiss();
	const owner = ownerOf(container);
	const element = document.createElement('div');
	element.className = `ui-toast ${kind}`;
	element.setAttribute('role', 'status');
	element.setAttribute('aria-live', 'polite');
	element.textContent = message;
	const shadow = element.attachShadow({ mode: 'open' });
	const style = document.createElement('style');
	const desktopTheme = !Platform.isMobile;
	element.toggleAttribute('data-tablet', !desktopTheme && Math.min(screen.width, screen.height) >= 600 && matchMedia('(any-pointer: coarse)').matches);
	style.textContent = desktopTheme ? desktopCSS : css;
	const content = document.createElement('span');
	content.className = 'message';
	content.append(document.createElement('slot'));
	const dismiss = () => {
		clearTimeout(record.timer);
		record.observer.disconnect();
		element.remove();
		if (active === record) active = null;
	};
	shadow.append(style, content);
	const observer = new MutationObserver(() => {
		if (!visible(owner) || !element.isConnected) dismiss();
	});
	const record = { owner, dismiss, observer, timer: setTimeout(dismiss, Interface.toastDuration * 1000) };
	active = record;
	document.body.append(element);
	const options = { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style'] };
	observer.observe(document.body, options);
	const root = owner.getRootNode();
	if (root instanceof ShadowRoot) observer.observe(root, options);
}

export function clearToast(container) {
	if (active?.owner === ownerOf(container)) active.dismiss();
}
