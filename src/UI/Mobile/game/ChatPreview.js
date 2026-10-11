import Interface from 'Preferences/Interface.js';
import { chatChannelLabels, previewCategories, matchesPreviewCategory } from './ChatChannels.js';

/** HUD-only filtering; never changes the send channel or the full chat filter. */
export function createChatPreview(root) {
	const container = root.querySelector('.chat-preview');
	const log = container.querySelector('[data-chat-preview]');
	const tabs = container.querySelector('[data-chat-preview-tabs]');
	const abort = new AbortController();
	let messages = [],
		category = 'all',
		lastId = 0,
		privateUnread = false;
	let following = true,
		lastHeight = log.clientHeight;
	const resize = new ResizeObserver(() => {
		lastHeight = log.clientHeight;
		if (following) log.scrollTop = log.scrollHeight;
	});
	resize.observe(log);
	log.addEventListener(
		'scroll',
		() => {
			if (log.clientHeight === lastHeight) following = log.scrollHeight - log.clientHeight - log.scrollTop <= 4;
		},
		{ signal: abort.signal }
	);
	const buttons = new Map();
	function updateTabs() {
		for (const [key, button] of buttons) {
			button.setAttribute('aria-pressed', String(key === category));
			button.querySelector('b').hidden = key !== 'dialogue' || !privateUnread;
		}
	}
	function render(bottom = false) {
		const pinned =
			bottom ||
			(log.clientHeight !== lastHeight ? following : log.scrollHeight - log.clientHeight - log.scrollTop <= 4);
		following = pinned;
		const oldTop = log.scrollTop,
			bounds = log.getBoundingClientRect();
		const anchor = [...log.children].find(row => row.getBoundingClientRect().bottom > bounds.top);
		const anchorId = anchor?.dataset.id,
			anchorTop = anchor?.getBoundingClientRect().top;
		log.replaceChildren(
			...messages
				.filter(message => matchesPreviewCategory(message, category))
				.map(message => {
					const row = document.createElement('span');
					row.className = 'chat-preview-line';
					row.dataset.id = String(message.id);
					row.textContent = `[${chatChannelLabels[message.channel] || '系统'}] ${message.text.replace(/[\r\n]+/g, ' ')}`;
					return row;
				})
		);
		if (!log.children.length) log.textContent = '暂无消息';
		if (pinned) log.scrollTop = log.scrollHeight;
		else {
			log.scrollTop = oldTop;
			const next = [...log.children].find(row => row.dataset.id === anchorId);
			if (next) log.scrollTop += next.getBoundingClientRect().top - anchorTop;
		}
	}
	for (const [key, label] of Object.entries(previewCategories)) {
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.previewCategory = key;
		button.append(document.createTextNode(label));
		const dot = document.createElement('b');
		dot.hidden = true;
		dot.setAttribute('aria-label', '有新私聊');
		dot.textContent = '•';
		button.append(dot);
		button.addEventListener(
			'click',
			() => {
				category = key;
				if (key === 'all' || key === 'dialogue') privateUnread = false;
				updateTabs();
				render(true);
			},
			{ signal: abort.signal }
		);
		buttons.set(key, button);
		tabs.append(button);
	}
	function configure(settings) {
		for (const [scene, key] of [
			['compact', 'chatPreviewCompactLines'],
			['spacious', 'chatPreviewSpaciousLines']
		]) {
			if (settings[key]) container.style.setProperty(`--chat-preview-${scene}-lines`, settings[key]);
			else container.style.removeProperty(`--chat-preview-${scene}-lines`);
		}
		container.classList.toggle('without-tabs', !settings.chatPreviewTabs);
		tabs.hidden = !settings.chatPreviewTabs;
		if (!settings.chatPreviewTabs) {
			category = 'all';
			privateUnread = false;
			render(true);
		}
		updateTabs();
	}
	window.addEventListener('interface-settings-change', () => configure(Interface), { signal: abort.signal });
	configure(Interface);
	return {
		configure,
		update(next, { read = false } = {}) {
			if (!next.length) {
				lastId = 0;
				privateUnread = false;
			}
			if (
				next.some(message => message.id > lastId && message.channel === 'private') &&
				(category === 'battle' || category === 'system' || container.classList.contains('collapsed'))
			)
				privateUnread = true;
			if (read || (!container.classList.contains('collapsed') && (category === 'all' || category === 'dialogue')))
				privateUnread = false;
			lastId = next.at(-1)?.id || 0;
			messages = next;
			updateTabs();
			render();
		},
		destroy() {
			abort.abort();
			resize.disconnect();
		}
	};
}
