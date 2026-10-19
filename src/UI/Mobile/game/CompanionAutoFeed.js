import { createCompanionSwitch, updateCompanionSwitch } from './CompanionSwitch.js';

/** Auto-feed switches and status labels follow the server-confirmed value. */
export function createAutoFeedSwitch() {
	return createCompanionSwitch('自动喂食');
}

export function updateAutoFeedSwitch(input, { enabled, supported, allowed, pending }) {
	updateCompanionSwitch(input, {
		checked: enabled && supported,
		disabled: !supported || !allowed || pending,
		text: '自动喂食',
		title: !supported ? '不支持自动喂食' : enabled ? '自动喂食已开启' : '自动喂食已关闭'
	});
}

export function createAutoFeedStatus(enabled, supported) {
	const status = document.createElement('span');
	status.className = 'companion-autofeed-state';
	status.dataset.state = !supported ? 'unsupported' : enabled ? 'on' : 'off';
	status.textContent = !supported ? '不支持' : enabled ? '开启' : '关闭';
	return status;
}
