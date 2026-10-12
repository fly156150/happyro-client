import Session from 'Engine/SessionStorage.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { subscribeGameInput } from 'Controls/GameInputIntent.js';
import {
	getCurrentAdventureMap,
	normalizeAdventureMap,
	getAdventureActionState,
	teleportToRandomCell
} from 'UI/Components/GameTools/AdventureActionService.js';

// This short-lived ticket survives UI destruction during our own same-map warp only.
let ticket = null;
let nextAllowed = 0;
let feedback = '';
const identity = () => JSON.stringify([Session.ServerName, Session.AID, Session.GID]);
export function cancelAutoCombatTeleport() {
	ticket = null;
}
export function isAutoCombatTeleportPending() {
	return Boolean(ticket && ticket.expires > Date.now());
}
export function requestAutoCombatTeleport(intervalSeconds) {
	if (ticket && ticket.expires <= Date.now()) ticket = null;
	if (ticket) return '正在随机瞬移';
	const state = getAdventureActionState();
	if (!state.allowed) return '无法随机瞬移：没有冒险工具传送权限';
	if (Date.now() < nextAllowed) return feedback || `等待瞬移间隔：${Math.ceil((nextAllowed - Date.now()) / 1000)} 秒`;
	if (!state.canTeleport || state.npcPending)
		return state.cooldownRemaining ? `传送冷却：${state.cooldownRemaining} 秒` : '等待冒险工具传送完成';
	const attempt = {
		identity: identity(),
		map: getCurrentAdventureMap(),
		expires: Date.now() + 15000,
		transitioned: false,
		ready: false,
		success: false
	};
	ticket = attempt;
	const sent = teleportToRandomCell(attempt.map, packet => {
		if (ticket !== attempt) return;
		if (packet.result !== 0) {
			ticket = null;
			feedback = getAdventureActionState().message || '随机瞬移失败';
		} else attempt.success = true;
	});
	if (!sent) {
		ticket = null;
		return '随机瞬移暂不可用';
	}
	nextAllowed = Date.now() + intervalSeconds * 1000;
	feedback = '';
	return '正在随机瞬移';
}
export function prepareAutoCombatTeleportMap(mapName) {
	if (!ticket) {
		feedback = '';
		return;
	}
	if (
		ticket.transitioned ||
		ticket.identity !== identity() ||
		ticket.map !== normalizeAdventureMap(mapName) ||
		ticket.expires <= Date.now()
	) {
		ticket = null;
		return;
	}
	ticket.transitioned = true;
}
export function completeAutoCombatTeleportMap() {
	if (ticket?.transitioned) ticket.ready = true;
}
export function consumeAutoCombatTeleport() {
	if (!ticket) return false;
	if (ticket.identity !== identity() || ticket.expires <= Date.now() || ticket.map !== getCurrentAdventureMap()) {
		ticket = null;
		return false;
	}
	if (!ticket.success || !ticket.ready) return false;
	ticket = null;
	return true;
}
subscribeGameInput(() => {
	cancelAutoCombatTeleport();
	return false;
});
window.addEventListener('blur', cancelAutoCombatTeleport);
document.addEventListener('visibilitychange', () => {
	if (document.hidden) cancelAutoCombatTeleport();
});
onConnectionEnd(() => {
	ticket = null;
	nextAllowed = 0;
	feedback = '';
});
