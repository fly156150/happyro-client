import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
 session: { Playing: true }, bootstrap: vi.fn(), create: vi.fn(), intent: vi.fn(),
 connection: new Set(), actions: new Set()
}));
vi.mock('UI/GUIComponent.js', () => ({ default: class {
 constructor() { this._host = document.createElement('div'); this.root = this._host.attachShadow({mode:'open'}); }
 getRoot() { return this.root; }
 remove() { this.onRemove(); this._host.remove(); }
} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: component => component } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('UI/Components/GameTools/GameToolsTabs.js', () => ({ availableGameToolsTabs: () => [] }));
vi.mock('UI/Components/GameTools/AdventureControlService.js', () => ({ loadAdventureControlBootstrap: state.bootstrap }));
vi.mock('Controls/GameInputIntent.js', () => ({ notifyGameInput: state.intent }));
vi.mock('Network/ConnectionLifecycle.js', () => ({ onConnectionEnd: fn => { state.connection.add(fn); return () => state.connection.delete(fn); } }));
vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({ subscribeAdventureActions: fn => { state.actions.add(fn); return () => state.actions.delete(fn); } }));
vi.mock('UI/Components/GameTools/AdventureRouteService.js', () => ({ subscribeAdventureRoute: () => () => {} }));
vi.mock('../../src/UI/Mobile/game/AdventureToolsView.js', () => ({ createAdventureToolsView: state.create }));
import Tools from '../../src/UI/Mobile/game/AdventureTools.js';
let view;
beforeEach(() => {
 vi.clearAllMocks(); state.session.Playing = true; state.session.FreezeUI = false;
 view = { destroy: vi.fn(), setTabs: vi.fn() }; state.create.mockImplementation((root, options) => { root.innerHTML='<button>关闭</button>'; root.querySelector('button').onclick=options.close; return view; });
 state.bootstrap.mockResolvedValue({characterMaintenanceAllowed:true});
 Tools.root.innerHTML = Tools.render(); document.body.append(Tools._host);
});
afterEach(() => Tools.remove());
it('unsubscribes and destroys the view on disconnect, including repeated opening', async () => {
 await Tools.onAppend(); await Tools.onAppend();
 expect(view.destroy).toHaveBeenCalledOnce();
 expect(state.connection.size).toBe(1); expect(state.actions.size).toBe(1);
 expect(state.intent).toHaveBeenCalledWith('action');
 for(const listener of [...state.connection]) listener();
 for(const listeners of [state.connection,state.actions]) expect(listeners.size).toBe(0);
 expect(view.destroy).toHaveBeenCalledTimes(2);
});
it('ignores a bootstrap response after closing and reopening', async () => {
 let resolve;
 state.bootstrap.mockImplementationOnce(() => new Promise(done => {resolve=done;}));
 const old = Tools.onAppend(); Tools.remove();
 await Tools.onAppend(); resolve({}); await old;
 expect(state.create).toHaveBeenCalledTimes(2); expect(view.setTabs).toHaveBeenCalledOnce(); expect(state.actions.size).toBe(1);
});
it('keeps close available during loading and ignores its late response', async () => {
 let resolve;
 state.bootstrap.mockImplementationOnce(() => new Promise(done => {resolve=done;}));
 const pending = Tools.onAppend(); Tools.root.querySelector('button').click();
 resolve({}); await pending;
 expect(state.create).toHaveBeenCalledOnce(); expect(view.setTabs).not.toHaveBeenCalled(); expect(state.connection.size).toBe(0);
});
it('offers the available catalogs without a global backend error banner', async () => {
 state.bootstrap.mockRejectedValueOnce(new Error('offline'));
 await Tools.onAppend();
 expect(state.create.mock.calls[0][1].context.capabilities).toEqual({adminAvailable:false});
 expect(view.setTabs).toHaveBeenCalledOnce();
});

it('owns the input freeze while open and restores an existing freeze', async () => {
 await Tools.onAppend(); expect(state.session.FreezeUI).toBe(true);
 Tools.remove(); expect(state.session.FreezeUI).toBe(false);
 state.session.FreezeUI=true;
 await Tools.onAppend(); Tools.remove(); expect(state.session.FreezeUI).toBe(true);
});
