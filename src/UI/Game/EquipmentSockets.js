import DB from 'DB/DBManager.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

/** The four packet fields also encode forged item ownership; those are not cards. */
export function equipmentSockets(item) {
	if (!item.IsIdentified || !item.slot || [254, 255, 256].includes(item.slot.card1)) return [];
	const cardSlots = Number(DB.getItemInfo(item.ITID).slotCount) || 0;
	return [0, 1, 2, 3].flatMap(index => {
		const id = Number(item.slot[`card${index + 1}`]);
		if (!Number.isInteger(id) || id <= 0) return [];
		const info = DB.getItemInfo(id);
		const description = info.identifiedDescriptionName;
		return [
			{
				id,
				slot: index + 1,
				kind: index < cardSlots ? 'card' : 'enchant',
				name: info.identifiedDisplayName,
				description: toPlainRagnarokText(description).trim(),
				descriptionMarkup: Array.isArray(description) ? description.filter(Boolean).join('\n') : description || ''
			}
		];
	});
}
