import { showToast } from 'UI/Components/Toast.js';
import { PET_EVOLUTION_INTIMACY } from 'DB/Pets/PetRules.js';
import Renderer from 'Renderer/Renderer.js';
import Session from 'Engine/SessionStorage.js';
import DB from 'DB/DBManager.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import EntityManager from 'Renderer/EntityManager.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import { itemQuantity } from './InventoryItems.js';
import { openGameSelection, selectionEntries } from './GameSelection.js';
import { showInteraction, clearInteraction, interactionSnapshot } from './ServerInteraction.js';
let state, captureToken;
export function resetGamePet() {
	state = {
		owner: Session.Entity,
		gid: 0,
		info: null,
		pending: null,
		messageKind: 'info',
		message: '',
		autoFeed: false,
		accessory: false
	};
	captureToken = null;
}
function current() {
	if (!state || state.owner !== Session.Entity) resetGamePet();
	return state;
}
function send(name, fields) {
	const packet = new PACKET.CZ[name]();
	Object.assign(packet, fields);
	Network.sendPacket(packet);
}
export function updateGamePetInfo(info) {
	const s = current();
	s.info = { ...info };
	s.accessory = Boolean(info.ITID);
	if (s.pending === 'rename' || s.pending === 'refresh') s.pending = null;
	s.message = '宠物状态已更新';
	s.messageKind = 'success';
}
export function updateGamePetState(pkt) {
	const s = current();
	if (pkt.type === 0) {
		if (s.gid !== pkt.GID && s.gid) {
			s.info = null;
			s.pending = null;
			s.accessory = false;
			s.autoFeed = false;
			s.message = '宠物已更换';
			s.messageKind = 'info';
		}
		s.gid = pkt.GID;
		return;
	}
	if (pkt.GID !== s.gid) return;
	if (s.info) {
		if (pkt.type === 1) s.info.nRelationship = pkt.data;
		if (pkt.type === 2) s.info.nFullness = pkt.data;
		if (pkt.type === 3) s.accessory = Boolean(pkt.data);
	}
}
export function updateGamePetAutoFeed(value) {
	const s = current();
	s.autoFeed = Boolean(value);
	if (s.pending === 'autofeed') {
		s.pending = null;
		s.message = '';
		s.messageKind = 'info';
	}
}
export function receiveGamePetResult(kind, result) {
	const s = current();
	if (s.pending !== kind) return;
	s.pending = null;
	s.messageKind = (kind === 'evolve' ? result === 6 : Boolean(result)) ? 'success' : 'error';
	if (kind === 'feed') s.message = result ? '喂食成功' : '喂食失败，请检查宠物食物';
	if (kind === 'evolve') s.message = result === 6 ? '进化成功' : '进化失败，请检查亲密度、宠物状态及材料';
	if (kind === 'feed' && interactionSnapshot()?.kind !== 'pet') showToast(document.body, s.message, s.messageKind);
}
function evolutions() {
	const s = current();
	return Object.entries(DB.getPetEvolutionByJob(s.info?.job) || {}).map(([egg, materials]) => {
		const requirements = materials.map(m => ({
			id: m.MaterialID,
			name: DB.getItemInfo(m.MaterialID).identifiedDisplayName,
			count: m.Amount,
			owned: Inventory.getUI()
				.list.filter(i => i.ITID === m.MaterialID && !i.equipped)
				.reduce((n, i) => n + itemQuantity(i), 0)
		}));
		return {
			egg: Number(egg),
			name: DB.getItemInfo(Number(egg)).identifiedDisplayName,
			materials: requirements,
			intimacyRequired: PET_EVOLUTION_INTIMACY,
			ready:
				s.info.nRelationship >= PET_EVOLUTION_INTIMACY &&
				!s.accessory &&
				requirements.every(m => m.owned >= m.count)
		};
	});
}
/** Shared authority checks for the pet menu and the selected-pet action bar. */
export function canCommandGamePet() {
	const s = current();
	const actor = s.gid === Session.petId && EntityManager.get(s.gid);
	return Boolean(
		Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE &&
		actor && !actor.remove_tick && s.info && !s.pending
	);
}
export function commandGamePet(action, value) {
	if (!canCommandGamePet()) return '当前无法操作宠物';
	const s = current();
	if (action === 'rename') {
		const name = String(value).trim();
		if (
			s.info.bModified ||
			!name ||
			new TextEncoder().encode(name).length > 23 ||
			Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
		)
			return '名称无效或宠物已经改名';
		s.pending = 'rename';
		send('RENAME_PET', { szName: name });
	} else if (action === 'evolve') {
		const evo = evolutions().find(e => e.egg === value);
		if (s.accessory) return '请先卸下宠物饰品';
		if (!evo?.ready) return '亲密度或进化材料不足';
		s.pending = 'evolve';
		send('PET_EVOLUTION', { evolutionPetEggITID: value });
	} else if (action === 'autofeed') {
		if (!DB.getPetByJobID(s.info.job)?.AutoFeeding) return '该宠物不支持自动喂食';
		s.pending = 'autofeed';
		send('CONFIG', { Config: 2, Value: s.autoFeed ? 0 : 1 });
	} else {
		const command = { feed: 1, perform: 2, egg: 3, unequip: 4 }[action];
		if (!command) return '未知操作';
		if (action === 'unequip' && !s.accessory) return '宠物未装备饰品';
		if (action === 'feed') s.pending = 'feed';
		send('COMMAND_PET', { cSub: command });
	}
	s.messageKind = 'pending';
	s.message = '已发送请求，以服务器状态为准';
	return s.message;
}
export function openGamePet(canOperate = () => true) {
	if (!canOperate() || !Session.Playing || !Session.Entity || Session.Entity.action === Session.Entity.ACTION.DIE)
		return null;
	const token = {};
	let guard = canOperate;
	const active = () =>
		interactionSnapshot()?.token === token &&
		guard() &&
		Session.Playing &&
		Session.Entity &&
		Session.Entity.action !== Session.Entity.ACTION.DIE;
	const exists = () => {
		const s = current();
		return s.gid === Session.petId && Boolean(EntityManager.get(s.gid));
	};
	const allowed = () => active() && canCommandGamePet();
	const service = {
		setOperationGuard: value => {
			guard = value;
		},
		snapshot: () => {
			const s = current();
			return {
				gid: s.gid,
				info: exists() ? s.info : null,
				accessory: s.accessory,
				allowed: Boolean(allowed()),
				pending: s.pending,
				canRefresh: Boolean(active() && exists() && !s.pending),
				message: s.message,
				messageKind: s.messageKind,
				autoFeed: s.autoFeed,
				supportsAutoFeed: Boolean(DB.getPetByJobID(s.info?.job)?.AutoFeeding),
				evolutions: exists() ? evolutions() : []
			};
		},
		command(action, value) {
			if (!allowed()) return '当前无法操作宠物';
			return commandGamePet(action, value);
		},
		refresh() {
			if (!active() || !exists() || current().pending) return;
			current().pending = 'refresh';
			current().message = '已发送请求，以服务器状态为准';
			current().messageKind = 'pending';
			send('COMMAND_PET', { cSub: 0 });
		},
		close() {
			if (interactionSnapshot()?.token === token) clearInteraction('pet');
		}
	};
	showInteraction({ kind: 'pet', title: '宠物', token, service, close: service.close });
	return service;
}
export function openGamePetEggs(indices) {
	return openGameSelection(
		'选择宠物蛋',
		selectionEntries(indices, 'inventory'),
		index => send('SELECT_PETEGG', { index }),
		() => send('SELECT_PETEGG', { index: 0 })
	);
}
function captureVisible(entity) {
	const rect = entity.boundingRect;
	return (
		entity.objecttype === entity.constructor.TYPE_MOB &&
		entity.action !== entity.ACTION.DIE &&
		entity.remove_tick === 0 &&
		entity.effectColor[3] > 0 &&
		rect.x2 > rect.x1 &&
		rect.y2 > rect.y1 &&
		rect.x2 > 0 &&
		rect.y2 > 0 &&
		rect.x1 < Renderer.width &&
		rect.y1 < Renderer.height
	);
}
export function openGamePetCapture() {
	const candidates = [];
	EntityManager.forEach(entity => {
		if (captureVisible(entity))
			candidates.push({
				id: entity.GID,
				name: entity.display.name,
				description: '捕捉结果由服务器判定，确认后使用当前捕捉机会。',
				validate: () => EntityManager.get(entity.GID) === entity && captureVisible(entity)
			});
	});
	captureToken = null;
	return openGameSelection(
		'选择要捕捉的魔物',
		candidates,
		id => {
			const token = {};
			captureToken = token;
			showInteraction({
				kind: 'information',
				title: '捕捉宠物',
				token,
				rows: [['状态', '等待捕捉结果']],
				close: () => {
					if (interactionSnapshot()?.token === token) clearInteraction('information');
					captureToken = null;
				}
			});
			send('TRYCAPTURE_MONSTER', { targetAID: id });
		},
		() => send('TRYCAPTURE_MONSTER', { targetAID: 0 }),
		candidates.length ? '请选择当前可见的魔物' : '当前没有可见魔物，可取消本次捕捉'
	);
}
export function receiveGamePetCapture(result) {
	if (!captureToken || interactionSnapshot()?.token !== captureToken) return;
	const token = captureToken;
	captureToken = null;
	showInteraction({
		kind: 'information',
		title: '捕捉宠物',
		token,
		rows: [['结果', result ? '捕捉成功，请查看背包中的宠物蛋' : '捕捉失败']],
		close: () => {
			if (interactionSnapshot()?.token === token) clearInteraction('information');
		}
	});
}
