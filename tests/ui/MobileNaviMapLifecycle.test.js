import { acquireInputFreeze, releaseInputFreeze } from '../../src/UI/InputFreeze.js';
const externalFreeze = Symbol('external dialog');
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ config: null, end: new Set() }));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
 constructor() { this._host = document.createElement('div'); this._host.innerHTML = '<div class="adventure-mount"></div>'; }
 getRoot() { return this._host; }
 append() { document.body.append(this._host); this.__active = true; this.ready = this.onAppend(); }
 remove() { this.__active = false; this.onRemove(); this._host.remove(); }
} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: value => value } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { Playing: true, FreezeUI: true } }));
vi.mock('Network/ConnectionLifecycle.js', () => ({ onConnectionEnd: fn => { state.end.add(fn); return () => state.end.delete(fn); } }));
vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({ subscribeAdventureActions: () => () => {} }));
vi.mock('UI/Components/GameTools/AdventureRouteService.js', () => ({ subscribeAdventureRoute: () => () => {} }));
vi.mock('UI/Components/GameTools/GameToolsTabs.js', () => ({ availableGameToolsTabs: () => [] }));
vi.mock('UI/Components/GameTools/AdventureControlService.js', () => ({ loadAdventureControlBootstrap: async () => ({}) }));
vi.mock('Controls/GameInputIntent.js', () => ({ notifyGameInput: vi.fn() }));
vi.mock('../../src/UI/Mobile/game/MobileInputEditor.js', () => ({ createMobileInputEditor: () => () => {} }));
vi.mock('../../src/UI/Mobile/game/MobileViewport.js', () => ({ createMobileViewport: () => Object.assign(() => {}, { destroy() {} }) }));
vi.mock('UI/Components/Feedback.js', () => ({ createFeedback: () => () => {} }));
vi.mock('../../src/UI/Mobile/game/AdventureToolsView.js', () => ({ createAdventureToolsView: (mount, config) => {
 state.config = config; mount.innerHTML = '<div class="game-tools-window"></div>';
 return { setTabs() {}, destroy() {} };
} }));
import tools from '../../src/UI/Mobile/game/AdventureTools.js';
import Session from 'Engine/SessionStorage.js';
beforeEach(() => { state.config = null; acquireInputFreeze(externalFreeze); });
afterEach(() => { tools.remove(); releaseInputFreeze(externalFreeze); state.end.clear(); document.body.replaceChildren(); });
it('opens the chosen map without closing the NPC and restores the prior freeze state before its close callback', async () => {
 const target = { mapName: 'alberta', x: 98, y: 154 }, close = vi.fn(() => {
  expect(tools.__active).toBe(false); expect(Session.FreezeUI).toBe(true);
 });
 tools.openMap(target, undefined, close); await tools.ready;
 expect(state.config.context.initialMap).toEqual(target); expect(Session.FreezeUI).toBe(true); expect(close).not.toHaveBeenCalled();
 state.config.close(); expect(close).toHaveBeenCalledOnce();
 tools.remove(); expect(close).toHaveBeenCalledOnce();
});
it('does not invoke a stale map return callback when replacing its window or disconnecting', async () => {
 const oldClose = vi.fn(), close = vi.fn();
 tools.openMap({ mapName: 'alberta', x: 98, y: 154 }, undefined, oldClose); await tools.ready;
 tools.openMap({ mapName: 'prontera', x: 120, y: 130 }, undefined, close); await tools.ready;
 expect(oldClose).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
 for (const end of [...state.end]) end();
 expect(oldClose).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(Session.FreezeUI).toBe(true);
});
