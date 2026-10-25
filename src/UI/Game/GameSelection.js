import { smithingMaterials, validateSmithingMaterials } from './CraftingMaterials.js';
import Session from 'Engine/SessionStorage.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import DB from 'DB/DBManager.js';
import SkillInfo from 'DB/Skills/SkillInfo.generated.js';
import Client from 'Core/Client.js';
import { createGameInventory } from './GameInventory.js';
import { showInteraction, clearInteraction, interactionSnapshot } from './ServerInteraction.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

const itemIdentity = item =>
	JSON.stringify([item.ITID, item.RefiningLevel, item.enchantgrade, item.slot, item.Options]);

export function selectionEntries(values, type) {
	return values
		.map(value => {
			if (type === 'skill') {
				const info = SkillInfo[value];
				return info && value > 0
					? {
							id: value,
							name: info.SkillName,
							descriptionMarkup: DB.getSkillDescription(value),
							description: toPlainRagnarokText(DB.getSkillDescription(value)),
							file: info.Name
						}
					: null;
			}
			if (type === 'inventory') {
				const item = Inventory.getUI().getItemByIndex(value);
				return item ? { id: value, item: { ...item }, inventory: true, identity: itemIdentity(item) } : null;
			}
			if (type === 'item')
				return { id: value, item: { index: value, ITID: value, count: 1, IsIdentified: true } };
			return { id: value.index, item: { ...value, count: 1, IsIdentified: true } };
		})
		.filter(Boolean);
}
export function openGameSelection(title, entries, submit, cancel, warning = '', options = {}) {
	const token = Symbol('selection'),
		inventory = createGameInventory(() => true),
		icons = new Map();
	let done = false,
		guard = () => false;
	function current() {
		return !done && interactionSnapshot()?.token === token && Session.Playing;
	}
	function finish(fn) {
		if (!current()) return false;
		done = true;
		clearInteraction('selection');
		fn();
		return true;
	}
	const service = {
		setOperationGuard(fn) {
			guard = fn;
		},
		snapshot() {
			return {
				warning,
				equipment: Boolean(options.equipment),
				materials: entries.some(entry => entry.materials)
					? Inventory.getUI()
							.list.filter(item => smithingMaterials.includes(item.ITID) && item.count > 0)
							.map(item => ({ id: item.ITID, name: DB.getItemName(item), count: item.count }))
					: [],
				entries: entries.map(entry => {
					const info = entry.item ? inventory.describe(entry.item) : entry;
					if (entry.loadIcon && !icons.has(entry.id)) {
						icons.set(entry.id, '');
						entry.loadIcon(url => {
							if (current()) icons.set(entry.id, url);
						});
					}

					if (entry.file && !icons.has(entry.file)) {
						icons.set(entry.file, '');
						Client.loadFile(`${DB.INTERFACE_PATH}item/${entry.file}.bmp`, url =>
							icons.set(entry.file, url)
						);
					}
					return {
						...info,
						id: entry.id,
						itemId: entry.item?.ITID,
						icon: info.icon || icons.get(entry.id) || icons.get(entry.file) || '',
						materials: Boolean(entry.materials)
					};
				}),
				allowed: current() && guard() && Session.Entity?.action !== Session.Entity?.ACTION.DIE
			};
		},
		choose(id, materials = []) {
			if (!service.snapshot().allowed) return '当前不能操作';
			const entry = entries.find(e => e.id === id);
			if (!entry) return '选择已失效';
			if (entry.validate && !entry.validate()) return '选择已失效，请重新打开';
			if (entry.inventory) {
				const live = Inventory.getUI().getItemByIndex(id);
				if (!live || itemIdentity(live) !== entry.identity) return '物品已经变化，请重新打开';
			}
			if ((!entry.materials && materials.length) || !validateSmithingMaterials(materials, Inventory.getUI().list))
				return '附加材料或数量已变化';
			finish(() =>
				entry.materials
					? submit(
							id,
							materials.map(ITID => ({ ITID }))
						)
					: submit(id)
			);
			return '';
		}
	};
	showInteraction({ kind: 'selection', title, token, service, back: options.back, close: () => finish(cancel) });
	return service;
}
