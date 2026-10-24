import Session from 'Engine/SessionStorage.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';

/** Match the desktop death menu's item and map restrictions. HP may arrive before resurrection. */
export function gameDeathSnapshot() {
	const entity = Session.Entity;
	const dead = Boolean(entity && entity.action === entity.ACTION.DIE);
	const restricted = Session.IsPKZone || Session.IsSiegeMode || Session.IsEventPVPMode;
	const count = dead && !restricted ? Inventory.getUI().getItemById(7621)?.count || 0 : 0;
	return { dead, tokenCount: Math.max(0, count) };
}
