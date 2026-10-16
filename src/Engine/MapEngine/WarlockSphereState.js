const sphereEffect = 'temporary_warlock_sphere';

/** Replace the prior snapshot: the renderer captures the sphere list at creation. */
export function updateWarlockSpheres(entity, effects) {
	effects.remove(null, entity.GID, sphereEffect);
	const active = [1, 2, 3, 4, 5].some(index => entity[`Summon${index}`]);
	if (active) effects.spam({ effectId: sphereEffect, ownerAID: entity.GID, persistent: false });
}
