import { registerGameToolsTab, getGameToolsTabs } from './GameToolsRegistry.js';
import maps from './MapCatalogTab.js';
import monsters from './MonsterCatalogTab.js';
import npcs from './NpcCatalogTab.js';
import items from './ItemCatalogTab.js';
import character from './CharacterMaintenanceTab.js';
import settings from './GameSettingsTab.js';

// Both presentations consume the same feature registry and permission rules.
for (const tab of [maps, monsters, items, npcs, character, settings]) registerGameToolsTab(tab);
export function availableGameToolsTabs(capabilities) {
	return getGameToolsTabs().filter(tab => !tab.capability || capabilities?.[tab.capability] === true);
}
