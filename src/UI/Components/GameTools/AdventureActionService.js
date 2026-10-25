import { abandonNavigationVisit } from 'UI/Game/NavigationVisit.js';
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
let mapProgress = null;
let mapArrival = null;
let npcArrival = null;
let mapArrivalCheck = null;
let endedConnectionId = null;
let npcArrivalCheck = null;
const ARRIVAL_TIMEOUT_MS = 30000;
const ARRIVAL_CHECK_MS = 100;
let npcTimer = null;
let mapTimer = null;
let cooldownUntil = 0;
let cooldownTimer = null;
let statusTimer = null;
let status = { message: '', error: false, kind: null };
const listeners = new Set();

onConnectionEnd(() => {
	endedConnectionId = Network.connectionId;
	clearTimeout(npcTimer);
	clearTimeout(mapTimer);
	clearTimeout(cooldownTimer);
	clearTimeout(statusTimer);
	npcPending = mapPending = false;
	mapCompletion?.({ result: -1 });
	mapCompletion = null;
	mapProgress = null;
	mapArrival = npcArrival = null;
	mapArrivalCheck = npcArrivalCheck = null;
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
	const connectionReady = Boolean(
		Session.Playing && Network.connectionId !== undefined && Network.connectionId !== endedConnectionId
	);
	return {
		allowed: Boolean(Session.NavigationTeleportAllowed),
		crossMapAllowed: Boolean(Session.NavigationTeleportCrossMap),
		connectionReady,
		canTeleport: Boolean(
			connectionReady &&
			Session.NavigationTeleportAllowed &&
			supportedMap &&
			(!crossMap || Session.NavigationTeleportCrossMap) &&
			!mapPending &&
			!npcPending &&
			!MapRenderer.loading &&
			Session.Entity &&
			Session.Entity.action !== Session.Entity.ACTION?.DIE &&
			Date.now() >= cooldownUntil
		),
		supportedMap,
		loading: Boolean(MapRenderer.loading),
		dead: Boolean(Session.Entity && Session.Entity.action === Session.Entity.ACTION?.DIE),
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

export function teleportToCoordinate(target, onComplete = null, onProgress = null) {
	const state = getAdventureActionState(target);
	if (
		!state.canTeleport ||
		!target?.mapName ||
		!Number.isInteger(target.x) ||
		!Number.isInteger(target.y) ||
		target.x < 0 ||
		target.y < 0 ||
		target.x > 0xffff ||
		target.y > 0xffff
	)
		return false;
	mapPending = true;
	mapCompletion = onComplete;
	mapProgress = onProgress;
	mapArrival = null;
	const requestId = ++nextMapRequestId;
	const packet = new PACKET.CZ.HAPPYRO_MAP_TELEPORT();
	packet.requestId = requestId;
	packet.mapName = normalizeAdventureMap(target.mapName);
	packet.x = Math.max(0, Math.floor(target.x));
	packet.y = Math.max(0, Math.floor(target.y));
	try {
		Network.sendPacket(packet);
	} catch {
		mapPending = false;
		mapCompletion = mapProgress = null;
		setStatus('传送请求未发送，请检查连接后重试。', true, 'coordinate');
		return false;
	}
	abandonNavigationVisit();
	setStatus('正在等待服务器确认...', false, 'coordinate');
	clearTimeout(mapTimer);
	mapTimer = setTimeout(() => {
		if (!mapPending || requestId !== nextMapRequestId) return;
		mapPending = false;
		setStatus('传送结果尚未确认，请先核对当前位置；不会自动重试。', true, 'coordinate');
		const complete = mapCompletion;
		mapCompletion = mapProgress = null;
		complete?.({ result: -1 });
	}, 8000);
	return true;
}

/** A successful receipt commits the server move; it does not finish client loading. */
function arrivalMatches(packet) {
	const entity = Session.Entity;
	const point = getCurrentAdventurePosition();
	return Boolean(
		entity &&
		entity.action !== entity.ACTION?.DIE &&
		!MapRenderer.loading &&
		normalizeAdventureMap(packet.mapName) === getCurrentAdventureMap() &&
		point.x === packet.x &&
		point.y === packet.y
	);
}

function watchArrival(kind, packet) {
	const coordinate = kind === 'coordinate';
	const identity = Session.GID;
	const connectionId = Network.connectionId;
	const deadline = Date.now() + ARRIVAL_TIMEOUT_MS;
	const finish = result => {
		if (coordinate) {
			mapPending = false;
			mapArrival = null;
			mapArrivalCheck = null;
			const complete = mapCompletion;
			mapCompletion = mapProgress = null;
			setStatus(result.result === 0 ? '' : result.message, result.result !== 0, kind);
			complete?.(result);
		} else {
			npcPending = false;
			npcArrival = null;
			npcArrivalCheck = null;
			setStatus(
				result.result === 0 ? `已传送到 NPC 附近 (${packet.x}, ${packet.y})` : result.message,
				result.result !== 0,
				kind
			);
		}
	};
	const check = () => {
		if ((coordinate ? mapArrival : npcArrival) !== packet) return;
		clearTimeout(coordinate ? mapTimer : npcTimer);
		if (Session.GID !== identity || Network.connectionId !== connectionId || !Session.Playing) {
			finish({ result: -1, message: '游戏会话已变化，请核对当前位置。' });
			return;
		}
		if (arrivalMatches(packet)) {
			finish(packet);
			return;
		}
		if (Date.now() >= deadline) {
			finish({
				result: -2,
				message: '服务器已接受传送，但尚未确认到达。请检查地图加载提示或重新登录；不会自动重试。'
			});
			return;
		}
		if (coordinate) mapTimer = setTimeout(check, ARRIVAL_CHECK_MS);
		else npcTimer = setTimeout(check, ARRIVAL_CHECK_MS);
	};
	if (coordinate) mapArrivalCheck = check;
	else npcArrivalCheck = check;
	setStatus('服务器已接受传送，正在等待地图和角色到达。', false, kind);
	if (coordinate) mapProgress?.({ phase: 'arrival', message: status.message });
	check();
}

export function handleMapTeleportResult(packet) {
	if (!mapPending || mapArrival || packet.requestId !== nextMapRequestId) return false;
	clearTimeout(mapTimer);
	const messages = {
		1: '当前角色没有传送权限',
		2: '跨地图传送已关闭',
		3: `传送冷却中，请等待 ${packet.cooldownRemaining} 秒`,
		4: '目标地图不可用',
		5: '当前地图规则禁止传送',
		6: '目标坐标无效',
		7: '传送失败，请稍后重试',
		8: '请先结束当前 NPC 对话，再尝试传送',
		9: '目标附近没有安全落点，请稍后重试。',
		10: '地图尚未加载完成，请稍后重试。'
	};
	if (packet.result === 0) {
		startCooldown(packet.cooldownRemaining);
		mapArrival = packet;
		watchArrival('coordinate', packet);
		return true;
	}
	mapPending = false;
	if (packet.result === 3) startCooldown(packet.cooldownRemaining);
	setStatus(messages[packet.result] || '传送请求被服务器拒绝', true, 'coordinate');
	const complete = mapCompletion;
	mapCompletion = mapProgress = null;
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
	try {
		Network.sendPacket(packet);
	} catch {
		npcPending = false;
		setStatus('传送请求未发送，请检查连接后重试。', true, 'npc');
		return false;
	}
	abandonNavigationVisit();
	setStatus('正在等待服务器确认...', false, 'npc');
	clearTimeout(npcTimer);
	npcTimer = setTimeout(() => {
		if (!npcPending || requestId !== nextNpcRequestId) return;
		npcPending = false;
		setStatus('传送结果尚未确认，请先核对当前位置；不会自动重试。', true, 'npc');
	}, 8000);
	return true;
}

export function handleNpcTeleportResult(packet) {
	if (!npcPending || npcArrival || packet.requestId !== nextNpcRequestId) return false;
	clearTimeout(npcTimer);
	const messages = {
		1: '当前角色没有传送权限',
		2: '跨地图传送已关闭',
		3: `传送冷却中，请等待 ${packet.cooldownRemaining} 秒`,
		4: '目标地图不可用',
		5: 'NPC 当前不存在或不可见',
		6: '当前地图规则禁止传送',
		7: 'NPC 附近没有可用落点',
		8: '传送失败，请稍后重试',
		9: '地图尚未加载完成，请稍后重试。'
	};
	if (packet.result === 0) {
		startCooldown(packet.cooldownRemaining);
		npcArrival = packet;
		watchArrival('npc', packet);
		return true;
	} else {
		npcPending = false;
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

/** MapRenderer clears loading immediately after onReady; observe before the next input frame. */
export function notifyAdventureMapReady() {
	queueMicrotask(() => {
		mapArrivalCheck?.();
		npcArrivalCheck?.();
		notify();
	});
}
