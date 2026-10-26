import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createAutoCombatController } from '../../src/UI/Game/AutoCombatController.js';
import { createAutoPickupController } from '../../src/UI/Game/AutoPickupController.js';
import { registerAutomationCombat, registerAutomationPickup, hasAutomationCombat, takeAutomationPickupTurn, cancelAutomationPickup } from '../../src/UI/Game/GameAutomation.js';
let time, mobs, items, busy, pickup, combat, io, data, unregisterCombat, unregisterPickup;
const mob = id => ({ id, species: 1002, name: `mob${id}`, position: [id, 0] });
const item = id => ({ id, itemId: 501, position: [id, 0] });
beforeEach(() => {
 time = 0; mobs = [mob(1), mob(2)]; items = []; busy = false;
 io = { now: () => time, settings: () => ({ enabled: true, range: 15, batchSeconds: 5, excluded: [], categories: [] }), available: () => true, position: () => [0,0], items: () => items, matches: () => true, reachable: () => true, busy: () => busy, chasing: () => true, pick: vi.fn(), cancel: vi.fn() };
 pickup = createAutoPickupController(io); unregisterPickup = registerAutomationPickup(pickup);
 data = { searchLimit: () => 50, enabled: () => true, now: () => time, position: () => [0,0], random: () => 0, targets: () => mobs, skills: () => [], busy: () => busy, chasing: () => false, reachable: () => true, select: vi.fn(), act: vi.fn(), stop: vi.fn(), pickupTurn: takeAutomationPickupTurn, cancelPickup: cancelAutomationPickup, teleport: vi.fn(() => '正在随机瞬移') };
 combat = createAutoCombatController(data); unregisterCombat = registerAutomationCombat(combat);
 combat.configure([], [], { search: 20, activity: 30 }, { enabled: true, waitSeconds: 1, intervalSeconds: 2 });
});
afterEach(() => { combat.stop(); unregisterCombat(); unregisterPickup(); });
function tick(ms = 200) { time += ms; if (!hasAutomationCombat()) pickup.tick(); combat.tick(); }
it('finishes the current enemy, picks a fixed batch without new-monster preemption, then attacks again', () => {
 combat.start(); expect(data.act.mock.calls[0][0].id).toBe(1);
 items = [item(3), item(4)]; tick(); expect(io.pick).not.toHaveBeenCalled();
 mobs = [mob(2)]; tick(); expect(io.pick.mock.calls[0][0].id).toBe(3); expect(combat.snapshot().target).toBe('');
 mobs.push(mob(1)); items.push(item(5)); tick(); expect(io.pick).toHaveBeenCalledOnce();
 items = items.filter(entry => entry.id !== 3); tick(); tick(); expect(io.pick.mock.calls[1][0].id).toBe(4);
 items = items.filter(entry => entry.id !== 4); tick(); tick();
 expect(data.act.mock.calls.at(-1)[0].id).toBe(1); expect(io.pick).toHaveBeenCalledTimes(2); expect(io.cancel).toHaveBeenCalledTimes(2);
});
it('yields to combat after the batch time limit even if walking to loot', () => {
 items = [item(4)]; combat.start(); expect(io.pick).toHaveBeenCalledOnce();
 tick(4999); expect(data.act).not.toHaveBeenCalled(); tick(1);
 expect(io.cancel).toHaveBeenCalledOnce(); expect(data.act.mock.calls[0][0].id).toBe(1);
});
it('continues another pickup round when no monsters exist, never teleporting over remaining loot', () => {
 mobs = []; items = [item(4)]; combat.start(); tick(5000); tick();
 expect(io.pick).toHaveBeenCalledTimes(2); expect(data.teleport).not.toHaveBeenCalled();
 items = []; tick(); tick(); tick(999); expect(data.teleport).not.toHaveBeenCalled(); tick(1);
 expect(data.teleport).toHaveBeenCalledWith(2);
});
it('resets the teleport countdown when loot appears even while the last animation is busy', () => {
 mobs = []; combat.start(); tick(900); items = [item(3)]; busy = true; tick();
 expect(data.teleport).not.toHaveBeenCalled(); expect(io.pick).not.toHaveBeenCalled();
 busy = false; tick(); expect(io.pick).toHaveBeenCalledOnce();
 items = []; tick(); tick(); tick(999); expect(data.teleport).not.toHaveBeenCalled(); tick(1); expect(data.teleport).toHaveBeenCalledOnce();
});
it('manual movement cancels the pickup turn and combat holds until movement ends', () => {
 items = [item(3)]; combat.start(); combat.pauseForMovement(); pickup.manual('move-start');
 tick(6000); expect(io.pick).toHaveBeenCalledOnce(); expect(data.act).not.toHaveBeenCalled();
 pickup.manual('move-end'); combat.resumeAfterMovement(); tick(1000); expect(io.pick).toHaveBeenCalledTimes(2);
});
it('unreachable or disappearing loot cannot block the next battle', () => {
 items = [item(3)]; io.reachable = () => false; combat.start(); expect(data.act).toHaveBeenCalledOnce();
 expect(io.pick).not.toHaveBeenCalled();
});
