import { beforeEach, expect, it, vi } from 'vitest';
import { getCombatSearchLimit, onCombatLimitsChange, updateCombatLimits } from '../../src/Network/CombatLimits.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
beforeEach(() => endConnection());
it('uses only authoritative limits and clears them on disconnect', () => {
 expect(getCombatSearchLimit()).toBeNull();
 const changed = vi.fn(); const off = onCombatLimitsChange(changed);
 updateCombatLimits({ searchRadius: 20 }); expect(getCombatSearchLimit()).toBe(20);
 updateCombatLimits({ searchRadius: 12 }); expect(getCombatSearchLimit()).toBe(12);
 updateCombatLimits({ searchRadius: 12 }); expect(changed).toHaveBeenCalledTimes(2);
 endConnection(); expect(getCombatSearchLimit()).toBeNull();
 off(); updateCombatLimits({ searchRadius: 25 }); expect(changed).toHaveBeenCalledTimes(3);
});
it('caps supported range and rejects invalid wire values without inventing a default', () => {
 updateCombatLimits({ searchRadius: 80 }); expect(getCombatSearchLimit()).toBe(50);
 for (const searchRadius of [0, -1, undefined, 2.5]) {
  updateCombatLimits({ searchRadius }); expect(getCombatSearchLimit()).toBeNull();
 }
});
