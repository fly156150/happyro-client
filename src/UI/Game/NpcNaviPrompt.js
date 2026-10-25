import { isNpcNaviAvailable, openNpcNaviMap } from 'UI/Components/Navigation/NpcNaviService.js';
import { showToast } from 'UI/Components/Toast.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';

export function createNpcNaviPrompt({ available, open, dialogueActive, notify }) {
	let target = null, timer = null, pending = false, version = 0;
	const listeners = new Set();
	const snapshot = () => ({ ready: Boolean(target && !dialogueActive()), pending });
	let last = '';
	function publish() {
		const state = snapshot(), key = JSON.stringify(state);
		if (key === last) return;
		last = key;
		for (const listener of listeners) listener(state);
	}
	function clear() {
		version++; target = null; pending = false;
		clearInterval(timer); timer = null; publish();
	}
	return {
		show(info, { label } = {}) {
			if (!available(info, label)) return false;
			version++; target = { info, label }; pending = false;
			if (!timer) timer = setInterval(publish, 100);
			publish(); notify('已加入导航，结束对话后可传送。');
			return true;
		},
		async open() {
			if (!target || pending || dialogueActive()) return false;
			const request = version, selected = target;
			pending = true; publish();
			const isCurrent = () => request === version && !dialogueActive();
			let opened = false;
			try { opened = await open(selected.info, { label: selected.label, isCurrent }); } catch { /* Allow explicit retry. */ }
			if (request !== version) return false;
			pending = false;
			if (opened && isCurrent()) clear();
			else { publish(); if (!dialogueActive()) notify('地图打开失败，请重试。'); }
			return opened;
		},
		clear, snapshot,
		subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); }
	};
}
const adapters = { dialogueActive: () => true };
export const configureNpcNaviPrompt = options => Object.assign(adapters, options);
const service = createNpcNaviPrompt({
	available: isNpcNaviAvailable, open: openNpcNaviMap,
	dialogueActive: () => adapters.dialogueActive(),
	notify: message => showToast(document.body, message, 'info')
});
export const showNpcNaviPrompt = (info, options) => service.show(info, options);
onConnectionEnd(service.clear);

/** Independent navigation actions share the HUD action-button styling. */
export function bindNpcNaviControls(container) {
	const controls = document.createElement('div');
	controls.className = 'battle-tools context-actions npc-navi-controls';
	controls.innerHTML = '<button type="button" class="surface" data-navi-open>打开地图</button><button type="button" class="surface" data-navi-cancel>取消</button>';
	container.append(controls);
	const open = controls.querySelector('[data-navi-open]');
	let enabled = true, state = service.snapshot();
	const render = () => {
		const visible = enabled && state.ready;
		controls.hidden = !visible;
		open.disabled = state.pending;
	};
	controls.addEventListener('pointerdown', event => event.stopPropagation());
	controls.addEventListener('keydown', event => event.stopPropagation());
	controls.addEventListener('click', event => event.stopPropagation());
	open.onclick = () => { void service.open(); };
	controls.querySelector('[data-navi-cancel]').onclick = () => service.clear();
	const unsubscribe = service.subscribe(next => { state = next; render(); });
	return {
		update(allowed = true) { enabled = allowed; render(); },
		destroy() { unsubscribe(); controls.remove(); }
	};
}
