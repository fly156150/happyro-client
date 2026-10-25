import NpcBox from 'UI/Components/NpcBox/NpcBox.js';
import { loadAdventureAsset } from 'UI/Components/GameTools/AdventureControlService.js';
import { getAdventureActionState } from 'UI/Components/GameTools/AdventureActionService.js';
import { recoveryDefinition } from 'DB/Items/RecoveryItems.js';
import DB from 'DB/DBManager.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Session from 'Engine/SessionStorage.js';
import { itemUseExecution } from 'Network/ItemUseExecution.js';
import { createRecoveryController } from './RecoveryController.js';
import { itemQuantity } from './InventoryItems.js';
import { isAutoCombatTeleportPending } from './AutoCombatTeleport.js';

export function recoveryItems() {
	return Inventory.getUI().list.flatMap(item => {
		const definition = recoveryDefinition(item.ITID);
		return definition && itemQuantity(item) > 0
			? [
					{
						...definition,
						index: item.index,
						count: itemQuantity(item),
						available: itemUseExecution.canUse(item.index, definition.cooldownGroup),
						name: DB.getItemName(item)
					}
				]
			: [];
	});
}
export function recoveryItemName(id) {
	return DB.getItemInfo(id).identifiedDisplayName || String(id);
}
export function createGameAutoRecovery(canRun) {
	return createRecoveryController({
		now: () => performance.now(),
		life: () => Session.Entity?.life,
		allowed: () =>
			canRun() && !isAutoCombatTeleportPending() && !getAdventureActionState().mapPending && !NpcBox.__active,
		busy: () => itemUseExecution.busy(true),
		items: recoveryItems,
		use: (item, complete) => Inventory.getUI().onUseItem(item.index, { source: 'automation', complete }) === true
	});
}

export const loadRecoveryItemIcon = id => loadAdventureAsset(`/items/${id}/icon`);
