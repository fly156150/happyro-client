import { publishRecoveryStatus } from './RecoveryStatus.js';
import { createGameAutoRecovery, recoveryItems, recoveryItemName, loadRecoveryItemIcon } from './GameAutoRecovery.js';
import { subscribeSkillExecution } from 'Network/SkillExecution.js';
import { isIdentificationExam } from './IdentificationExam.js';
import { getCurrentAdventureMap } from 'UI/Components/GameTools/AdventureActionService.js';
import { registerAutomationCombat } from './GameAutomation.js';
import { cancelAutoCombatTeleport, consumeAutoCombatTeleport } from './AutoCombatTeleport.js';
import Session from 'Engine/SessionStorage.js';
import { subscribeGameInput } from 'Controls/GameInputIntent.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { createGameAutoCombat } from './GameAutoCombat.js';

const combatRuntimes = new Set();
let disposeActiveRuntime = null;
export function isAutoCombatEngaged() {
	return [...combatRuntimes].some(controller => {
		const state = controller.snapshot();
		return state.active && !state.pausedForMovement && Boolean(state.target);
	});
}

/** One map-scoped runtime shared by desktop and touch presentations. */
export function createGameAutoCombatRuntime({
	enabled = () => true,
	isMoving = () => false,
	update = () => {},
	onDisconnect = () => {}
} = {}) {
	disposeActiveRuntime?.();
	let destroyed = false;
	let movementHeld = false;
	let resumeAt = 0;
	const canRun = () =>
		Boolean(
			!destroyed &&
			!isIdentificationExam(getCurrentAdventureMap()) &&
			enabled() &&
			Session.Playing &&
			!Session.FreezeUI &&
			!document.hidden &&
			Session.Entity &&
			Session.Entity.action !== Session.Entity.ACTION.DIE
		);
	const controller = createGameAutoCombat(canRun);
	combatRuntimes.add(controller);
	const recovery = createGameAutoRecovery(canRun);
	const unsubscribeSkills = subscribeSkillExecution(controller.skillFeedback);
	const unregisterAutomation = registerAutomationCombat(controller);
	const abort = new AbortController();
	const stop = message => {
		cancelAutoCombatTeleport();
		movementHeld = false;
		controller.stop(message);
		recovery.reset();
		publishRecoveryStatus('');
		update(controller.snapshot());
	};
	const pauseForMovement = () => {
		controller.pauseForMovement();
		// Do not resume before a newly sent walk request can be reflected by the server.
		resumeAt = performance.now() + 300;
	};
	const unsubscribeInput = subscribeGameInput((kind, targetId) => {
		if (kind === 'move-start') {
			movementHeld = true;
			pauseForMovement();
		} else if (kind === 'move-pulse') {
			pauseForMovement();
		} else if (kind === 'move-end') {
			movementHeld = false;
			resumeAt = performance.now() + 300;
		} else if (kind === 'attack-target') {
			return controller.snapshot().active && controller.attackTarget(targetId);
		} else {
			stop(kind === 'skill' ? '手动施法，自动战斗已停止' : '手动操作，自动战斗已停止');
		}
		return false;
	});
	const timer = window.setInterval(() => {
		if (isIdentificationExam(getCurrentAdventureMap()) || Session.Entity?.action === Session.Entity?.ACTION.DIE) cancelAutoCombatTeleport();
		if (canRun() && consumeAutoCombatTeleport()) controller.start();
		if (
			canRun() &&
			!movementHeld &&
			!isMoving() &&
			performance.now() >= resumeAt &&
			Session.Entity?.action !== Session.Entity?.ACTION.WALK
		)
			controller.resumeAfterMovement();
		recovery.tick(controller.snapshot().recovery, canRun() && controller.snapshot().active);
		publishRecoveryStatus(recovery.snapshot().status);
		controller.tick();
		update(controller.snapshot());
	}, 200);
	window.addEventListener('blur', () => stop(), { signal: abort.signal });
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.hidden) stop();
		},
		{ signal: abort.signal }
	);
	const unsubscribeConnection = onConnectionEnd(() => {
		destroy();
		onDisconnect();
	});
	function destroy() {
		if (destroyed) return;
		destroyed = true;
		if (disposeActiveRuntime === destroy) disposeActiveRuntime = null;
		combatRuntimes.delete(controller);
		unregisterAutomation();
		clearInterval(timer);
		abort.abort();
		unsubscribeInput();
		unsubscribeSkills();
		unsubscribeConnection();
		recovery.reset();
		publishRecoveryStatus('');
		controller.stop();
	}
	disposeActiveRuntime = destroy;
	return { ...controller, recoveryItems, recoveryItemName, loadRecoveryItemIcon, stop, pauseForMovement, destroy, recoveryStatus: () => recovery.snapshot() };
}
