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
	const body = await response.json().catch(() => {
		if (response.ok) throw new Error('无法解析服务器响应，请核对操作结果后重试');
		return {};
	});
	if (!response.ok) {
		const validation = body.errors ? Object.values(body.errors).flat()[0] : null;
		const error = new Error(validation || body.message || body.error?.message || '操作失败，请稍后重试');
		error.code = body.error?.code;
		throw error;
	}
	return body;
}

async function request(path, options = {}) {
	const body = await requestBody(path, options);
	if (!body || !Object.hasOwn(body, 'data')) throw new Error('服务器响应不完整，请核对操作结果后重试');
	return body.data;
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

// Keep an uncertain write's key until its result is known. A second click is
// a retry of that operation, not permission to execute the mutation again.
let mutationSession = '';
let pendingMutations = new Map();
const rejectedBeforeExecution = new Set([
	'validation_failed', 'forbidden', 'invalid_game_session', 'unauthenticated',
	'rate_limited', 'character_offline', 'character_not_found', 'item_not_found',
	'invalid_parameter', 'item_not_grantable', 'inventory_full',
	'inventory_overweight', 'item_amount_exceeded', 'insufficient_zeny'
]);

function mutate(path, input) {
	const session = JSON.stringify([Session.AID, Session.GID, Session.WebToken]);
	if (session !== mutationSession) {
		mutationSession = session;
		pendingMutations = new Map();
	}
	const requests = pendingMutations;
	const fingerprint = JSON.stringify([path, input]);
	let operation = requests.get(fingerprint);
	if (!operation) {
		operation = { key: createIdempotencyKey(), pending: null };
		requests.set(fingerprint, operation);
	}
	if (operation.pending) return operation.pending;
	operation.pending = request(path, {
		method: 'POST',
		body: JSON.stringify({ ...input, idempotency_key: operation.key })
	}).then(result => {
		requests.delete(fingerprint);
		return result;
	}).catch(error => {
		if (rejectedBeforeExecution.has(error.code)) requests.delete(fingerprint);
		throw error;
	}).finally(() => { operation.pending = null; });
	return operation.pending;
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
	return mutate('/character/commands', { type, payload });
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
	return mutate('/currency/zeny/grants', { amount });
}

export function grantAdventureItem(itemId, amount) {
	return mutate('/items/grants', { target: { type: 'self' }, item_id: itemId, amount });
}

let settingsSession = '';
let pendingSettings = new Map();

export function applyAdventureGameSettings(changes) {
	const session = JSON.stringify([Session.AID, Session.GID, Session.WebToken]);
	if (session !== settingsSession) {
		settingsSession = session;
		pendingSettings = new Map();
	}
	const requests = pendingSettings;
	const sortedChanges = Object.fromEntries(Object.entries(changes).sort(([left], [right]) => left.localeCompare(right)));
	const fingerprint = JSON.stringify(sortedChanges);
	let operation = requests.get(fingerprint);
	if (!operation) {
		operation = { key: createIdempotencyKey(), pending: null };
		requests.set(fingerprint, operation);
	}
	if (operation.pending) return operation.pending;
	operation.pending = request('/game-settings', {
		method: 'PUT',
		body: JSON.stringify({ idempotency_key: operation.key, changes: sortedChanges })
	}).then(result => {
		requests.delete(fingerprint);
		return result;
	}).catch(error => {
		if (error.code === 'settings_auto_restored') requests.delete(fingerprint);
		throw error;
	}).finally(() => {
		operation.pending = null;
	});
	return operation.pending;
}
