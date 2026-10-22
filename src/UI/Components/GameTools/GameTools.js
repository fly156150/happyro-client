import headerCSS from '../DesktopWindowHeader.css?raw';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { trackTabView } from './TabViewState.js';
import { subscribeAdventureActions, clearAdventureActionFeedback } from './AdventureActionService.js';
import { subscribeAdventureRoute, clearAdventureRouteFeedback } from './AdventureRouteService.js';
import { clearToast, showToast } from 'UI/Components/Toast.js';
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import Preferences from 'Core/Preferences.js';
import htmlText from './GameTools.html?raw';
import cssText from './GameTools.css?raw';
import buttonCssText from './GameToolsButtons.css?raw';
import lightThemeCssText from '../DesktopLightTheme.css?raw';
import lightCssText from './GameToolsLight.css?raw';
import tabsCssText from '../DesktopTabs.css?raw';
import itemCatalogCssText from './ItemCatalogTab.css?raw';
import gameSelectCssText from './GameSelect.css?raw';
import { getGameToolsTabs } from './GameToolsRegistry.js';
import { availableGameToolsTabs } from './GameToolsTabs.js';
import { loadAdventureControlBootstrap } from './AdventureControlService.js';
import { notifyMonsterSpawnConfig, notifyMonsterSpawnResult } from './MonsterCatalogTab.js';

const preferences = Preferences.get('GameTools', { tab: 'maps' }, 2.0);
const GameTools = new GUIComponent('GameTools', cssText + itemCatalogCssText + gameSelectCssText + lightThemeCssText + buttonCssText + lightCssText + tabsCssText + headerCSS);
// Use the desktop theme scrollbars instead of the legacy RO image scrollbar.
GameTools.nativeScrolling = true;
const mountedTabs = new Map();
let activeTabId;
let capabilities;
let shouldRestoreAfterMapLoad = false;

function validationMessage(input) {
	const { validity } = input;
	if (validity.valueMissing) return '请填写此字段';
	if (validity.badInput) return '请输入有效的数字';
	if (validity.rangeUnderflow) return `数值不能小于 ${input.min}`;
	if (validity.rangeOverflow) return `数值不能大于 ${input.max}`;
	if (validity.stepMismatch) return '请输入符合步进要求的数值';
	if (validity.tooShort) return `内容不能少于 ${input.minLength} 个字符`;
	if (validity.tooLong) return `内容不能超过 ${input.maxLength} 个字符`;
	if (validity.typeMismatch) return '请输入有效的内容';
	if (validity.patternMismatch) return '输入格式不正确';
	return '请检查输入内容';
}

GameTools.render = () => htmlText;

GameTools.onShortCut = function onShortCut(key) {
	if (key.cmd === 'TOGGLE') this.toggle();
};

GameTools.onKeyDown = function onKeyDown(event) {
	if (event.key !== 'Escape' || event.defaultPrevented || !this.__active || this._host.style.display === 'none') return;
	if (this.getRoot().querySelector('.ui-confirm')) return;
	const z = Number(this._host.style.zIndex);
	if (Object.values(UIManager.components).some(component => component !== this && component.__active && component.needFocus && component._host?.style.display !== 'none' && Number(component._host?.style.zIndex) > z)) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	this.toggle();
};

GameTools.init = function init() {
	const root = this.getRoot();
	this.draggable('.titlebar');
	let lastActionMessage = '';
	subscribeAdventureActions(state => {
		const previous = lastActionMessage;
		lastActionMessage = state.message;
		if (this._host.style.display === 'none') return;
		const window = root.querySelector('.game-tools-window');
		if (state.message && state.message !== previous) {
			showToast(
				window,
				state.message,
				state.error ? 'error' : state.npcPending || state.mapPending ? 'pending' : 'success'
			);
		}
	});
	let lastRouteMessage = '';
	subscribeAdventureRoute(state => {
		const previous = lastRouteMessage;
		lastRouteMessage = state.message;
		if (this._host.style.display === 'none') return;
		const window = root.querySelector('.game-tools-window');
		if (state.message && state.message !== previous) {
			showToast(
				window,
				state.message,
				state.message === '已到达目的地' ? 'success' : 'info'
			);
		}
	});
	root.addEventListener('invalid', event => event.target.setCustomValidity(validationMessage(event.target)), true);
	root.addEventListener('input', event => event.target.setCustomValidity?.(''), true);
	root.querySelector('.close').addEventListener('click', () => this.toggle());
	root.querySelector('.close').addEventListener('mousedown', event => event.stopImmediatePropagation());
	clearToast(this.getRoot().querySelector('.game-tools-window'));
	this._host.style.display = 'none';
	this.renderTabs();
};

GameTools.renderTabs = function renderTabs({ reopening = false } = {}) {
	const root = this.getRoot();
	const tabs = availableGameToolsTabs(capabilities);
	for (const [id, entry] of mountedTabs) {
		if (tabs.some(tab => tab.id === id)) continue;
		entry.cleanup?.();
		entry.view.destroy();
		entry.container.remove();
		mountedTabs.delete(id);
	}
	if (!tabs.length) return;
	const selected = tabs.find(tab => tab.id === preferences.tab) || tabs[0];
	root.querySelector('.desktop-tab-group').innerHTML = tabs
		.map(
			tab =>
				`<button class="tab-button${tab.id === selected.id ? ' active' : ''}" type="button" role="tab" data-tab="${tab.id}">${tab.label}</button>`
		)
		.join('');
	root.querySelectorAll('.tab-button').forEach(button => {
		button.addEventListener('click', () => this.selectTab(button.dataset.tab));
	});
	this.mountTab(selected, reopening);
};

GameTools.selectTab = function selectTab(id) {
	const tab = getGameToolsTabs().find(candidate => candidate.id === id);
	if (!tab) return;
	if (id === preferences.tab) return;
	preferences.tab = id;
	preferences.save();
	this.renderTabs();
};

GameTools.mountTab = function mountTab(tab, reopening = false) {
	const content = this.getRoot().querySelector('.tab-content');
	const switching = activeTabId !== tab.id;
	if (!switching && !reopening && mountedTabs.has(tab.id)) return;
	clearToast(content.closest('.game-tools-window'));
	clearAdventureActionFeedback();
	clearAdventureRouteFeedback();
	for (const [id, entry] of mountedTabs) {
		entry.container.hidden = id !== tab.id;
		entry.container.dispatchEvent(new Event('game-tools-reset-feedback'));
	}
	let entry = mountedTabs.get(tab.id);
	if (!entry) {
		const container = document.createElement('div');
		container.className = 'game-tools-tab';
		container.dataset.tabId = tab.id;
		content.append(container);
		const view = trackTabView(container);
		const context = {
			openMonster: id => {
				this.selectTab('monsters');
				mountedTabs.get('monsters')?.container.dispatchEvent(new CustomEvent('game-tools-open-monster', { detail: id }));
			},
			returnToItem: () => this.selectTab('items'),
			get capabilities() {
				return capabilities;
			}
		};
		entry = { container, view, cleanup: tab.mount(container, context) };
		mountedTabs.set(tab.id, entry);
	} else {
		entry.container.hidden = false;
		entry.container.dispatchEvent(new Event('game-tools-activate'));
		entry.view.restore();
	}
	activeTabId = tab.id;
};

onConnectionEnd(() => {
	for (const entry of mountedTabs.values()) {
		entry.cleanup?.();
		entry.view.destroy();
		entry.container.remove();
	}
	mountedTabs.clear();
	activeTabId = undefined;
	capabilities = undefined;
	shouldRestoreAfterMapLoad = false;
	if (GameTools._host) GameTools._host.style.display = 'none';
});

GameTools.onAppend = function onAppend() {
	this.centerInViewport();
};

GameTools.prepareMapTransition = function prepareMapTransition() {
	shouldRestoreAfterMapLoad = Boolean(
		this.__active && this._host?.isConnected && this._host.style.display !== 'none'
	);
};

GameTools.restoreAfterMapLoad = function restoreAfterMapLoad() {
	if (!shouldRestoreAfterMapLoad) return;
	shouldRestoreAfterMapLoad = false;
	this.append();
	this._host.style.display = '';
	this.focus();
};

GameTools.centerInViewport = function centerInViewport() {
	const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
	const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
	const { width, height } = this._host.getBoundingClientRect();
	this._host.style.left = `${Math.max(0, (viewportWidth - width) / 2)}px`;
	this._host.style.top = `${Math.max(0, (viewportHeight - height) / 2)}px`;
};

GameTools.toggle = function toggle() {
	if (this.__active && this._host.style.display !== 'none') {
		clearToast(this.getRoot().querySelector('.game-tools-window'));
		clearAdventureActionFeedback();
		clearAdventureRouteFeedback();
		for (const entry of mountedTabs.values()) {
			entry.view.discardDrafts();
			entry.container.dispatchEvent(new Event('game-tools-close'));
			entry.container.dispatchEvent(new Event('game-tools-reset-feedback'));
		}
		this._host.style.display = 'none';
		return;
	}
	this.append();
	this._host.style.display = '';
	this.centerInViewport();
	this.focus();
	this.renderTabs({ reopening: true });
	void this.refreshCapabilities();
};

GameTools.refreshCapabilities = async function refreshCapabilities() {
	try {
		const nextCapabilities = { ...(await loadAdventureControlBootstrap()), adminAvailable: true };
		const changed = JSON.stringify(capabilities) !== JSON.stringify(nextCapabilities);
		capabilities = nextCapabilities;
		if (changed) {
			for (const entry of mountedTabs.values())
				entry.container.dispatchEvent(new Event('game-tools-reset-feedback'));
			this.renderTabs();
		}
	} catch {
		capabilities = {
			adminAvailable: false,
			characterMaintenanceAllowed: false,
			gameSettingsAllowed: false,
			itemGrantAllowed: false
		};
		this.renderTabs();
	}
};

GameTools.setMonsterSpawnConfig = function setMonsterSpawnConfig() {
	notifyMonsterSpawnConfig();
};

GameTools.onMonsterSpawnResult = function onMonsterSpawnResult(result) {
	notifyMonsterSpawnResult(result);
};

export default UIManager.addComponent(GameTools);
