import { afterEach, describe, expect, it, vi } from 'vitest';
import Session from '../../src/Engine/SessionStorage.js';
import {
	loadCharacterAllocationLimits,
	grantAdventureItem,
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
