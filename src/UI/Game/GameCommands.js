import { canCommandGameCompanion, commandGameCompanion, companionAttackMode } from './GameCompanions.js';
import { canCommandGamePet, commandGamePet } from './GamePet.js';
import Friends from 'Engine/MapEngine/Friends.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import Trade from 'UI/Components/Trade/Trade.js';
import UIManager from 'UI/UIManager.js';
import { ownAttack, releaseAttack } from 'Controls/AttackIntent.js';
import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Camera from 'Renderer/Camera.js';
import { DEFAULT_CAMERA_ZOOM } from 'Preferences/Camera.js';
import Altitude from 'Renderer/Map/Altitude.js';
import Mouse from 'Controls/MouseEventHandler.js';
import MapControl, { checkFreeCell } from 'Controls/MapControl.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';

let directionalMovementPlayer = null;

export function selectedTarget() {
	const target = EntityManager.getFocusEntity();
	return target && EntityManager.get(target.GID) === target && target.action !== target.ACTION.DIE && !target.remove_tick ? target : null;
}
export function canAttack(target) {
	if (!target || target === Session.Entity) return false;
	const T = target.constructor;
	return (
		[T.TYPE_MOB, T.TYPE_UNIT, T.TYPE_NPC_ABR, T.TYPE_NPC_BIONIC].includes(target.objecttype) ||
		([T.TYPE_PC, T.TYPE_ELEM, T.TYPE_HOM].includes(target.objecttype) && target.canAttackEntity())
	);
}
export function stopAttack() {
	releaseAttack();
	Session.moveAction = null;
	if (Session.Playing) Network.sendPacket(new PACKET.CZ.CANCEL_LOCKON());
}
export function attackSelected(moving = false, onRequest = null) {
	const target = selectedTarget();
	if (canAttack(target)) {
		ownAttack(target.GID, () => {
			if (!Session.FreezeUI && selectedTarget() === target) {
				target.onFocus({ attack: true, allowMove: !moving });
				onRequest?.();
			}
		});
		target.onFocus({ attack: true, allowMove: !moving });
		onRequest?.();
	}
}
export function moveDirection(x, y) {
	const player = Session.Entity;
	if (!player || player.action === player.ACTION.DIE || player.action === player.ACTION.SIT) return;
	Navigation.stopAutoWalk();
	MapControl.onRequestStopWalk();
	Session.moveAction = null;
	Session.autoFollow = false;
	// Invert the camera yaw on the map X/Z plane using its rendered angle.
	// Camera.direction is rounded to sprite octants and cannot steer movement.
	const angle = (Camera.angle[1] * Math.PI) / 180;
	const dx = x * Math.cos(angle) - y * Math.sin(angle);
	const dy = x * Math.sin(angle) + y * Math.cos(angle);
	const dest = [];
	if (!checkFreeCell(Math.round(player.position[0] + dx * 3), Math.round(player.position[1] + dy * 3), 1, dest))
		return;
	const packet = new PACKET.CZ.REQUEST_MOVE2();
	packet.dest[0] = dest[0];
	packet.dest[1] = dest[1];
	Network.sendPacket(packet);
	directionalMovementPlayer = player;
}
export function stopDirectionalMovement() {
	MapControl.onRequestStopWalk();
	Session.moveAction = null;
	const player = directionalMovementPlayer;
	directionalMovementPlayer = null;
	if (
		!player ||
		player !== Session.Entity ||
		!Session.Playing ||
		player.action === player.ACTION.DIE ||
		player.action === player.ACTION.SIT
	)
		return;
	Network.sendPacket(new PACKET.CZ.HAPPYRO_STOP_MOVE());
}
export function pickSceneEntity(x, y) {
	Mouse.screen.x = x;
	Mouse.screen.y = y;
	return EntityManager.intersect();
}
export function tapScene(x, y, pressedTarget) {
	Mouse.screen.x = x;
	Mouse.screen.y = y;
	const pos = [];
	const ground = Altitude.intersect(Camera.modelView, Camera.projection, pos);
	Mouse.world.x = ground ? pos[0] : -1;
	Mouse.world.y = ground ? pos[1] : -1;
	const target = pressedTarget || EntityManager.intersect();
	const previous = EntityManager.getFocusEntity();
	Session.moveAction = null;
	Session.autoFollow = false;
	if (target === Session.Entity) {
		if (previous && previous !== target) previous.onFocusEnd();
		EntityManager.setFocusEntity(target);
		return;
	}
	if (previous === Session.Entity) EntityManager.setFocusEntity(null);
	if (target && target !== Session.Entity) {
		if (previous && previous !== target) previous.onFocusEnd();
		EntityManager.setFocusEntity(target);
		EntityManager.setOverEntity(target);
		target.onFocus({ attack: false });
		if (
			[target.constructor.TYPE_ITEM, target.constructor.TYPE_NPC, target.constructor.TYPE_NPC2].includes(
				target.objecttype
			)
		)
			interactSelected();
		return;
	}
	if (ground) {
		MapControl.onRequestWalk();
		MapControl.onRequestStopWalk();
	}
}
export function interactSelected() {
	const target = selectedTarget();
	if (!target) return;
	const T = target.constructor;
	if (
		target.room?.display &&
		[target.room.constructor.Type.BUY_SHOP, target.room.constructor.Type.SELL_SHOP].includes(target.room.type)
	) {
		target.onRoomEnter();
		return;
	}
	if (target.objecttype === T.TYPE_PC && target !== Session.Entity) {
		UIManager.showPromptBox(`向 ${target.display.name} 发起交易？`, 'ok', 'cancel', () => {
			if (Session.Playing && !Session.FreezeUI && selectedTarget() === target)
				Trade.reqExchange(target.GID, target.display.name);
		});
		return;
	}
	if (![T.TYPE_NPC, T.TYPE_NPC2, T.TYPE_ITEM, T.TYPE_WARP].includes(target.objecttype)) return;
	Mouse.world.x = Math.round(target.position[0]);
	Mouse.world.y = Math.round(target.position[1]);
	target.onMouseDown();
}
/** Revalidate the selected player at activation time, not just when rendering buttons. */
export function playerAction(action, expectedId, openPrivate) {
	const target = selectedTarget();
	if (!Session.Playing || Session.FreezeUI) return '当前不能操作';
	if (!target || target.GID !== expectedId || target === Session.Entity || target.objecttype !== target.constructor.TYPE_PC)
		return '目标已离开或已切换，请重新选择玩家';
	const name = target.display.name;
	if (!name) return '正在获取角色名，请稍后重试';
	if (action === 'private') openPrivate(name);
	else if (action === 'equipment') Equipment.onCheckPlayerEquipment(target.GID);
	else if (action === 'friend') {
		if (Friends.isFriend(name)) return '已是好友';
		if (Friends.addFriend(name) === false) return '好友请求未发送';
	} else if (action === 'trade') Trade.reqExchange(target.GID, name);
	return '';
}

/** Bind confirmations to the selected pet object and owner, not a reusable GID. */
export function preparePetAction(action, expectedId, openPet) {
	const target = selectedTarget(), owner = Session.Entity;
	const valid = () => Boolean(
		Session.Playing && !Session.FreezeUI && owner && Session.Entity === owner &&
		owner.action !== owner.ACTION.DIE && target && target === selectedTarget() &&
		target.GID === expectedId && target.GID === Session.petId &&
		target.objecttype === target.constructor.TYPE_PET && !target.remove_tick
	);
	if (!valid()) return { error: '宠物已离开或已切换，请重新选择' };
	if (!['view', 'feed', 'perform', 'egg'].includes(action)) return { error: '未知操作' };
	return {
		execute() {
			if (!valid()) return '宠物已离开或已切换，请重新选择';
			if (action === 'view') return openPet() ? '' : '当前无法查看宠物';
			const result = commandGamePet(action);
			return result === '已发送请求，以服务器状态为准' ? '' : result;
		}
	};
}

/** Keep a dismissal confirmation bound to the original mercenary and owner. */
export function prepareMercenaryAction(action, expectedId, openMercenary) {
	const target = selectedTarget(), owner = Session.Entity;
	const valid = () => Boolean(
		Session.Playing && !Session.FreezeUI && owner && Session.Entity === owner &&
		owner.action !== owner.ACTION.DIE && target && target === selectedTarget() &&
		target.GID === expectedId && target.GID === Session.mercId &&
		target.objecttype === target.constructor.TYPE_MERC && !target.remove_tick
	);
	if (!valid()) return { error: '佣兵已离开或已切换，请重新选择' };
	if (!['view', 'return', 'aggressive', 'dismiss'].includes(action)) return { error: '未知操作' };
	return {
		execute() {
			if (!valid()) return '佣兵已离开或已切换，请重新选择';
			if (action === 'view') return openMercenary() ? '' : '当前无法查看佣兵';
			const result = commandGameCompanion('mercenary', action);
			return ['攻击模式已更新', '已发送请求，以服务器状态为准'].includes(result) ? '' : result;
		}
	};
}

/** Keep feeding bound to the selected homunculus and its original owner. */
export function prepareHomunculusAction(action, expectedId, openHomunculus) {
	const target = selectedTarget(), owner = Session.Entity;
	const valid = () => Boolean(
		Session.Playing && !Session.FreezeUI && owner && Session.Entity === owner &&
		owner.action !== owner.ACTION.DIE && target && target === selectedTarget() &&
		target.GID === expectedId && target.GID === Session.homunId &&
		target.objecttype === target.constructor.TYPE_HOM && !target.remove_tick
	);
	if (!valid()) return { error: '生命体已离开或已切换，请重新选择' };
	if (!['view', 'feed', 'return', 'aggressive'].includes(action)) return { error: '未知操作' };
	return {
		execute() {
			if (!valid()) return '生命体已离开或已切换，请重新选择';
			if (action === 'view') return openHomunculus() ? '' : '当前无法查看生命体';
			const result = commandGameCompanion('homunculus', action);
			return ['攻击模式已更新', '已发送请求，以服务器状态为准'].includes(result) ? '' : result;
		}
	};
}

export function targetSnapshot() {
	const target = selectedTarget();
	if (!target) return { name: '点击目标进行选择', attack: false, interaction: '' };
	const T = target.constructor;
	return {
		self: target === Session.Entity,
		name: target.display.name || '已选目标',
		player: target.objecttype === T.TYPE_PC && target !== Session.Entity ? { id: target.GID, name: target.display.name, friend: Friends.isFriend(target.display.name) } : null,
		pet: target.objecttype === T.TYPE_PET && target.GID === Session.petId && !target.remove_tick
			? { id: target.GID, name: target.display.name, canOperate: canCommandGamePet() } : null,
		mercenary: target.objecttype === T.TYPE_MERC && target.GID === Session.mercId && !target.remove_tick
			? { id: target.GID, name: target.display.name, canOperate: canCommandGameCompanion('mercenary'), aggressive: companionAttackMode('mercenary') } : null,
		homunculus: target.objecttype === T.TYPE_HOM && target.GID === Session.homunId && !target.remove_tick
			? { id: target.GID, name: target.display.name, canOperate: canCommandGameCompanion('homunculus'), aggressive: companionAttackMode('homunculus') } : null,
		attack: canAttack(target),
		interaction:
			target.room?.display &&
			[target.room.constructor.Type.BUY_SHOP, target.room.constructor.Type.SELL_SHOP].includes(target.room.type)
				? '查看摊位'
				: target.objecttype === T.TYPE_PC && target !== Session.Entity
					? '交易'
					: target.objecttype === T.TYPE_WARP
						? '进入'
						: ''
	};
}

export function adjustCamera(action) {
	const indoor = DB.isIndoor(Camera.currentMap);
	if (action === 'zoomIn' || action === 'zoomOut') Camera.setZoom(action === 'zoomIn' ? -1 : 1);
	else if (action === 'reset') {
		Camera.angleFinal[0] = indoor ? Camera.indoorRange : Camera.range;
		Camera.angleFinal[1] = indoor ? Camera.indoorRotationTo : 0;
		Camera.zoomFinal = DEFAULT_CAMERA_ZOOM;
	} else {
		const tilt = action === 'up' || action === 'down';
		const index = tilt ? 0 : 1;
		const min = tilt
			? indoor
				? Camera.MIN_ALTITUDE_INDOOR
				: Camera.MIN_V_ANGLE
			: indoor
				? Camera.indoorRotationFrom
				: Camera.rotationFrom;
		const max = tilt
			? indoor
				? Camera.MAX_ALTITUDE_INDOOR
				: Camera.MAX_V_ANGLE
			: indoor
				? Camera.indoorRotationTo
				: Camera.rotationTo;
		const delta = tilt ? (action === 'up' ? 5 : -5) : action === 'left' ? -15 : 15;
		Camera.angleFinal[index] = Math.max(min, Math.min(max, Camera.angleFinal[index] + delta));
	}
	Camera.save();
}
