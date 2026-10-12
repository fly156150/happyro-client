import { expect, it, vi } from 'vitest';
import { createGameSession } from '../../src/Engine/Auth/GameSession.js';
const response = body => ({ ok: true, status: 200, json: async () => body });
it('keeps temporary credentials only in memory and rotates on resume', async () => {
	const fetch = vi.fn().mockResolvedValueOnce(response({ token: 'old' })).mockResolvedValueOnce(response({ token: 'new', ticket: 'ticket' }));
	const session = createGameSession(fetch);
	await session.create(1, 'web', false);
	expect(session.available).toBe(true);
	expect((await session.resume()).ticket).toBe('ticket');
	expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ token: 'old' });
	expect(fetch.mock.calls[1][1].credentials).toBe('same-origin');
});
it('persistent credentials use cookie transport without token in request body', async () => {
	const fetch = vi.fn().mockResolvedValue(response({ persistent: true }));
	const session = createGameSession(fetch);
	await session.create(1, 'web', true); await session.resume();
	expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({});
});
it('logout waits for pending creation, then revokes its actual credential', async () => {
	let finish;
	const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ok: true, status: 204 });
	const session = createGameSession(fetch);
	const creation = session.create(1, 'web', false);
	await Promise.resolve();
	const logout = session.revoke();
	finish(response({ token: 'just-created' }));
	await creation; await logout;
	expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ token: 'just-created' });
	expect(session.available).toBe(false);
});
it('expired session requires ordinary login and does not leave credentials available', async () => {
	const session = createGameSession(vi.fn().mockResolvedValue({ ok: false, status: 401 }));
	expect(await session.resume()).toBeNull(); expect(session.available).toBe(false);
});
it('service failure rejects without pretending logout succeeded', async () => {
	const session = createGameSession(vi.fn().mockResolvedValue({ ok: false, status: 503 }));
	await expect(session.revoke()).rejects.toThrow('暂时不可用');
});
