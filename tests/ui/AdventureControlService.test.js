import { afterEach, describe, expect, it, vi } from 'vitest';
import Session from '../../src/Engine/SessionStorage.js';
import {
	applyAdventureGameSettings,
	loadCharacterAllocationLimits,
	grantAdventureItem,
	grantAdventureZeny,
	loadAdventureControlBootstrap,
	maintainCurrentCharacter,
	searchAdventureItems
} from '../../src/UI/Components/GameTools/AdventureControlService.js';

describe('adventure control service', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('creates a UUID idempotency key without crypto.randomUUID', async () => {
		Session.AID = 2000001;
		Session.GID = 150002;
		Session.WebToken = 'session-token';
		vi.stubGlobal('crypto', {
			getRandomValues(bytes) {
				bytes.forEach((_, index) => (bytes[index] = index));
				return bytes;
			}
		});
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: { char_id: 150002 } })
		});
		vi.stubGlobal('fetch', fetchMock);

		await maintainCurrentCharacter('character.vitals.restore', {});

		const [url, options] = fetchMock.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(url).toBe('/api/adventure-tools/character/commands');
		expect(body.idempotency_key).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
		expect(options.headers['X-HappyRO-Auth-Token']).toBe('session-token');
	});

	it('loads session capabilities through the same authenticated endpoint', async () => {
		Session.AID = 2000001;
		Session.GID = 150002;
		Session.WebToken = 'session-token';
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: { gameSettingsAllowed: true } })
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(loadAdventureControlBootstrap()).resolves.toEqual({ gameSettingsAllowed: true });
		expect(fetchMock.mock.calls[0][0]).toBe('/api/adventure-tools/bootstrap');
		expect(fetchMock.mock.calls[0][1].headers['X-HappyRO-Account-ID']).toBe('2000001');
	});

	it('searches the server item catalog with pagination and filters', async () => {
		Session.AID = 2000001;
		Session.GID = 150002;
		Session.WebToken = 'session-token';
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], total: 0 }) });
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchAdventureItems({ query: '红药', type: 'Healing', page: 2, perPage: 30 })).resolves.toEqual({
			data: [],
			total: 0
		});

		expect(fetchMock.mock.calls[0][0]).toBe('/api/adventure-tools/items?page=2&perPage=30&query=%E7%BA%A2%E8%8D%AF&type=Healing');
	});

	it('grants an item explicitly to the current character target', async () => {
		Session.AID = 2000001;
		Session.GID = 150002;
		Session.WebToken = 'session-token';
		vi.stubGlobal('crypto', { getRandomValues: bytes => bytes.fill(1) });
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { item_id: 501, amount: 3 } }) });
		vi.stubGlobal('fetch', fetchMock);

		await grantAdventureItem(501, 3);

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toMatchObject({ target: { type: 'self' }, item_id: 501, amount: 3 });
	});
});

it('reads normal allocation limits through the authenticated read-only endpoint', async () => {
 Session.AID = 2000001; Session.GID = 150002; Session.WebToken = 'session-token';
 const limits = {base:{str:32767},traits:{pow:110}};
 const fetchMock = vi.fn().mockResolvedValue({ok:true,json:async()=>({data:limits})});
 vi.stubGlobal('fetch',fetchMock);
 try {
  await expect(loadCharacterAllocationLimits()).resolves.toEqual(limits);
  expect(fetchMock).toHaveBeenCalledWith('/api/adventure-tools/character/allocation-limits',expect.objectContaining({headers:expect.objectContaining({'X-HappyRO-Character-ID':'150002'})}));
 } finally { vi.unstubAllGlobals(); }
});

it('reuses failed settings requests, coalesces clicks and separates game sessions', async () => {
 Session.AID = 2000001; Session.GID = 150002; Session.WebToken = 'settings-session';
 let nonce = 1;
 vi.stubGlobal('crypto', { getRandomValues: bytes => bytes.fill(nonce++) });
 const fetchMock = vi.fn().mockRejectedValueOnce(new Error('connection lost'));
 vi.stubGlobal('fetch', fetchMock);
 try {
  await expect(applyAdventureGameSettings({ job_exp_rate: 200, base_exp_rate: 300 })).rejects.toThrow('connection lost');
  const original = JSON.parse(fetchMock.mock.calls[0][1].body).idempotency_key;
  let resolve;
  fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const first = applyAdventureGameSettings({ base_exp_rate: 300, job_exp_rate: 200 });
  const duplicate = applyAdventureGameSettings({ job_exp_rate: 200, base_exp_rate: 300 });
  expect(first).toBe(duplicate);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).idempotency_key).toBe(original);
  resolve({ ok: true, json: async () => ({ data: { values: {} } }) });
  await first;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
  await applyAdventureGameSettings({ base_exp_rate: 300, job_exp_rate: 200 });
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).idempotency_key).not.toBe(original);
  fetchMock.mockRejectedValueOnce(new Error('lost again'));
  await expect(applyAdventureGameSettings({ base_exp_rate: 400 })).rejects.toThrow('lost again');
  const failed = JSON.parse(fetchMock.mock.calls[3][1].body).idempotency_key;
  Session.WebToken = 'new-session';
  await applyAdventureGameSettings({ base_exp_rate: 400 });
  expect(JSON.parse(fetchMock.mock.calls[4][1].body).idempotency_key).not.toBe(failed);
 } finally { vi.unstubAllGlobals(); }
});

for (const [name, submit] of [
	['item', () => grantAdventureItem(501, 3)],
	['zeny', () => grantAdventureZeny(100)],
	['character', () => maintainCurrentCharacter('character.heal', {})]
]) {
	it(`retries ${name} with its original key after a lost response and coalesces clicks`, async () => {
		Session.AID = 2000001; Session.GID = 150002; Session.WebToken = `retry-${name}`;
		let nonce = 1;
		vi.stubGlobal('crypto', { getRandomValues: bytes => bytes.fill(nonce++) });
		const fetchMock = vi.fn().mockRejectedValueOnce(new Error('response lost'));
		vi.stubGlobal('fetch', fetchMock);
		try {
			await expect(submit()).rejects.toThrow('response lost');
			const key = JSON.parse(fetchMock.mock.calls[0][1].body).idempotency_key;
			let resolve;
			fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
			const first = submit(), second = submit();
			expect(first).toBe(second);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(JSON.parse(fetchMock.mock.calls[1][1].body).idempotency_key).toBe(key);
			resolve({ ok: true, json: async () => ({ data: { applied: true } }) });
			await first;
			fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
			await submit();
			expect(JSON.parse(fetchMock.mock.calls[2][1].body).idempotency_key).not.toBe(key);
			fetchMock.mockRejectedValueOnce(new Error('lost again'));
			await expect(submit()).rejects.toThrow();
			const oldSessionKey = JSON.parse(fetchMock.mock.calls[3][1].body).idempotency_key;
			Session.WebToken += '-new';
			await submit();
			expect(JSON.parse(fetchMock.mock.calls[4][1].body).idempotency_key).not.toBe(oldSessionKey);
		} finally { vi.unstubAllGlobals(); }
	});
}

it('allows a fresh command after a definitive offline rejection but preserves an unknown outcome', async () => {
	Session.AID = 2000001; Session.GID = 150002; Session.WebToken = 'definitive-rejection';
	let nonce = 1;
	vi.stubGlobal('crypto', { getRandomValues: bytes => bytes.fill(nonce++) });
	const fetchMock = vi.fn().mockResolvedValueOnce({ok:false,json:async()=>({error:{code:'character_offline'}})})
		.mockResolvedValue({ok:false,json:async()=>({error:{code:'command_not_replayable'}})});
	vi.stubGlobal('fetch', fetchMock);
	try {
		await expect(grantAdventureZeny(10)).rejects.toThrow();
		await expect(grantAdventureZeny(10)).rejects.toThrow();
		await expect(grantAdventureZeny(10)).rejects.toThrow();
		const keys = fetchMock.mock.calls.map(([,options])=>JSON.parse(options.body).idempotency_key);
		expect(keys[0]).not.toBe(keys[1]);
		expect(keys[1]).toBe(keys[2]);
	} finally { vi.unstubAllGlobals(); }
});

for (const [name, json] of [
	['truncated JSON', async () => { throw new SyntaxError('truncated'); }],
	['missing result', async () => ({})]
]) {
	it(`keeps the operation key when a successful response has ${name}`, async () => {
		Session.AID = 2000001; Session.GID = 150002; Session.WebToken = name;
		let nonce = 1;
		vi.stubGlobal('crypto', {getRandomValues: bytes => bytes.fill(nonce++)});
		const fetchMock = vi.fn().mockResolvedValueOnce({ok:true,json})
			.mockResolvedValue({ok:true,json:async()=>({data:{applied:true}})});
		vi.stubGlobal('fetch',fetchMock);
		try {
			await expect(grantAdventureItem(501,1)).rejects.toThrow();
			await expect(grantAdventureItem(501,1)).resolves.toEqual({applied:true});
			const keys=fetchMock.mock.calls.map(([,options])=>JSON.parse(options.body).idempotency_key);
			expect(keys[1]).toBe(keys[0]);
		} finally { vi.unstubAllGlobals(); }
	});
}

it('allows settings to be submitted again after automatic restoration', async () => {
 Session.WebToken = 'automatically-restored';
 let nonce = 1;
 vi.stubGlobal('crypto', { getRandomValues: bytes => bytes.fill(nonce++) });
 const fetchMock = vi.fn()
  .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { code: 'settings_auto_restored' } }) })
  .mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'applied' } }) });
 vi.stubGlobal('fetch', fetchMock);
 try {
  await expect(applyAdventureGameSettings({ base_exp_rate: 200 })).rejects.toThrow();
  await expect(applyAdventureGameSettings({ base_exp_rate: 200 })).resolves.toEqual({ status: 'applied' });
  const keys = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).idempotency_key);
  expect(keys[0]).not.toBe(keys[1]);
 } finally { vi.unstubAllGlobals(); }
});
