import { showToast } from 'UI/Components/Toast.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import AIDriver from 'Core/AIDriver.js';
import SkillListMH from 'UI/Components/SkillListMH/SkillListMH.js';
import SkillInfo from 'DB/Skills/SkillInfo.generated.js';
import { cancelCompanionSkill } from 'Engine/MapEngine/CompanionSkillAction.js';
import { showInteraction, clearInteraction, interactionSnapshot } from './ServerInteraction.js';

let owner, states;
export function resetGameCompanions() {
	owner = Session.Entity;
	states = Object.fromEntries(
		['homunculus', 'mercenary'].map(kind => [
			kind,
			{ gid: 0, info: null, pending: null, autoFeed: false, messageKind: 'info', message: '' }
		])
	);
}
function state(kind) {
	if (!states || owner !== Session.Entity) resetGameCompanions();
	return states[kind];
}
function entity(kind) {
	const s = state(kind);
	return s.gid && s.gid === Session[kind === 'homunculus' ? 'homunId' : 'mercId'] ? EntityManager.get(s.gid) : null;
}
function send(name, values) {
	const packet = new PACKET.CZ[name]();
	Object.assign(packet, values);
	Network.sendPacket(packet);
}
export function updateGameCompanion(kind, values, gid) {
	let s = state(kind);
	if (gid && gid !== s.gid) {
		cancelCompanionSkill(entity(kind));
		s = states[kind] = {
			gid,
			info: s.gid ? null : s.info,
			pending: null,
			autoFeed: s.gid ? false : s.autoFeed,
			messageKind: 'info',
			message: ''
		};
	}
	s.info = { ...s.info, ...values };
}
export function updateGameCompanionAutoFeed(value) {
	const s = state('homunculus');
	s.autoFeed = Boolean(value);
	if (s.pending === 'autofeed') {
		s.pending = null;
		s.message = '';
		s.messageKind = 'info';
	}
}
export function receiveGameCompanionFeed(result) {
	const s = state('homunculus');
	if (s.pending !== 'feed') return;
	s.pending = null;
	s.messageKind = result ? 'success' : 'error';
	s.message = result ? '喂食成功' : '喂食失败，请检查生命体食物';
	const interaction = interactionSnapshot();
	if (interaction?.kind !== 'companions' || interaction.service.snapshot().kind !== 'homunculus')
		showToast(document.body, s.message, s.messageKind);
}
export function canCommandGameCompanion(kind) {
	const actor = entity(kind);
	return Boolean(
		Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE &&
		actor && actor.action !== actor.ACTION.DIE && !actor.remove_tick && state(kind).info && !state(kind).pending
	);
}
export function companionAttackMode(kind) {
	return Boolean(AIDriver[kind === 'homunculus' ? 'HOM_AGGRESSIVE' : 'MER_AGGRESSIVE']);
}
function validateCompanionCommand(kind, action, value) {
	if (!canCommandGameCompanion(kind)) return '当前无法操作';
	const info = state(kind).info;
	if (['feed', 'rename', 'autofeed'].includes(action) && kind !== 'homunculus') return '佣兵不支持此操作';
	if (
		action === 'rename' &&
		((info.bModified & 1) ||
			!value ||
			new TextEncoder().encode(value).length > 23 ||
			Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
	)
		return '名称无效或生命体已经改名';
	if (!['feed', 'rename', 'autofeed', 'dismiss', 'return', 'aggressive'].includes(action)) return '未知操作';
	return '';
}
/** Share the same commands between the full menu and selected-unit controls. */
export function commandGameCompanion(kind, action, value) {
	const error = validateCompanionCommand(kind, action, value);
	if (error) return error;
	const actor = entity(kind);
	const aiKey = kind === 'homunculus' ? 'HOM_AGGRESSIVE' : 'MER_AGGRESSIVE';
	const s = state(kind);
	cancelCompanionSkill(actor);
	switch (action) {
		case 'feed':
			s.pending = 'feed';
			send('COMMAND_MER', { type: 0, command: 1 });
			break;
		case 'rename':
			send('RENAME_MER', { name: value });
			break;
		case 'dismiss':
			if (kind === 'homunculus') send('COMMAND_MER', { type: 0, command: 2 });
			else send('MER_COMMAND', { command: 2 });
			break;
		case 'return':
			send('REQUEST_MOVETOOWNER', { GID: actor.GID });
			break;
		case 'autofeed':
			s.pending = 'autofeed';
			send('CONFIG', { Config: 3, Value: s.autoFeed ? 0 : 1 });
			break;
		case 'aggressive':
			AIDriver[aiKey] = !AIDriver[aiKey];
			localStorage.setItem(aiKey, AIDriver[aiKey] ? '1' : '0');
			break;
	}
	s.messageKind = action === 'aggressive' ? 'success' : 'pending';
	s.message = action === 'aggressive' ? '攻击模式已更新' : '已发送请求，以服务器状态为准';
	return s.message;
}
export function openGameCompanions(kind, canOperate = () => true) {
	if (
		!['homunculus', 'mercenary'].includes(kind) ||
		!canOperate() ||
		!Session.Playing ||
		!Session.Entity ||
		Session.Entity.action === Session.Entity.ACTION.DIE
	)
		return null;
	const token = {};
	const openingOwner = Session.Entity;
	let guard = canOperate,
		review = null,
		learning = null;
	const active = () =>
		interactionSnapshot()?.token === token &&
		Session.Entity === openingOwner &&
		guard() &&
		Session.Playing &&
		Session.Entity &&
		Session.Entity.action !== Session.Entity.ACTION.DIE;
	const allowed = () => active() && canCommandGameCompanion(kind);
	function validate(action, value) {
		if (!active()) return '当前无法操作';
		return validateCompanionCommand(kind, action, value);
	}
	const service = {
		setOperationGuard: value => {
			guard = value;
		},
		snapshot() {
			const s = state(kind),
				model = SkillListMH[kind];
			if (learning && (learning.actor !== entity(kind) || learning.revision !== model.getSkillRevision()))
				learning = null;
			if (review && (review.actor !== entity(kind) || !allowed())) review = null;
			return {
				kind,
				gid: s.gid,
				info: entity(kind) ? { ...s.info } : null,
				allowed: allowed(),
				// Homunculus flags use bit 0 for renamed; the other bits describe its state.
				canRename: kind === 'homunculus' && allowed() && !(s.info?.bModified & 1),
				pending: s.pending,
				message: s.message,
				messageKind: s.messageKind,
				autoFeed: s.autoFeed,
				aggressive: companionAttackMode(kind),
				review,
				skills: entity(kind)
					? model.getSkills().map(skill => ({
							...skill,
							name: SkillInfo[skill.SKID]?.SkillName || `技能 #${skill.SKID}`,
							learnable:
								kind === 'homunculus' &&
								allowed() &&
								!learning &&
								s.info.SKPoint > 0 &&
								Boolean(skill.upgradable)
						}))
					: []
			};
		},
		prepare(action, value) {
			value = action === 'rename' ? String(value).trim() : value;
			const error = validate(action, value);
			if (error) return error;
			review = { action, value, actor: entity(kind) };
			return '';
		},
		cancel() {
			review = null;
		},
		confirm() {
			if (!review) return '请先选择操作';
			const { action, value, actor } = review;
			review = null;
			const error = validate(action, value);
			if (error || actor !== entity(kind)) return error || '伴侣已变化，请重新确认';
			return commandGameCompanion(kind, action, value);
		},
		learn(id, expectedLevel) {
			const skill = service.snapshot().skills.find(s => s.SKID === id);
			if (!skill?.learnable || skill.level + 1 !== expectedLevel) return '技能状态已变化，请重新确认';
			learning = { actor: entity(kind), revision: SkillListMH[kind].getSkillRevision() };
			SkillListMH[kind].onIncreaseSkill(id);
			return '已请求学习一级，等待服务器更新';
		},
		close() {
			if (interactionSnapshot()?.token === token) clearInteraction('companions');
		}
	};
	showInteraction({
		kind: 'companions',
		title: kind === 'homunculus' ? '生命体' : '佣兵',
		token,
		service,
		close: service.close
	});
	return service;
}
