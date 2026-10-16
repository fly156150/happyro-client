import SK from './SkillConst.js';
import SU from './SkillUnitConst.js';

const str = (file, extra = {}) => ({
	type: 'STR', file, texturePath: file.slice(0, file.lastIndexOf('/') + 1),
	attachedEntity: false, ...extra
});

// One-shot fields use the server's ground coordinate. Psychic Wave is a
// persistent skill unit; its animation stops when that unit is removed.
export const sorcererRenderEffects = {
	'sorcerer:earth': [
		str('new_earthgrave/new_earthgrave/new_earthgrave'),
		str('new_earthgrave/new_earthgrave_bottom/new_earthgrave_bottom', { renderBeforeEntities: true })
	],
	'sorcerer:earth-hit': [str('new_earthgrave/new_earthgrave_hit/new_earthgrave_hit')],
	'sorcerer:diamond-cast': [str('new_diamonddust/new_diamonddust_cast/new_diamonddust_cast')],
	'sorcerer:diamond': [
		str('new_diamonddust/new_diamonddust/new_diamonddust', { wav: 'effect/wl_jackfrost' }),
		str('new_diamonddust/new_diamonddust_bottom/new_diamonddust_bottom', { renderBeforeEntities: true })
	],
	'sorcerer:psychic-cast': [str('new_psychicwave/new_psychicwave_cast/new_psychicwave_cast')],
	'sorcerer:psychic-unit': [
		str('new_psychicwave/new_psychicwave/new_psychicwave', { repeat: true }),
		str('new_psychicwave/new_psychicwave_bottom/new_psychicwave_bottom', { repeat: true, renderBeforeEntities: true })
	]
};

export const sorcererSkillEffects = {
	[SK.SO_EARTHGRAVE]: { groundCastEffectId: 'sorcerer:earth', hitEffectId: 'sorcerer:earth-hit' },
	[SK.SO_DIAMONDDUST]: { beginCastEffectId: 'sorcerer:diamond-cast', groundCastEffectId: 'sorcerer:diamond' },
	[SK.SO_PSYCHIC_WAVE]: { beginCastEffectId: 'sorcerer:psychic-cast', groundCastEffectId: 922 }
};
export const sorcererGroundUnits = { [SU.UNT_PSYCHIC_WAVE]: 'sorcerer:psychic-unit' };
