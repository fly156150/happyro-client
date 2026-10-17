import SK from './SkillConst.js';

// These older skills have no complete STR sequence in the supported GRF.
// Build short activation feedback from its primitive textures instead of
// borrowing another skill's animation. This is not an exact official replica.
const ring = (textureName, extra = {}) => ({
	type: 'CYLINDER', textureName, attachedEntity: true,
	duration: 900, animation: 4, topSize: 0.9, bottomSize: 1.1,
	height: 0.08, posZ: 0.08, totalCircleSides: 32, circleSides: 32,
	alphaMax: 0.7, blendMode: 2, fade: true, ...extra
});
const beam = extra => ring('alpha_down', {
	animation: 5, topSize: 0.6, bottomSize: 0.6, height: 3,
	duration: 1100, alphaMax: 0.45, ...extra
});
const symbol = (file, extra = {}) => ({
	type: '2D', file: `effect/${file}.tga`, attachedEntity: true,
	duration: 1100, size: 45, posz: 28, fadeIn: true, fadeOut: true,
	alphaMax: 0.85, ...extra
});

export const legacySupportRenderEffects = {
	119: [ring('ring_yellow', { topSize: 3, bottomSize: 3.2, attachedEntity: false }),
		{ wav: 'effect/hunter_detecting' }],
	386: [ring('ring_yellow'), beam({ red: 1, green: 0.85, blue: 0.4 }),
		{ wav: 'effect/hunter_detecting', attachedEntity: true }],
	389: [0, 0.7, 1.4].map(posZ => ring('ring_white', {
		posZ, duration: 1000, rotate: true, green: 1, red: 0.65, blue: 0.8
	})).concat({ wav: 'effect/\xc0\xa9\xb5\xe5\xbf\xf6\xc5\xa9', attachedEntity: true }),
	719: [beam({ red: 0.65, green: 1, blue: 0.7 }), ring('ring_white'),
		{ wav: 'effect/ab_renovatio', attachedEntity: true }],
	753: [ring('ring_white', { animation: 3, topSize: 2, bottomSize: 2.2 }),
		beam({ animation: 3 })],
	755: [ring('ring_blue', { rotate: true, posZ: 0.8 }),
		beam({ red: 0.4, green: 0.7, blue: 1 })],
	'priest:expiatio': [symbol('expiatio'), ring('ring_yellow')],
	'priest:silentium': [ring('ring_blue', { topSize: 3, bottomSize: 3.2, attachedEntity: false })],
	ef_duplelight: [
		symbol('whitelight', { size: 20, posxStart: -24, posxEnd: 24, posz: 32 }),
		symbol('whitelight', { size: 20, posxStart: 24, posxEnd: -24, posz: 46, red: 0.5, green: 0.7 }),
		{ wav: 'effect/ab_duplelight', attachedEntity: true }
	]
};

// Success-only buffs must not flash when the server rejects the cast.
export const legacySupportSkillEffects = {
	[SK.HT_DETECTING]: { groundCastEffectId: 119 },
	[SK.SN_SIGHT]: { successEffectId: 386 },
	[SK.SN_WINDWALK]: { successEffectId: 389 },
	[SK.AB_ORATIO]: { successEffectId: 755 },
	[SK.AB_RENOVATIO]: { successEffectId: 719 },
	[SK.AB_CLEARANCE]: { successEffectId: 753 },
	[SK.AB_EXPIATIO]: { successEffectId: 'priest:expiatio' },
	[SK.AB_DUPLELIGHT]: { successEffectId: 'ef_duplelight' },
	[SK.AB_SILENTIUM]: { successEffectIdOnCaster: 'priest:silentium' }
};
