import Session from 'Engine/SessionStorage.js';
import DB from 'DB/DBManager.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import { createGameInventory } from './GameInventory.js';
import { itemQuantity } from './InventoryItems.js';
import { showInteraction, interactionSnapshot, clearInteraction } from './ServerInteraction.js';

const identity = item => JSON.stringify([item.ITID, item.RefiningLevel, item.enchantgrade, item.slot, item.Options]);
export function openGameTrade(name, callbacks) {
	const token = {},
		offered = new Map(),
		received = [];
	let cancelling = false;
	let guard = () => !Session.FreezeUI,
		pending = null,
		ownLocked = false,
		peerLocked = false;
	let money = 0,
		peerMoney = 0,
		status = '添加物品和金额后锁定报价，再核对双方内容确认成交。';
	const owned = () => interactionSnapshot()?.token === token;
	const allowed = () =>
		owned() && guard() && Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE;
	const inventory = createGameInventory(allowed);
	const eligible = item =>
		item &&
			!item.equipped &&
			!(item.IsDamaged && DB.getPetByEggID(item.ITID)) &&
			!Inventory.getUI().equipswitchlist.some(entry => entry.index === item.index);
	const service = {
		setOperationGuard: value => {
			guard = value;
		},
		snapshot() {
			return {
				name,
				status,
				pending: Boolean(pending || cancelling),
				ownLocked,
				peerLocked,
				money,
				peerMoney,
				allowed: Boolean(allowed()),
				balance: Session.zeny,
				items: Inventory.getUI()
					.list.filter(item => eligible(item) && !offered.has(item.index))
					.map(item => ({ ...inventory.describe(item), identity: identity(item) })),
				offered: [...offered.values()].map(item => inventory.describe(item)),
				received: received.map(item => inventory.describe(item))
			};
		},
		add(index, expected, count) {
			const item = Inventory.getUI().getItemByIndex(index);
			if (
				!allowed() ||
				cancelling ||
				pending ||
				ownLocked ||
				!eligible(item) ||
				identity(item) !== expected ||
				offered.has(index) ||
				offered.size >= 10 ||
				!Number.isInteger(count) ||
				count < 1 ||
				count > Math.min(32767, itemQuantity(item))
			)
				return '物品或数量已变化，无法加入交易';
			pending = { type: 'item', index, item: { ...item, count } };
			callbacks.add(index, count);
			return '等待服务器确认物品';
		},
		setMoney(value) {
			if (
				!allowed() ||
				cancelling ||
				pending ||
				ownLocked ||
				!Number.isInteger(value) ||
				value < 0 ||
				value > Math.min(Session.zeny, 2147483647)
			)
				return '金额无效或正在等待回复';
			// Zeny has no acknowledgement until conclude; the peer receives the update immediately.
			money = value;
			callbacks.add(0, value);
			return '金额已发送，请核对后锁定报价';
		},
		acknowledge(index, success) {
			if (!owned() || pending?.type !== 'item' || pending.index !== index) return;
			const request = pending;
			pending = null;
			if (success) {
				// The trade protocol reserves client inventory on ACK; cancellation returns ADD_ITEM packets.
				Inventory.getUI().removeItem(index, request.item.count);
				offered.set(index, request.item);
			}
			status = success ? '物品已加入；需要修改请取消后重新交易' : '服务器拒绝加入该物品';
		},
		receive(item) {
			if (!owned() || pending?.type === 'execute') return;
			if (!item.ITID) peerMoney = item.count;
			else received.push({ ...item, index: received.length });
			status = '对方更新了报价，请重新核对';
		},
		lock() {
			if (!allowed() || cancelling || pending || ownLocked || money > Session.zeny) return '当前无法锁定报价';
			pending = { type: 'lock' };
			callbacks.lock();
			return '等待服务器锁定报价';
		},
		conclude(peer) {
			if (!owned()) return;
			if (peer) peerLocked = true;
			else {
				ownLocked = true;
				if (pending?.type === 'lock') pending = null;
			}
			status = ownLocked && peerLocked ? '双方已锁定，请核对物品和金额后确认成交' : '等待另一方锁定报价';
		},
		execute() {
			if (!allowed() || cancelling || pending || !ownLocked || !peerLocked) return '双方尚未锁定报价';
			pending = { type: 'execute' };
			callbacks.execute();
			return '已确认，等待交易结果';
		},
		cancel() {
			if (!allowed() || cancelling || pending?.type === 'execute') return '正在等待交易结果';
			cancelling = true;
			callbacks.cancel();
			return '等待服务器取消交易';
		},
		finish(message, success) {
			if (!owned()) return;
			if (success) {
				clearInteraction('trade');
				return;
			}
			showInteraction({
				kind: 'notice',
				title: '交易结果',
				lines: [message],
				close: () => clearInteraction('notice')
			});
		}
	};
	showInteraction({ kind: 'trade', title: `与 ${name} 交易`, token, service, canClose: false });
	return service;
}
export function currentGameTrade() {
	const current = interactionSnapshot();
	return current?.kind === 'trade' ? current.service : null;
}
