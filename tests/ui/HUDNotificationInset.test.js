import { afterEach, expect, it, vi } from 'vitest';
import { bindHUDNotificationInset } from '../../src/UI/Mobile/game/HUDNotificationInset.js';

afterEach(() => {
	vi.unstubAllGlobals();
	document.body.replaceChildren();
	document.body.style.removeProperty('--mobile-notification-top');
});

it('tracks portrait HUD bounds and clears the offset on rotation and removal', async () => {
	let resize;
	const disconnect = vi.fn();
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback) { resize = callback; }
		observe() {}
		disconnect = disconnect;
	});
	const host = document.createElement('div');
	const root = host.attachShadow({mode: 'open'});
	root.innerHTML = '<div class="top-left"></div><div class="top-right"><button class="map"></button><div class="status-effects"></div></div>';
	document.body.append(host);
	let bottom = 150;
	root.querySelector('.top-left').getBoundingClientRect = () => ({bottom: 120});
	root.querySelector('.top-right').getBoundingClientRect = () => ({bottom: 600});
	root.querySelector('.map').getBoundingClientRect = () => ({bottom});
	host.dataset.orientation = 'portrait';
	const release = bindHUDNotificationInset(root);
	const top = () => document.body.style.getPropertyValue('--mobile-notification-top');
	expect(top()).toBe('162px');
	expect(document.body.style.getPropertyValue('--mobile-item-notification-top')).toBe('175px');
	bottom = 220; resize(); expect(top()).toBe('232px');
	host.dataset.orientation = 'landscape'; await Promise.resolve(); expect(top()).toBe('');
	host.dataset.orientation = 'portrait'; await Promise.resolve(); expect(top()).toBe('232px');
	release(); expect(top()).toBe(''); expect(disconnect).toHaveBeenCalledOnce();
	expect(document.body.style.getPropertyValue('--mobile-item-notification-top')).toBe('');
});
