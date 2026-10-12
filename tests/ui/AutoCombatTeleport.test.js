import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ session: { GID: 1 }, map: 'izlude', action: {}, complete: null, send: vi.fn() }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({
 getCurrentAdventureMap: () => state.map,
 normalizeAdventureMap: map => map.replace(/\.gat$/, ''),
 getAdventureActionState: () => state.action,
 teleportToRandomCell: (target, complete) => { state.complete = complete; state.send(target); return true; }
}));
import { requestAutoCombatTeleport, prepareAutoCombatTeleportMap, completeAutoCombatTeleportMap, consumeAutoCombatTeleport, isAutoCombatTeleportPending } from '../../src/UI/Game/AutoCombatTeleport.js';
import { notifyGameInput } from '../../src/Controls/GameInputIntent.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); endConnection(); vi.clearAllMocks(); state.map = 'izlude'; state.session.GID = 1; state.action = { allowed: true, canTeleport: true }; });
afterEach(() => { endConnection(); vi.useRealTimers(); });
it.each([true, false])('resumes exactly once after both same-map arrival and success, ackFirst=%s', ackFirst => {
 requestAutoCombatTeleport(10); expect(state.send).toHaveBeenCalledWith('izlude');
 if (ackFirst) state.complete({ result: 0 });
 expect(consumeAutoCombatTeleport()).toBe(false);
 prepareAutoCombatTeleportMap('izlude.gat'); completeAutoCombatTeleportMap();
 if (!ackFirst) { expect(consumeAutoCombatTeleport()).toBe(false); state.complete({ result: 0 }); }
 expect(consumeAutoCombatTeleport()).toBe(true); expect(consumeAutoCombatTeleport()).toBe(false);
 requestAutoCombatTeleport(10); expect(state.send).toHaveBeenCalledOnce();
 vi.advanceTimersByTime(10000); requestAutoCombatTeleport(10); expect(state.send).toHaveBeenCalledTimes(2);
});
it.each(['input', 'blur', 'disconnect', 'map', 'character', 'timeout', 'rejection'])('does not resume after %s', reason => {
 requestAutoCombatTeleport(10);
 if (reason === 'input') notifyGameInput('action');
 if (reason === 'blur') window.dispatchEvent(new Event('blur'));
 if (reason === 'disconnect') endConnection();
 if (reason === 'map') prepareAutoCombatTeleportMap('prontera.gat');
 if (reason === 'character') state.session.GID = 2;
 if (reason === 'timeout') vi.advanceTimersByTime(16000);
 state.complete({ result: reason === 'rejection' ? 5 : 0 });
 prepareAutoCombatTeleportMap('izlude'); completeAutoCombatTeleportMap();
 expect(consumeAutoCombatTeleport()).toBe(false); expect(isAutoCombatTeleportPending()).toBe(false);
});
it('honors permissions, cooldown, and other pending adventure actions', () => {
 for (const action of [{ allowed: false }, { allowed: true, canTeleport: false, cooldownRemaining: 5 }, { allowed: true, canTeleport: true, npcPending: true }]) {
  state.action = action; requestAutoCombatTeleport(10);
 }
 expect(state.send).not.toHaveBeenCalled();
});
it('does not retry a failed request before the configured interval', () => {
 requestAutoCombatTeleport(10); state.action.message = '当前地图规则禁止传送'; state.complete({ result: 5 });
 expect(requestAutoCombatTeleport(10)).toBe('当前地图规则禁止传送'); expect(state.send).toHaveBeenCalledOnce();
});
