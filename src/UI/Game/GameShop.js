import DB from 'DB/DBManager.js';
import { itemQuantity } from './InventoryItems.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Session from 'Engine/SessionStorage.js';
import { createGameInventory } from './GameInventory.js';
import { interactionSnapshot, showInteraction, clearInteraction } from './ServerInteraction.js';

/** A server offer owns its order; counts and currency remain server-authoritative. */
export function openGameShop(mode, offers, submit, quit, options = {}) {
	const token = {};
	const currency = options.currency || 'Zeny';
	const balance = () => options.balance ?? Session.zeny;
	let pending = false;
	let canOperate = () => !Session.FreezeUI;
	let finished = false;
	let submittedItems = [];
	const order = new Map();
	const original = offers.map((offer, index) => ({
		...offer,
		index: offer.index ?? index,
		identity: mode === 'sell' ? Inventory.getUI().getItemByIndex(offer.index)?.ITID : offer.ITID
	}));
	const available = () =>
		interactionSnapshot()?.token === token &&
		!pending &&
		!finished &&
		canOperate() &&
		Session.Playing &&
		Session.Entity &&
		Session.Entity.action !== Session.Entity.ACTION.DIE;
	const inventory = createGameInventory(available);
	function snapshot() {
		const items = original.flatMap(offer => {
			let item = { ...offer, IsIdentified: true, count: 65535 };
			if (mode === 'sell') {
				item = Inventory.getUI().getItemByIndex(offer.index);
				if (
					!item ||
					item.ITID !== offer.identity ||
					item.equipped ||
					(options.type !== 'player-buying' && Inventory.getUI().npcsalelock && !(item.PlaceETCTab < 1))
				)
					return [];
			}
			const materials = (
				offer.currencyList ||
				(offer.currencyITID ? [{ ITID: offer.currencyITID, amount: offer.currencyamount }] : [])
			).map(material => ({ ...material, name: DB.getItemName({ ITID: material.ITID, IsIdentified: true }) }));
			const view = inventory.describe(item);
			const price =
				mode === 'sell' ? (offer.overchargeprice ?? offer.price) : (offer.discountprice ?? offer.price ?? 0);
			return [
				{
					...view,
					price,
					materials,
					limit:
						mode === 'sell'
							? Math.min(view.count, options.limitToOffer ? offer.qty : 65535, 65535)
							: Math.min(offer.qty ?? offer.amount ?? 65535, 65535),
					quantity: order.get(offer.index)?.count || 0
				}
			];
		});
		const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
		return { mode, items, total, money: balance(), currency, pending, allowed: Boolean(available()) };
	}
	const service = {
		snapshot,
		setOperationGuard: guard => {
			canOperate = guard;
		},
		set(index, id, count) {
			const item = snapshot().items.find(entry => entry.index === index && entry.ID === id);
			if (!available() || !item || !Number.isInteger(count) || count < 0 || count > item.limit)
				return '数量或物品状态已变化';
			if (count) order.set(index, { ...original.find(offer => offer.index === index), ITID: id, index, count });
			else order.delete(index);
			return '';
		},
		clear() {
			if (!available()) return false;
			order.clear();
			return true;
		},
		submit() {
			const state = snapshot();
			if (!available() || !order.size) return '请先选择物品及数量';
			for (const entry of order.values()) {
				const item = state.items.find(
					candidate => candidate.index === entry.index && candidate.ID === entry.ITID
				);
				if (!item || entry.count > item.limit || !Number.isFinite(item.price) || item.price < 0)
					return '物品已变化，请重新选择';
			}
			if (options.limitToOffer) {
				const counts = new Map();
				for (const entry of order.values()) counts.set(entry.ITID, (counts.get(entry.ITID) || 0) + entry.count);
				for (const [id, count] of counts)
					if (count > original.find(entry => entry.ITID === id).qty) return '超过对方收购数量';
			}
			const required = new Map();
			for (const item of state.items)
				for (const material of item.materials) {
					const amount = material.amount * item.quantity;
					required.set(material.ITID, (required.get(material.ITID) || 0) + amount);
				}
			for (const [id, count] of required) {
				const owned = Inventory.getUI()
					.list.filter(item => item.ITID === id && !item.equipped)
					.reduce((sum, item) => sum + itemQuantity(item), 0);
				if (!Number.isSafeInteger(count) || count > owned) return '兑换材料不足，请核对订单';
			}
			if (
				!Number.isSafeInteger(state.total) ||
				(mode === 'buy' && state.total > state.money) ||
				(options.maxTotal !== undefined && state.total > options.maxTotal)
			)
				return '持有金额不足或订单金额无效';
			submittedItems = state.items
				.filter(item => item.quantity)
				.map(item => ({ name: item.name, count: item.quantity }));
			pending = true;
			submit(
				[...order.values()].map(entry => ({
					ITID: entry.ITID,
					index: entry.index,
					count: entry.count,
					...(entry.currencyITID ? { shopIndex: entry.index, matcurrency: entry.currencyITID } : {}),
					...(options.type === 'cash' ? { price: entry.price, discountprice: entry.discountprice } : {})
				}))
			);
			if (options.requestOnly) {
				finished = true;
				clearInteraction('shop');
			}
			return '已提交，等待服务器回复';
		},
		acknowledgeSale(index, count) {
			if (!pending || options.type !== 'player-buying') return false;
			const entry = order.get(index);
			if (!entry) return false;
			entry.count -= count;
			if (entry.count <= 0) order.delete(index);
			return order.size === 0;
		},
		finish() {
			finished = true;
			if (options.closeAfterResult) quit();
			return { mode, items: submittedItems };
		},
		close() {
			if (interactionSnapshot()?.token !== token) return;
			finished = true;
			clearInteraction('shop');
			quit();
		}
	};
	showInteraction({
		kind: 'shop',
		title: options.title || (mode === 'buy' ? '购买物品' : '出售物品'),
		shopType: options.type || mode,
		shopOwner: options.owner,
		token,
		service,
		close: service.close
	});
	return service;
}
export function finishGameShop(message, success) {
	if (interactionSnapshot()?.kind !== 'shop') return false;
	const receipt = interactionSnapshot().service.finish();
	showInteraction({
		kind: 'notice',
		title: success ? (receipt.mode === 'sell' ? '出售成功' : '购买成功') : '交易失败',
		lines: success ? [] : [toPlainRagnarokText(message)],
		resultItems: success ? receipt.items : [],
		close: () => clearInteraction('notice')
	});
	return true;
}

/** Invalidate an open player catalog when its owner removes the store. */
export function closePlayerShop(owner) {
	const current = interactionSnapshot();
	if (current?.kind === 'shop' && current.shopOwner === owner)
		finishGameShop('摊位已关闭，请重新选择摊位', false);
}
