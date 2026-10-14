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
	let wide = $('.mobile-adventure').clientWidth >= 600;
	const resize = new ResizeObserver(entries => {
		wide = entries[0].contentRect.width >= 600;
		back.hidden = wide || !detail;
	});
	resize.observe($('.mobile-adventure'));
	let active = null,
		cleanup,
		tabView,
		detail = false;
	const scrolls = new Map();
	let savedItem = null;
	let availableTabs = tabs;
	function discardSavedItem() {
		savedItem?.cleanup?.();
		savedItem?.tabView?.destroy();
		savedItem = null;
	}
	function openMonster(id) {
		const tab = availableTabs.find(candidate => candidate.id === 'monsters');
		if (!tab || active?.id !== 'items') return;
		savedItem = { container: content.firstElementChild, cleanup, tabView, detail, scrolls: new Map(scrolls) };
		savedItem.container.remove();
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
		back.hidden = false;
		for (const button of navigation.querySelectorAll('[data-tool]'))
			button.setAttribute('aria-selected', String(button.dataset.tool === tab.id));
		content.className = 'adventure-content';
		content.dataset.feature = tab.id;
		const container = document.createElement('div');
		container.className = 'game-tools-tab';
		container.dataset.tabId = tab.id;
		content.append(container);
		if (tab.id === 'items' && savedItem) {
			container.replaceWith(savedItem.container);
			cleanup = savedItem.cleanup;
			tabView = savedItem.tabView;
			detail = savedItem.detail;
			for (const [node, offset] of savedItem.scrolls) scrolls.set(node, offset);
			savedItem = null;
			content.classList.toggle('show-detail', detail);
			back.textContent = '返回列表';
			back.hidden = wide || !detail;
			content.firstElementChild.dispatchEvent(new Event('game-tools-reset-feedback'));
			tabView.restore();
			return;
		}
		if (tab.id !== 'monsters') discardSavedItem();
		cleanup = tab.mount(container, { ...context, ...target, openMonster, returnToItem: () => open(availableTabs.find(candidate => candidate.id === 'items')) });
		tabView = trackTabView(container);
		showList();
		if (tab.id === 'character') {
			detail = true;
			content.classList.add('show-detail');
			back.textContent = '选择职业';
			back.hidden = wide;
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
			back.hidden = wide;
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
			disposeTab();
			discardSavedItem();
			root.replaceChildren();
		}
	};
}
