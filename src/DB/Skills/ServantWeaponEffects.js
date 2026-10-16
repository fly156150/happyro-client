import Job from '../Jobs/JobConst.js';

// The server shares ZC_SPIRITS with monk spheres and gunslinger coins.
// Only the Dragon Knight branch interprets it as servant weapon ammunition.
export function isServantWeaponJob(job) {
	return job === Job.DRAGON_KNIGHT || job === Job.DRAGON_KNIGHT2 || job === Job.DRAGON_KNIGHT_RIDING;
}

export const servantWeaponEffectIds = Array.from({ length: 5 }, (_, index) => `servant-weapon:${index}`);
export const servantWeaponRenderEffects = Object.fromEntries(
	servantWeaponEffectIds.map((id, index) => [
		id,
		[
			{
				type: '3D',
				file: 'effect/servantweapon/servantweapon_shoot/sav_wp_01.tga',
				attachedEntity: true,
				duration: 4000,
				repeat: true,
				rotatePosX: 2,
				rotatePosY: 2,
				// The common particle renderer uses 350 degrees per unit rotation.
				nbOfRotation: 360 / 350,
				rotateLate: (index * 4) / 5,
				rotateWithCamera: true,
				zOffset: 3,
				// Preserve the 122×410 weapon texture aspect ratio.
				sizeX: (55 * 122) / 410,
				sizeY: 55,
				alphaMax: 1
			}
		]
	])
);
