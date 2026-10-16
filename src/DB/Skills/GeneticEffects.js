import SK from './SkillConst.js';

const str = (file, extra = {}) => ({
	type: 'STR', file, texturePath: file.slice(0, file.lastIndexOf('/') + 1),
	attachedEntity: false, ...extra
});
const layers = (directory, name) => [
	str(`${directory}/${name}/${name}`),
	str(`${directory}/${name}_bottom/${name}_bottom`, { renderBeforeEntities: true })
];

export const geneticRenderEffects = {
	'genetic:cart-tornado': layers('new_cart_tornado', 'new_cart_tornado'),
	'genetic:cart-cannon-cast': layers('new_cart_cannon', 'new_cart_cannon_cast'),
	'genetic:cart-cannon-fire': layers('new_cart_cannon', 'new_cart_cannon_fire'),
	'genetic:cart-cannon-hit': layers('new_cart_cannon', 'new_cart_cannon_explosion'),
	'genetic:cart-boost': layers('new_cartboost', 'new_cartboost'),
	'genetic:mandragora-cast': [str('new_mandragora/new_mandragora_cast/new_mandragora_cast')],
	'genetic:mandragora': layers('new_mandragora', 'new_mandragora'),
	'genetic:thorn-cast': layers('new_wallofthorn', 'new_wallofthorn_cast'),
	'genetic:blast-hit': [str('blast_forge/blast_forge_hit/blast_forge_hit')],
	'genetic:twister-hit': [str('twister_cutter/twister_cutter_hit/twister_cutter_hit')],
	'genetic:zephyr-hit': [str('absolute_zephyr/absolute_zephyr_hit/absolute_zephyr_hit')],
	'genetic:blazing-hit': [str('blazing_and_furious/blazing_and_furious/blazing_and_furious')],
	'genetic:fighter': [str('the_one_fighter_rises/the_one_fighter_rises_bottom/the_one_fighter_rises_bottom', { renderBeforeEntities: true })],
	'genetic:mandara-hit': layers('toxin_of_mandara', 'toxin_of_mandara_bomb'),
	'genetic:needle-hit': [str('needle_stinger/needle_stinger_hit/needle_stinger_hit')],
	'genetic:glanzen-hit': [str('glanzen_spies/glanzen_spies_hit/glanzen_spies_hit')],
	'genetic:pferd-cast': [str('heilige_pferd/heilige_pferd_cast/heilige_pferd_cast')],
	'genetic:pferd': layers('heilige_pferd', 'heilige_pferd'),
	'genetic:tone': [str('goldene_tone/goldene_tone/goldene_tone')]
};

// Server success packets activate caster effects once; splash damage packets
// only play victim impacts. Ground casts keep their explicit map coordinate.
export const geneticSkillEffects = {
	[SK.GN_CART_TORNADO]: { successEffectIdOnCaster: 'genetic:cart-tornado' },
	[SK.GN_CARTCANNON]: {
		beginCastEffectId: 'genetic:cart-cannon-cast',
		successEffectIdOnCaster: 'genetic:cart-cannon-fire',
		hitEffectId: 'genetic:cart-cannon-hit'
	},
	[SK.GN_CARTBOOST]: { successEffectId: 'genetic:cart-boost' },
	[SK.GN_MANDRAGORA]: {
		beginCastEffectId: 'genetic:mandragora-cast', successEffectIdOnCaster: 'genetic:mandragora'
	},
	[SK.GN_WALLOFTHORN]: { groundCastEffectId: 'genetic:thorn-cast' },
	[SK.MH_BLAST_FORGE]: { hitEffectId: 'genetic:blast-hit' },
	[SK.MH_TWISTER_CUTTER]: { hitEffectId: 'genetic:twister-hit' },
	[SK.MH_ABSOLUTE_ZEPHYR]: { hitEffectId: 'genetic:zephyr-hit' },
	[SK.MH_BLAZING_AND_FURIOUS]: { hitEffectId: 'genetic:blazing-hit' },
	[SK.MH_THE_ONE_FIGHTER_RISES]: { successEffectIdOnCaster: 'genetic:fighter' },
	[SK.MH_TOXIN_OF_MANDARA]: { hitEffectId: 'genetic:mandara-hit' },
	[SK.MH_NEEDLE_STINGER]: { hitEffectId: 'genetic:needle-hit' },
	[SK.MH_GLANZEN_SPIES]: { hitEffectId: 'genetic:glanzen-hit' },
	[SK.MH_HEILIGE_PFERD]: { beginCastEffectId: 'genetic:pferd-cast', successEffectIdOnCaster: 'genetic:pferd' },
	[SK.MH_GOLDENE_TONE]: { successEffectId: 'genetic:tone' }
};
