import Session from 'Engine/SessionStorage.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import DB from 'DB/DBManager.js';
import { createGameInventory } from './GameInventory.js';
import { itemQuantity } from './InventoryItems.js';
import { showInteraction, clearInteraction, interactionSnapshot } from './ServerInteraction.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

let active;
const titles = { synthesis: 'Laphine 合成', upgrade: 'Laphine 升级', reform: '装备改造' };
const closePackets = {
	synthesis: 'RANDOM_COMBINE_ITEM_UI_CLOSE',
	upgrade: 'RANDOM_UPGRADE_ITEM_UI_CLOSE',
	reform: 'CLOSE_REFORM_UI'
};
const identity = item => JSON.stringify([item.ITID, item.RefiningLevel, item.enchantgrade, item.slot, item.Options]);
export function transformationMatches(item, rule) {
	return (
		(item.RefiningLevel || 0) >= (rule.NeedRefineMin || 0) &&
		(rule.NeedRefineMax === undefined || (item.RefiningLevel || 0) <= rule.NeedRefineMax) &&
		(item.Options || []).filter(option => option.index !== 0).length >= (rule.NeedOptionNumMin || 0) &&
		(!(rule.IsEmptySocket || rule.NotSocketEnchantItem) || !Object.values(item.slot || {}).some(Boolean))
	);
}
export function finishItemTransformation(kind, packet) {
	return active?.result(kind, packet);
}
export function openItemTransformation(kind, itemId) {
	const recipes =
		kind === 'reform'
			? DB.getAllReformInfos(DB.findReformListByItemID(itemId) || [])
			: [kind === 'synthesis' ? DB.getLaphineSysInfoById(itemId) : DB.getLaphineUpgInfoById(itemId)].filter(
					Boolean
				);
	const token = Symbol(kind),
		inventory = createGameInventory(() => true),
		order = new Map();
	let guard = () => false,
		pending = false,
		message = recipes.length
			? '选择材料后核对并确认，操作会消耗道具或改变装备。'
			: '没有此道具的配方信息，请关闭窗口';
	const current = () => Session.Playing && interactionSnapshot()?.token === token;
	const allowed = () => current() && guard() && !pending && Session.Entity?.action !== Session.Entity?.ACTION.DIE;
	const source = () => Inventory.getUI();
	function recipeFor(item) {
		return recipes.find(
			rule =>
				transformationMatches(item, rule) &&
				(kind === 'reform'
					? rule.BaseItemId === item.ITID
					: (kind === 'synthesis' ? rule.SourceItems : rule.TargetItems).some(
							entry => entry.id === item.ITID
						))
		);
	}
	function eligible(item) {
		return (
			item &&
			item.IsIdentified &&
			!item.IsDamaged &&
			!item.WearState &&
			!source().equipswitchlist?.some(entry => entry.index === item.index) &&
			recipeFor(item)
		);
	}
	function required(item, recipe) {
		return kind === 'synthesis' ? recipe.SourceItems.find(entry => entry.id === item.ITID).count : 1;
	}
	function costs(recipe) {
		return kind === 'reform'
			? recipe.Materials.map(entry => ({ id: entry.MaterialItemID, count: entry.Amount }))
			: [];
	}
	function explanation(item, recipe, markup = false) {
		const lines = [markup ? recipe.NeedSource_String || '' : toPlainRagnarokText(recipe.NeedSource_String || '')];
		if (kind === 'reform') {
			lines.push(
				`改造结果：${DB.getItemName({ ITID: recipe.ResultItemId, IsIdentified: true })}`,
				`精炼变化：${recipe.ChangeRefineValue}；保留阶级：${recipe.PreserveGrade ? '是' : '否'}；保留插槽：${recipe.PreserveSocketItem ? '是' : '否'}`
			);
			lines.push(
				...costs(recipe).map(row => `${DB.getItemName({ ITID: row.id, IsIdentified: true })} × ${row.count}`)
			);
		}
		lines.push(`本条目需要数量：${required(item, recipe)}`);
		return lines.filter(Boolean).join('\n');
	}
	function display() {
		showInteraction({ kind: 'transformation', title: titles[kind], token, service, canClose: true, close });
	}
	function close() {
		if (!current()) return;
		clearInteraction('transformation');
		Network.sendPacket(new PACKET.CZ[closePackets[kind]]());
	}
	const service = {
		setOperationGuard(fn) {
			guard = fn;
		},
		snapshot() {
			return {
				items: inventory
					.snapshot()
					.filter(row => eligible(source().getItemByIndex(row.index)))
					.map(row => {
						const item = source().getItemByIndex(row.index),
							recipe = recipeFor(item);
						return {
							...row,
							requiredCount: required(item, recipe),
							descriptionMarkup: explanation(item, recipe, true),
							description: explanation(item, recipe)
						};
					}),
				order: [...order.values()],
				allowed: allowed(),
				message,
				pending,
				instruction:
					kind === 'synthesis'
						? `需要选择 ${recipes[0]?.NeedCount || 0} 个不同的背包条目`
						: '选择一个目标装备，确认前请核对消耗与结果'
			};
		},
		set(index, id, count) {
			const item = source().getItemByIndex(index),
				recipe = eligible(item);
			if (
				!allowed() ||
				!recipe ||
				item.ITID !== id ||
				!Number.isInteger(count) ||
				(count !== 0 && count !== required(item, recipe)) ||
				count > itemQuantity(item)
			)
				return '物品、资格或所需数量已变化';
			if (!count) order.delete(index);
			else {
				if (kind !== 'synthesis') order.clear();
				order.set(index, {
					index,
					ID: id,
					count,
					name: DB.getItemName(item),
					identity: identity(item),
					descriptionMarkup: explanation(item, recipe, true),
							description: explanation(item, recipe)
				});
			}
			return '';
		},
		clear() {
			if (allowed()) order.clear();
		},
		confirm() {
			if (!allowed()) return '当前不能操作';
			if (order.size !== (kind === 'synthesis' ? recipes[0]?.NeedCount : 1)) return '所选材料条目数不符合配方';
			const totals = new Map();
			for (const row of order.values()) {
				const item = source().getItemByIndex(row.index),
					recipe = eligible(item);
				if (
					!recipe ||
					identity(item) !== row.identity ||
					itemQuantity(item) < row.count ||
					row.count !== required(item, recipe)
				)
					return '材料已经变化，请重新选择';
				for (const cost of costs(recipe)) totals.set(cost.id, (totals.get(cost.id) || 0) + cost.count);
			}
			// Upgrade requires its source item; synthesis and reform may be opened by an NPC.
			if (kind === 'upgrade' && !source().list.some(item => item.ITID === itemId && itemQuantity(item) > 0))
				return '开启窗口的道具已不存在';
			for (const [id, count] of totals) {
				const available = source()
					.list.filter(item => item.ITID === id && !order.has(item.index) && !item.WearState)
					.reduce((sum, item) => sum + itemQuantity(item), 0);
				if (available < count) return '改造材料不足';
			}
			let packet;
			if (kind === 'synthesis') {
				packet = new PACKET.CZ.REQ_RANDOM_COMBINE_ITEM();
				packet.itemId = itemId;
				packet.items = [...order.values()].map(({ index, count }) => ({ index, count }));
			} else if (kind === 'upgrade') {
				packet = new PACKET.CZ.REQ_RANDOM_UPGRADE_ITEM();
				packet.itemId = itemId;
				packet.item_index = [...order.keys()][0];
			} else {
				packet = new PACKET.CZ.ITEM_REFORM();
				packet.ITID = itemId;
				packet.index = [...order.keys()][0];
			}
			pending = true;
			message = '等待服务器结果';
			display();
			Network.sendPacket(packet);
			return '';
		},
		result(type, packet) {
			if (type !== kind || !current() || !pending) return false;
			if (kind === 'reform' && !order.has(packet.index)) return false;
			pending = false;
			if (packet.result === 0) {
				close();
				return true;
			}
			message = `操作未完成（服务器结果 ${packet.result}），请重新核对材料`;
			display();
			return true;
		}
	};
	active = service;
	display();
	return service;
}
