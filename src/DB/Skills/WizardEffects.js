import SK from './SkillConst.js';

const str = (file, extra = {}) => ({
	type: 'STR', file, texturePath: file.slice(0, file.lastIndexOf('/') + 1),
	attachedEntity: false, ...extra
});

// Ground casts play once at the server coordinate; hit packets only play
// target impacts. Derived skill IDs are separate packets, not aliases of casts.
export const wizardRenderEffects = {
	'wizard:comet-cast': [str('new_comet/new_comet_cast/new_comet_cast')],
	'wizard:comet': [
		str('new_comet/new_comet/new_comet'),
		str('new_comet/new_comet_bottom/new_comet_bottom', { renderBeforeEntities: true })
	],
	'wizard:soul-cast': [str('new_soulexpansion/new_soulexpansion_cast/new_soulexpansion_cast')],
	'wizard:soul-hit': [str('new_soulexpansion/new_soulexpansion_hit/new_soulexpansion_hit')],
	'wizard:jack-cast': [str('new_jackfrost/new_jackfrost_cast/new_jackfrost_cast')],
	'wizard:jack-hit': [str('new_jackfrost/new_jackfrost/new_jackfrost_00', { wav: 'effect/wl_jackfrost' })]
};

// These older spells use native procedural textures rather than STR assets.
wizardRenderEffects['wizard:frost-mist'] = [{
	type: '3D', file: 'effect/frostmisty.tga', duration: 1400,
	sizeStart: 80, sizeEnd: 180, duplicate: 12, timeBetweenDupli: 65,
	posxStartRand: 4, posyStartRand: 4, poszStart: 0, poszEnd: 1.5,
	alphaMax: 0.55, fadeOut: true, rotateWithCamera: true, attachedEntity: false,
	wav: 'effect/wl_frostmisty'
}];
wizardRenderEffects['wizard:drain-hit'] = [{
	type: '3D', file: 'effect/ring_red.tga', duration: 450,
	sizeStart: 90, sizeEnd: 15, alphaMax: 0.8, fadeOut: true,
	rotateWithCamera: true, zOffset: 1, attachedEntity: false
}];

export const wizardSkillEffects = {
	[SK.MG_THUNDERSTORM]: { groundCastEffectId: 30, hitEffectId: 52 },
	[SK.WZ_METEOR]: { groundCastEffectId: 92, hitEffectId: 49 },
	[SK.WZ_HEAVENDRIVE]: { groundCastEffectId: 142, hitEffectId: 147 },
	[SK.WL_COMET]: { beginCastEffectId: 'wizard:comet-cast', groundCastEffectId: 'wizard:comet' },
	[SK.WL_SOULEXPANSION]: { beginCastEffectId: 'wizard:soul-cast', hitEffectId: 'wizard:soul-hit' },
	[SK.WL_FROSTMISTY]: { groundCastEffectId: 'wizard:frost-mist', hitEffectId: 51 },
	[SK.WL_DRAINLIFE]: { hitEffectId: 'wizard:drain-hit' },
	[SK.WL_JACKFROST]: { beginCastEffectId: 'wizard:jack-cast', hitEffectId: 'wizard:jack-hit' }
};

for (const [element, resource] of [
	['FIRE', '01_fire'], ['WIND', '02_wind'], ['GROUND', '03_earth'], ['WATER', '04_water']
]) {
	const id = `wizard:tetra-${element}`;
	wizardRenderEffects[id] = [str(`tetravortex/tetra_${resource}_explosion/tetra_${resource}_expn`)];
	wizardSkillEffects[SK[`WL_TETRAVORTEX_${element}`]] = { hitEffectId: id };
	wizardSkillEffects[SK[`WL_SUMMON_ATK_${element}`]] = { hitEffectId: id };
}
