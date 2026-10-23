import { clearToast } from 'UI/Components/Toast.js';
import { trackTabView } from 'UI/Components/GameTools/TabViewState.js';

const labels = { maps: '地图', monsters: '魔物', npcs: 'NPC', items: '物品', character: '角色', settings: '设置' };

/** Mobile navigation owns presentation; registered features own data and actions. */
export function createAdventureToolsView(root, { tabs, context, close, backToMenu }) {
	root.innerHTML = `<section class="game-tools-window mobile-adventure mobile-menu-window">
		<header class="adventure-header"><button type="button" data-back hidden>返回</button><nav class="adventure-tabs menu-tabs" role="tablist" aria-label="冒险工具"></nav><button type="button" data-menu-back>返回</button><button type="button" data-close>关闭</button></header>
		<div class="adventure-content" hidden></div>
	</section>`;
	const $ = selector => root.querySelector(selector);
	const navigation = $('.adventure-tabs'),
		content = $('.adventure-content'),
		back = $('[data-back]');
	const abort = new AbortController();
	let active = null,
		cleanup,
		tabView,
		detail = false;
	const host = root.getRootNode().host;
	const windowElement = $('.mobile-adventure');
	// Tablet wide layouts keep both panes even below the phone's catalog breakpoint.
	const showsBothPanes = () =>
		(!host.hasAttribute('data-phone-screen') && host.dataset.menuArrangement === 'wide') ||
		windowElement.clientWidth >= 600;
	const updateBack = () => { back.hidden = showsBothPanes() || !detail; };
	const resize = new ResizeObserver(updateBack);
	resize.observe(windowElement);
	const layout = new MutationObserver(updateBack);
	layout.observe(host, { attributes: true, attributeFilter: ['data-menu-arrangement', 'data-phone-screen'] });
	const scrolls = new Map();
	let savedSource = null;
	let availableTabs = tabs;
	function discardSavedSource() {
		savedSource?.cleanup?.();
		savedSource?.tabView?.destroy();
		savedSource = null;
	}
	function openMonster(id) {
		const tab = availableTabs.find(candidate => candidate.id === 'monsters');
		if (!tab || !['items', 'maps'].includes(active?.id)) return;
		savedSource = { tab: active, container: content.firstElementChild, cleanup, tabView, detail, scrolls: new Map(scrolls) };
		savedSource.container.remove();
		cleanup = null;
		tabView = null;
		open(tab, { initialMonsterId: id });
	}
	function disposeTab() {
		clearToast(content);
		// Resolve outstanding confirmations before removing a feature view.
		for (const button of root.querySelectorAll('.ui-confirm [data-cancel]')) button.click();
		tabView?.destroy();
		tabView = null;
		cleanup?.();
		cleanup = null;
		content.replaceChildren();
	}
	function showList() {
		detail = false;
		content.classList.remove('show-detail');
		back.hidden = true;
		for (const [node, offset] of scrolls) if (node.isConnected) node.scrollTop = offset;
	}
	function open(tab, target = {}) {
		if (active?.id === tab.id) return;
		disposeTab();
		active = tab;
		detail = false;
		scrolls.clear();

		content.hidden = false;
		for (const button of navigation.querySelectorAll('[data-tool]'))
			button.setAttribute('aria-selected', String(button.dataset.tool === tab.id));
		content.className = 'adventure-content';
		content.dataset.feature = tab.id;
		const container = document.createElement('div');
		container.className = 'game-tools-tab';
		container.dataset.tabId = tab.id;
		content.append(container);
		if (tab.id === savedSource?.tab.id) {
			container.replaceWith(savedSource.container);
			cleanup = savedSource.cleanup;
			tabView = savedSource.tabView;
			detail = savedSource.detail;
			for (const [node, offset] of savedSource.scrolls) scrolls.set(node, offset);
			savedSource = null;
			content.classList.toggle('show-detail', detail);
			back.textContent = '返回列表';
			updateBack();
			content.firstElementChild.dispatchEvent(new Event('game-tools-reset-feedback'));
			tabView.restore();
			return;
		}
		if (tab.id !== 'monsters') discardSavedSource();
		cleanup = tab.mount(container, { ...context, ...target, openMonster, returnLabel: savedSource?.tab.id === 'maps' ? '返回地图' : '返回物品', returnToCatalog: () => { if (savedSource) open(savedSource.tab); } });
		tabView = trackTabView(container);
		showList();
		if (tab.id === 'character') {
			detail = true;
			content.classList.add('show-detail');
			back.textContent = '选择职业';
			updateBack();
		}
	}
	function setTabs(nextTabs) {
		availableTabs = nextTabs;
		navigation.replaceChildren();
		for (const tab of nextTabs) {
			const button = document.createElement('button');
			button.type = 'button';
			button.dataset.tool = tab.id;
			button.textContent = labels[tab.id] || tab.label;
			button.setAttribute('role', 'tab');
			button.setAttribute('aria-selected', 'false');
			button.onclick = () => open(tab);
			navigation.append(button);
		}
		if (nextTabs.length) open(nextTabs[0]);
	}
	content.addEventListener(
		'click',
		event => {
			const row = event.target.closest('[data-catalog-key], .monster-row, [data-job-id]');
			if (!row) return;
			for (const node of content.querySelectorAll(
				'.catalog-list, .monster-list, .character-job-list, .catalog-browser, .monster-browser, .character-job-browser'
			))
				scrolls.set(node, node.scrollTop);
			detail = true;
			content.classList.add('show-detail');
			back.textContent = '返回列表';
			updateBack();
		},
		{ signal: abort.signal }
	);
	back.onclick = showList;

	$('[data-menu-back]').hidden = !backToMenu;
	$('[data-menu-back]').onclick = backToMenu;
	$('[data-close]').onclick = close;
	if (tabs.length) setTabs(tabs);
	else {
		navigation.textContent = '冒险工具';
		content.hidden = false;
		content.innerHTML = '<p class="adventure-loading-message" role="status">正在加载冒险工具…</p>';
	}
	return {
		setTabs,
		activeFeature: () => active?.id,
		destroy() {
			abort.abort();
			resize.disconnect();
			layout.disconnect();
			disposeTab();
			discardSavedSource();
			root.replaceChildren();
		}
	};
}
