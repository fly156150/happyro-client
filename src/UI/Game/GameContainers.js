import { createItemPreviewLoader } from './ItemPreview.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import StatusConst from 'DB/Status/StatusState.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import Storage from 'UI/Components/Storage/Storage.js';
import Cart from 'UI/Components/CartItems/CartItems.js';
import { createGameInventory } from './GameInventory.js';
import { storageTransferStatus } from './StorageTransfer.js';
import { interactionSnapshot } from './ServerInteraction.js';

const identity = item =>
	JSON.stringify([item.ITID, item.RefiningLevel, item.enchantgrade, item.slot, item.Options, item.IsIdentified]);

export function createGameContainers(canOperate) {
	const inventory = createGameInventory(canOperate);
	const loadPreview = createItemPreviewLoader();
	let cartRemoval = null;
	const ridingOptions =
		StatusConst.EffectState.FALCON |
		StatusConst.EffectState.RIDING |
		StatusConst.EffectState.DRAGON1 |
		StatusConst.EffectState.DRAGON2 |
		StatusConst.EffectState.DRAGON3 |
		StatusConst.EffectState.DRAGON4 |
		StatusConst.EffectState.DRAGON5 |
		StatusConst.EffectState.MADOGEAR;
	function cartRemovalState() {
		if (cartRemoval?.owner !== Session.Entity) cartRemoval = null;
		if (cartRemoval?.pending) {
			if (!Session.Entity?.hasCart) cartRemoval = { owner: Session.Entity, success: true, message: '已卸下手推车' };
			else if (Date.now() - cartRemoval.started >= 5000)
				cartRemoval = { owner: Session.Entity, success: false, message: '未能卸下手推车，请重试' };
		} else if (cartRemoval?.success && Session.Entity?.hasCart) cartRemoval = null;
		return cartRemoval;
	}
	function available() {
		return canOperate() && Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE;
	}
	function sources() {
		return [
			'inventory',
			...(interactionSnapshot()?.kind === 'storage' ? ['storage'] : []),
			...(Session.Entity?.hasCart ? ['cart'] : [])
		];
	}
	function raw(source) {
		if (source === 'storage') return Storage.getUI().getItems();
		if (source === 'cart') return Cart.list;
		const worn = new Set(
			Equipment.getUI()
				.getItems()
				.map(item => item.index)
		);
		return Inventory.getUI().list.filter(item => !item.equipped && !worn.has(item.index));
	}
	return {
		removeCart() {
			if (!available() || !Session.Entity?.hasCart) return '当前没有可卸下的手推车';
			if (cartRemovalState()?.pending || interactionSnapshot()?.storageTransfer?.pending) return '请稍后重试';
			// This protocol removes riding attachments before carts; do not dismiss another attachment.
			if (Session.Entity.effectState & ridingOptions) return '请先解除坐骑或猎鹰，再卸下手推车';
			cartRemoval = { owner: Session.Entity, pending: true, started: Date.now() };
			Network.sendPacket(new PACKET.CZ.REQ_CARTOFF());
			return null;
		},
		preview(source, index, id, expectedIdentity) {
			const item = raw(source).find(item => item.index === index && item.ITID === id && identity(item) === expectedIdentity);
			return item ? loadPreview(item) : Promise.resolve(null);
		},
		snapshot(source) {
			const containers = sources();
			const removal = cartRemovalState();
			return {
				cartRemoval: removal,
				containers,
				storageCapacity: containers.includes('storage') ? Storage.getUI().getCapacity() : null,
				allowed: Boolean(available() && containers.includes(source)),
				pending: Boolean(interactionSnapshot()?.storageTransfer?.pending || removal?.pending),
				transferStatus: storageTransferStatus(),
				transferSucceeded: interactionSnapshot()?.storageTransfer?.success === true,
				items: containers.includes(source)
					? raw(source)
							.map(item => ({ ...inventory.describe(item), type: item.type, identity: identity(item) }))
							.filter(item => item.count > 0)
					: [],
				capacity:
					source === 'storage' ? Storage.getUI().getCapacity() : source === 'cart' && containers.includes('cart') ? Cart.capacity : null
			};
		},
		transfer(source, destination, index, id, count, expectedIdentity) {
			const containers = sources();
			if (cartRemovalState()?.pending) return '请稍后重试';
			if (interactionSnapshot()?.storageTransfer?.pending) return storageTransferStatus();
			if (
				!available() ||
				source === destination ||
				!containers.includes(source) ||
				!containers.includes(destination)
			)
				return '当前不能转移物品';
			const item = raw(source).find(entry => entry.index === index && entry.ITID === id);
			if (
				!item ||
				identity(item) !== expectedIdentity ||
				!Number.isInteger(count) ||
				count < 1 ||
				count > 2147483647 ||
				count > inventory.describe(item).count
			)
				return '物品或数量已经变化，请重新选择';
			const routes = {
				'inventory:storage': Storage.reqAddItem,
				'storage:inventory': Storage.reqRemoveItem,
				'cart:storage': Storage.reqAddItemFromCart,
				'storage:cart': Storage.reqMoveItemToCart,
				'inventory:cart': Inventory.getUI().reqMoveItemToCart,
				'cart:inventory': Cart.reqRemoveItem
			};
			if (source === 'storage' || destination === 'storage') {
				interactionSnapshot().storageTransfer = {
					source,
					destination,
					index,
					id,
					count,
					pending: true,
					started: Date.now()
				};
			}
			routes[`${source}:${destination}`](index, count);
			return '已请求转移，等待服务器更新';
		}
	};
}
