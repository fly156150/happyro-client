import catalog from './RecoveryItems.json';
const definitions = new Map(catalog.items.map(item => [item.id, item]));
export const recoveryDefinition = id => definitions.get(id);
