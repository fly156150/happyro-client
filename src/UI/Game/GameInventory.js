import { itemUseExecution } from 'Network/ItemUseExecution.js';
import { PET_INCUBATOR_ID } from 'DB/Pets/PetRules.js';
import EntityManager from 'Renderer/EntityManager.js';
import { itemSubtypes } from './ItemSubtypes.js';
import { createItemPreviewLoader } from './ItemPreview.js';
import { equipmentSockets } from './EquipmentSockets.js';
import { beginItemOperation, finishItemOperation } from './ItemOperationFeedback.js';
import ItemType from 'DB/Items/ItemType.js';
import MapControl from 'Controls/MapControl.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import { consumables, equipment, itemQuantity } from './InventoryItems.js';
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

/** Read live inventory identities; never optimistically mutate server-owned counts or equipment. */
export function createGameInventory(canOperate) {
	const icons = new Map();
	const loadPreview = createItemPreviewLoader();
	function entries() {
		const items = new Map(
			Inventory.getUI()
				.list.filter(item => itemQuantity(item) > 0)
				.map(item => [item.index, { item, worn: false }])
		);
		for (const item of Equipment.getUI().getItems()) items.set(item.index, { item, worn: true });
		return [...items.values()];
	}
	function available() {
		return Boolean(
			canOperate() && Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE
		);
	}
	function describe({ item, worn }) {
		const info = DB.getItemInfo(item.ITID);
		const description = item.IsIdentified ? info.identifiedDescriptionName : info.unidentifiedDescriptionName;
		const file = item.IsIdentified ? info.identifiedResourceName : info.unidentifiedResourceName;
		if (file && !icons.has(file)) {
			icons.set(file, '');
			Client.loadFile(`${DB.INTERFACE_PATH}item/${file}.bmp`, url => icons.set(file, url));
		}
		const equippable = equipment.includes(item.type);
		const usable = consumables.includes(item.type);
		const action = worn
			? 'unequip'
			: equippable
				? 'equip'
				: usable
					? 'use'
					: item.type === ItemType.CARD
						? 'card'
						: null;
		const reason = !available()
			? '当前无法操作物品'
			: !worn && equippable && !item.IsIdentified
				? '装备尚未鉴定'
				: !worn && equippable && item.IsDamaged
					? '装备已损坏'
					: !action
						? '此物品没有直接使用操作'
						: '';
		return {
			sockets: equippable ? equipmentSockets(item) : [],
			index: item.index,
			ID: item.ITID,
			name: DB.getItemName(item),
			count: itemQuantity(item),
			icon: icons.get(file) || '',
			worn,
			location: item.location,
			wearLocation: worn ? item.equipped : 0,
			type: item.type,
			subtypes: itemSubtypes(item),
			category: equippable ? 'equipment' : usable ? 'usable' : 'other',
			descriptionMarkup: Array.isArray(description) ? description.filter(Boolean).join('\n') : description || '',
			description: toPlainRagnarokText(description)
				.replace(/^[\t _-]+\r?$/gm, '')
				.replace(/\n(?:[\t ]*\r?\n)+/g, '\n\n')
				.replace(/\r?\n(?:[\t ]*\r?\n)*(?=[\t ]*(?:重量|Weight)\s*[:：])/gi, '\n')
				.trim(),
			action,
			reason,
			shortcut: !worn && (equippable || usable),
			identified: Boolean(item.IsIdentified),
			damaged: Boolean(item.IsDamaged)
		};
	}
	return {
		snapshot: () => entries().map(describe),
		async preview(index, id) {
			const entry = entries().find(({ item }) => item.index === index && item.ITID === id);
			if (!entry) return null;
			return loadPreview(entry.item);
		},
		describe: item => describe({ item, worn: false }),
		act(index, id, action, location, feedback) {
			const entry = entries().find(({ item }) => item.index === index && item.ITID === id);
			if (!entry) return '物品已经变化，请重新选择';
			const state = describe(entry);
			if (state.reason) return state.reason;
			if (state.action !== action) return '穿戴状态已经变化，请重新选择操作';
			if (action === 'use' && id === PET_INCUBATOR_ID && EntityManager.get(Session.petId))
				return '请先收回当前宠物';
			if (action === 'use' && !itemUseExecution.canUse(index)) return '上次用药结果未确认，请等待服务器响应或重新登录';
			if (action === 'use' && itemUseExecution.busy()) return '请稍后再使用物品';
			if (action === 'unequip') {
				beginItemOperation(Session.Entity, action, index, feedback);
				Equipment.getUI().onUnEquip(index);
			} else if (action === 'equip') {
				if (
					location !== undefined &&
					(!Number.isInteger(location) ||
						location <= 0 ||
						(location & (location - 1)) !== 0 ||
						!(entry.item.location & location))
				)
					return '装备不适用于此部位';
				beginItemOperation(Session.Entity, action, index, feedback);
				Inventory.getUI().onEquipItem(index, location ?? entry.item.location);
			} else {
				beginItemOperation(Session.Entity, action, index, feedback);
				if (action === 'card') Inventory.getUI().onUseCard(index);
				else if (Inventory.getUI().onUseItem(index) === false) {
					finishItemOperation(Session.Entity, action, index, null);
					return '当前无法使用此物品';
				}
			}
			return '';
		},
		drop(index, id, count) {
			const entry = entries().find(({ item }) => item.index === index && item.ITID === id);
			if (!available()) return '当前无法丢弃物品';
			if (
				!entry ||
				entry.worn ||
				!Number.isInteger(count) ||
				count < 1 ||
				count > 65535 ||
				count > itemQuantity(entry.item)
			)
				return '物品或数量已经变化，请重新选择';
			beginItemOperation(Session.Entity, 'drop', index);
			MapControl.onRequestDropItem(index, count);
			return '';
		},
		canBind(index, id) {
			const entry = entries().find(({ item }) => item.index === index && item.ITID === id);
			return Boolean(entry && available() && describe(entry).shortcut);
		}
	};
}
