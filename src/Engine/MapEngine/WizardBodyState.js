import StatusState from '../../DB/Status/StatusState.js';

// Body-state notifications also arrive when entering sight. Skill-success
// notifications do not describe the duration or an early break of the prison.
export function syncWhiteImprison(entity, effects) {
	const active = entity.bodyState === StatusState.BodyState.IMPRISON;
	if (Boolean(entity.whiteImprisonEffect) === active) return;
	effects.remove(null, entity.GID, 802);
	entity.whiteImprisonEffect = active;
	if (active) effects.spam({ effectId: 802, ownerAID: entity.GID });
}
