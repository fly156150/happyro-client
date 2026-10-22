vi.mock('Renderer/EntityManager.js', () => ({ default: {get:vi.fn(),forEach:vi.fn()} }));
vi.mock('UI/Components/MiniMap/MiniMapImage.js', () => ({ hasVisiblePixels: () => true, createAltitudeFallback: () => null }));
vi.mock('UI/Game/AutoCombatTeleport.js', () => ({ cancelAutoCombatTeleport: vi.fn(), consumeAutoCombatTeleport: () => false }));
vi.mock('UI/Components/GameTools/WorldAssetService.js', () => ({ loadCatalogMapImage: vi.fn(async () => null) }));
vi.mock('UI/Mobile/game/AdventureTools.js', () => ({ default: { append: vi.fn(), openMap: vi.fn() } }));
vi.mock('UI/Game/GameAttributes.js', () => ({ createGameAttributes: () => ({}) }));
vi.mock('UI/Game/GameAutoCombat.js', () => ({ createGameAutoCombat: () => ({ tick: vi.fn(), stop: vi.fn(), resumeAfterMovement: vi.fn(), snapshot: () => ({ active: false }) }) }));
vi.mock('UI/Game/GameCompanions.js',()=>({openGameCompanions:vi.fn()}));
vi.mock('UI/Game/GamePet.js',()=>({openGamePet:vi.fn()}));
vi.mock('UI/Game/GameMail.js',()=>({openGameMail:vi.fn(),gameMailUnread:()=>false}));
vi.mock('UI/Game/GameVending.js', () => ({showOwnedVending:vi.fn()}));
vi.mock('UI/Game/GameSocial.js', () => ({ createGameSocial: () => ({ snapshot: () => ({ friends: [], party: [] }) }) }));
vi.mock('UI/Game/GameChat.js', () => ({ createGameChat: () => ({ send: vi.fn() }), chatChannel: () => 'public', chatChannelError: () => '' }));
vi.mock('UI/Game/GameQuests.js', () => ({ createGameQuests: () => ({ snapshot: () => ({ quests: [] }) }) }));
vi.mock('UI/Game/GameContainers.js', () => ({ createGameContainers: () => ({ snapshot: () => ({ items: [] }) }) }));
vi.mock('UI/Game/GameSkills.js', () => ({ createGameSkills: () => ({ snapshot: () => ({ skills: [] }) }) }));
vi.mock('UI/Game/GameInventory.js', () => ({ createGameInventory: canOperate => { state.inventoryAllowed = canOperate; return { snapshot: () => [], act: vi.fn() }; } }));
vi.mock('UI/Game/GameShortcuts.js', () => ({ createGameShortcuts: () => ({ snapshot: () => ({}), cancel: vi.fn() }) }));
vi.mock('Renderer/Renderer.js', () => ({ default: { canvas: document.createElement('canvas') } }));
vi.mock('UI/Game/GameCommands.js', () => ({ adjustCamera: vi.fn(), targetSnapshot: () => ({}), moveDirection: vi.fn(), stopDirectionalMovement: vi.fn(), stopAttack: vi.fn(), attackSelected: vi.fn(), tapScene: vi.fn(), interactSelected: vi.fn() }));
vi.mock('../../src/UI/Mobile/game/PointerControls.js', () => ({ bindPointerControls: (_root, _scene, actions) => { state.controlsEnabled = actions.enabled; return ({ isMoving: () => false, cancel: vi.fn(), destroy: vi.fn() }); } }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
	Session: { FreezeUI: false, Entity: { ACTION: {WALK: 1}, action: 0, display: { name: '角色' }, job: 0, clevel: 1, joblevel: 1, money: 0, life: { hp: 10, hp_max: 10, sp: 2, sp_max: 3 }, position: [1, 2] } },
	cancel: vi.fn(), stopWalk: vi.fn(), feed: new Set(), orientation: new Set(), connection: new Set(), actions: null,
	view: { suspend: vi.fn(), showInteraction: vi.fn(), updateShortcuts: vi.fn(), update: vi.fn(), setMap: vi.fn(), setMessages: vi.fn(), close: vi.fn(), destroy: vi.fn() }
}));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
	static MouseMode = { CROSS: 0 };
	constructor(name) { this.name = name; this._host = document.createElement('div'); this.root = this._host.attachShadow({ mode: 'open' }); }
	getRoot() { return this.root; }
	remove() { this.onRemove(); }
} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: component => component } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.Session }));
vi.mock('UI/Platform.js', () => ({ default: { onOrientationChange: fn => { state.orientation.add(fn); return () => state.orientation.delete(fn); } } }));
vi.mock('Core/Mobile.js', () => ({ default: { cancelInteraction: state.cancel } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: { intersect: true } }));
vi.mock('Controls/MapControl.js', () => ({ default: { onRequestStopWalk: state.stopWalk } }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: { width: 0, height: 0 } }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: { currentMap: 'test.gat' } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMapName: () => '地图' } }));
vi.mock('DB/Jobs/JobDisplayNameTable.js', () => ({ getJobDisplayName: () => '初心者' }));
vi.mock('UI/Components/StatusIcons/StatusIcons.js', () => ({ default: { getSnapshot: () => [] } }));
vi.mock('UI/Game/ChatFeed.js', () => ({ subscribeChatFeed: fn => { state.feed.add(fn); return () => state.feed.delete(fn); } }));
vi.mock('Network/ConnectionLifecycle.js', () => ({ onConnectionEnd: fn => { state.connection.add(fn); return () => state.connection.delete(fn); } }));
vi.mock('../../src/UI/Mobile/game/GameHUDView.js', () => ({ createGameHUDView: (root, actions) => { state.actions = actions; return state.view; } }));
import HUD from '../../src/UI/Mobile/game/GameHUD.js';
beforeEach(() => {
	vi.useFakeTimers(); vi.clearAllMocks(); state.Session.FreezeUI = false;
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {} });
	state.view.close.mockImplementation(() => state.actions.setModal(false));
	state.view.destroy.mockImplementation(() => state.actions.setModal(false));
});
afterEach(() => { HUD.onRemove(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('replaces subscriptions and timers on repeat mounting and releases all on map removal', () => {
	HUD.onAppend(); HUD.onAppend();
	expect(vi.getTimerCount()).toBe(1);
	for (const listeners of [state.feed, state.orientation, state.connection]) expect(listeners.size).toBe(1);
	state.actions.setModal(true); expect(state.Session.FreezeUI).toBe(true);
	HUD.onRemove();
	expect(state.Session.FreezeUI).toBe(false); expect(vi.getTimerCount()).toBe(0);
	for (const listeners of [state.feed, state.orientation, state.connection]) expect(listeners.size).toBe(0);
	const calls = state.view.update.mock.calls.length; vi.advanceTimersByTime(1000);
	expect(state.view.update).toHaveBeenCalledTimes(calls);
});
it('cancels scene input on blur, orientation changes, and disconnect', () => {
	HUD.onAppend(); state.actions.setModal(true);
	window.dispatchEvent(new Event('blur'));
	expect(state.view.suspend).toHaveBeenCalledOnce(); expect(state.Session.FreezeUI).toBe(true); expect(state.stopWalk).toHaveBeenCalled();
	const count = state.cancel.mock.calls.length;
	for (const fn of state.orientation) fn('portrait');
	expect(state.cancel.mock.calls.length).toBeGreaterThan(count);
	for (const fn of [...state.connection]) fn();
	expect(vi.getTimerCount()).toBe(0); expect(state.feed.size).toBe(0);
});

it('allows inventory actions only while its own modal is open, without bypassing an existing freeze', () => {
 HUD.onAppend(); expect(state.inventoryAllowed()).toBe(false);
 state.actions.setModal(true); expect(state.inventoryAllowed()).toBe(true);
 state.actions.setModal(false); expect(state.inventoryAllowed()).toBe(false);
 state.Session.FreezeUI = true; state.actions.setModal(true); expect(state.inventoryAllowed()).toBe(false);
 state.actions.setModal(false); expect(state.Session.FreezeUI).toBe(true);
});

import { showInteraction, interactionSnapshot } from '../../src/UI/Game/ServerInteraction.js';
it('preserves a server window received before mounting and clears it when leaving the map', () => {
 showInteraction({ kind: 'npc', id: 42 });
 HUD.onAppend();
 expect(state.view.showInteraction).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'npc', id: 42 }));
 HUD.onRemove();
 expect(interactionSnapshot()).toBeNull();
});

it('allows portrait controls and preserves an open panel when rotating', () => {
 state.Session.Playing = true;
 HUD.onAppend();
 expect(state.controlsEnabled()).toBe(true);
 state.actions.setModal(true);
 for (const fn of state.orientation) fn('portrait');
 expect(state.view.suspend).not.toHaveBeenCalled();
 expect(state.Session.FreezeUI).toBe(true);
 expect(state.controlsEnabled()).toBe(false);
 state.actions.setModal(false);
 expect(state.controlsEnabled()).toBe(true);
});
