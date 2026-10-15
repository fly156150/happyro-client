import { registerAutomationPickup, hasAutomationCombat } from './GameAutomation.js';
import { isAutoCombatTeleportPending } from './AutoCombatTeleport.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Renderer from 'Renderer/Renderer.js';
import Mouse from 'Controls/MouseEventHandler.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PathFinding from 'Utils/PathFinding.js';
import Altitude from 'Renderer/Map/Altitude.js';
import { subscribeGameInput } from 'Controls/GameInputIntent.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { isAutoCombatEngaged } from './GameAutoCombatRuntime.js';
import { loadPickupSettings } from './PickupSettings.js';
import { matchesPickupCategory } from './PickupCatalog.js';
import { createAutoPickupController } from './AutoPickupController.js';

let runtime;
export function stopAutoPickup() {
	runtime?.destroy();
	runtime = null;
}
export function startAutoPickup() {
	stopAutoPickup();
	let queued,
		destroyed = false;
	const controller = createAutoPickupController({
		now: () => performance.now(),
		settings: loadPickupSettings,
		available: () =>
			Boolean(
				Session.Playing &&
				!Session.FreezeUI &&
				!isAutoCombatEngaged() &&
				!isAutoCombatTeleportPending() &&
				!document.hidden &&
				Session.Entity &&
				![Session.Entity.ACTION.DIE, Session.Entity.ACTION.SIT].includes(Session.Entity.action)
			),
		position: () => Session.Entity.position,
		items: () => {
			const result = [];
			EntityManager.forEach(entity => {
				if (entity.objecttype === entity.constructor.TYPE_ITEM && entity.pickupItemId && !entity.remove_tick)
					result.push({
						id: entity.GID,
						itemId: entity.pickupItemId,
						type: entity.pickupItemType,
						position: [...entity.position]
					});
			});
			return result;
		},
		matches: matchesPickupCategory,
		busy: () =>
			Boolean(
				Session.moveAction ||
				Session.autoFollow ||
				isAutoCombatEngaged() ||
				Session.Entity.action === Session.Entity.ACTION.WALK ||
				Session.Entity.action === Session.Entity.ACTION.ATTACK ||
				Session.Entity.cast?.display ||
				Session.Entity.amotionTick > Renderer.tick ||
				document.querySelector('#MobileGameHUD')?.shadowRoot?.querySelector('.backdrop:not([hidden])') ||
				document.activeElement?.matches('input, textarea')
			),
		chasing: () => Boolean(queued && Session.moveAction === queued),
		reachable: item =>
			item.distance <= 2 ||
			PathFinding.search(
				Session.Entity.position[0] | 0,
				Session.Entity.position[1] | 0,
				Math.round(item.position[0]),
				Math.round(item.position[1]),
				1,
				[],
				Altitude.TYPE.WALKABLE
			) > 0,
		pick: item => {
			const entity = EntityManager.get(item.id);
			if (!entity) return;
			const previous = { ...Mouse.world };
			try {
				Mouse.world.x = Math.round(entity.position[0]);
				Mouse.world.y = Math.round(entity.position[1]);
				entity.onMouseDown();
				queued = Session.moveAction?.ITAID === item.id ? Session.moveAction : null;
			} finally {
				Object.assign(Mouse.world, previous);
			}
		},
		cancel: () => {
			if (queued && Session.moveAction === queued) {
				Session.moveAction = null;
				if (Session.Playing && Session.Entity?.action !== Session.Entity?.ACTION.DIE)
					Network.sendPacket(new PACKET.CZ.HAPPYRO_STOP_MOVE());
			}
			queued = null;
		}
	});
	const unsubscribe = subscribeGameInput(kind => {
		controller.manual(kind);
		return false;
	});
	const unregisterAutomation = registerAutomationPickup(controller);
	const timer = window.setInterval(() => {
		if (!hasAutomationCombat()) controller.tick();
	}, 200);
	const settingsChanged = () => controller.cancel();
	// Focus loss can swallow mouseup; release the movement hold as well as cancelling pickup.
	const blur = () => controller.manual('move-end');
	const visibilityChanged = () => {
		if (document.hidden) blur();
	};
	window.addEventListener('happyro-pickup-settings', settingsChanged);
	window.addEventListener('blur', blur);
	document.addEventListener('visibilitychange', visibilityChanged);
	const disconnect = onConnectionEnd(stopAutoPickup);
	runtime = {
		destroy() {
			if (destroyed) return;
			destroyed = true;
			clearInterval(timer);
			controller.destroy();
			unregisterAutomation();
			unsubscribe();
			disconnect();
			window.removeEventListener('happyro-pickup-settings', settingsChanged);
			window.removeEventListener('blur', blur);
			document.removeEventListener('visibilitychange', visibilityChanged);
		}
	};
}
