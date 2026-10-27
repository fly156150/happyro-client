import { requestEquipmentAvailability } from './EquipmentAvailability.js';
import { playerStatuses } from 'Network/PlayerStatuses.js';
import Location from 'DB/Items/EquipmentLocation.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import StatusConst from 'DB/Status/StatusState.js';

const effects = StatusConst.EffectState;
const attachmentMask = effects.RIDING | effects.FALCON | effects.DRAGON1 | effects.DRAGON2 |
	effects.DRAGON3 | effects.DRAGON4 | effects.DRAGON5 | effects.MADOGEAR;

export const equipmentSlots = [
	['HEAD_TOP', '头饰（上）', 'normal'],
	['HEAD_MID', '头饰（中）', 'normal'],
	['HEAD_BOTTOM', '头饰（下）', 'normal'],
	['WEAPON', '右手／武器', 'normal'],
	['SHIELD', '左手／盾牌', 'normal'],
	['ARMOR', '铠甲', 'normal'],
	['GARMENT', '披肩', 'normal'],
	['SHOES', '鞋子', 'normal'],
	['ACCESSORY1', '饰品（右）', 'normal'],
	['ACCESSORY2', '饰品（左）', 'normal'],
	['AMMO', '弹药', 'normal'],
	['COSTUME_HEAD_TOP', '时装头饰（上）', 'costume'],
	['COSTUME_HEAD_MID', '时装头饰（中）', 'costume'],
	['COSTUME_HEAD_BOTTOM', '时装头饰（下）', 'costume'],
	['COSTUME_ROBE', '时装披肩', 'costume'],
	['COSTUME_FLOOR', '时装地面', 'costume'],
	['SHADOW_WEAPON', '影子武器', 'shadow'],
	['SHADOW_SHIELD', '影子盾牌', 'shadow'],
	['SHADOW_ARMOR', '影子铠甲', 'shadow'],
	['SHADOW_SHOES', '影子鞋子', 'shadow'],
	['SHADOW_R_ACCESSORY_SHADOW', '影子饰品（右）', 'shadow'],
	['SHADOW_L_ACCESSORY_SHADOW', '影子饰品（左）', 'shadow']
].map(([key, label, group]) => ({ key, label, group, location: Location[key] }));

export function createEquipmentController(inventory, stats, canOperate, skillRevision = () => 0) {
	let removal = null;
	function attachment() {
		const owner = Session.Entity;
		const mask = (owner?.effectState || 0) & attachmentMask;
		if (removal?.owner !== owner) removal = null;
		if (removal?.pending) {
			if (!mask) removal = { owner, success: true, message: '已解除骑乘或随行状态' };
			else if (Date.now() - removal.started >= 5000)
				removal = { owner, success: false, message: '未能解除，请重试' };
		} else if (removal?.success && mask) removal = null;
		const label = mask & effects.MADOGEAR ? '卸下机甲' : mask & ~effects.FALCON ? '解除坐骑' : '解除猎鹰';
		return { mask, label, removal };
	}
	function snapshot() {
		const items = inventory.snapshot();
		return {
			attachment: attachment(),
			eligibilityKey: JSON.stringify([Session.GID, Session.Entity?._job, Session.Entity?.clevel,
				Session.Entity?.sex, Session.Entity?.effectState, Session.UserLevel, Session.hasCart,
				playerStatuses.revision, skillRevision(),
				items.filter(item => item.worn).map(item => [item.index, item.ID, item.wearLocation])]),
			slots: equipmentSlots.map(slot => ({
				...slot,
				item: items.find(item => item.worn && item.wearLocation & slot.location),
				candidates: items.filter(
					item => !item.worn && item.identified && !item.damaged && !item.reason &&
						item.category === 'equipment' && item.location & slot.location
				)
			})),
			stats: stats()
		};
	}
	return {
		snapshot,
		checkCandidates(slotKey, candidates, signal) {
			const slot = equipmentSlots.find(slot => slot.key === slotKey);
			return requestEquipmentAvailability(slot.location, candidates, signal);
		},
		removeAttachment(expectedMask) {
			if (!canOperate() || !Session.Playing || !Session.Entity || Session.Entity.action === Session.Entity.ACTION.DIE)
				return '当前无法操作';
			const current = attachment();
			if (!current.mask || current.mask !== expectedMask) return '骑乘状态已变化，请重新选择';
			if (current.removal?.pending) return '请稍后重试';
			removal = { owner: Session.Entity, pending: true, started: Date.now() };
			Network.sendPacket(new PACKET.CZ.REQ_CARTOFF());
			return null;
		},
		act(slotKey, index, id, action) {
			const slot = snapshot().slots.find(entry => entry.key === slotKey);
			if (!slot) return '请选择装备部位';
			const item =
				action === 'unequip'
					? slot.item
					: action === 'equip'
						? slot.candidates.find(entry => entry.index === index && entry.ID === id)
						: null;
			if (!item || item.index !== index || item.ID !== id) return '装备已经变化，请重新选择';
			return inventory.act(index, id, action, action === 'equip' ? slot.location : undefined);
		}
	};
}
