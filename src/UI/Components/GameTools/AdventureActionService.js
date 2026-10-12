import Network from 'Network/NetworkManager.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import { isSupportedMapResource } from 'DB/Map/SupportedMapTable.js';

let nextNpcRequestId = 0x80000000;
let nextMapRequestId = 0x40000000;
let npcPending = false;
let mapPending = false;
let mapCompletion = null;
let npcTimer = null;
let mapTimer = null;
let cooldownUntil = 0;
let cooldownTimer = null;
let statusTimer = null;
let status = { message: '', error: false, kind: null };
const listeners = new Set();

onConnectionEnd(() => {
	clearTimeout(npcTimer);
	clearTimeout(mapTimer);
	clearTimeout(cooldownTimer);
	clearTimeout(statusTimer);
	npcPending = mapPending = false;
	mapCompletion?.({ result: -1 });
	mapCompletion = null;
	cooldownUntil = 0;
	status = { message: '', error: false, kind: null };
	notify();
});

export function normalizeAdventureMap(mapName) {
	return String(mapName || '')
		.replace(/\.gat$/i, '')
		.toLocaleLowerCase();
}

export function getCurrentAdventureMap() {
	return normalizeAdventureMap(MapRenderer.currentMap);
}

export function getCurrentAdventurePosition() {
	return {
		x: Math.ceil(Session.Entity?.position?.[0] || 0),
		y: Math.ceil(Session.Entity?.position?.[1] || 0)
	};
}

function notify() {
	for (const listener of listeners) listener(getAdventureActionState());
}

function setStatus(message, error = false, kind = null, duration = 0) {
	clearTimeout(statusTimer);
	status = { message, error, kind };
	notify();
	if (duration > 0) {
		statusTimer = setTimeout(() => {
			if (status.kind !== kind || status.message !== message) return;
			status = { message: '', error: false, kind: null };
			notify();
		}, duration);
	}
}

function startCooldown(seconds) {
	cooldownUntil = Date.now() + Math.max(0, seconds) * 1000;
	clearTimeout(cooldownTimer);
	cooldownTimer = setTimeout(notify, Math.max(0, seconds) * 1000);
}

export function getAdventureActionState(target = null) {
	const crossMap = target?.mapName && normalizeAdventureMap(target.mapName) !== getCurrentAdventureMap();
	const supportedMap = !target?.mapName || isSupportedMapResource(target.mapName);
	return {
		allowed: Boolean(Session.NavigationTeleportAllowed),
		crossMapAllowed: Boolean(Session.NavigationTeleportCrossMap),
		canTeleport: Boolean(
			Session.NavigationTeleportAllowed &&
			supportedMap &&
			(!crossMap || Session.NavigationTeleportCrossMap) &&
			!mapPending &&
			Date.now() >= cooldownUntil
		),
		supportedMap,
		npcPending,
		mapPending,
		cooldownRemaining: Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)),
		...status
	};
}

export function subscribeAdventureActions(listener) {
	listeners.add(listener);
	listener(getAdventureActionState());
	return () => listeners.delete(listener);
}

/** Reserved uint16 pair requests a random safe cell, distinct from the (0,0) default arrival. */
export function teleportToRandomCell(mapName, onComplete = null) {
	return teleportToCoordinate({ mapName, x: 0xffff, y: 0xffff }, onComplete);
}

export function teleportToCoordinate(target, onComplete = null) {
	const state = getAdventureActionState(target);
	if (!state.canTeleport || !target?.mapName || !Number.isFinite(target.x) || !Number.isFinite(target.y))
		return false;
	mapPending = true;
	mapCompletion = onComplete;
	const requestId = ++nextMapRequestId;
	const packet = new PACKET.CZ.HAPPYRO_MAP_TELEPORT();
	packet.requestId = requestId;
	packet.mapName = normalizeAdventureMap(target.mapName);
	packet.x = Math.max(0, Math.floor(target.x));
	packet.y = Math.max(0, Math.floor(target.y));
	Network.sendPacket(packet);
	setStatus('正在等待服务器确认...', false, 'coordinate');
	clearTimeout(mapTimer);
	mapTimer = setTimeout(() => {
		if (!mapPending || requestId !== nextMapRequestId) return;
		mapPending = false;
		setStatus('服务器响应超时，请稍后重试', true, 'coordinate');
		const complete = mapCompletion;
		mapCompletion = null;
		complete?.({ result: -1 });
	}, 8000);
	return true;
}

export function handleMapTeleportResult(packet) {
	if (!mapPending || packet.requestId !== nextMapRequestId) return false;
	clearTimeout(mapTimer);
	mapPending = false;
	const messages = {
		1: '当前角色没有传送权限',
		2: '跨地图传送已关闭',
		3: `传送冷却中，请等待 ${packet.cooldownRemaining} 秒`,
		4: '目标地图不可用',
		5: '当前地图规则禁止传送',
		6: '目标坐标无效',
		7: '传送失败，请稍后重试'
	};
	if (packet.result === 0) {
		startCooldown(packet.cooldownRemaining);
		setStatus('', false, null);
	} else {
		if (packet.result === 3) startCooldown(packet.cooldownRemaining);
		setStatus(messages[packet.result] || '传送请求被服务器拒绝', true, 'coordinate');
	}
	const complete = mapCompletion;
	mapCompletion = null;
	complete?.(packet);
	return true;
}

export function teleportToNpc(npc) {
	const state = getAdventureActionState(npc);
	if (
		npcPending ||
		!state.canTeleport ||
		!isSupportedMapResource(npc?.mapName) ||
		npc?.type !== 'NPC' ||
		!Number.isFinite(npc.x) ||
		!Number.isFinite(npc.y) ||
		!Number.isFinite(npc.npcClass)
	)
		return false;

	npcPending = true;
	const requestId = ++nextNpcRequestId;
	const packet = new PACKET.CZ.HAPPYRO_NPC_TELEPORT();
	packet.requestId = requestId;
	packet.mapName = normalizeAdventureMap(npc.mapName);
	packet.npcX = Math.max(0, Math.floor(npc.x));
	packet.npcY = Math.max(0, Math.floor(npc.y));
	packet.npcClass = Math.floor(npc.npcClass);
	Network.sendPacket(packet);
	setStatus('正在等待服务器确认...', false, 'npc');
	clearTimeout(npcTimer);
	npcTimer = setTimeout(() => {
		if (!npcPending || requestId !== nextNpcRequestId) return;
		npcPending = false;
		setStatus('服务器响应超时，请稍后重试', true, 'npc');
	}, 8000);
	return true;
}

export function handleNpcTeleportResult(packet) {
	if (!npcPending || packet.requestId !== nextNpcRequestId) return false;
	clearTimeout(npcTimer);
	npcPending = false;
	const messages = {
		1: '当前角色没有传送权限',
		2: '跨地图传送已关闭',
		3: `传送冷却中，请等待 ${packet.cooldownRemaining} 秒`,
		4: '目标地图不可用',
		5: 'NPC 当前不存在或不可见',
		6: '当前地图规则禁止传送',
		7: 'NPC 附近没有可用落点',
		8: '传送失败，请稍后重试'
	};
	if (packet.result === 0) {
		startCooldown(packet.cooldownRemaining);
		setStatus(`已传送到 NPC 附近 (${packet.x}, ${packet.y})`, false, 'npc');
	} else {
		if (packet.result === 3) startCooldown(packet.cooldownRemaining);
		setStatus(messages[packet.result] || '传送请求被服务器拒绝', true, 'npc');
	}
	return true;
}

export function notifyAdventureConfigChanged() {
	notify();
}

export function clearAdventureActionFeedback() {
	setStatus('', false, null);
}
