import { expect, it } from 'vitest';
import { updateWarlockSpheres } from '../../src/Engine/MapEngine/WarlockSphereState.js';
it('replaces sphere snapshots while summoning, consuming and clearing', () => {
	const entity = { GID: 7, Summon1: 68 };
	const instances = [];
	const effects = {
		remove: (type, id, effect) => {
			for (let i = instances.length - 1; i >= 0; i--)
				if (instances[i].ownerAID === id && instances[i].effectId === effect) instances.splice(i, 1);
		},
		spam: params => instances.push({ ...params, spheres: [1, 2, 3, 4, 5].map(i => entity[`Summon${i}`]).filter(Boolean) })
	};
	updateWarlockSpheres(entity, effects);
	entity.Summon2 = 70;
	updateWarlockSpheres(entity, effects);
	expect(instances).toHaveLength(1);
	expect(instances[0].spheres).toEqual([68, 70]);
	entity.Summon1 = 0;
	updateWarlockSpheres(entity, effects);
	expect(instances).toHaveLength(1);
	expect(instances[0].spheres).toEqual([70]);
	entity.Summon2 = 0;
	updateWarlockSpheres(entity, effects);
	expect(instances).toEqual([]);
});
