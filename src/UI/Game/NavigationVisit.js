import UIManager from 'UI/UIManager.js';

/** One source window may wait for a map/catalog visit; travel permanently releases it. */
let active = null;
export function beginNavigationVisit(source) {
	active?.discard();
	let ended = false;
	const visit = {
		close() {
			if (ended) return;
			ended = true;
			if (active === visit) active = null;
			source?.restore();
		},
		discard() {
			if (ended) return;
			ended = true;
			if (active === visit) active = null;
			source?.discard();
		}
	};
	active = visit;
	return visit;
}
export function abandonNavigationVisit() { active?.discard(); }

/** An explicit new map owner replaces the previous source; plain reopening retains it. */
export function replaceNavigationClose(current, next) {
	if (next == null) return current;
	if (active && active.close === current && next !== current) active.discard();
	return next;
}

/** Mobile panels supply their modal owner; desktop windows retain their existing DOM. */
export function suspendNavigationSource(node) {
	if (!node) return null;
	if (!node.isConnected) return false;
	for (let element = node; element; element = element.parentElement || element.getRootNode().host) {
		const style = getComputedStyle(element);
		if (element.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
	}
	const request = { suspend: null, blocked: false };
	node.dispatchEvent(new CustomEvent('navi-source-suspend', { bubbles: true, composed: true, detail: request }));
	if (request.blocked) return false;
	if (request.suspend) return request.suspend();
	const host = node.getRootNode().host;
	if (!host || !/^(ItemInfo|ItemCompare|Quest|SkillDescription|Achievement)/.test(host.id)) return null;
	const hosts = /^Item/.test(host.id)
		? [document.getElementById('ItemInfo'), document.getElementById('ItemCompare')]
		: [host];
	const hidden = hosts.filter(element => element?.isConnected && element.style.display !== 'none')
		.map(element => ({ element, display: element.style.display, valid: true, release: null }));
	for (const entry of hidden) {
		const { element, display } = entry;
		entry.release = () => {
			if (!entry.valid) return;
			entry.valid = false;
			element.removeEventListener('x_append', entry.release);
			element.removeEventListener('x_remove', entry.release);
			if (element.style.display === 'none') element.style.display = display;
		};
		element.addEventListener('x_append', entry.release);
		element.addEventListener('x_remove', entry.release);
		element.style.display = 'none';
	}
	return {
		restore() { for (const entry of hidden) entry.release(); },
		discard() {
			for (const entry of hidden) {
				if (!entry.valid) continue;
				const stillSuspended = entry.element.style.display === 'none';
				entry.release();
				if (!stillSuspended) continue;
				const component = UIManager.components[entry.element.id];
				if (component?._host === entry.element) component.remove();
			}
		}
	};
}
