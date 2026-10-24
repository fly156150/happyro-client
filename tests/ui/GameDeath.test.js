import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ session: {}, item: null }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: {
	getUI: () => ({ getItemById: id => id === 7621 ? state.item : null })
} }));
import { gameDeathSnapshot } from '../../src/UI/Game/GameDeath.js';
beforeEach(() => {
	for (const key of Object.keys(state.session)) delete state.session[key];
	state.session.Entity = { action: 1, ACTION: { DIE: 1 }, life: { hp: 0 } };
	state.item = { count: 2 };
});
it('offers the same revival token and quantity as the desktop menu', () => {
	expect(gameDeathSnapshot()).toEqual({ dead: true, tokenCount: 2 });
	state.item = null;
	expect(gameDeathSnapshot()).toEqual({ dead: true, tokenCount: 0 });
});
it.each(['IsPKZone', 'IsSiegeMode', 'IsEventPVPMode'])('hides the token in %s', flag => {
	state.session[flag] = true;
	expect(gameDeathSnapshot()).toEqual({ dead: true, tokenCount: 0 });
});
it('uses the resurrection action instead of stale HP and handles leaving the map', () => {
	state.session.Entity.action = 0;
	expect(gameDeathSnapshot()).toEqual({ dead: false, tokenCount: 0 });
	state.session.Entity = null;
	expect(gameDeathSnapshot()).toEqual({ dead: false, tokenCount: 0 });
});
