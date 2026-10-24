import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/UI/Components/GameTools/AdventureActionService.js', () => ({ subscribeAdventureActions: () => () => {}, clearAdventureActionFeedback: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/AdventureRouteService.js', () => ({ subscribeAdventureRoute: () => () => {}, clearAdventureRouteFeedback: vi.fn() }));
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
const fixtures = vi.hoisted(() => ({ tabs: [], capabilities: {}, preferences: { tab: 'maps', save() {} } }));
vi.mock('UI/GUIComponent.js', () => ({
	default: class {
		constructor() {
			this._host = document.createElement('div');
			this._host.innerHTML = '<div class="tab-list"><div class="desktop-tab-group"></div></div><div class="tab-content"></div>';
		}
		getRoot() {
			return this._host;
		}
		append() {
			this.__active = true;
		}
		focus() {}
	}
}));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: (value) => value } }));
vi.mock('Core/Preferences.js', () => ({ default: { get: () => fixtures.preferences } }));
vi.mock('../../src/UI/Components/GameTools/GameToolsRegistry.js', () => ({
	registerGameToolsTab: (tab) => fixtures.tabs.push(tab),
	getGameToolsTabs: () => fixtures.tabs
}));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
	loadAdventureControlBootstrap: async () => fixtures.capabilities
}));
vi.mock('../../src/UI/Components/GameTools/MapCatalogTab.js', () => ({
	default: { id: 'maps', label: 'maps', mount: vi.fn(() => () => {}) }
}));
vi.mock('../../src/UI/Components/GameTools/NpcCatalogTab.js', () => ({
	default: { id: 'npcs', label: 'npcs', mount: vi.fn(() => () => {}) }
}));
vi.mock('../../src/UI/Components/GameTools/MonsterCatalogTab.js', () => ({
	default: { id: 'monsters', label: 'monsters', mount: vi.fn(() => () => {}) },
	notifyMonsterSpawnConfig: vi.fn(),
	notifyMonsterSpawnResult: vi.fn()
}));
vi.mock('../../src/UI/Components/GameTools/ItemCatalogTab.js', () => ({
	default: {
		id: 'items',
		label: 'items',
		capability: 'adminAvailable',
		mount: vi.fn((element, context) => {
			element.dataset.grant = String(context.capabilities.itemGrantAllowed);
			element.addEventListener('game-tools-reset-feedback', () => { element.dataset.grant = String(context.capabilities.itemGrantAllowed); });
			return () => {};
		})
	}
}));
vi.mock('../../src/UI/Components/GameTools/CharacterMaintenanceTab.js', () => ({
	default: {
		id: 'character',
		label: 'character',
		capability: 'characterMaintenanceAllowed',
		refreshOnOpen: true,
		mount: vi.fn(() => () => {})
	}
}));
vi.mock('../../src/UI/Components/GameTools/GameSettingsTab.js', () => ({
	default: {
		id: 'settings',
		label: 'settings',
		capability: 'gameSettingsAllowed',
		refreshOnOpen: true,
		mount: vi.fn(() => () => {})
	}
}));
import tools from '../../src/UI/Components/GameTools/GameTools.js';
const tab = (id) => fixtures.tabs.find((candidate) => candidate.id === id);
beforeEach(async () => {
	endConnection();
	vi.clearAllMocks();
	fixtures.preferences.tab = 'maps';
	fixtures.capabilities = { itemGrantAllowed: false, characterMaintenanceAllowed: true, gameSettingsAllowed: true };
	tools.getRoot().querySelector('.tab-content').innerHTML = '';
	await tools.refreshCapabilities();
	tools.renderTabs();
});
describe('adventure window lifecycle', () => {
	it('updates permission dependent content when access is granted and revoked', async () => {
		tools.selectTab('items');
		expect(tools.getRoot().querySelector('[data-tab-id=items]').dataset.grant).toBe('false');
		fixtures.capabilities.itemGrantAllowed = true;
		await tools.refreshCapabilities();
		expect(tools.getRoot().querySelector('[data-tab-id=items]').dataset.grant).toBe('true');
		fixtures.capabilities.itemGrantAllowed = false;
		await tools.refreshCapabilities();
		expect(tools.getRoot().querySelector('[data-tab-id=items]').dataset.grant).toBe('false');
	});
	it('retains tabs and requests a refresh when returning to live forms', () => {
		tools.renderTabs({ reopening: true });
		expect(tab('maps').mount).toHaveBeenCalledTimes(1);
		for (const id of ['character', 'settings']) {
			tools.selectTab(id);
			const node = tools.getRoot().querySelector(`[data-tab-id=${id}]`);
			const refresh = vi.fn();
			node.addEventListener('game-tools-activate', refresh);
			tools.renderTabs({ reopening: true });
			expect(tab(id).mount).toHaveBeenCalledTimes(1);
			expect(refresh).toHaveBeenCalledTimes(1);
		}
	});
});

it('preserves catalog nodes across switches and clears them at session end', () => {
	tools.selectTab('npcs');
	const node=tools.getRoot().querySelector('[data-tab-id=npcs]');
	node.innerHTML='<input type="search" value="Kafra"><div class="selected">42</div>';
	tools.selectTab('maps');
	expect(node.hidden).toBe(true);
	tools.selectTab('npcs');
	expect(node.hidden).toBe(false);
	expect(node.querySelector('input').value).toBe('Kafra');
	expect(tab('npcs').mount).toHaveBeenCalledTimes(1);
	endConnection();
	expect(tools.getRoot().querySelectorAll('.game-tools-tab')).toHaveLength(0);
});

it('opens maps from the minimap even when another tab was selected or the window is visible', () => {
 tools.selectTab('items');
 tools._host.style.display = 'none';
 tools.showMap();
 expect(fixtures.preferences.tab).toBe('maps');
 expect(tools._host.style.display).toBe('');
 expect(tools.getRoot().querySelector('[data-tab-id=maps]').hidden).toBe(false);
 tools.selectTab('items');
 tools.showMap();
 expect(tools._host.style.display).toBe('');
 expect(tools.getRoot().querySelector('[data-tab-id=maps]').hidden).toBe(false);
 expect(tools.getRoot().querySelector('[data-tab-id=items]').hidden).toBe(true);
});
