import Platform from 'UI/Platform.js';
import VendingShop from 'UI/Components/VendingShop/VendingShop.js';
import Session from 'Engine/SessionStorage.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import CartItems from 'UI/Components/CartItems/CartItems.js';
import DB from 'DB/DBManager.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import { createGameInventory } from './GameInventory.js';
import { itemQuantity } from './InventoryItems.js';
import ItemType from 'DB/Items/ItemType.js';
import { showInteraction, interactionSnapshot, clearInteraction } from './ServerInteraction.js';

const identity = item => JSON.stringify([item.ITID, item.RefiningLevel, item.enchantgrade, item.slot, item.Options]);
const integer = (value, max) => Number.isInteger(value) && value > 0 && value <= max;
let ownedStore = null;
export function resetGameVending() {
	ownedStore = null;
}
export function openVendingSetup(mode, slots) {
	const token = {},
		order = new Map();
	let guard = () => !Session.FreezeUI,
		pending = false,
		ended = false;
	const available = () =>
		interactionSnapshot()?.token === token &&
		!pending &&
		!ended &&
		guard() &&
		Session.Playing &&
		Session.Entity &&
		Session.Entity.action !== Session.Entity.ACTION.DIE;
	const inventory = createGameInventory(available);
	const items = () =>
		(mode === 'sell' ? CartItems.list : Inventory.getUI().list).filter(
			item =>
				item.IsIdentified &&
				!item.IsDamaged &&
				!item.equipped &&
				(mode === 'sell' ||
					(![
						ItemType.WEAPON,
						ItemType.ARMOR,
						ItemType.SHADOWGEAR,
						ItemType.PETEGG,
						ItemType.PETARMOR
					].includes(item.type) &&
						DB.isBuyable(item.ITID)))
		);
	const service = {
		setOperationGuard: next => {
			guard = next;
		},
		snapshot() {
			return {
				mode,
				slots,
				pending,
				allowed: Boolean(available()),
				money: Session.zeny,
				items: items().map(item => ({
					...inventory.describe(item),
					identity: identity(item),
					quantity: order.get(item.index)?.count || 0,
					price: order.get(item.index)?.price || 0
				})),
				order: [...order.values()].map(item => ({
					...inventory.describe(item),
					count: item.count,
					price: item.price
				})),
				total: [...order.values()].reduce((sum, item) => sum + item.price * item.count, 0)
			};
		},
		set(index, expected, count, price) {
			const item = items().find(entry => entry.index === index);
			if (
				!available() ||
				!item ||
				identity(item) !== expected ||
				!Number.isInteger(count) ||
				count < 0 ||
				count > (mode === 'sell' ? Math.min(itemQuantity(item), 32767) : 9999)
			)
				return '物品或数量已变化';
			if (!count) {
				order.delete(index);
				return '';
			}
			if (!integer(price, 2147483647) || (!order.has(index) && order.size >= slots))
				return '单价无效或已达到摊位栏位上限';
			if (mode === 'buy' && [...order.values()].some(row => row.index !== index && row.ITID === item.ITID))
				return '同种物品只能设置一条收购记录';
			order.set(index, { ...item, count, price, identity: expected });
			return '';
		},
		submit(name, budget) {
			if (!available() || !order.size || !name.trim()) return '请填写摊位名称并选择物品';
			for (const entry of order.values()) {
				const item = items().find(row => row.index === entry.index);
				if (!item || identity(item) !== entry.identity || (mode === 'sell' && itemQuantity(item) < entry.count))
					return '物品已经变化，请重新选择';
			}
			const total = service.snapshot().total;
			if (!Number.isSafeInteger(total)) return '总金额无效';
			if (mode === 'buy' && (!integer(budget, 2147483647) || budget > Session.zeny))
				return '收购预算无效或余额不足';
			const packet = mode === 'sell' ? new PACKET.CZ.REQ_OPENSTORE2() : new PACKET.CZ.REQ_OPEN_BUYING_STORE();
			packet.storeName = name.trim();
			packet.result = 1;
			packet.storeList = [...order.values()].map(({ index, ITID, count, price }) => ({
				index,
				ITID,
				count,
				price
			}));
			if (mode === 'buy') packet.LimitZeny = budget;
			pending = true;
			Network.sendPacket(packet);
			return '等待服务器摆摊结果';
		},
		fail() {
			if (interactionSnapshot()?.token !== token) return;
			ended = true;
			showInteraction({
				kind: 'notice',
				title: '摆摊失败',
				lines: ['服务器未接受摆摊请求，请检查物品、金额及摆摊条件后重新使用技能。'],
				close: () => clearInteraction('notice')
			});
		},
		close() {
			if (interactionSnapshot()?.token !== token || pending || ended) return;
			ended = true;
			Network.sendPacket(
				mode === 'sell' ? new PACKET.CZ.REQ_OPENSTORE2() : new PACKET.CZ.REQ_OPEN_BUYING_STORE()
			);
			clearInteraction('vending');
		}
	};
	showInteraction({
		kind: 'vending',
		canClose: false,
		title: mode === 'sell' ? '设置售卖摊位' : '设置收购摊位',
		token,
		service,
		close: service.close
	});
	return service;
}
export function vendingSetupFailed() {
	const current = interactionSnapshot();
	if (current?.kind === 'vending') current.service.fail();
}
export function setOwnedVending(mode, packet) {
	ownedStore = {
		mode,
		items: packet.itemList.map(item => ({ ...item, IsIdentified: 1 })),
		budget: packet.limitZeny,
		owner: Session.Entity,
		log: []
	};
	showOwnedVending();
}
export function updateOwnedVending(index, count, byItemID = false, budget) {
	if (!ownedStore || ownedStore.owner !== Session.Entity) return;
	const item = ownedStore.items.find(row => (byItemID ? row.ITID === index : row.index === index));
	if (!item) return;
	item.count = Math.max(0, item.count - count);
	if (budget !== undefined) ownedStore.budget = budget;
	ownedStore.log.push(`${DB.getItemName(item)} × ${count}，单价 ${item.price} Zeny`);
	if (ownedStore.mode === 'sell' && ownedStore.items.every(row => row.count === 0)) {
		Network.sendPacket(new PACKET.CZ.REQ_CLOSESTORE());
		const log = [...ownedStore.log];
		ownedStore = null;
		if (interactionSnapshot()?.kind === 'vending')
			showInteraction({
				kind: 'notice',
				title: '商品已售完',
				lines: log,
				close: () => clearInteraction('notice')
			});
	}
}
export function showOwnedVending() {
	if (!Platform.isMobile) {
		const room = Session.Entity?.room;
		if (!room?.display || ![room.constructor.Type.BUY_SHOP, room.constructor.Type.SELL_SHOP].includes(room.type))
			return false;
		VendingShop.append();
		return true;
	}
	if (!ownedStore || ownedStore.owner !== Session.Entity) return false;
	const store = ownedStore,
		token = {};
	let guard = () => !Session.FreezeUI,
		closed = false;
	const inventory = createGameInventory(() => true);
	const service = {
		setOperationGuard: next => {
			guard = next;
		},
		snapshot: () => ({
			mode: store.mode,
			owned: true,
			budget: store.budget,
			items: store.items.map(item => ({ ...inventory.describe(item), count: item.count, price: item.price })),
			log: [...store.log],
			allowed: !closed && Session.Playing && guard()
		}),
		closeStore() {
			if (interactionSnapshot()?.token !== token || !service.snapshot().allowed) return '当前无法关闭摊位';
			Network.sendPacket(
				store.mode === 'sell' ? new PACKET.CZ.REQ_CLOSESTORE() : new PACKET.CZ.REQ_CLOSE_BUYING_STORE()
			);
			closed = true;
			ownedStore = null;
			clearInteraction('vending');
			return '已请求关闭摊位';
		}
	};
	showInteraction({
		kind: 'vending',
		title: store.mode === 'sell' ? '我的售卖摊位' : '我的收购摊位',
		token,
		service,
		close: () => clearInteraction('vending')
	});
	return true;
}

export function finishOwnedBuying() {
	if (ownedStore?.mode !== 'buy') return;
	ownedStore = null;
	if (interactionSnapshot()?.kind === 'vending')
		showInteraction({
			kind: 'notice',
			title: '收购摊位已关闭',
			lines: ['收购数量已满足或预算已用完。'],
			close: () => clearInteraction('notice')
		});
}
