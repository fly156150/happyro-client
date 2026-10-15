import { interactionSnapshot } from 'UI/Game/ServerInteraction.js';
import {
	openVendingSetup,
	vendingSetupFailed,
	setOwnedVending,
	updateOwnedVending,
	finishOwnedBuying
} from 'UI/Game/GameVending.js';
import Platform from 'UI/Platform.js';
import { openGameShop, finishGameShop } from 'UI/Game/GameShop.js';
/**
 * Engine/MapEngine/Store.js
 *
 * Manage npc store (buy/sell items)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Load dependencies
 */
import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import EntityManager from 'Renderer/EntityManager.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import NpcStore from 'UI/Components/NpcStore/NpcStore.js';
import Vending from 'UI/Components/Vending/Vending.js';
import VendingReport from 'UI/Components/VendingReport/VendingReport.js';
import VendingShop from 'UI/Components/VendingShop/VendingShop.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';

/**
 * Received items list to buy from cash npc
 *
 * @param {object} pkt - PACKET.ZC.ZC_PC_CASH_POINT_ITEMLIST
 */
function onBuyCashList(pkt) {
	if (!Platform.isMobile) {
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.CASH_SHOP);
		NpcStore.setList(pkt.itemList);

		const entity = Session.Entity;
		NpcStore.ui.find('.cashuser .buyer').text(entity ? entity.display.name : '');
		NpcStore.ui.find('.cashuser .cashpoints').text(pkt.KafraPoint);
	}
	const submit = itemList => {
		// add prompt confirmation first later...
		const _pkt = new PACKET.CZ.PC_BUY_CASH_POINT_ITEM();
		const count = itemList.length;
		_pkt.kafrapts = 0;

		for (let i = 0; i < count; ++i) {
			_pkt.list.push({
				count: itemList[i].count,
				ITID: itemList[i].ITID,
				price: itemList[i].discountprice || itemList[i].price
			});
			//pkt.kafrapts += (itemList[i].discountprice || itemList[i].price) * itemList[i].count;
		}

		Network.sendPacket(_pkt);
	};
	if (Platform.isMobile)
		openGameShop('buy', pkt.itemList, submit, () => Network.sendPacket(new PACKET.CZ.NPC_TRADE_QUIT()), {
			type: 'cash',
			title: '点数商店',
			currency: '商店点数',
			balance: pkt.KafraPoint,
			closeAfterResult: true
		});
	else NpcStore.onSubmit = submit;
}

/**
 * Received items list to sell
 *
 * @param {object} pkt - PACKET.ZC.ZC_PC_CASH_POINT_ITEMLIST
 */
function onBuyVendingList(pkt) {
	if (Platform.isMobile) {
		setOwnedVending('sell', pkt);
		return;
	}
	VendingShop.append();
	VendingShop.setType(VendingShop.Type.VENDING_LIST);
	VendingShop.setItems(pkt.itemList);
}

/**
 * Received items list to buy
 *
 * @param {object} pkt - PACKET.ZC.ZC_PC_CASH_POINT_ITEMLIST
 */
function onBuyingList(pkt) {
	if (Platform.isMobile) {
		setOwnedVending('buy', pkt);
		return;
	}
	VendingShop.append();
	VendingShop.setType(VendingShop.Type.BUYING_LIST);
	VendingShop.setItems(pkt.itemList);
}

function onDeleteVendingItem(pkt) {
	if (Platform.isMobile) {
		updateOwnedVending(pkt.index, pkt.count);
		return;
	}
	// Vending Report
	if (PACKETVER.value >= 20141016) {
		VendingReport.add(pkt);
	}

	VendingShop.removeItem(pkt.index, pkt.count);
}

/**
 * Received items list to buy from npc
 *
 * @param {object} pkt - PACKET.ZC.PC_PURCHASE_ITEMLIST
 */
function onBuyList(pkt) {
	if (!Platform.isMobile) {
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.BUY);
		NpcStore.setList(pkt.itemList);
	}
	const submit = itemList => {
		const _pkt = new PACKET.CZ.PC_PURCHASE_ITEMLIST();
		const count = itemList.length;

		for (let i = 0; i < count; ++i) {
			_pkt.itemList.push({
				ITID: itemList[i].ITID,
				count: itemList[i].count
			});
		}

		Network.sendPacket(_pkt);
	};
	if (Platform.isMobile)
		openGameShop('buy', pkt.itemList, submit, () => Network.sendPacket(new PACKET.CZ.NPC_TRADE_QUIT()));
	else NpcStore.onSubmit = submit;
}

/**
 * Received items list to from barter NPC
 *
 * @param {object} pkt - PACKET.ZC.NPC_BARTER_MARKET_ITEMINFO
 */
function onBarterBuyList(pkt) {
	if (!Platform.isMobile) {
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.BARTER_MARKET);
		NpcStore.setList(pkt.itemList);
	}
	const submit = itemList => {
		const _pkt = new PACKET.CZ.NPC_BARTER_MARKET_PURCHASE();
		const count = itemList.length;

		for (let i = 0; i < count; ++i) {
			const item = Inventory.getUI().getItemById(itemList[i].matcurrency);
			const item_index = item ? item.index : -1;
			_pkt.itemList.push({
				itemId: itemList[i].ITID,
				amount: itemList[i].count,
				invIndex: item_index,
				shopIndex: itemList[i].shopIndex
			});
		}

		Network.sendPacket(_pkt);
	};
	if (Platform.isMobile)
		openGameShop('buy', pkt.itemList, submit, () => Network.sendPacket(new PACKET.CZ.NPC_BARTER_MARKET_CLOSE()), {
			type: 'barter',
			title: '材料兑换',
			closeAfterResult: true
		});
	else NpcStore.onSubmit = submit;
}

/**
 * Received items list to from expanded barter NPC
 *
 * @param {object} pkt - PACKET.ZC.NPC_EXPANDED_BARTER_MARKET_ITEMINFO
 */
function onExpandedBarterBuyList(pkt) {
	if (!Platform.isMobile) {
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.BARTER_MARKET_EXTENDED);
		NpcStore.setList(pkt.itemList);
	}
	const submit = itemList => {
		const _pkt = new PACKET.CZ.NPC_EXPANDED_BARTER_MARKET_PURCHASE();
		const count = itemList.length;

		for (let i = 0; i < count; ++i) {
			_pkt.itemList.push({
				itemId: itemList[i].ITID,
				shopIndex: itemList[i].index,
				amount: itemList[i].count
			});
		}

		Network.sendPacket(_pkt);
	};
	if (Platform.isMobile)
		openGameShop(
			'buy',
			pkt.itemList,
			submit,
			() => Network.sendPacket(new PACKET.CZ.NPC_EXPANDED_BARTER_MARKET_CLOSE()),
			{ type: 'barter-expanded', title: '材料兑换', closeAfterResult: true }
		);
	else NpcStore.onSubmit = submit;
}

/**
 * Received purchased informations
 *
 * @param {object} pkt - PACKET_ZC_PC_PURCHASE_RESULT
 */
function onBuyResult(pkt) {
	if (
		Platform.isMobile &&
		finishGameShop(
			DB.getMessage(
				{ 0: 54, 1: 55, 2: 56, 4: 230, 5: 281, 7: 1797, 11: 3554, 12: 3555, 13: 3557, 14: 3556 }[pkt.result] ??
					57
			),
			pkt.result === 0
		)
	)
		return;
	NpcStore.remove();

	switch (pkt.result) {
		case 0:
			ChatBox.addText(DB.getMessage(54), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
			break; // success
		case 1:
			ChatBox.addText(DB.getMessage(55), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // zeny
		case 2:
			ChatBox.addText(DB.getMessage(56), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // overweight
		case 4:
			ChatBox.addText(DB.getMessage(230), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // out of stock
		case 5:
			ChatBox.addText(DB.getMessage(281), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // trade
		// case 6: 6 = Because the store information was incorrect the item was not purchased.
		case 7:
			ChatBox.addText(DB.getMessage(1797), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // no sale information
		case 11:
			ChatBox.addText(DB.getMessage(3554), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // Exchange failed
		case 12:
			ChatBox.addText(DB.getMessage(3555), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
			break; // Exchange successfuly completed
		case 13:
			ChatBox.addText(DB.getMessage(3557), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // The item has been sold and out of stock
		case 14:
			ChatBox.addText(DB.getMessage(3556), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // Not enough items to exchange
		default:
			ChatBox.addText(DB.getMessage(57), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // deal failed
	}

	if (NpcStore.getCurrentType() >= 4 && NpcStore.getCurrentType() != NpcStore.Type.CASH_SHOP) {
		// Marketshop && Barter
		NpcStore.closeStore();
	}
}

/**
 * Received purchased informations
 *
 * @param {object} pkt - PACKET_ZC_PC_CASH_POINT_UPDATE
 */

function onBuyCashResult(pkt) {
	if (
		Platform.isMobile &&
		finishGameShop(
			DB.getMessage({ 0: 54, 1: 1227, 2: 1228, 4: 1229, 5: 1230, 6: 1254, 7: 1813 }[pkt.Error] ?? 1814),
			pkt.Error === 0
		)
	)
		return;
	if (NpcStore.getCurrentType() >= 4 && NpcStore.getCurrentType() != NpcStore.Type.CASH_SHOP) {
		NpcStore.setClosePacketSent(true);
		// Marketshop && Barter
		NpcStore.remove();
		NpcStore.closeStore();
	}

	switch (pkt.Error) {
		case 0:
			ChatBox.addText(DB.getMessage(54), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
			break; // success
		case 1:
			ChatBox.addText(DB.getMessage(1227), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // zeny
		case 2:
			ChatBox.addText(DB.getMessage(1228), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // overweight
		case 4:
			ChatBox.addText(DB.getMessage(1229), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // out of stock
		case 5:
			ChatBox.addText(DB.getMessage(1230), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // trade
		case 6:
			ChatBox.addText(DB.getMessage(1254), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break;
		case 7:
			ChatBox.addText(DB.getMessage(1813), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // no sale information
		default:
			ChatBox.addText(DB.getMessage(1814), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // deal failed
	}

	NpcStore.ui.find('.cashuser .cashpoints').text(pkt.KafraPoint);
}

/**
 * Received purchased informations
 *
 * @param {object} pkt - FAILED_TRADE_BUYING_STORE_TO_SELLER
 */

function onSellToBuyingStoreResult(pkt) {
	if (
		Platform.isMobile &&
		finishGameShop('收购交易未全部完成，请检查物品数量和对方预算；已成交部分以背包更新为准。', false)
	)
		return;
	switch (pkt.Result) {
		case 6:
			ChatBox.addText(DB.getMessage(1742), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // The trade failed, because the entered amount of item %s is higher, than the buyer is willing to buy.
		case 7:
			ChatBox.addText(DB.getMessage(1740), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // The trade failed, because the buyer is lacking required balance.
		default:
			ChatBox.addText(DB.getMessage(57), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			break; // deal failed
	}
}

/**
 * Received items list to buy from npc
 *
 * @param {object} pkt - PACKET.ZC.PC_SELL_ITEMLIST
 */
function onSellList(pkt) {
	if (!Platform.isMobile) {
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.SELL);
		NpcStore.setList(pkt.itemList);
	}
	const submit = itemList => {
		const _pkt = new PACKET.CZ.PC_SELL_ITEMLIST();
		const count = itemList.length;

		for (let i = 0; i < count; ++i) {
			_pkt.itemList.push({
				index: itemList[i].index,
				count: itemList[i].count
			});
		}

		Network.sendPacket(_pkt);
	};
	if (Platform.isMobile)
		openGameShop('sell', pkt.itemList, submit, () => Network.sendPacket(new PACKET.CZ.NPC_TRADE_QUIT()));
	else NpcStore.onSubmit = submit;
}

/**
 * Receive sell list result
 *
 * @param {object} pkt - PACKET_ZC.PC.SELL_RESULT
 */
function onSellResult(pkt) {
	if (Platform.isMobile && finishGameShop(DB.getMessage(pkt.result === 0 ? 54 : 57), pkt.result === 0)) return;
	NpcStore.setClosePacketSent(true);
	NpcStore.remove();

	// success
	if (pkt.result === 0) {
		ChatBox.addText(DB.getMessage(54), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
	}

	// Fail
	else {
		ChatBox.addText(DB.getMessage(57), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
	}
}

/**
 * Received items list to buy from player
 *
 * @param {object} pkt - PACKET.ZC.PC_PURCHASE_ITEMLIST_FROMMC
 */
function onVendingStoreList(_pkt) {
	if (!Platform.isMobile) {
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.VENDING_STORE);
		NpcStore.setList(_pkt.itemList);

		// Get seller name
		const entity = EntityManager.get(_pkt.AID);
		NpcStore.ui.find('.seller').text(entity ? entity.display.name : '');
	}

	// Bying items
	const submit = function (itemList) {
		if (!Platform.isMobile) {
			NpcStore.setClosePacketSent(true);
			NpcStore.remove();
		}

		let pkt;

		if (_pkt instanceof PACKET.ZC.PC_PURCHASE_ITEMLIST_FROMMC3) {
			pkt = new PACKET.CZ.PC_PURCHASE_ITEMLIST_FROMMC2();
			pkt.UniqueID = _pkt.UniqueID;
		} else if (_pkt instanceof PACKET.ZC.PC_PURCHASE_ITEMLIST_FROMMC2) {
			pkt = new PACKET.CZ.PC_PURCHASE_ITEMLIST_FROMMC2();
			pkt.UniqueID = _pkt.UniqueID;
		} else {
			pkt = new PACKET.CZ.PC_PURCHASE_ITEMLIST_FROMMC();
		}

		pkt.AID = _pkt.AID;
		const count = itemList.length;

		for (let i = 0; i < count; ++i) {
			pkt.itemList.push({
				index: itemList[i].index,
				count: itemList[i].count
			});
		}

		Network.sendPacket(pkt);
	};
	if (Platform.isMobile)
		openGameShop(
			'buy',
			_pkt.itemList.map(item => ({ ...item, qty: item.count })),
			submit,
			() => {},
			{ type: 'player-vending', title: '玩家售卖摊位', requestOnly: true, owner: _pkt.AID }
		);
	else NpcStore.onSubmit = submit;
}
/**
 * Received items list to buy from player
 *
 * @param {object} pkt - PACKET.ZC.ACK_ITEMLIST_BUYING_STORE
 */
function onBuyingStoreList(_pkt) {
	if (!Platform.isMobile) {
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.BUYING_STORE);
		NpcStore.setList(_pkt.itemList);
		NpcStore.setPriceLimit(_pkt.limitZeny);

		// Get seller name
		const entity = EntityManager.get(_pkt.AID);
		NpcStore.ui.find('.seller').text(entity ? entity.display.name : '');
	}

	// Bying items
	const submit = function (itemList) {
		if (!Platform.isMobile) {
			NpcStore.setClosePacketSent(true);
			NpcStore.remove();
		}

		const pkt = new PACKET.CZ.REQ_TRADE_BUYING_STORE();
		pkt.UniqueID = _pkt.UniqueID;
		pkt.AID = _pkt.AID;

		const count = itemList.length;

		for (let i = 0; i < count; ++i) {
			pkt.itemList.push({
				index: itemList[i].index,
				ITID: itemList[i].ITID,
				count: itemList[i].count
			});
		}

		Network.sendPacket(pkt);
	};
	if (Platform.isMobile) {
		const offers = Inventory.getUI().list.flatMap(item => {
			const offer = _pkt.itemList.find(row => row.ITID === item.ITID);
			return offer && !item.equipped && item.IsIdentified
				? [{ ...offer, index: item.index, qty: offer.count }]
				: [];
		});
		openGameShop('sell', offers, submit, () => {}, {
			type: 'player-buying',
			owner: _pkt.AID,
			title: '出售给玩家收购摊位',
			limitToOffer: true,
			maxTotal: _pkt.limitZeny
		});
	} else NpcStore.onSubmit = submit;
}
/**
 * Open vending creation window with X slots
 *
 * @param {object} pkt - PACKET.ZC.PACKET_ZC_OPENSTORE
 */
function onOpenVending(pkt) {
	if (Platform.isMobile) {
		openVendingSetup('sell', pkt.itemcount);
		return;
	}
	if (Vending.isOpen) {
		return;
	}

	// Otherwise, open another merchant's shop
	Vending.setType(Vending.Type.VENDING_STORE);
	Vending.onVendingSkill(pkt);
}

/**
 * Open Buying creation window with X slots
 *
 * @param {object} pkt - PACKET.ZC.PACKET_ZC_OPENSTORE
 */
function onOpenBuying(pkt) {
	if (Platform.isMobile) {
		openVendingSetup('buy', pkt.itemcount);
		return;
	}
	Vending.setType(Vending.Type.BUYING_STORE);
	Vending.onBuyingSkill(pkt);
}

/**
 * Open vending creation window with X slots
 *
 * @param {object} pkt - PACKET.ZC.ACK_OPENSTORE2
 */
function onOpenVendingResult(pkt) {
	if (Platform.isMobile && pkt.result !== 0) vendingSetupFailed();
	// TODO: check what it do in client
}

/**
 * Open vending creation window with X slots
 *
 * @param {object} pkt - PACKET.ZC.ACK_OPENSTORE2
 */
function onOpenBuyingResult(pkt) {
	if (Platform.isMobile) {
		vendingSetupFailed();
		return;
	}
	// client use same message for all errors, i just documented it here:
	switch (pkt.Result) {
		case 1:
			ChatBox.addText(DB.getMessage(1741), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG); // "Failed to open buying store." - invalid item/amount/price
			break;
		case 2:
			ChatBox.addText(DB.getMessage(1741), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG); // "Total amount of then possessed items exceeds the weight limit by %d. Please re-enter." - not able to carry all wanted items without getting overweight (90%)
			break;
		default:
			ChatBox.addText(DB.getMessage(1741), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
	}
}

/**
 * Received items list to from Marketshop NPC
 *
 * @param {object} pkt - PACKET.ZC.NPC_MARKET_OPEN2
 */
function onMarketShop(pkt) {
	if (!Platform.isMobile) {
		// Initialize the NPC store for Market Shop
		NpcStore.append();
		NpcStore.setType(NpcStore.Type.MARKETSHOP); // Set the type to MARKETSHOP
		NpcStore.setList(pkt.itemList); // Set the item list from the packet

		// Define the submission callback
	}
	const submit = itemList => {
		const _pkt = new PACKET.CZ.NPC_MARKET_PURCHASE(); // Use the market purchase packet
		const count = itemList.length;

		for (let i = 0; i < count; ++i) {
			_pkt.itemList.push({
				itemId: itemList[i].ITID, // Item ID
				amount: itemList[i].count // Quantity to purchase
			});
		}

		// Send the constructed packet
		Network.sendPacket(_pkt);
	};
	if (Platform.isMobile)
		openGameShop('buy', pkt.itemList, submit, () => Network.sendPacket(new PACKET.CZ.NPC_MARKET_CLOSE()), {
			type: 'market',
			title: '限量商店',
			closeAfterResult: true
		});
	else NpcStore.onSubmit = submit;
}

/**
 * Handles marketshop purchase result packet
 *
 * @param {PACKET.ZC.NPC_MARKET_PURCHASE_RESULT} pkt
 * @param {PACKET.ZC.NPC_MARKET_PURCHASE_RESULT2} pkt
 */
function onMarketShopResult(pkt) {
	if (Platform.isMobile && finishGameShop(DB.getMessage(pkt.result === 0 ? 54 : 57), pkt.result === 0)) return;
	if (pkt) {
		switch (pkt.result) {
			case 0: // PACKETVER.value >= 20190807 success
			case 1: // PACKETVER.value < 20190807 success
				ChatBox.addText(DB.getMessage(54), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
				NpcStore.onMarketShopResultUI(pkt.itemList);
				break;
			default:
				break;
		}
	}
}

function onBuyingItemDeleted(pkt) {
	Inventory.getUI().removeItem(pkt.index, pkt.count);
	if (Platform.isMobile && interactionSnapshot()?.shopType === 'player-buying') {
		if (interactionSnapshot().service.acknowledgeSale(pkt.index, pkt.count)) finishGameShop('订单已成交', true);
	}
}
function onBuyingStoreUpdated(pkt) {
	if (Platform.isMobile) updateOwnedVending(pkt.ITID, pkt.count, true, pkt.limitZeny);
}

/**
 * Initialize
 */
export default function MainEngine() {
	Network.hookPacket(PACKET.ZC.PC_CASH_POINT_ITEMLIST, onBuyCashList);
	Network.hookPacket(PACKET.ZC.PC_CASH_POINT_UPDATE, onBuyCashResult);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_ITEMLIST, onBuyList);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_ITEMLIST2, onBuyList);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_RESULT, onBuyResult);
	Network.hookPacket(PACKET.ZC.PC_SELL_ITEMLIST, onSellList);
	Network.hookPacket(PACKET.ZC.PC_SELL_RESULT, onSellResult);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_ITEMLIST_FROMMC, onVendingStoreList);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_ITEMLIST_FROMMC2, onVendingStoreList);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_ITEMLIST_FROMMC3, onVendingStoreList);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_RESULT_FROMMC, onBuyResult);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_MYITEMLIST, onBuyVendingList);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_MYITEMLIST2, onBuyVendingList);
	Network.hookPacket(PACKET.ZC.DELETEITEM_FROM_MCSTORE, onDeleteVendingItem);
	Network.hookPacket(PACKET.ZC.DELETEITEM_FROM_MCSTORE2, onDeleteVendingItem);
	Network.hookPacket(PACKET.ZC.FAILED_TRADE_BUYING_STORE_TO_BUYER, () => {
		if (Platform.isMobile) finishOwnedBuying();
	});
	Network.hookPacket(PACKET.ZC.ITEM_DELETE_BUYING_STORE, onBuyingItemDeleted);
	Network.hookPacket(PACKET.ZC.UPDATE_ITEM_FROM_BUYING_STORE2, onBuyingStoreUpdated);
	Network.hookPacket(PACKET.ZC.OPENSTORE, onOpenVending);
	Network.hookPacket(PACKET.ZC.ACK_OPENSTORE2, onOpenVendingResult);
	Network.hookPacket(PACKET.ZC.OPEN_BUYING_STORE, onOpenBuying);
	Network.hookPacket(PACKET.ZC.FAILED_OPEN_BUYING_STORE_TO_BUYER, onOpenBuyingResult);
	Network.hookPacket(PACKET.ZC.MYITEMLIST_BUYING_STORE, onBuyingList);
	Network.hookPacket(PACKET.ZC.PC_PURCHASE_ITEMLIST_FROMMC3, onVendingStoreList);
	Network.hookPacket(PACKET.ZC.ACK_ITEMLIST_BUYING_STORE, onBuyingStoreList);
	Network.hookPacket(PACKET.ZC.FAILED_TRADE_BUYING_STORE_TO_SELLER, onSellToBuyingStoreResult);
	Network.hookPacket(PACKET.ZC.NPC_MARKET_OPEN2, onMarketShop);
	Network.hookPacket(PACKET.ZC.NPC_MARKET_PURCHASE_RESULT, onMarketShopResult);
	Network.hookPacket(PACKET.ZC.NPC_MARKET_PURCHASE_RESULT2, onMarketShopResult);
	Network.hookPacket(PACKET.ZC.NPC_BARTER_MARKET_ITEMINFO, onBarterBuyList);
	Network.hookPacket(PACKET.ZC.NPC_EXPANDED_BARTER_MARKET_ITEMINFO, onExpandedBarterBuyList);
}
