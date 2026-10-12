import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRecoveryController } from '../../src/Engine/Recovery/RecoveryController.js';
let recovery, deps, identity;
beforeEach(() => {
	vi.useFakeTimers();
	deps = {
		probe: vi.fn(() => true), close: vi.fn(), capture: vi.fn(() => ({ zoom: 140 })),
		present: vi.fn(), login: vi.fn(), restore: vi.fn(), visible: () => true
	};
	identity = { accountId: 1, characterId: 22, serverKey: 'a:6900', charServer: { ip: 3, port: 6121, name: 'A' } };
	recovery = createRecoveryController(deps);
	recovery.ready(identity);
});
afterEach(() => { recovery.cancel(); vi.useRealTimers(); });
function authenticate() {
	recovery.disconnected(); recovery.beginLogin();
	return recovery.loginAccepted(1, 'a:6900', [identity.charServer]);
}
it('leaves a healthy foreground session untouched and only probes once', () => {
	recovery.check(); recovery.check();
	expect(deps.probe).toHaveBeenCalledTimes(1);
	recovery.pong(); vi.advanceTimersByTime(30000);
	expect(recovery.state).toBe('playing');
	expect(deps.close).not.toHaveBeenCalled();
	expect(deps.login).not.toHaveBeenCalled();
});
it('does not count hidden time as an unresponsive foreground connection', () => {
	recovery.check(); recovery.hidden(); vi.advanceTimersByTime(60000);
	expect(recovery.state).toBe('playing');
	expect(deps.close).not.toHaveBeenCalled();
});
it('times out a half-open connection and never automatically resends credentials or operations', () => {
	recovery.check(); vi.advanceTimersByTime(12000);
	expect(recovery.state).toBe('disconnected');
	expect(deps.capture).toHaveBeenCalledTimes(1);
	expect(deps.close).toHaveBeenCalledTimes(1);
	recovery.disconnected(); recovery.pong(); vi.advanceTimersByTime(60000);
	expect(deps.close).toHaveBeenCalledTimes(1);
	expect(deps.login).not.toHaveBeenCalled();
});
it('does not mistake map transitions for dropped sessions', () => {
	recovery.check(); recovery.transition(); vi.advanceTimersByTime(30000);
	recovery.check();
	expect(deps.close).not.toHaveBeenCalled();
	recovery.ready(identity);
	expect(recovery.state).toBe('playing');
});
it('selects the exact character ID only after new authentication and PIN success', () => {
	expect(authenticate()).toEqual(identity.charServer);
	const enter = vi.fn();
	recovery.characterList([{ GID: 11, CharNum: 0 }, { GID: 22, CharNum: 4 }], enter);
	expect(enter).not.toHaveBeenCalled();
	recovery.pin(1); expect(enter).not.toHaveBeenCalled();
	recovery.pin(0); recovery.pin(0);
	expect(enter).toHaveBeenCalledTimes(1);
	expect(enter).toHaveBeenCalledWith({ GID: 22, CharNum: 4 });
	recovery.ready(identity);
	expect(deps.restore).toHaveBeenCalledWith({ zoom: 140 });
});
it('handles PIN response before fragmented character lists', () => {
	authenticate(); recovery.pin(0);
	const enter = vi.fn();
	recovery.characterList([{ GID: 11 }], enter); expect(enter).not.toHaveBeenCalled();
	recovery.characterList([{ GID: 22 }], enter); expect(enter).toHaveBeenCalledTimes(1);
});
it.each([
	[2, 'a:6900', [{ ip: 3, port: 6121, name: 'A' }]],
	[1, 'b:6900', [{ ip: 3, port: 6121, name: 'A' }]],
	[1, 'a:6900', [{ ip: 4, port: 6121, name: 'A' }]]
])('never restores across account or server changes', (aid, server, list) => {
	recovery.disconnected(); recovery.beginLogin();
	expect(recovery.loginAccepted(aid, server, list)).toBeNull();
	expect(recovery.state).toBe('idle');
});
it('returns to ordinary selection if the original character no longer exists', () => {
	authenticate(); recovery.pin(0);
	recovery.characterList([{ GID: 11 }], vi.fn()); recovery.charactersComplete();
	expect(recovery.state).toBe('idle');
});
it('cancels recovery on intentional exit or explicit authentication rejection', () => {
	recovery.check(); recovery.cancel();
	expect(recovery.disconnected()).toBe(false);
	vi.advanceTimersByTime(60000);
	expect(deps.close).not.toHaveBeenCalled();
});
it('bounds restoration time and allows the user to leave without retry loops', () => {
	authenticate(); recovery.pin(0); recovery.characterList([{ GID: 22 }], vi.fn());
	vi.advanceTimersByTime(30000);
	expect(recovery.state).toBe('disconnected');
	recovery.beginLogin(false);
	expect(recovery.state).toBe('idle');
	expect(recovery.loginAccepted(1, 'a:6900', [identity.charServer])).toBeNull();
});
