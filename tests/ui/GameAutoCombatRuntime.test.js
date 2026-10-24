vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({ getCurrentAdventureMap: () => state.map, normalizeAdventureMap: value => value, getAdventureActionState: () => ({ allowed: false }), teleportToCoordinate: vi.fn() }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ map: 'izlude', session: {}, act: vi.fn(), stop: vi.fn() }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('UI/Game/GameAutoCombat.js', async () => {
	const { createAutoCombatController } = await import('../../src/UI/Game/AutoCombatController.js');
	return { createGameAutoCombat: enabled => createAutoCombatController({
		enabled, position: () => [0, 0], now: () => performance.now(), random: () => 0,
		targets: () => [{ id: 1, species: 1002, name: '波利', position: [1, 0] }],
		skills: () => [], reachable: () => true, chasing: () => false, busy: () => false,
		select: vi.fn(), act: state.act, stop: state.stop
	}) };
});
import { createGameAutoCombatRuntime } from '../../src/UI/Game/GameAutoCombatRuntime.js';
import { notifyGameInput } from '../../src/Controls/GameInputIntent.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
let runtime;
beforeEach(() => {
	vi.useFakeTimers(); vi.clearAllMocks(); state.map = 'izlude';
	Object.assign(state.session, { Playing: true, FreezeUI: false, Entity: { action: 0, ACTION: { DIE: 9, WALK: 1 } } });
	vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => { runtime?.destroy(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('drives repeated attacks independently of either HUD rendering', () => {
	runtime = createGameAutoCombatRuntime(); runtime.start();
	expect(state.act).toHaveBeenCalledOnce();
	vi.advanceTimersByTime(1000); expect(state.act).toHaveBeenCalledTimes(2);
});
it('holds combat during manual input and server walking, then resumes from idle', () => {
	runtime = createGameAutoCombatRuntime(); runtime.start();
	notifyGameInput('move-start'); vi.advanceTimersByTime(2000);
	expect(runtime.snapshot().pausedForMovement).toBe(true); expect(state.act).toHaveBeenCalledOnce();
	notifyGameInput('move-end'); state.session.Entity.action = 1; vi.advanceTimersByTime(2000);
	expect(state.act).toHaveBeenCalledOnce();
	state.session.Entity.action = 0; vi.advanceTimersByTime(200);
	expect(runtime.snapshot().pausedForMovement).toBe(false); expect(state.act).toHaveBeenCalledTimes(2);
});
it('supports touch movement through the same pause/resume policy', () => {
	let moving = true;
	runtime = createGameAutoCombatRuntime({ isMoving: () => moving }); runtime.start(); runtime.pauseForMovement();
	vi.advanceTimersByTime(2000); expect(state.act).toHaveBeenCalledOnce();
	moving = false; vi.advanceTimersByTime(200); expect(state.act).toHaveBeenCalledTimes(2);
});
it.each(['skill', 'action'])('manual %s stops automation until explicitly restarted', kind => {
	runtime = createGameAutoCombatRuntime(); runtime.start(); notifyGameInput(kind);
	vi.advanceTimersByTime(3000); expect(runtime.snapshot().active).toBe(false); expect(state.act).toHaveBeenCalledOnce();
});
it('retargets only during automation and leaves ordinary desktop attacks unhandled', () => {
	runtime = createGameAutoCombatRuntime(); expect(notifyGameInput('attack-target', 1)).toBe(false);
	runtime.start(); expect(notifyGameInput('attack-target', 1)).toBe(true); expect(runtime.snapshot().active).toBe(true);
});
it.each(['death', 'freeze', 'hidden', 'blur'])('stops on %s and does not automatically restart', reason => {
	runtime = createGameAutoCombatRuntime(); runtime.start();
	if (reason === 'death') state.session.Entity.action = 9;
	if (reason === 'freeze') state.session.FreezeUI = true;
	if (reason === 'hidden') { vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')); }
	if (reason === 'blur') window.dispatchEvent(new Event('blur'));
	vi.advanceTimersByTime(1000); expect(runtime.snapshot().active).toBe(false);
	state.session.Entity.action = 0; state.session.FreezeUI = false;
	vi.advanceTimersByTime(1000); expect(state.act).toHaveBeenCalledOnce();
});
it('disconnect disposes the timer and input subscription and notifies its presentation once', () => {
	const onDisconnect = vi.fn(); runtime = createGameAutoCombatRuntime({ onDisconnect }); runtime.start();
	endConnection(); endConnection(); runtime.destroy();
	expect(onDisconnect).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
	expect(runtime.start()).toBe(false); expect(notifyGameInput('attack-target', 1)).toBe(false);
});
it('map disposal allows a fresh runtime with one timer and no inherited attack state', () => {
	runtime = createGameAutoCombatRuntime(); runtime.start(); runtime.destroy();
	runtime = createGameAutoCombatRuntime(); expect(vi.getTimerCount()).toBe(1);
	expect(runtime.snapshot().active).toBe(false); vi.advanceTimersByTime(2000); expect(state.act).toHaveBeenCalledOnce();
});

it.each(['in_moc_16', 'job_hunte', 'job3_rang02'])('stops auto-combat in %s without automatically restarting on exit', map => {
 runtime = createGameAutoCombatRuntime(); runtime.start();
 state.map = map; vi.advanceTimersByTime(200);
 expect(runtime.snapshot().active).toBe(false); expect(runtime.start()).toBe(false);
 expect(runtime.attackTarget(1)).toBe(false); expect(state.act).toHaveBeenCalledOnce();
 state.map = 'prontera'; vi.advanceTimersByTime(1000);
 expect(runtime.snapshot().active).toBe(false); expect(state.act).toHaveBeenCalledOnce();
 expect(runtime.start()).toBe(true);
});
