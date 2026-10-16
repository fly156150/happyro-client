import SK from './SkillConst.js';

const str = (file, extra = {}) => ({
	type: 'STR', file, texturePath: file.slice(0, file.lastIndexOf('/') + 1),
	attachedEntity: false, ...extra
});

// The modern server sends one success notification before splash damage.
// Area visuals snapshot that notification; individual victims only get impacts.
export const crusaderRenderEffects = {
	'crusader:overbrand-cast': [
		str('new_overbrand/new_overbrand_cast/new_overbrand_cast'),
		str('new_overbrand/new_overbrand_cast_bottom/new_overbrand_cast_bottom', { renderBeforeEntities: true })
	],
	'crusader:overbrand-hit': [str('new_overbrand/new_overbrand_hit/new_overbrand_hit')],
	'crusader:banishing-hit': [
		str('new_banishingpoint/new_banishingpoint_target/new_banishingpoint_target', { wav: 'effect/lg_banishingpoint' }),
		str('new_banishingpoint/new_banishingpoint_target_bottom/new_banishingpoint_target_bottom', { renderBeforeEntities: true })
	],
	'crusader:earth': [
		str('new_earthdrive/new_earthdrive/new_earthdrive', { wav: 'effect/lg_earthdrive' }),
		str('new_earthdrive/new_earthdrive_bottom/new_earthdrive_bottom', { renderBeforeEntities: true })
	],
	'crusader:earth-hit': [str('new_earthdrive/new_earthdrive_target/new_earthdrive_target')],
	'crusader:genesis-cast': [
		str('new_rayofgenesis/new_rayofgenesis_cast/new_rayofgenesis_cast'),
		str('new_rayofgenesis/new_rayofgenesis_cast_bottom/new_rayofgenesis_cast_bottom', { renderBeforeEntities: true })
	],
	'crusader:genesis': [str('new_rayofgenesis/new_rayofgenesis/new_rayofgenesis', { wav: 'effect/lg_rayofgenesis' })],
	'crusader:genesis-hit': [str('new_rayofgenesis/new_rayofgenesis_hit/new_rayofgenesis_hit')],
	'crusader:guardian': [
		str('guardianshield/guardianshield/guardianshield', { attachedEntity: true }),
		str('guardianshield/guardianshield_bottom/guardianshield_bottom', { attachedEntity: true, renderBeforeEntities: true })
	]
};

export const crusaderSkillEffects = {
	[SK.LG_BANISHINGPOINT]: { hitEffectId: 'crusader:banishing-hit' },
	[SK.LG_OVERBRAND]: {
		beginCastEffectId: 'crusader:overbrand-cast',
		successEffectId: 'ef_overbrand', hitEffectId: 'crusader:overbrand-hit'
	},
	[SK.LG_EARTHDRIVE]: { successEffectId: 'crusader:earth', hitEffectId: 'crusader:earth-hit' },
	[SK.LG_RAYOFGENESIS]: {
		beginCastEffectId: 'crusader:genesis-cast',
		successEffectId: 'crusader:genesis', hitEffectId: 'crusader:genesis-hit'
	},
	[SK.IG_GUARDIAN_SHIELD]: { successEffectId: 'crusader:guardian' }
};
