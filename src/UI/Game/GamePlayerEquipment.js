import { equipmentSlots } from './GameEquipment.js';
import { createGameInventory } from './GameInventory.js';
import { createItemPreviewLoader } from './ItemPreview.js';
import { showInteraction, clearInteraction, interactionSnapshot } from './ServerInteraction.js';

/** Read-only inspection uses server WearState, never the local character's equipment. */
export function showPlayerEquipment(packet) {
	const inventory = createGameInventory(() => false);
	const loadPreview = createItemPreviewLoader();
	const items = packet.ItemInfo;
	const token = Symbol('player-equipment');
	showInteraction({
		kind: 'equipment',
		title: `${packet.characterName} · 装备`,
		token,
		service: {
			readOnly: true,
			snapshot: () => ({
				attachment: { mask: 0, label: '', removal: null },
				stats: [],
				slots: equipmentSlots.map(slot => {
					const item = items.find(item => item.WearState & slot.location);
					return {
						...slot,
						item: item ? { ...inventory.describe(item), worn: true, reason: '' } : null,
						candidates: []
					};
				})
			}),
			preview: (index, id) => {
				const item = items.find(item => item.index === index && item.ITID === id);
				return item ? loadPreview(item) : Promise.resolve(null);
			}
		},
		close: () => {
			if (interactionSnapshot()?.token === token) clearInteraction('equipment');
		}
	});
}
