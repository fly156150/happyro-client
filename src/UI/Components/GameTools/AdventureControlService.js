import Session from 'Engine/SessionStorage.js';

function headers() {
	return {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		'X-HappyRO-Account-ID': String(Session.AID),
		'X-HappyRO-Character-ID': String(Session.GID),
		'X-HappyRO-Auth-Token': Session.WebToken || ''
	};
}

async function requestBody(path, options = {}) {
	const response = await fetch(`/api/adventure-tools${path}`, { ...options, headers: headers() });
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const validation = body.errors ? Object.values(body.errors).flat()[0] : null;
		const error = new Error(validation || body.message || body.error?.message || '操作失败，请稍后重试');
		error.code = body.error?.code;
		throw error;
	}
	return body;
}

async function request(path, options = {}) {
	return (await requestBody(path, options)).data;
}

export async function loadAdventureAsset(path) {
	const response = await fetch(`/api/adventure-tools${path}`, { headers: headers() });
	if (!response.ok) throw new Error('物品图片加载失败');
	return URL.createObjectURL(await response.blob());
}

function createIdempotencyKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function loadAdventureControlBootstrap() {
	return request('/bootstrap');
}

export function loadCurrentCharacter() {
	return request('/character');
}

export function loadCharacterAllocationLimits() {
	return request('/character/allocation-limits');
}

export function maintainCurrentCharacter(type, payload) {
	return request('/character/commands', {
		method: 'POST',
		body: JSON.stringify({ idempotency_key: createIdempotencyKey(), type, payload })
	});
}

export function loadAdventureGameSettings() {
	return request('/game-settings');
}

export function searchAdventureItems({ query = '', type = '', subtype = '', dropKind = 'all', page = 1, perPage = 30 } = {}) {
	const params = new URLSearchParams({ page, perPage });
	if (query) params.set('query', query);
	if (type) params.set('type', type);
	if (subtype) params.set('subtype', subtype);
	if (dropKind !== 'all') params.set('dropKind', dropKind);
	return requestBody(`/items?${params}`);
}

export function loadAdventureItem(itemId) {
	return request(`/items/${itemId}`);
}

export function searchAdventureNpcs({ query = '', onMap = '', currentMap = '', page = 1, perPage = 32 } = {}) {
	const params = new URLSearchParams({ page, perPage });
	if (query) params.set('query', query);
	if (onMap) params.set('onMap', onMap);
	if (currentMap) params.set('currentMap', currentMap);
	return requestBody(`/npcs?${params}`);
}

/**
 * Every NPC on one map. The map preview places all markers at once, so this
 * stays unpaginated on purpose.
 */
export function loadAdventureMapNpcs(map) {
	return request(`/maps/${encodeURIComponent(map)}/npcs`);
}

export function searchAdventureMaps({ query = '', onMap = '', currentMap = '', page = 1, perPage = 35 } = {}) {
	const params = new URLSearchParams({ page, perPage });
	if (query) params.set('query', query);
	if (onMap) params.set('onMap', onMap);
	if (currentMap) params.set('currentMap', currentMap);
	return requestBody(`/maps?${params}`);
}

export function grantAdventureZeny(amount) {
	return request('/currency/zeny/grants', {
		method: 'POST',
		body: JSON.stringify({ idempotency_key: createIdempotencyKey(), amount })
	});
}

export function grantAdventureItem(itemId, amount) {
	return request('/items/grants', {
		method: 'POST',
		body: JSON.stringify({
			idempotency_key: createIdempotencyKey(),
			target: { type: 'self' },
			item_id: itemId,
			amount
		})
	});
}

export function applyAdventureGameSettings(changes) {
	return request('/game-settings', {
		method: 'PUT',
		body: JSON.stringify({ changes })
	});
}
