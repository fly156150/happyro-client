import { abandonNavigationVisit } from 'UI/Game/NavigationVisit.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';
import { remainingPathFromPosition } from 'UI/Components/Navigation/NavigationAutoWalk.js';
import {
	getCurrentAdventureMap,
	getCurrentAdventurePosition,
	normalizeAdventureMap
} from './AdventureActionService.js';

let timer = null;
let target = null;
let navigationStarted = false;
let navigationState = Navigation.getRouteState();
let status = { active: false, message: '' };
const listeners = new Set();

function matchesTarget(navigationTarget, routeTarget) {
	return Boolean(
		navigationTarget &&
		routeTarget &&
		navigationTarget.map === normalizeAdventureMap(routeTarget.mapName) &&
		navigationTarget.x === routeTarget.x &&
		navigationTarget.y === routeTarget.y
	);
}

function notify() {
	const state = getStatus();
	for (const listener of listeners) listener(state);
}

function getStatus() {
	const routeMatches = matchesTarget(navigationState.target, target);
	const path = routeMatches ? remainingPathFromPosition(navigationState.path, getCurrentAdventurePosition()) : [];
	return {
		...status,
		target: target ? { ...target } : null,
		path,
		pending: routeMatches && navigationState.pending,
		walking: routeMatches && navigationState.active,
		unavailable: routeMatches && navigationState.unavailable
	};
}

function update(active, message) {
	status = { active, message };
	notify();
}

function monitorArrival() {
	if (!target || !status.active) return;
	// Intermediate maps are part of a route; Navigation resumes after loading.
	if (getCurrentAdventureMap() !== normalizeAdventureMap(target.mapName)) return;
	const position = getCurrentAdventurePosition();
	if (Math.abs(position.x - target.x) <= 1 && Math.abs(position.y - target.y) <= 1) {
		stopAdventureRoute('已到达目的地');
	}
}

export function previewAdventureRoute(nextTarget) {
	if (
		!nextTarget?.mapName ||
		!Number.isFinite(nextTarget.x) ||
		!Number.isFinite(nextTarget.y) ||
		normalizeAdventureMap(nextTarget.mapName) !== getCurrentAdventureMap()
	)
		return false;
	if (status.active) stopAdventureRoute();
	else Navigation.stopAutoWalk();
	clearInterval(timer);
	timer = null;
	target = { ...nextTarget };
	navigationStarted = false;
	update(false, '');
	const position = getCurrentAdventurePosition();
	Navigation.navigateTo({
		startMap: getCurrentAdventureMap(),
		startX: position.x,
		startY: position.y,
		endMap: normalizeAdventureMap(target.mapName),
		endX: target.x,
		endY: target.y,
		displayName: target.mapDisplayName || target.mapName,
		autoWalk: false
	});
	return true;
}

export function startAdventureRoute(nextTarget) {
	if (
		(getStatus().pending || getStatus().unavailable || status.active) &&
		target &&
		normalizeAdventureMap(target.mapName) === normalizeAdventureMap(nextTarget?.mapName) &&
		target.x === nextTarget?.x &&
		target.y === nextTarget?.y
	)
		return false;
	if (
		!nextTarget?.mapName ||
		!Number.isFinite(nextTarget.x) ||
		!Number.isFinite(nextTarget.y) ||
		normalizeAdventureMap(nextTarget.mapName) !== getCurrentAdventureMap()
	)
		return false;
	clearInterval(timer);
	if (status.active) stopAdventureRoute();
	else Navigation.stopAutoWalk();
	clearInterval(timer);
	timer = null;
	target = { ...nextTarget };
	navigationStarted = false;
	abandonNavigationVisit();
	update(true, '');
	const position = getCurrentAdventurePosition();
	Navigation.navigateTo({
		startMap: getCurrentAdventureMap(),
		startX: position.x,
		startY: position.y,
		endMap: normalizeAdventureMap(target.mapName),
		endX: target.x,
		endY: target.y,
		displayName: target.mapDisplayName || target.mapName,
		autoWalk: true
	});
	timer = setInterval(monitorArrival, 500);
	return true;
}

export function stopAdventureRoute(message = '') {
	const stopMovement = !message && status.active;
	clearInterval(timer);
	timer = null;
	navigationStarted = false;
	update(false, message);
	if (message === '已到达目的地') {
		target = null;
		Navigation.clear();
		return;
	}
	Navigation.stopAutoWalk();
	if (stopMovement && Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE) {
		Network.sendPacket(new PACKET.CZ.HAPPYRO_STOP_MOVE());
	}
}

export function subscribeAdventureRoute(listener) {
	listeners.add(listener);
	listener(getStatus());
	return () => listeners.delete(listener);
}

Navigation.subscribeRouteState(nextState => {
	navigationState = nextState;
	if (!target || !matchesTarget(nextState.target, target)) {
		if (status.active) {
			const position = getCurrentAdventurePosition();
			const arrived =
				target &&
				getCurrentAdventureMap() === normalizeAdventureMap(target.mapName) &&
				Math.abs(position.x - target.x) <= 1 &&
				Math.abs(position.y - target.y) <= 1;
			stopAdventureRoute(arrived ? '已到达目的地' : '寻路已停止');
		} else notify();
		return;
	}
	if (nextState.active) navigationStarted = true;
	if (nextState.unavailable) {
		clearInterval(timer);
		timer = null;
		navigationStarted = false;
		update(false, '');
		return;
	}
	if (status.active && navigationStarted && !nextState.active && !nextState.pending) {
		const position = getCurrentAdventurePosition();
		const arrived =
			getCurrentAdventureMap() === normalizeAdventureMap(target.mapName) &&
			Math.abs(position.x - target.x) <= 1 &&
			Math.abs(position.y - target.y) <= 1;
		stopAdventureRoute(arrived ? '已到达目的地' : '寻路已停止');
		return;
	}
	if (!status.active && !nextState.pending) status = { active: false, message: '' };
	notify();
});

export function clearAdventureRouteFeedback() {
	status = { ...status, message: '' };
	notify();
}
