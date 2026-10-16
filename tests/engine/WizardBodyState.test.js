import { expect, it, vi } from 'vitest';
import StatusState from '../../src/DB/Status/StatusState.js';
import { syncWhiteImprison } from '../../src/Engine/MapEngine/WizardBodyState.js';

it('restores prison on entry, avoids duplicates and removes it on an early break', () => {
	const entity = { GID: 42, bodyState: StatusState.BodyState.IMPRISON };
	const effects = { spam: vi.fn(), remove: vi.fn() };
	syncWhiteImprison(entity, effects);
	syncWhiteImprison(entity, effects);
	expect(effects.spam).toHaveBeenCalledExactlyOnceWith({ effectId: 802, ownerAID: 42 });
	effects.remove.mockClear();
	entity.bodyState = 0;
	syncWhiteImprison(entity, effects);
	expect(effects.remove).toHaveBeenCalledExactlyOnceWith(null, 42, 802);
	expect(entity.whiteImprisonEffect).toBe(false);
	entity.bodyState = StatusState.BodyState.IMPRISON;
	syncWhiteImprison(entity, effects);
	expect(effects.spam).toHaveBeenCalledTimes(2);
});
