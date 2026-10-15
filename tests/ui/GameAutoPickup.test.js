vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({ getCurrentAdventureMap: () => 'izlude', normalizeAdventureMap: value => value, getAdventureActionState: () => ({ allowed: false }), teleportToCoordinate: vi.fn() }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ session: {}, items: [], settings: {}, mouse: { world: { x: 99, y: 98 } }, send: vi.fn(), combat: false }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { forEach: fn => state.items.forEach(fn), get: id => state.items.find(item => item.GID === id) } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { tick: 100 } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: state.mouse }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: state.send } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: { HAPPYRO_STOP_MOVE: class Stop {} } } }));
vi.mock('Utils/PathFinding.js', () => ({ default: { search: () => 4 } }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: { TYPE: { WALKABLE: 1 } } }));
vi.mock('UI/Game/GameAutoCombatRuntime.js', () => ({ isAutoCombatEngaged: () => state.combat }));
vi.mock('UI/Game/PickupSettings.js', () => ({ loadPickupSettings: () => state.settings }));
vi.mock('UI/Game/PickupCatalog.js', () => ({ matchesPickupCategory: () => true }));
import { startAutoPickup, stopAutoPickup } from '../../src/UI/Game/GameAutoPickup.js';
import { notifyGameInput } from '../../src/Controls/GameInputIntent.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
beforeEach(() => {
 vi.useFakeTimers(); vi.clearAllMocks(); state.combat = false;
 vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
 Object.assign(state.session, { Playing: true, FreezeUI: false, moveAction: null, Entity: { position: [0, 0], action: 0, ACTION: { DIE: 9, SIT: 2, WALK: 1, ATTACK: 3 } } });
 state.settings = { enabled: true, range: 5, batchSeconds: 5, categories: [], excluded: [] };
 state.items = [{ GID: 123, pickupItemId: 501, position: [4, 0], objecttype: 2, constructor: { TYPE_ITEM: 2 }, onMouseDown: vi.fn(() => { state.session.moveAction = { ITAID: 123 }; }) }];
});
afterEach(() => { stopAutoPickup(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren(); });
it('invokes the original item handler with its ground position and restores mouse coordinates', () => {
 startAutoPickup(); vi.advanceTimersByTime(200); expect(state.items[0].onMouseDown).toHaveBeenCalledOnce();
 expect(state.mouse.world).toEqual({ x: 99, y: 98 }); expect(state.session.moveAction).toEqual({ ITAID: 123 });
 vi.advanceTimersByTime(2000); expect(state.items[0].onMouseDown).toHaveBeenCalledOnce();
});
it('turning off cancels its queued pickup immediately and stops its walk', () => {
 startAutoPickup(); vi.advanceTimersByTime(200); state.settings.enabled = false;
 window.dispatchEvent(new Event('happyro-pickup-settings'));
 expect(state.session.moveAction).toBeNull(); expect(state.send).toHaveBeenCalledOnce();
});
it('manual input never clears a newer manual action', () => {
 startAutoPickup(); vi.advanceTimersByTime(200); const manual = { targetGID: 200 }; state.session.moveAction = manual;
 notifyGameInput('attack-target', 200); expect(state.session.moveAction).toBe(manual); expect(state.send).not.toHaveBeenCalled();
});
it('freezing, combat and death do not start pickup', () => {
 state.combat = true; startAutoPickup(); vi.advanceTimersByTime(1000); expect(state.items[0].onMouseDown).not.toHaveBeenCalled();
 state.combat = false; state.session.FreezeUI = true; vi.advanceTimersByTime(1000); expect(state.items[0].onMouseDown).not.toHaveBeenCalled();
 state.session.FreezeUI = false; state.session.Entity.action = 9; vi.advanceTimersByTime(1000); expect(state.items[0].onMouseDown).not.toHaveBeenCalled();
});
it('restarting on a new map leaves only one timer; disconnect cleans everything', () => {
 startAutoPickup(); startAutoPickup(); expect(vi.getTimerCount()).toBe(1);
 endConnection(); expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(1000); expect(state.items[0].onMouseDown).not.toHaveBeenCalled();
});
it('mobile HUD with a closed backdrop does not block pickup', () => {
 const hud = document.createElement('div'); hud.id = 'MobileGameHUD'; const shadow = hud.attachShadow({ mode: 'open' }); shadow.innerHTML = '<div class="backdrop" hidden><div class="panel"></div></div>'; document.body.append(hud);
 startAutoPickup(); vi.advanceTimersByTime(200); expect(state.items[0].onMouseDown).toHaveBeenCalledOnce();
});

it.each(['blur','visibilitychange'])('releases a lost movement hold on %s and resumes only when visible', event => {
 startAutoPickup();notifyGameInput('move-start');
 vi.spyOn(document,'hidden','get').mockReturnValue(true);
 (event==='blur'?window:document).dispatchEvent(new Event(event));
 vi.advanceTimersByTime(2000);expect(state.items[0].onMouseDown).not.toHaveBeenCalled();
 vi.spyOn(document,'hidden','get').mockReturnValue(false);
 document.dispatchEvent(new Event('visibilitychange'));
 vi.advanceTimersByTime(200);expect(state.items[0].onMouseDown).toHaveBeenCalledOnce();
});
