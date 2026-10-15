import catalog from 'DB/Items/ItemSubtypes.generated.json';
import { weaponSubtypeNames, armorSlotNames, cardSubtypeNames } from './ItemSubtypeNames.js';

export const itemSubtypeNames = { ...weaponSubtypeNames, ...armorSlotNames, ...cardSubtypeNames };

/** Generated using the same source snapshot and classifier as adventure item searches. */
export function itemSubtypes(item) {
 const subtype = catalog.items[item.ITID];
 return subtype && Object.hasOwn(itemSubtypeNames, subtype) ? [subtype] : [];
}
