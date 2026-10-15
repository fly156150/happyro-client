import Session from 'Engine/SessionStorage.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import DB from 'DB/DBManager.js';
import { createGameInventory } from './GameInventory.js';
import { showInteraction, clearInteraction, interactionSnapshot } from './ServerInteraction.js';

let activeService;
export function updateRefinementMaterials(kind, pkt) {
	return activeService?.materials(kind, pkt);
}
export function finishRefinement(kind, pkt) {
	return activeService?.result(kind, pkt);
}
export function openGameRefinement(kind) {
	const token = Symbol(kind),
		inventory = createGameInventory(() => true);
	let resultId = 0;
	let guard = () => false,
		selected = null,
		offer = null,
		pending = false,
		message = '请选择装备',
		messageKind = 'info';
	const current = () => Session.Playing && interactionSnapshot()?.token === token;
	const available = () => current() && guard() && !pending && Session.Entity?.action !== Session.Entity?.ACTION.DIE;
	const count = id =>
		Inventory.getUI()
			.list.filter(item => item.ITID === id)
			.reduce((sum, item) => sum + (item.count || 0), 0);
	const live = () => selected && Inventory.getUI().getItemByIndex(selected.index);
	function valid() {
		const item = live();
		return (
			item &&
			item.ITID === selected.ID &&
			item.RefiningLevel === selected.refine &&
			item.enchantgrade === selected.grade &&
			inventory
				.snapshot()
				.some(entry => entry.index === selected.index && !entry.worn && entry.identified && !entry.damaged)
		);
	}
	const service = {
		setOperationGuard(fn) {
			guard = fn;
		},
		snapshot() {
			return {
				kind,
				items: inventory
					.snapshot()
					.filter(item => !item.worn && item.category === 'equipment' && item.identified && !item.damaged),
				selected,
				offer,
				pending,
				message,
				messageKind,
				resultId,
				allowed: available(),
				zeny: Session.zeny,
				materials:
					(kind === 'refine' ? offer?.MaterialInfo : offer?.materialList)?.map((material, index) => ({
						...material,
						index,
						name: DB.getItemInfo(material.itemId).identifiedDisplayName,
						owned: count(material.itemId)
					})) || []
			};
		},
		select(index, id) {
			if (!available()) return '当前不能选择装备';
			const item = Inventory.getUI().getItemByIndex(index);
			if (!item || item.ITID !== id || !service.snapshot().items.some(entry => entry.index === index))
				return '装备已经变化';
			selected = { index, ID: id, refine: item.RefiningLevel, grade: item.enchantgrade };
			offer = null;
			pending = true;
			messageKind = 'info';
			message = '正在请求材料和费用';
			const pkt =
				kind === 'refine'
					? new PACKET.CZ.REFINING_SELECT_ITEM()
					: new PACKET.CZ.GRADE_ENCHANT_SELECT_EQUIPMENT();
			pkt.index = index;
			Network.sendPacket(pkt);
			return '';
		},
		materials(type, pkt) {
			if (type === 'grade' && kind === 'grade' && current() && selected && pending && !offer && pkt.index === -1) {
				pending = false;
				selected = null;
				messageKind = 'error';
				message = '此装备无法评级，请选择其他装备';
				return true;
			}
			if (type !== kind || !current() || !selected || (pkt.itemIndex ?? pkt.index) !== selected.index)
				return false;
			offer = pkt;
			pending = false;
			messageKind = service.snapshot().materials.length ? 'info' : 'error';
			message = service.snapshot().materials.length ? '请选择材料，核对费用与风险' : '此装备无法继续强化';
			return true;
		},
		confirm(materialIndex, blessing = 0) {
			if (!available() || !offer || !valid()) return '装备或状态已变化，请重新选择';
			const material = service.snapshot().materials.find(entry => entry.index === materialIndex);
			if (!material) return '请选择材料';
			if (Session.zeny < (material.zeny ?? material.price) || material.owned < (material.amount ?? 1))
				return '材料或 Zeny 不足';
			if (!Number.isInteger(blessing) || blessing < 0) return '祝福数量无效';
			if (kind === 'refine') {
				if (blessing !== 0 && blessing !== offer.blacksmithBlessing) return '祝福数量已变化';
				if (blessing + (material.itemId === 6635 ? (material.amount ?? 1) : 0) > count(6635))
					return '铁匠的祝福不足';
			} else {
				if (!offer.success_chance) return '此装备当前无法评级';
				const info = offer.blessing_info;
				if (
					blessing > (info?.max_blessing || 0) ||
					blessing * (info?.amount || 0) + (material.itemId === info?.id ? (material.amount ?? 1) : 0) >
						count(info?.id)
				)
					return '祝福材料不足';
			}
			const pkt = kind === 'refine' ? new PACKET.CZ.REQ_REFINING() : new PACKET.CZ.GRADE_ENCHANT_REQ();
			pkt.index = selected.index;
			if (kind === 'refine') {
				pkt.itemId = material.itemId;
				pkt.blacksmithBlessing = blessing;
			} else {
				pkt.material_index = materialIndex;
				pkt.blessing_flag = blessing ? 1 : 0;
				pkt.blessing_amount = blessing;
				pkt.protect_flag = 0;
			}
			pending = true;
			messageKind = 'info';
			message = '已请求强化，等待服务器结果';
			Network.sendPacket(pkt);
			return '';
		},
		result(type, pkt) {
			if (type !== kind || !current() || !selected || (pkt.itemIndex ?? pkt.index) !== selected.index)
				return false;
			pending = false;
			offer = null;
			selected = null;
			resultId++;
			messageKind = pkt.result === 0 ? 'success' : 'error';
			message =
				(kind === 'refine'
					? ['精炼成功', '精炼失败，装备损毁', '精炼失败，精炼等级降低', '精炼失败，装备保留']
					: ['评级成功', '评级失败', '评级失败，精炼等级降低', '评级失败，装备损毁', '装备受到保护'])[pkt.result] ||
				`强化结果：${pkt.result}`;
			return true;
		}
	};
	activeService = service;
	showInteraction({
		kind: 'refinement',
		title: kind === 'refine' ? '装备精炼' : '装备评级',
		token,
		service,
		close() {
			if (!current()) return;
			clearInteraction('refinement');
			Network.sendPacket(
				kind === 'refine' ? new PACKET.CZ.CLOSE_REFINING_UI() : new PACKET.CZ.GRADE_ENCHANT_CLOSE_UI()
			);
		}
	});
	return service;
}
